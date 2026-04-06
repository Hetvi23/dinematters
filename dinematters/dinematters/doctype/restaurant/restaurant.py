# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import urllib.request
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_url
from dinematters.dinematters.doctype.restaurant.qr_branding import build_table_qr_assets


class Restaurant(Document):
	def autoname(self):
		"""Auto-generate restaurant_id and set as name"""
		if not self.restaurant_id and self.restaurant_name:
			self.restaurant_id = self.generate_restaurant_id()
		if self.restaurant_id:
			self.name = self.restaurant_id
	
	def validate(self):
		"""Validate restaurant data"""
		# Auto-generate restaurant_id if not provided (before autoname)
		if not self.restaurant_id and self.restaurant_name:
			self.restaurant_id = self.generate_restaurant_id()
		
		# Auto-generate slug if not provided
		if not self.slug and self.restaurant_id:
			self.slug = self.restaurant_id.lower().replace(" ", "-")
		
		# Auto-generate subdomain if not provided
		if not self.subdomain and self.restaurant_id:
			self.subdomain = self.restaurant_id.lower().replace(" ", "-")
		
		# Validate plan change (admin-only)
		self.validate_plan_change()
		
		# Prevent non-admin reactivation if suspended for billing
		self.validate_billing_reactivation()
		
		# Note: QR codes are no longer auto-generated on table update
		# They must be explicitly generated via the generate_qr_codes_pdf method
	
	def validate_plan_change(self):
		"""Validate subscription plan changes - admin only"""
		if not self.is_new() and self.has_value_changed('plan_type'):
			# Check if user has permission to change plan
			if not frappe.has_permission('Restaurant', 'write'):
				frappe.throw(_('You do not have permission to change subscription plans'))
			
			# Only System Manager and specific roles can change plans
			allowed_roles = ['System Manager', 'Administrator']
			user_roles = frappe.get_roles(frappe.session.user)
			
			if not any(role in allowed_roles for role in user_roles):
				frappe.throw(
					_('Only administrators can change subscription plans. Please contact support.'),
					frappe.PermissionError
				)
			
			# Set plan metadata
			self.plan_changed_by = frappe.session.user
			self.plan_activated_on = frappe.utils.now()

			# Auto-set billing defaults for the new plan
			settings = frappe.get_single("Dinematters Settings")
			if self.plan_type == "DIAMOND":
				self.monthly_minimum = settings.diamond_monthly_floor or 1299.0
				self.platform_fee_percent = settings.diamond_commission_percent or 1.5
			elif self.plan_type == "GOLD":
				self.monthly_minimum = settings.gold_monthly_fee or 999.0
				self.platform_fee_percent = 0.0
			elif self.plan_type == "SILVER":
				self.monthly_minimum = 0.0
				self.platform_fee_percent = 0.0
			
			# Waiver individual feature fees for GOLD/DIAMOND (they are included)
			if self.plan_type in ["GOLD", "DIAMOND"]:
				frappe.db.set_value("Restaurant Config", {"restaurant": self.name}, "menu_theme_paid_until", None)
			
			# Log the change (will be created in on_update)
			self._plan_changed = True
	
	def log_plan_change(self):
		"""Create audit log for plan changes"""
		if not hasattr(self, '_plan_changed') or not self._plan_changed:
			return
		
		try:
			# Get previous plan from database
			previous_plan = frappe.db.get_value('Restaurant', self.name, 'plan_type')
			
			# Create Plan Change Log
			plan_change_log = frappe.get_doc({
				'doctype': 'Plan Change Log',
				'restaurant': self.name,
				'previous_plan': previous_plan,
				'new_plan': self.plan_type,
				'changed_by': frappe.session.user,
				'changed_on': frappe.utils.now(),
				'change_reason': self.plan_change_reason or '',
				'ip_address': frappe.local.request_ip or 'Unknown'
			})
			plan_change_log.insert(ignore_permissions=True)
			
			# Update plan change history JSON
			if not self.plan_change_history:
				self.plan_change_history = []
			
			history_entry = {
				'date': frappe.utils.now(),
				'from': previous_plan,
				'to': self.plan_type,
				'by': frappe.session.user,
				'reason': self.plan_change_reason or ''
			}
			
			import json
			if isinstance(self.plan_change_history, str):
				self.plan_change_history = json.loads(self.plan_change_history or '[]')
			
			if not self.plan_change_history:
				self.plan_change_history = []
			
			self.plan_change_history.append(history_entry)
			
			# Use db_set to avoid recursion in on_update and bypass strict list validation if it occurs
			self.db_set('plan_change_history', json.dumps(self.plan_change_history), update_modified=False)
			
			frappe.msgprint(
				_('Subscription plan changed from {0} to {1}').format(previous_plan, self.plan_type),
				indicator='green'
			)
			
		except Exception as e:
			frappe.log_error(f'Error logging plan change: {str(e)}', 'Plan Change Log Error')

	def validate_billing_reactivation(self):
		"""
		Prevent non-admins from toggling 'is_active' to 1 if the account 
		was suspended for billing reasons.
		"""
		if not self.is_new() and self.has_value_changed('is_active') and self.is_active:
			# If it's currently suspended/overdue, only System Manager can re-enable
			if self.billing_status in ["suspended", "overdue"]:
				allowed_roles = ['System Manager', 'Administrator']
				user_roles = frappe.get_roles(frappe.session.user)
				
				if not any(role in allowed_roles for role in user_roles):
					frappe.throw(
						_("This restaurant is suspended due to billing. Only an administrator can reactivate it. Please clear dues and contact support."),
						frappe.PermissionError
					)

	def suspend_restaurant_billing(self, reason="Insufficient Balance"):
		"""
		Automatically deactivate restaurant for billing failure.
		Hard Lock: Sets is_active=0 and billing_status=suspended.
		"""
		if self.billing_status == "suspended" and not self.is_active:
			return # Already suspended
			
		self.is_active = 0
		self.billing_status = "suspended"
		
		# Log the reason
		self.add_comment("Comment", text=f"⚠️ System Auto-Suspension: {reason} (Balance below -₹300)")
		self.save(ignore_permissions=True)
		frappe.db.commit()
		
		# Notify owner (optional but recommended)
		frappe.log_error(f"Billing Suspension: {self.name} deactivated due to {reason}", "Billing Enforcement")
	
	def generate_restaurant_id(self):
		"""Generate unique restaurant_id from restaurant_name"""
		import re
		from frappe.utils import cstr
		
		# Create base ID from restaurant name
		base_id = self.restaurant_name.strip()
		# Remove special characters, keep only alphanumeric and spaces
		base_id = re.sub(r'[^a-zA-Z0-9\s-]', '', base_id)
		# Replace spaces and multiple hyphens with single hyphen
		base_id = re.sub(r'[\s-]+', '-', base_id)
		# Convert to lowercase
		base_id = base_id.lower()
		# Remove leading/trailing hyphens
		base_id = base_id.strip('-')
		
		# Ensure it's not empty
		if not base_id:
			base_id = "restaurant"
		
		# Check if restaurant_id already exists, append number if needed
		restaurant_id = base_id
		counter = 1
		while frappe.db.exists("Restaurant", {"restaurant_id": restaurant_id}):
			restaurant_id = f"{base_id}-{counter}"
			counter += 1
		
		return restaurant_id
	
	def after_insert(self):
		"""Auto-assign owner when restaurant is created"""
		if self.owner_email:
			self.auto_assign_owner()
		
		# Auto-create Restaurant Config for new restaurants
		create_restaurant_config(self)
		
		# Auto-create default Home Features for new restaurants
		create_default_home_features(self)
		
		# Initialize free signup coins (60 coins)
		from dinematters.dinematters.api.coin_billing import initialize_free_coins
		initialize_free_coins(self.name)
		
		# Generate QR codes if tables field is set
		if hasattr(self, "_generate_qr_codes") and self._generate_qr_codes:
			if self.tables and self.tables > 0:
				self.generate_table_qr_codes_pdf()
	
	def on_update(self):
		"""Called after document is updated"""
		# Log plan changes
		self.log_plan_change()
		
		# QR codes are no longer auto-generated here
		# They must be explicitly generated via the generate_qr_codes_pdf method
		pass
	
	def auto_assign_owner(self):
		"""Auto-create User, Restaurant User and User Permission for owner"""
		try:
			# Find user by email
			user = frappe.db.get_value("User", {"email": self.owner_email}, "name")
			
			# If user doesn't exist, create it
			if not user:
				user = self.create_owner_user()
				if not user:
					return  # Error already logged and messaged
			
			# Check if Restaurant User already exists
			if frappe.db.exists("Restaurant User", {"user": user, "restaurant": self.name}):
				frappe.msgprint(f"Owner {self.owner_email} is already assigned to this restaurant")
				return
			
			# Create Restaurant User (this will auto-create User Permission via Restaurant User hooks)
			from dinematters.dinematters.utils.permissions import assign_user_to_restaurant
			
			restaurant_user = assign_user_to_restaurant(
				user=user,
				restaurant=self.name,
				role="Restaurant Admin",
				is_default=1
			)
			
			# Verify User Permission was created
			user_permission_exists = frappe.db.exists("User Permission", {
				"user": user,
				"allow": "Restaurant",
				"for_value": self.name
			})
			
			if user_permission_exists:
				frappe.msgprint(
					f"✅ Owner {self.owner_email} has been created and assigned to this restaurant with Restaurant Admin role. User Permission created successfully.",
					indicator="green"
				)
			else:
				frappe.msgprint(
					f"⚠️ Restaurant User created but User Permission may not be created. Please verify.",
					indicator="orange"
				)
				
		except Exception as e:
			frappe.log_error(f"Error assigning owner to restaurant: {str(e)}", "Restaurant Owner Assignment")
			frappe.msgprint(
				f"Error assigning owner: {str(e)}. Please assign manually via Restaurant User.",
				indicator="red"
			)
	
	def create_owner_user(self):
		"""Create User account from owner information"""
		try:
			from frappe.utils import random_string
			
			# Parse owner_name into first_name and last_name
			first_name = ""
			last_name = ""
			if self.owner_name:
				name_parts = self.owner_name.strip().split(maxsplit=1)
				first_name = name_parts[0] if name_parts else ""
				last_name = name_parts[1] if len(name_parts) > 1 else ""
			else:
				# Use email prefix as first name if name not provided
				first_name = self.owner_email.split("@")[0]
			
			# Generate username from email (use email as username)
			username = self.owner_email
			
			# Check if username already exists (different email but same username)
			if frappe.db.exists("User", {"name": username}):
				# Append random string if username exists
				username = f"{self.owner_email.split('@')[0]}-{random_string(4).lower()}"
			
			# Create User
			user_doc = frappe.get_doc({
				"doctype": "User",
				"email": self.owner_email,
				"first_name": first_name,
				"last_name": last_name,
				"mobile_no": self.owner_phone if self.owner_phone else None,
				"send_welcome_email": 1,  # Send welcome email with password reset link
				"user_type": "System User",
				"enabled": 1
			})
			
			# Set username (name field)
			user_doc.name = username
			
			# Insert user
			user_doc.insert(ignore_permissions=True)
			
			# Send welcome email (Frappe will send password reset link)
			try:
				user_doc.send_welcome_mail_to_user()
			except Exception as email_error:
				# Log error but don't fail the process
				pass
			
			frappe.msgprint(
				f"✅ User account created for {self.owner_email}. Welcome email sent with password reset link.",
				indicator="blue"
			)
			
			return user_doc.name
			
		except frappe.DuplicateEntryError:
			# User might have been created between check and insert
			user = frappe.db.get_value("User", {"email": self.owner_email}, "name")
			if user:
				frappe.msgprint(f"User {self.owner_email} already exists. Proceeding with assignment.")
				return user
			else:
				frappe.msgprint(
					f"Error creating user account. Please create user manually and assign via Restaurant User.",
					indicator="red"
				)
				return None
		except Exception as e:
			error_msg = str(e)[:100]  # Truncate error message
			frappe.msgprint(
				f"Error creating user: {error_msg}. Please create user manually.",
				indicator="red"
			)
			return None

	def generate_table_qr_codes_pdf(self):
		"""Generate PDF with QR codes for all tables"""
		try:
			import os
			import tempfile
			from io import BytesIO
			from dinematters.dinematters.media.storage import download_object
			from reportlab.lib.pagesizes import A4
			from reportlab.lib.units import inch
			from reportlab.pdfgen import canvas
			from reportlab.lib.utils import ImageReader

			assets = build_table_qr_assets(self, force=True)

			pdf_buffer = BytesIO()
			pdf_canvas = canvas.Canvas(pdf_buffer, pagesize=A4)

			page_width, page_height = A4
			card_width = 4.4 * inch
			card_height = 5.85 * inch

			for index, asset in enumerate(assets, start=1):
				with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
					temp_path = temp_file.name
				try:
					download_object(asset["png_object_key"], temp_path)
					# Compress image to reduce PDF size
					from PIL import Image
					with Image.open(temp_path) as img:
						# Convert to RGB and compress as JPEG
						if img.mode in ('RGBA', 'LA', 'P'):
							rgb_img = Image.new('RGB', img.size, (255, 255, 255))
							if img.mode == 'P':
								img = img.convert('RGBA')
							rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
							img = rgb_img
						else:
							img = img.convert('RGB')
						
						card_buffer = BytesIO()
						img.save(card_buffer, format='JPEG', quality=85, optimize=True)
						card_buffer.seek(0)
				finally:
					if os.path.exists(temp_path):
						os.remove(temp_path)
				x = (page_width - card_width) / 2
				y = (page_height - card_height) / 2 + 0.1 * inch
				pdf_canvas.drawImage(ImageReader(card_buffer), x, y, width=card_width, height=card_height)
				pdf_canvas.setFont("Helvetica", 10)
				pdf_canvas.drawCentredString(page_width / 2, y - 0.18 * inch, asset["qr_data"])
				if index < len(assets):
					pdf_canvas.showPage()

			pdf_canvas.save()
			pdf_buffer.seek(0)

			file_name = f"{self.restaurant_id}_table_qr_codes.pdf"

			existing_files = frappe.get_all(
				"File",
				{
					"file_name": file_name,
					"attached_to_doctype": "Restaurant",
					"attached_to_name": self.name,
				},
				["name"],
			)

			for file_doc in existing_files:
				try:
					frappe.delete_doc("File", file_doc.name, ignore_permissions=True, force=True)
					frappe.db.commit()
				except Exception as e:
					frappe.log_error(
						f"Error deleting existing QR code file {file_doc.name}: {str(e)}",
						"QR Code File Deletion",
					)
			
			# Clear the qr_codes_pdf_url field when PDF is deleted
			try:
				if frappe.db.has_column("Restaurant", "qr_codes_pdf_url"):
					self.db_set("qr_codes_pdf_url", "", update_modified=False)
			except Exception:
				pass

			import time

			timestamp = int(time.time())

			file_doc = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": file_name,
					"content": pdf_buffer.getvalue(),
					"is_private": 0,
					"attached_to_doctype": "Restaurant",
					"attached_to_name": self.name,
				}
			)
			file_doc.save(ignore_permissions=True)

			self._last_table_qr_assets = assets
			frappe.msgprint(
				f"✅ QR codes PDF generated successfully for {self.tables} tables. File: {file_name}",
				indicator="green",
			)

			file_url = file_doc.file_url
			if "?" in file_url:
				file_url += f"&t={timestamp}"
			else:
				file_url += f"?t={timestamp}"

			try:
				if frappe.db.has_column("Restaurant", "qr_codes_pdf_url"):
					self.db_set("qr_codes_pdf_url", file_url, update_modified=False)
			except Exception:
				pass

			return file_url

		except ImportError:
			frappe.throw(_("Required libraries not installed. Please install: pip install qrcode[pil] reportlab"))
		except Exception as e:
			frappe.log_error(f"Error generating QR codes PDF: {str(e)}", "Restaurant QR Code Generation")
			frappe.msgprint(
				f"Error generating QR codes PDF: {str(e)}",
				indicator="red",
			)
			raise
	
	@frappe.whitelist()
	def get_qr_codes_pdf_url(self):
		"""Get the URL of the QR codes PDF if it exists"""
		file_name = f"{self.restaurant_id}_table_qr_codes.pdf"
		
		# First check if File record exists
		existing_file = frappe.db.get_value("File", {
			"file_name": file_name,
			"attached_to_doctype": "Restaurant",
			"attached_to_name": self.name
		}, ["file_url", "name"], as_dict=True)
		
		if existing_file and existing_file.file_url:
			# Verify the file actually exists in storage
			try:
				from dinematters.dinematters.media.storage import verify_object_exists
				import os
				
				# If it's a local file, check if it exists
				if existing_file.file_url.startswith("/files/"):
					file_path = os.path.join(frappe.get_site_path(), existing_file.file_url[1:])
					if os.path.exists(file_path):
						return existing_file.file_url
					else:
						# File doesn't exist, delete the File record
						frappe.delete_doc("File", existing_file.name, ignore_permissions=True, force=True)
						frappe.db.commit()
						# Clear the URL field
						if frappe.db.has_column("Restaurant", "qr_codes_pdf_url"):
							self.db_set("qr_codes_pdf_url", "", update_modified=False)
				else:
					# For CDN files, we assume the URL is valid if File record exists
					return existing_file.file_url
			except Exception:
				pass
		
		# Check the qr_codes_pdf_url field as fallback, but validate it
		doc_url = frappe.db.get_value("Restaurant", self.name, "qr_codes_pdf_url")
		if doc_url:
			# Verify this URL is still valid by checking if File record exists
			file_exists = frappe.db.exists("File", {
				"file_name": file_name,
				"attached_to_doctype": "Restaurant", 
				"attached_to_name": self.name
			})
			if not file_exists:
				# Clear the invalid URL
				if frappe.db.has_column("Restaurant", "qr_codes_pdf_url"):
					self.db_set("qr_codes_pdf_url", "", update_modified=False)
				doc_url = None
		
		return doc_url if doc_url else None

	@frappe.whitelist()
	def delete_qr_codes_pdf(self):
		"""Delete the QR codes PDF file"""
		try:
			file_name = f"{self.restaurant_id}_table_qr_codes.pdf"
			
			# Find and delete all File records
			existing_files = frappe.get_all(
				"File",
				{
					"file_name": file_name,
					"attached_to_doctype": "Restaurant",
					"attached_to_name": self.name,
				},
				["name"],
			)
			
			deleted_count = 0
			for file_doc in existing_files:
				try:
					frappe.delete_doc("File", file_doc.name, ignore_permissions=True, force=True)
					deleted_count += 1
				except Exception as e:
					frappe.log_error(
						f"Error deleting QR code file {file_doc.name}: {str(e)}",
						"QR Code File Deletion",
					)
			
			# Clear the qr_codes_pdf_url field
			try:
				if frappe.db.has_column("Restaurant", "qr_codes_pdf_url"):
					self.db_set("qr_codes_pdf_url", "", update_modified=False)
			except Exception:
				pass
			
			frappe.db.commit()
			
			if deleted_count > 0:
				frappe.msgprint(
					f"✅ QR codes PDF deleted successfully ({deleted_count} file(s) removed)",
					indicator="green",
				)
			else:
				frappe.msgprint(
					"No QR codes PDF found to delete",
					indicator="orange",
				)
			
			return True
			
		except Exception as e:
			frappe.log_error(f"Error deleting QR codes PDF: {str(e)}", "QR Code PDF Deletion")
			frappe.msgprint(
				f"Error deleting QR codes PDF: {str(e)}",
				indicator="red",
			)
			return False

	@frappe.whitelist()
	def get_table_qr_assets(self, force=False):
		assets = build_table_qr_assets(self, force=frappe.utils.cint(force))
		return {
			"restaurant": self.name,
			"restaurant_id": self.restaurant_id,
			"tables": len(assets),
			"items": assets,
		}
	
@frappe.whitelist()
def get_qr_codes_pdf_url(restaurant):
	"""Get QR codes PDF URL for a restaurant"""
	try:
		restaurant_doc = frappe.get_doc("Restaurant", restaurant)
		pdf_url = restaurant_doc.get_qr_codes_pdf_url()
		return {
			"status": "success",
			"pdf_url": pdf_url
		}
	except Exception as e:
		frappe.log_error(f"Error getting QR codes PDF URL: {str(e)}", "QR Code URL Retrieval")
		return {
			"status": "error",
			"message": str(e)
		}


@frappe.whitelist()
def get_table_qr_assets(restaurant, force=0):
	restaurant_doc = frappe.get_doc("Restaurant", restaurant)
	return restaurant_doc.get_table_qr_assets(force=force)


@frappe.whitelist()
def delete_qr_codes_pdf(restaurant):
	"""Delete QR codes PDF for a restaurant"""
	try:
		restaurant_doc = frappe.get_doc("Restaurant", restaurant)
		result = restaurant_doc.delete_qr_codes_pdf()
		return {
			"status": "success",
			"message": "QR codes PDF deleted successfully"
		}
	except Exception as e:
		frappe.log_error(f"Error deleting QR codes PDF: {str(e)}", "QR Code Deletion")
		return {
			"status": "error",
			"message": str(e)
		}


@frappe.whitelist()
def generate_qr_codes_pdf(restaurant):
	"""Generate QR codes PDF for a restaurant"""
	try:
		restaurant_doc = frappe.get_doc("Restaurant", restaurant)
		pdf_url = restaurant_doc.generate_table_qr_codes_pdf()
		return {
			"status": "success",
			"message": f"QR codes PDF generated successfully",
			"pdf_url": pdf_url
		}
	except Exception as e:
		frappe.log_error(f"Error generating QR codes PDF: {str(e)}", "QR Code Generation")
		return {
			"status": "error",
			"message": str(e)
		}


def create_restaurant_config(self):
	"""Create Restaurant Config record for new restaurant"""
	try:
		# Check if Restaurant Config already exists
		existing_config = frappe.db.exists("Restaurant Config", {"restaurant": self.name})
		if existing_config:
			return
		
		# Create Restaurant Config with default values
		config_doc = frappe.get_doc({
			"doctype": "Restaurant Config",
			"restaurant": self.name,
			"restaurant_name": self.restaurant_name,
			"tagline": "",
			"subtitle": "",
			"description": self.description or "",
			"primary_color": "#DB782F",
			"default_theme": "light",
			"logo": self.logo or "",
			"hero_video": "",
			"apple_touch_icon": "",
			"currency": self.currency or "INR",
			"menu_layout": "2 Columns",
			# Enable transactional features only for DIAMOND subscription plan
			"enable_table_booking": 1 if self.plan_type == "DIAMOND" else 0,
			"enable_banquet_booking": 1 if self.plan_type == "DIAMOND" else 0,
			"enable_events": 1 if self.plan_type == "DIAMOND" else 0,
			"enable_offers": 1 if self.plan_type == "DIAMOND" else 0,
			"enable_coupons": 1 if self.plan_type == "DIAMOND" else 0,
			"enable_experience_lounge": 1 if self.plan_type == "DIAMOND" else 0,
			"verify_my_user": 0,
			"google_review_link": "",
			"instagram_profile_link": "",
			"facebook_profile_link": "",
			"whatsapp_phone_number": self.owner_phone or ""
		})
		config_doc.insert(ignore_permissions=True)
		
	except Exception as e:
		frappe.log_error(f"Error creating Restaurant Config for {self.name}: {str(e)}", "Restaurant Config Creation Error")


def create_default_home_features(self):
	"""Create default Home Features for new restaurant"""
	try:
		# Check if Home Features already exist
		existing_features = frappe.get_all("Home Feature", filters={"restaurant": self.name})
		if existing_features:
			return
		
		# Ensure SVG files exist in File doctype
		self.ensure_svg_files_exist()
		
		# Create default Home Features
		default_features = [
			{"feature_id": "menu", "title": "Explore our Menu", "subtitle": "Food, Taste, Love",
			 "image_src": "/files/explore.svg", "route": "/main-menu", "size": "large", "is_mandatory": 1},
			{"feature_id": "book-table", "title": "Book your Tables", "subtitle": "& banquets",
			 "image_src": "/files/book-table.svg", "route": "/book-table", "size": "small", "is_mandatory": 0},
			{"feature_id": "legacy", "title": "The Place", "subtitle": "& it's legacy",
			 "image_src": "/files/legacy.svg", "route": "/legacy", "size": "small", "is_mandatory": 1},
			{"feature_id": "offers-events", "title": "Offers & Events", "subtitle": "Treasure mine.",
			 "image_src": "/files/events-offers.svg", "route": "/events", "size": "small", "is_mandatory": 0},
			{"feature_id": "dine-play", "title": "Dine & Play", "subtitle": "Enjoy your bites",
			 "image_src": "/files/experience-lounge.svg", "route": "/experience-lounge-splash", "size": "small", "is_mandatory": 0}
		]
		
		for idx, feat in enumerate(default_features, 1):
			# Features enabled logic:
			# - Mandatory features (menu, legacy) are always enabled.
			# - Transactional features (book-table, offers, lounge) are DIAMOND only.
			if feat["is_mandatory"] == 1:
				is_enabled = True
			else:
				# These are the premium transactional features
				is_enabled = (self.plan_type == "DIAMOND")
			
			feat_doc = frappe.get_doc({
				"doctype": "Home Feature",
				"restaurant": self.name,
				"feature_id": feat["feature_id"],
				"title": feat["title"],
				"subtitle": feat.get("subtitle", ""),
				"image_src": feat.get("image_src", ""),
				"image_alt": feat.get("title", ""),
				"route": feat.get("route", ""),
				"size": feat.get("size", "small"),
				"is_enabled": 1 if is_enabled else 0,
				"is_mandatory": feat.get("is_mandatory", 0),
				"display_order": idx
			})
			feat_doc.insert(ignore_permissions=True)
			
	except Exception as e:
		frappe.log_error(f"Error creating default Home Features for {self.name}: {str(e)}", "Home Features Creation Error")


def ensure_svg_files_exist(self):
	"""Ensure SVG files exist in File doctype"""
	import os
	
	svg_files = [
		{"filename": "legacy.svg", "source_path": "./apps/ono-menu/public/images/ui/legacy.svg"},
		{"filename": "experience-lounge.svg", "source_path": "./apps/ono-menu/public/images/ui/experience-lounge.svg"},
		{"filename": "events-offers.svg", "source_path": "./apps/ono-menu/public/images/ui/events-offers.svg"},
		{"filename": "explore.svg", "source_path": "./apps/ono-menu/public/images/ui/explore.svg"},
		{"filename": "book-table.svg", "source_path": "./apps/ono-menu/public/images/ui/book-table.svg"}
	]
	
	for svg in svg_files:
		try:
			# Check if File record already exists
			existing_file = frappe.db.get_value("File", {"file_name": svg["filename"]})
			if existing_file:
				continue
			
			# Check if source file exists
			if not os.path.exists(svg["source_path"]):
				continue
			
			# Copy to public/files if not exists
			target_path = f"./sites/dine_matters/public/files/{svg['filename']}"
			if not os.path.exists(target_path):
				import shutil
				shutil.copy2(svg["source_path"], target_path)
			
			# Read file content
			with open(svg["source_path"], 'rb') as f:
				content = f.read()
			
			# Create File doc
			file_doc = frappe.get_doc({
				"doctype": "File",
				"file_name": svg["filename"],
				"file_url": f"/files/{svg['filename']}",
				"is_private": 0,
				"content": content
			})
			file_doc.insert(ignore_permissions=True)
			
		except Exception as e:
			frappe.log_error(f"Error ensuring SVG file {svg['filename']}: {str(e)}", "SVG File Creation Error")

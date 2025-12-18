# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_url


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
		
		# Check if tables field changed and generate QR codes
		if self.has_value_changed("tables") and self.tables and self.tables > 0:
			# Generate QR codes after save
			self._generate_qr_codes = True
	
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
		
		# Generate QR codes if tables field is set
		if hasattr(self, "_generate_qr_codes") and self._generate_qr_codes:
			if self.tables and self.tables > 0:
				self.generate_table_qr_codes_pdf()
	
	def on_update(self):
		"""Generate QR codes when tables field is updated"""
		if hasattr(self, "_generate_qr_codes") and self._generate_qr_codes:
			if self.tables and self.tables > 0:
				self.generate_table_qr_codes_pdf()
	
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
			import qrcode
			from io import BytesIO
			from reportlab.lib.pagesizes import letter, A4
			from reportlab.lib.units import inch
			from reportlab.pdfgen import canvas
			from reportlab.lib.utils import ImageReader
			from PIL import Image
			import os
			
			if not self.restaurant_id:
				frappe.throw(_("Restaurant ID is required to generate QR codes"))
			
			if not self.tables or self.tables <= 0:
				frappe.throw(_("Number of tables must be greater than 0"))
			
			# Create a BytesIO buffer for the PDF
			pdf_buffer = BytesIO()
			pdf_canvas = canvas.Canvas(pdf_buffer, pagesize=A4)
			
			# Page dimensions
			page_width, page_height = A4
			margin = 0.5 * inch
			qr_size = 3 * inch  # Larger QR code for single page
			
			# Generate QR code for each table (one per page)
			for table_num in range(1, self.tables + 1):
				# Create QR code data: restaurant-id/table-number
				qr_data = f"{self.restaurant_id}/{table_num}"
				
				# Generate QR code
				qr = qrcode.QRCode(
					version=1,
					error_correction=qrcode.constants.ERROR_CORRECT_L,
					box_size=10,
					border=4,
				)
				qr.add_data(qr_data)
				qr.make(fit=True)
				
				# Create QR code image
				qr_img = qr.make_image(fill_color="black", back_color="white")
				qr_img = qr_img.resize((int(qr_size), int(qr_size)), Image.Resampling.LANCZOS)
				
				# Calculate position (centered on page)
				x = (page_width - qr_size) / 2
				y = (page_height - qr_size) / 2 + 0.5 * inch  # Slightly below center
				
				# Draw QR code
				pdf_canvas.drawImage(ImageReader(qr_img), x, y, width=qr_size, height=qr_size)
				
				# Draw table number label below QR code
				label_y = y - 0.3 * inch
				pdf_canvas.setFont("Helvetica-Bold", 16)
				pdf_canvas.drawCentredString(page_width / 2, label_y, f"Table {table_num}")
				
				# Draw QR data below table number
				pdf_canvas.setFont("Helvetica", 10)
				pdf_canvas.drawCentredString(page_width / 2, label_y - 0.2 * inch, qr_data)
				
				# Draw restaurant name at top
				if self.restaurant_name:
					pdf_canvas.setFont("Helvetica-Bold", 14)
					pdf_canvas.drawCentredString(page_width / 2, page_height - margin - 0.3 * inch, self.restaurant_name)
				
				# New page for next QR code (except for the last one)
				if table_num < self.tables:
					pdf_canvas.showPage()
			
			# Save PDF
			pdf_canvas.save()
			pdf_buffer.seek(0)
			
			# Delete existing QR codes PDF if it exists
			file_name = f"{self.restaurant_id}_table_qr_codes.pdf"
			existing_file = frappe.db.get_value("File", {
				"file_name": file_name,
				"attached_to_doctype": "Restaurant",
				"attached_to_name": self.name
			}, "name")
			
			if existing_file:
				try:
					frappe.delete_doc("File", existing_file, ignore_permissions=True)
				except:
					pass  # Ignore if file doesn't exist
			
			# Save as attachment
			file_doc = frappe.get_doc({
				"doctype": "File",
				"file_name": file_name,
				"content": pdf_buffer.getvalue(),
				"is_private": 0,
				"attached_to_doctype": "Restaurant",
				"attached_to_name": self.name
			})
			file_doc.save(ignore_permissions=True)
			
			frappe.msgprint(
				f"✅ QR codes PDF generated successfully for {self.tables} tables. File: {file_name}",
				indicator="green"
			)
			
			# Store file URL in document for easy access (if field exists)
			try:
				if frappe.db.has_column("Restaurant", "qr_codes_pdf_url"):
					self.db_set("qr_codes_pdf_url", file_doc.file_url, update_modified=False)
			except:
				# Field doesn't exist yet, will be available after migration
				pass
			
			return file_doc.file_url
			
		except ImportError:
			frappe.throw(_("Required libraries not installed. Please install: pip install qrcode[pil] reportlab"))
		except Exception as e:
			frappe.log_error(f"Error generating QR codes PDF: {str(e)}", "Restaurant QR Code Generation")
			frappe.msgprint(
				f"Error generating QR codes PDF: {str(e)}",
				indicator="red"
			)
			raise
	
	@frappe.whitelist()
	def get_qr_codes_pdf_url(self):
		"""Get the URL of the QR codes PDF if it exists"""
		# Check for existing QR codes PDF file
		file_name = f"{self.restaurant_id}_table_qr_codes.pdf"
		existing_file = frappe.db.get_value("File", {
			"file_name": file_name,
			"attached_to_doctype": "Restaurant",
			"attached_to_name": self.name
		}, "file_url")
		
		if existing_file:
			return existing_file
		
		# If not found, check the stored URL in the document
		doc_url = frappe.db.get_value("Restaurant", self.name, "qr_codes_pdf_url")
		if doc_url:
			return doc_url
		
		return None
	
	@frappe.whitelist()
	def generate_qr_codes_pdf(self):
		"""Whitelisted method to generate QR codes PDF"""
		return self.generate_table_qr_codes_pdf()


@frappe.whitelist()
def get_qr_codes_pdf_url(restaurant):
	"""Get QR codes PDF URL for a restaurant"""
	restaurant_doc = frappe.get_doc("Restaurant", restaurant)
	return restaurant_doc.get_qr_codes_pdf_url()


@frappe.whitelist()
def generate_qr_codes_pdf(restaurant):
	"""Generate QR codes PDF for a restaurant"""
	restaurant_doc = frappe.get_doc("Restaurant", restaurant)
	return restaurant_doc.generate_table_qr_codes_pdf()



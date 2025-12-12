# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
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


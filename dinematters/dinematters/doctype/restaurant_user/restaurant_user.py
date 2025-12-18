# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RestaurantUser(Document):
	def validate(self):
		"""Validate Restaurant User"""
		# Ensure only one default restaurant per user
		if self.is_default:
			existing_default = frappe.db.get_value(
				"Restaurant User",
				{"user": self.user, "is_default": 1, "name": ["!=", self.name]},
				"name"
			)
			if existing_default:
				frappe.throw("User can have only one default restaurant")
	
	def after_insert(self):
		"""Add role to user when Restaurant User is created"""
		self.add_role_to_user()
	
	def on_update(self):
		"""Update role when Restaurant User is updated"""
		self.add_role_to_user()
	
	def on_trash(self):
		"""Clean up when Restaurant User is deleted"""
		# Role removal is handled automatically by Frappe when user is removed from restaurant
		pass
	
	def add_role_to_user(self):
		"""Add role to user if not already present"""
		try:
			user_doc = frappe.get_doc("User", self.user)
			role = self.role or "Restaurant Staff"
			
			# Check if role already exists
			existing_roles = [r.role for r in user_doc.roles]
			if role not in existing_roles:
				user_doc.append("roles", {"role": role})
				user_doc.save(ignore_permissions=True)
		except Exception as e:
			frappe.log_error(f"Error adding role to user: {str(e)}", "Restaurant User Role Assignment")



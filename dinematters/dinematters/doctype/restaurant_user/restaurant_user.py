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
		"""Auto-create User Permission when Restaurant User is created"""
		self.create_user_permission()
		self.add_role_to_user()
	
	def on_update(self):
		"""Update User Permission when Restaurant User is updated"""
		# If restaurant changed, update permission
		if self.has_value_changed("restaurant"):
			old_restaurant = self.get_doc_before_save().restaurant
			self.remove_user_permission(old_restaurant)
		
		# Update permission
		self.create_user_permission()
		self.add_role_to_user()
	
	def on_trash(self):
		"""Remove User Permission when Restaurant User is deleted"""
		if self.restaurant:
			self.remove_user_permission(self.restaurant)
	
	def create_user_permission(self):
		"""Create User Permission for restaurant"""
		from dinematters.dinematters.utils.permissions import create_restaurant_user_permission
		
		create_restaurant_user_permission(
			user=self.user,
			restaurant=self.restaurant,
			is_default=1 if self.is_default else 0
		)
	
	def remove_user_permission(self, restaurant):
		"""Remove User Permission for restaurant"""
		from dinematters.dinematters.utils.permissions import remove_restaurant_user_permission
		
		remove_restaurant_user_permission(
			user=self.user,
			restaurant=restaurant
		)
	
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


# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
import re


class MenuCategory(Document):
	def validate(self):
		# Auto-generate category_id if missing
		if not self.category_id and self.category_name:
			self.category_id = self.generate_id_from_name(self.category_name)

		if self.category_id and self.restaurant:
			# Check if any other category with same ID exists for this restaurant
			duplicate = frappe.db.get_value(
				"Menu Category",
				{"category_id": self.category_id, "restaurant": self.restaurant, "name": ["!=", self.name]},
				"name"
			)
			if duplicate:
				frappe.throw(
					_("Category ID '{0}' already exists for restaurant '{1}'").format(self.category_id, self.restaurant),
					frappe.DuplicateEntryError
				)

	
	def on_trash(self):
		"""Cascade delete all products in this category"""
		products = frappe.get_all("Menu Product", filters={"category": self.name}, fields=["name"])
		for product in products:
			frappe.delete_doc("Menu Product", product.name, force=True, ignore_permissions=True)

	def generate_id_from_name(self, name):
		"""Generate a slug-like ID from name"""
		if not name:
			return None
		
		# Convert to lowercase
		id_str = name.lower()
		
		# Replace spaces and special characters with hyphens
		id_str = re.sub(r'[^\w\s-]', '', id_str)  # Remove special chars
		id_str = re.sub(r'[-\s]+', '-', id_str)  # Replace spaces and multiple hyphens with single hyphen
		id_str = id_str.strip('-')  # Remove leading/trailing hyphens
		
		return id_str

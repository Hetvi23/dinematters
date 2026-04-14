# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class MenuCategory(Document):
	def validate(self):
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






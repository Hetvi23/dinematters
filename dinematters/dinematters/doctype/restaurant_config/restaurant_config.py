# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


from frappe import _

class RestaurantConfig(Document):
	def validate(self):
		self.validate_character_limits()

	def validate_character_limits(self):
		if self.tagline and len(self.tagline) > 70:
			frappe.throw(_("Tagline cannot exceed 70 characters to ensure it fits within 2 lines on mobile screens."))
		
		if self.subtitle and len(self.subtitle) > 100:
			frappe.throw(_("Subtitle cannot exceed 100 characters to ensure it fits within 2 lines on mobile screens."))



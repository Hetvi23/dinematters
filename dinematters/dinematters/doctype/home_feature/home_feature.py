# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class HomeFeature(Document):
	def validate(self):
		"""Ensure mandatory features cannot be disabled"""
		if self.is_mandatory and not self.is_enabled:
			frappe.throw("Mandatory features cannot be disabled")



# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from dinematters.dinematters.utils.customer_helpers import normalize_phone


class Customer(Document):
	"""Platform-wide customer record. One per unique phone (10-digit normalized)."""

	def validate(self):
		# Normalize phone to 10 digits to prevent duplicates from format variations (0987.., +91..)
		if self.phone:
			normalized = normalize_phone(self.phone)
			if normalized and len(normalized) == 10:
				self.phone = normalized

# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class Customer(Document):
	"""Platform-wide customer record. One per unique phone."""

	def validate(self):
		from dinematters.dinematters.utils.customer_helpers import canonical_phone, _find_existing_customer_by_phone
		canonical = canonical_phone(self.phone)
		if not canonical or len(canonical) != 10:
			frappe.throw(_("Phone must be a valid 10-digit number"))

		# Always store canonical form
		self.phone = canonical

		# Prevent duplicate: another Customer with same phone (canonical) already exists
		existing = _find_existing_customer_by_phone(self.phone)
		if existing and existing.name != self.name:
			frappe.throw(_("Customer with phone {0} already exists").format(self.phone))

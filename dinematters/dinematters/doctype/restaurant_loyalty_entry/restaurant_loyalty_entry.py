# Copyright (c) 2026, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RestaurantLoyaltyEntry(Document):
	def validate(self):
		if not self.posting_date:
			self.posting_date = frappe.utils.today()

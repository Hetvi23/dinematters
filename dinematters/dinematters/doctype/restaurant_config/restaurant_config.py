# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RestaurantConfig(Document):
	def validate(self):
		"""
		Validate and process currency field
		If currency is a symbol (like "$"), convert it to currency code (like "USD")
		"""
		if self.currency:
			# Check if currency is a symbol (not a 3-letter code)
			# Symbols are typically 1-3 characters and not all uppercase letters
			if not (len(self.currency) == 3 and self.currency.isupper() and self.currency.isalpha()):
				# This might be a symbol, try to find matching currency
				currency_code = frappe.db.get_value(
					"Currency",
					{"symbol": self.currency},
					"name"
				)
				
				if currency_code:
					self.currency = currency_code
				else:
					# If not found by symbol, check if it's already a valid currency code
					if not frappe.db.exists("Currency", self.currency):
						frappe.throw(f"Invalid currency: {self.currency}. Please provide a valid currency code or symbol.")



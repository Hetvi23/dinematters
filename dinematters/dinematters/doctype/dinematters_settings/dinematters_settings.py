# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DinemattersSettings(Document):
	"""Site-wide settings for Dinematters (OTP, etc.). Single doc."""
	
	def on_update(self):
		from dinematters.dinematters.utils.email_setup import setup_hostinger_email
		setup_hostinger_email()


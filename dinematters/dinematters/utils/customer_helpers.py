# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Customer helpers for platform-wide customer records.
"""

import frappe
import re


def normalize_phone(phone: str) -> str:
	"""Extract 10-digit India number."""
	digits = re.sub(r"\D", "", str(phone or ""))
	return digits[-10:] if len(digits) >= 10 else digits


def get_or_create_customer(phone: str, name: str = None, email: str = None):
	"""Get or create Customer by phone. Used when verifying OTP and when creating Order/Booking."""
	normalized = normalize_phone(phone)
	if not normalized or len(normalized) != 10:
		return None

	existing = frappe.db.get_value("Customer", {"phone": normalized}, "name")
	if existing:
		doc = frappe.get_doc("Customer", existing)
		if name:
			doc.customer_name = name
		if email is not None:
			doc.email = email
		doc.flags.ignore_permissions = True
		doc.save()
		return doc

	return frappe.get_doc({
		"doctype": "Customer",
		"phone": normalized,
		"customer_name": name or f"Customer {normalized}",
		"email": email or ""
	}).insert(ignore_permissions=True)


def is_phone_verified(phone: str) -> bool:
	"""Platform-wide: check if phone is verified (Customer exists with verified_at)."""
	normalized = normalize_phone(phone)
	if not normalized or len(normalized) != 10:
		return False
	return bool(frappe.db.get_value("Customer", {"phone": normalized}, "verified_at"))


def require_verified_phone(restaurant_id: str, phone: str) -> bool:
	"""Returns True if restaurant has verify_my_user OFF, or if phone is verified."""
	config = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_id}, "verify_my_user")
	if not config:
		return True
	return is_phone_verified(phone)

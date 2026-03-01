# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Customer helpers for platform-wide customer records.
"""

import frappe
import re


def normalize_phone(phone: str) -> str:
	"""Extract 10-digit India number (digits only, last 10)."""
	digits = re.sub(r"\D", "", str(phone or ""))
	return digits[-10:] if len(digits) >= 10 else digits


def canonical_phone(phone: str) -> str:
	"""
	Canonical form for storage and deduplication.
	India mobile: 10 digits, first digit 6-9. If starts with 0 (trunk prefix), use 9 instead.
	"""
	normalized = normalize_phone(phone)
	if not normalized or len(normalized) != 10:
		return normalized or ""
	if normalized[0] == "0":
		return "9" + normalized[1:]
	return normalized


def _find_existing_customer_by_phone(phone: str):
	"""Find existing Customer by phone (exact or digit match). Returns doc or None."""
	canonical = canonical_phone(phone)
	if not canonical or len(canonical) != 10:
		return None

	# 1. Exact match on canonical
	existing = frappe.db.get_value("Customer", {"phone": canonical}, "name")
	if existing:
		return frappe.get_doc("Customer", existing)

	# 2. Match on normalized (in case stored in alternate form)
	normalized = normalize_phone(phone)
	if normalized != canonical:
		existing = frappe.db.get_value("Customer", {"phone": normalized}, "name")
		if existing:
			return frappe.get_doc("Customer", existing)

	# 3. Scan for any Customer whose phone digits match (handles +91 7487871213 vs 7487871213)
	all_customers = frappe.get_all("Customer", fields=["name", "phone"])
	for c in all_customers:
		if c.phone and canonical_phone(c.phone) == canonical:
			return frappe.get_doc("Customer", c.name)
	return None


def get_or_create_customer(phone: str, name: str = None, email: str = None):
	"""Get or create Customer by phone. Used when verifying OTP and when creating Order/Booking.
	Always uses canonical phone to prevent duplicates."""
	canonical = canonical_phone(phone)
	if not canonical or len(canonical) != 10:
		return None

	existing_doc = _find_existing_customer_by_phone(phone)
	if existing_doc:
		if name:
			existing_doc.customer_name = name
		if email is not None:
			existing_doc.email = email
		existing_doc.flags.ignore_permissions = True
		existing_doc.save()
		return existing_doc

	return frappe.get_doc({
		"doctype": "Customer",
		"phone": canonical,
		"customer_name": name or f"Customer {canonical}",
		"email": email or ""
	}).insert(ignore_permissions=True)


def is_phone_verified(phone: str) -> bool:
	"""Platform-wide: check if phone is verified (Customer exists with verified_at)."""
	doc = _find_existing_customer_by_phone(phone)
	return bool(doc and doc.verified_at)


def require_verified_phone(restaurant_id: str, phone: str) -> bool:
	"""Returns True if restaurant has verify_my_user OFF, or if phone is verified."""
	config = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_id}, "verify_my_user")
	if not config:
		return True
	return is_phone_verified(phone)

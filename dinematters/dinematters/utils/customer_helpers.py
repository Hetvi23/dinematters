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


def _phone_variants(normalized: str):
	"""Return normalized and common format variants for lookup."""
	return [normalized, f"0{normalized}", f"+91{normalized}", f"+91 {normalized}", f"91{normalized}"]


def _find_customer_by_normalized_phone(normalized: str):
	"""Find Customer by phone (single source of truth). Tries normalized and common format variants."""
	if not frappe.db.has_column("Customer", "phone"):
		return None
	for v in _phone_variants(normalized):
		existing = frappe.db.get_value("Customer", {"phone": v}, "name")
		if existing:
			return existing
	return None


def get_or_create_customer(phone: str, name: str = None, email: str = None):
	"""Get or create Customer by phone. Phone is the unique identifier - no duplicates."""
	normalized = normalize_phone(phone)
	if not normalized or len(normalized) != 10:
		return None

	existing = _find_customer_by_normalized_phone(normalized)
	if existing:
		# Update via db to avoid attr errors when ERPNext Customer lacks fields
		if name:
			frappe.db.set_value("Customer", existing, "customer_name", name)
		if email is not None:
			frappe.db.set_value("Customer", existing, "email", email or "")
		frappe.db.set_value("Customer", existing, "phone", normalized)
		frappe.db.commit()
		# Re-fetch by phone in case ERPNext renamed doc when customer_name changed
		current = _find_customer_by_normalized_phone(normalized)
		return frappe.get_doc("Customer", current or existing)

	try:
		return frappe.get_doc({
			"doctype": "Customer",
			"phone": normalized,
			"customer_name": name or f"Customer {normalized}",
			"email": email or ""
		}).insert(ignore_permissions=True)
	except (frappe.DuplicateEntryError, frappe.UniqueValidationError):
		existing = _find_customer_by_normalized_phone(normalized)
		if existing:
			if name:
				frappe.db.set_value("Customer", existing, "customer_name", name)
			if email is not None:
				frappe.db.set_value("Customer", existing, "email", email or "")
			frappe.db.commit()
			current = _find_customer_by_normalized_phone(normalized)
			return frappe.get_doc("Customer", current or existing)
		raise


def is_phone_verified(phone: str) -> bool:
	"""Platform-wide: check if phone is verified (Customer exists with verified_at)."""
	normalized = normalize_phone(phone)
	if not normalized or len(normalized) != 10:
		return False
	if not frappe.db.has_column("Customer", "verified_at"):
		return False
	for v in _phone_variants(normalized):
		val = frappe.db.get_value("Customer", {"phone": v}, "verified_at")
		if val:
			return True
	return False


def require_verified_phone(restaurant_id: str, phone: str) -> bool:
	"""Returns True if restaurant has verify_my_user OFF, or if phone is verified."""
	config = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_id}, "verify_my_user")
	if not config:
		return True
	return is_phone_verified(phone)

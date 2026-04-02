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


def get_phone_variants_for_lookup(normalized: str):
	"""Public helper for matching phone in Order.customer_phone etc. Returns list of variants."""
	return _phone_variants(normalized)


def _find_customer_by_normalized_phone(normalized: str):
	"""Find Customer by phone (single source of truth). Uses SQL fuzzy matching for robustness."""
	if not frappe.db.has_column("Customer", "phone"):
		return None
	
	# Priority 1: Exact match on normalized (fastest)
	existing = frappe.db.get_value("Customer", {"phone": normalized}, "name")
	if existing:
		return existing
		
	# Priority 2: Fuzzy match ignoring formatting characters (+, -, space, parens)
	# This handles the duplicates shown in the dashboard screenshot.
	res = frappe.db.sql("""
		SELECT name FROM `tabCustomer` 
		WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', ''), '(', '') LIKE %s
		LIMIT 1
	""", (f"%{normalized}",), as_dict=True)
	
	if res:
		return res[0].name
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


def validate_customer_session(phone: str, session_token: str) -> bool:
	"""
	Verify that the provided session_token is valid and belongs to the phone number.
	Essential for securing sensitive APIs like create_order.
	"""
	try:
		if not session_token or not phone:
			return False
		
		normalized = normalize_phone(phone)
		session = frappe.cache().get_value(f"customer_session:{session_token}")
		
		if not session:
			return False
		
		# Check if token belongs to this normalized phone
		if session.get("phone") != normalized:
			return False
			
		# Check if customer doc exists
		customer_id = session.get("customer_id")
		if not customer_id or not frappe.db.exists("Customer", customer_id):
			return False
			
		return True
	except Exception:
		return False


def require_verified_phone(restaurant_id: str, phone: str) -> bool:
	"""Returns True if restaurant has verify_my_user OFF, or if phone is verified."""
	config = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_id}, "verify_my_user")
	if not config:
		return True
	return is_phone_verified(phone)

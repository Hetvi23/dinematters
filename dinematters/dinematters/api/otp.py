# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
OTP verification API — send, verify, check.
SMS primary, WhatsApp fallback. Platform-wide verification.
"""

import random
import string
import frappe
from dinematters.dinematters.utils.customer_helpers import normalize_phone, get_or_create_customer, is_phone_verified
from dinematters.dinematters.utils.otp_service import (
	send_otp_via_sms,
	send_otp_via_whatsapp,
	OTP_LENGTH,
	OTP_EXPIRY_MINUTES,
	OTP_RESEND_COOLDOWN,
	OTP_MAX_PER_HOUR,
)


@frappe.whitelist(allow_guest=True)
def send_otp(restaurant_id, phone, purpose="verification", restaurant_name=None):
	"""
	Send OTP: SMS first, WhatsApp fallback on failure.
	Returns: { success, token, expires_in, channel } or { success, skip_verification } or { success, already_verified }
	"""
	try:
		config = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_id}, "verify_my_user")
		if not config:
			return {"success": True, "skip_verification": True}

		normalized = normalize_phone(phone)
		if not normalized or len(normalized) != 10:
			return {"success": False, "error": "INVALID_PHONE", "message": "Invalid phone number"}

		if is_phone_verified(phone):
			return {"success": True, "already_verified": True}

		# Rate limit
		rate_key = f"otp_rate:{normalized}"
		count = int(frappe.cache().get_value(rate_key) or 0)
		if count >= OTP_MAX_PER_HOUR:
			return {"success": False, "error": "RATE_LIMIT_EXCEEDED", "message": "Max 3 OTPs per hour. Try again later."}

		cooldown_key = f"otp_cooldown:{normalized}"
		if frappe.cache().get_value(cooldown_key):
			return {"success": False, "error": "COOLDOWN", "message": "Wait 30 seconds before resending."}

		# API key (use get_password — get_single_value returns masked "********" for Password fields)
		api_key = frappe.get_single("Dinematters Settings").get_password("fast2sms_api_key")
		if not api_key:
			return {"success": False, "error": "OTP_SERVICE_NOT_CONFIGURED", "message": "OTP service not configured"}

		otp = "".join(random.choices(string.digits, k=OTP_LENGTH))

		# Try SMS first (restaurant_name from frontend for dynamic message)
		sms_ok = send_otp_via_sms(api_key, normalized, otp, restaurant_name=restaurant_name or restaurant_id)
		channel = "sms"

		if not sms_ok:
			channel = "whatsapp"
			whatsapp_ok = send_otp_via_whatsapp(api_key, phone, otp)
			if not whatsapp_ok:
				_create_otp_log(restaurant_id, phone, "whatsapp", 0, purpose, "Both SMS and WhatsApp failed")
				return {"success": False, "error": "OTP_SEND_FAILED", "message": "Failed to send OTP"}

		# Store OTP in cache
		token = frappe.generate_hash(length=32)
		frappe.cache().set_value(
			f"otp:{normalized}:{token}",
			{"otp": otp, "purpose": purpose},
			expires_in_sec=OTP_EXPIRY_MINUTES * 60
		)

		# Rate limit & cooldown
		frappe.cache().set_value(rate_key, count + 1, expires_in_sec=3600)
		frappe.cache().set_value(cooldown_key, "1", expires_in_sec=OTP_RESEND_COOLDOWN)

		_create_otp_log(restaurant_id, phone, channel, 0, purpose, None)

		return {
			"success": True,
			"token": token,
			"expires_in": OTP_EXPIRY_MINUTES * 60,
			"channel": channel,
			"message": "OTP sent successfully"
		}
	except Exception as e:
		frappe.log_error(f"send_otp error: {e}", "OTP_Send_Error")
		return {"success": False, "error": "INTERNAL_ERROR", "message": str(e)}


@frappe.whitelist(allow_guest=True)
def verify_otp(restaurant_id, phone, otp, token, name=None, email=None):
	"""Verify OTP. On success, create/update Customer with verified_at."""
	try:
		normalized = normalize_phone(phone)
		if not normalized or len(normalized) != 10:
			return {"success": False, "error": "INVALID_PHONE"}

		cached = frappe.cache().get_value(f"otp:{normalized}:{token}")
		if not cached:
			return {"success": False, "error": "OTP_EXPIRED_OR_INVALID"}

		if cached.get("otp") != otp:
			return {"success": False, "error": "INVALID_OTP"}

		frappe.cache().delete_value(f"otp:{normalized}:{token}")

		customer = get_or_create_customer(phone=normalized, name=name, email=email)
		if not customer:
			return {"success": False, "error": "CUSTOMER_CREATE_FAILED"}

		if not customer.verified_at:
			customer.verified_at = frappe.utils.now()
			customer.first_verified_at_restaurant = restaurant_id
			customer.flags.ignore_permissions = True
			customer.save()

		return {"success": True, "verified": True, "customer_id": customer.name}
	except Exception as e:
		frappe.log_error(f"verify_otp error: {e}", "OTP_Verify_Error")
		return {"success": False, "error": "INTERNAL_ERROR", "message": str(e)}


@frappe.whitelist(allow_guest=True)
def check_verified(phone):
	"""Check if phone is verified (platform-wide)."""
	try:
		normalized = normalize_phone(phone)
		if not normalized or len(normalized) != 10:
			return {"success": False, "verified": False}
		return {"success": True, "verified": is_phone_verified(phone)}
	except Exception as e:
		frappe.log_error(f"check_verified error: {e}", "OTP_Check_Error")
		return {"success": False, "verified": False}


def _create_otp_log(restaurant_id, phone, channel, verified, purpose, error_message):
	try:
		frappe.get_doc({
			"doctype": "OTP Verification Log",
			"restaurant": restaurant_id,
			"phone": phone,
			"channel": channel,
			"verified": verified,
			"purpose": purpose or "verification",
			"error_message": error_message
		}).insert(ignore_permissions=True)
	except Exception:
		pass

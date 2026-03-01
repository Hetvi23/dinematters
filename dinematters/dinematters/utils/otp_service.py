# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Fast2SMS OTP service: SMS primary, WhatsApp fallback.
"""

import re
import requests
import frappe

FAST2SMS_SMS_URL = "https://www.fast2sms.com/dev/bulkV2"
OTP_LENGTH = 4
OTP_EXPIRY_MINUTES = 5
OTP_RESEND_COOLDOWN = 30
OTP_MAX_PER_HOUR = 3


def send_otp_via_sms(api_key: str, numbers: str, otp: str, restaurant_name: str = None) -> bool:
	"""Send OTP via Fast2SMS. Returns True if successful."""
	try:
		settings = frappe.get_single("Dinematters Settings")
		route = "dlt"
		if not (getattr(settings, "fast2sms_sender_id", None) and getattr(settings, "fast2sms_dlt_template_id", None)):
			route = "q"  # Quick SMS – temporary testing only (₹5/SMS), not production

		headers = {"authorization": api_key, "Content-Type": "application/json"}

		# Production message: restaurant-dynamic, single-line (newlines can affect delivery)
		label = (restaurant_name or "DineMatters").strip()[:25]
		sms_message = f"Your {label} verification code is: {otp}. Don't share this code with anyone."

		if route == "q":
			payload = {
				"route": "q",
				"message": sms_message,
				"numbers": numbers
			}
		else:
			payload = {
				"route": "dlt",
				"sender_id": settings.fast2sms_sender_id,
				"message": settings.fast2sms_dlt_template_id,
				"variables_values": otp,
				"numbers": numbers
			}

		resp = requests.post(FAST2SMS_SMS_URL, json=payload, headers=headers, timeout=10)
		data = resp.json() if resp.text else {}
		return resp.status_code == 200 and data.get("return", False)
	except Exception as e:
		frappe.log_error(f"Fast2SMS SMS failed: {e}", "OTP_SMS_Failed")
		return False


def send_otp_via_whatsapp(api_key: str, phone: str, otp: str) -> bool:
	"""Send OTP via Fast2SMS WhatsApp. Returns True if successful."""
	try:
		settings = frappe.get_single("Dinematters Settings")
		phone_id = getattr(settings, "whatsapp_phone_number_id", None)
		template = getattr(settings, "whatsapp_otp_template_name", None)
		if not phone_id or not template:
			return False

		to = re.sub(r"\D", "", str(phone))
		if len(to) == 10 and not to.startswith("91"):
			to = "91" + to

		url = f"https://www.fast2sms.com/dev/whatsapp/v24.0/{phone_id}/messages"
		headers = {"Authorization": api_key, "Content-Type": "application/json"}
		body = {
			"messaging_product": "whatsapp",
			"recipient_type": "individual",
			"to": to,
			"type": "template",
			"template": {
				"name": template,
				"language": {"code": "en"},
				"components": [
					{"type": "body", "parameters": [{"type": "text", "text": otp}]},
					{"type": "button", "sub_type": "url", "index": "0", "parameters": [{"type": "text", "text": otp}]}
				]
			}
		}

		resp = requests.post(url, json=body, headers=headers, timeout=10)
		return resp.status_code == 200
	except Exception as e:
		frappe.log_error(f"Fast2SMS WhatsApp failed: {e}", "OTP_WhatsApp_Failed")
		return False

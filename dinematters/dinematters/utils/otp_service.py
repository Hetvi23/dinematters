# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Fast2SMS & Evolution API OTP service.
"""

import re
import requests
import frappe

FAST2SMS_SMS_URL = "https://www.fast2sms.com/dev/bulkV2"
OTP_LENGTH = 6
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


def send_otp_via_msg91_whatsapp(auth_key: str, mobile: str, otp: str, template: str, restaurant_name: str = None) -> bool:
	"""Send OTP via MSG91 WhatsApp. Supports Template ID or Name with variables."""
	try:
		if not auth_key or not template:
			return False

		to = re.sub(r"\D", "", str(mobile))
		if len(to) == 10:
			to = "91" + to

		# If 'template' looks like a Template Name (non-numeric), use WhatsApp API
		# Otherwise use standard OTP API
		is_template_name = not template.isdigit()

		if is_template_name:
			# WhatsApp API (v5)
			url = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
			settings = frappe.get_single("Dinematters Settings")
			sender_number = getattr(settings, "whatsapp_phone_number_id", None) or "917801838526"
			
			payload = {
				"integrated_number": sender_number,
				"content_type": "template",
				"payload": {
					"messaging_product": "whatsapp",
					"type": "template",
					"template": {
						"name": template,
						"language": {
							"code": "en_US",
							"policy": "deterministic"
						},
						"namespace": "7d8e31f4_d5d5_4ee7_8a76_3abb99331d00",
						"to_and_components": [
							{
								"to": [to],
								"components": {
									"body_restaurant_name": {
										"type": "text",
										"value": f"{restaurant_name or 'DineMatters'}",
										"parameter_name": "restaurant_name"
									},
									"body_otp": {
										"type": "text",
										"value": f"{otp}",
										"parameter_name": "otp"
									}
								}
							}
						]
					}
				}
			}
			headers = {
				"authkey": auth_key,
				"Content-Type": "application/json"
			}
			resp = requests.post(url, json=payload, headers=headers, timeout=10)
		else:
			# Standard OTP API
			url = "https://api.msg91.com/api/v5/otp"
			params = {
				"template_id": template,
				"mobile": to,
				"authkey": auth_key,
				"otp": otp
			}
			resp = requests.get(url, params=params, timeout=10)

		data = resp.json() if resp.text else {}
		frappe.log_error(f"MSG91 Response ({resp.status_code}): {resp.text}", "OTP_MSG91_Debug")
		
		if not (resp.status_code == 200 and (data.get("type") == "success" or data.get("status") == "success")):
			return {"success": False, "error": "MSG91_FAILED", "message": resp.text, "status_code": resp.status_code}

		return {"success": True, "message": "OTP sent successfully", "raw_response": data}
	except Exception as e:
		frappe.log_error(f"MSG91 WhatsApp failed: {e}", "OTP_MSG91_Failed")
		return False


def send_otp_via_evolution_api(url: str, api_key: str, instance: str, phone: str, otp: str, restaurant_name: str = None) -> bool:
	"""Send OTP via Evolution API (WhatsApp). Returns True if successful."""
	try:
		if not url or not api_key or not instance:
			return False

		to = re.sub(r"\D", "", str(phone))
		if len(to) == 10 and not to.startswith("91"):
			to = "91" + to

		# Ensure URL doesn't have trailing slash
		url = url.rstrip("/")
		endpoint = f"{url}/message/sendText/{instance}"
		
		headers = {
			"apikey": api_key,
			"Content-Type": "application/json"
		}

		label = (restaurant_name or "DineMatters").strip()[:25]
		payload = {
			"number": to,
			"options": {
				"delay": 1200,
				"presence": "composing",
				"linkPreview": False
			},
			"textMessage": {
				"text": f"Your {label} verification code is: {otp}. Don't share this code with anyone."
			}
		}

		resp = requests.post(endpoint, json=payload, headers=headers, timeout=12)
		data = resp.json() if resp.text else {}
		
		success = resp.status_code in [200, 201] and data.get("key")
		if not success:
			frappe.log_error(f"Evolution API Failed: {resp.text}", "OTP_Evolution_Failed")
			
		return success
	except Exception as e:
		frappe.log_error(f"Evolution API failed: {e}", "OTP_Evolution_Error")
		return False

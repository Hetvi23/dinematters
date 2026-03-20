# Copyright (c) 2025, Dinematters and contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from dinematters.dinematters.api.otp import check_verified, send_otp
from dinematters.dinematters.utils.customer_helpers import (
	normalize_phone,
	get_or_create_customer,
)


class TestOTP(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_normalize_phone(self):
		self.assertEqual(normalize_phone("9876543210"), "9876543210")
		self.assertEqual(normalize_phone("+91 98765 43210"), "9876543210")
		self.assertEqual(normalize_phone("91-9876543210"), "9876543210")
		self.assertEqual(normalize_phone("123"), "123")

	def test_check_verified_invalid_phone(self):
		res = check_verified("123")
		self.assertTrue("success" in res)
		self.assertFalse(res.get("verified"))

	def test_send_otp_skip_when_verify_off(self):
		restaurant = frappe.db.get_value("Restaurant", {"is_active": 1}, "name")
		if not restaurant:
			self.skipTest("No active restaurant")
		frappe.db.set_value("Restaurant Config", {"restaurant": restaurant}, "verify_my_user", 0)
		frappe.db.commit()
		res = send_otp(restaurant, "9876543210")
		self.assertTrue(res.get("success"))
		self.assertTrue(res.get("skip_verification"))

	def test_get_or_create_customer(self):
		phone = "9999888877"
		existing = frappe.db.get_value("Customer", {"phone": phone}, "name")
		if existing:
			frappe.delete_doc("Customer", existing, force=True)
			frappe.db.commit()

		cust = get_or_create_customer(phone, "Test User", "test@example.com")
		self.assertIsNotNone(cust)
		self.assertEqual(cust.phone, phone)
		self.assertEqual(cust.customer_name, "Test User")

		cust2 = get_or_create_customer(phone, "Updated Name", "updated@example.com")
		self.assertEqual(cust2.name, cust.name)
		self.assertEqual(cust2.customer_name, "Updated Name")

	def test_msg91_whatsapp_mock(self):
		from dinematters.dinematters.utils.otp_service import send_otp_via_msg91_whatsapp
		from unittest.mock import patch

		with patch("requests.get") as mock_get:
			mock_get.return_value.status_code = 200
			mock_get.return_value.text = '{"type":"success"}'
			mock_get.return_value.json.return_value = {"type": "success"}

			success = send_otp_via_msg91_whatsapp("test_key", "9876543210", "1234", "test_template")
			self.assertTrue(success)
			self.assertTrue(mock_get.called)
			args, kwargs = mock_get.call_args
			self.assertEqual(kwargs["params"]["otp"], "1234")
			self.assertEqual(kwargs["params"]["mobile"], "919876543210")

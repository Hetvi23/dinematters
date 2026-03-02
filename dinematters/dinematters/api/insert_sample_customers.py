# Copyright (c) 2025, Dinematters
# Insert sample customers for 2 restaurants to test Customers frontend.

import frappe
from frappe.utils import now
import random
import string
from datetime import datetime

from dinematters.dinematters.utils.customer_helpers import get_or_create_customer


@frappe.whitelist()
def insert_sample_customers():
	"""Create sample customers linked to unvind and araku via Orders."""
	R1, R2 = "unvind", "araku"

	def get_product(rest):
		return frappe.db.get_value(
			"Menu Product", {"restaurant": rest}, ["name", "price"], as_dict=True
		)

	customers_data = [
		{"phone": "9876501001", "name": "Rahul Sharma", "email": "rahul@example.com", "verified": True, "rest": R1},
		{"phone": "9876501002", "name": "Priya Patel", "email": "priya@example.com", "verified": True, "rest": R1},
		{"phone": "9876501003", "name": "Amit Kumar", "email": "", "verified": False, "rest": R1},
		{"phone": "9876502001", "name": "Sneha Reddy", "email": "sneha@example.com", "verified": True, "rest": R2},
		{"phone": "9876502002", "name": "Vikram Singh", "email": "vikram@example.com", "verified": False, "rest": R2},
	]

	# Use get_or_create_customer to avoid duplicates (phone is unique)
	created = []
	for c in customers_data:
		cust = get_or_create_customer(c["phone"], c["name"], c["email"])
		cust_name = cust.name if cust else None
		if not cust_name:
			continue

		if c["verified"]:
			frappe.db.set_value(
				"Customer",
				cust_name,
				{"verified_at": now(), "first_verified_at_restaurant": c["rest"]},
				update_modified=False,
			)

		created.append((cust_name, c["phone"], c["rest"]))

	for cust_name, cust_phone, rest in created:
		prod = get_product(rest)
		if not prod:
			continue

		oid = f"order-{int(datetime.now().timestamp())}-{''.join(random.choices(string.ascii_lowercase, k=6))}"
		if frappe.db.exists("Order", {"order_id": oid}):
			continue

		year = datetime.now().year
		count = frappe.db.count("Order", filters={"creation": [">=", f"{year}-01-01"]})
		onum = f"ORD-{year}-{count + 1000:04d}"

		ord_doc = frappe.new_doc("Order")
		ord_doc.restaurant = rest
		ord_doc.order_id = oid
		ord_doc.order_number = onum
		ord_doc.platform_customer = cust_name
		ord_doc.customer_phone = cust_phone
		ord_doc.subtotal = float(prod.price or 100)
		ord_doc.total = float(prod.price or 100)
		ord_doc.status = "billed"
		ord_doc.is_tokenization = 0
		ord_doc.append(
			"order_items",
			{
				"product": prod.name,
				"quantity": 1,
				"unit_price": float(prod.price or 100),
				"total_price": float(prod.price or 100),
			},
		)
		ord_doc.flags.ignore_permissions = True
		ord_doc.insert()

	frappe.db.commit()
	return {"success": True, "message": "Sample customers created for unvind and araku."}

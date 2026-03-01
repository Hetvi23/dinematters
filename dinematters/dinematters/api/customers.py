# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Customer APIs for cross-restaurant analytics.
"""

import frappe
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api
from dinematters.dinematters.utils.permission_helpers import get_user_restaurant_ids


@frappe.whitelist()
def get_customer_profile(customer_id):
	"""
	Admin: Get customer profile with all restaurants visited, orders, bookings.
	System Manager only.
	"""
	if "System Manager" not in frappe.get_roles():
		return {"success": False, "error": "Permission denied"}

	try:
		if not frappe.db.exists("Customer", customer_id):
			return {"success": False, "error": "Customer not found"}

		customer = frappe.get_doc("Customer", customer_id)
		restaurants = []

		# Orders
		orders = frappe.get_all(
			"Order",
			filters={"platform_customer": customer_id},
			fields=["name", "restaurant", "order_number", "total", "status", "creation"]
		)
		order_by_rest = {}
		for o in orders:
			rest = o.restaurant
			if rest not in order_by_rest:
				order_by_rest[rest] = []
			order_by_rest[rest].append(o)

		# Table bookings
		table_bookings = frappe.get_all(
			"Table Booking",
			filters={"platform_customer": customer_id},
			fields=["name", "restaurant", "booking_number", "date", "time_slot", "status", "creation"]
		)
		tb_by_rest = {}
		for b in table_bookings:
			rest = b.restaurant
			if rest not in tb_by_rest:
				tb_by_rest[rest] = []
			tb_by_rest[rest].append(b)

		# Banquet bookings
		banquet_bookings = frappe.get_all(
			"Banquet Booking",
			filters={"platform_customer": customer_id},
			fields=["name", "restaurant", "booking_number", "date", "event_type", "status", "creation"]
		)
		bb_by_rest = {}
		for b in banquet_bookings:
			rest = b.restaurant
			if rest not in bb_by_rest:
				bb_by_rest[rest] = []
			bb_by_rest[rest].append(b)

		all_rests = set(order_by_rest.keys()) | set(tb_by_rest.keys()) | set(bb_by_rest.keys())
		for rest_id in all_rests:
			rest_name = frappe.db.get_value("Restaurant", rest_id, "restaurant_name") or rest_id
			restaurants.append({
				"restaurant_id": rest_id,
				"restaurant_name": rest_name,
				"orders": order_by_rest.get(rest_id, []),
				"tableBookings": tb_by_rest.get(rest_id, []),
				"banquetBookings": bb_by_rest.get(rest_id, [])
			})

		return {
			"success": True,
			"data": {
				"customer": {
					"id": customer.name,
					"phone": customer.phone,
					"customerName": customer.customer_name,
					"email": customer.email,
					"verifiedAt": str(customer.verified_at) if customer.verified_at else None
				},
				"restaurants": restaurants
			}
		}
	except Exception as e:
		frappe.log_error(f"get_customer_profile error: {e}", "Customer_API")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_restaurant_customers(restaurant_id):
	"""
	Restaurant: Get customers who have orders/bookings at this restaurant only.
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		restaurant_ids = get_user_restaurant_ids(frappe.session.user)
		if "System Manager" not in frappe.get_roles() and restaurant not in restaurant_ids:
			return {"success": False, "error": "Permission denied"}

		customer_ids = set()
		for doctype, field in [
			("Order", "platform_customer"),
			("Table Booking", "platform_customer"),
			("Banquet Booking", "platform_customer")
		]:
			rows = frappe.get_all(
				doctype,
				filters={"restaurant": restaurant, field: ["!=", ""]},
				pluck=field
			)
			customer_ids.update(r for r in rows if r)

		customers = []
		for cid in customer_ids:
			c = frappe.db.get_value(
				"Customer",
				cid,
				["name", "phone", "mobile_no", "customer_name", "email", "verified_at"],
				as_dict=True
			)
			if not c:
				continue

			orders = frappe.get_all(
				"Order",
				filters={"restaurant": restaurant, "platform_customer": cid},
				fields=["name", "order_number", "total", "status", "creation", "customer_phone"]
			)
			table_bookings = frappe.get_all(
				"Table Booking",
				filters={"restaurant": restaurant, "platform_customer": cid},
				fields=["name", "booking_number", "date", "time_slot", "status", "creation", "customer_phone"]
			)
			banquet_bookings = frappe.get_all(
				"Banquet Booking",
				filters={"restaurant": restaurant, "platform_customer": cid},
				fields=["name", "booking_number", "date", "event_type", "status", "creation", "customer_phone"]
			)

			# Phone: prefer Customer.phone, then mobile_no, else from first Order/Booking
			phone = c.phone or c.mobile_no
			if not phone and orders:
				phone = orders[0].get("customer_phone")
			if not phone and table_bookings:
				phone = table_bookings[0].get("customer_phone")
			if not phone and banquet_bookings:
				phone = banquet_bookings[0].get("customer_phone")

			customers.append({
				"id": c.name,
				"phone": phone,
				"customerName": c.customer_name,
				"verifiedAt": str(c.verified_at) if c.verified_at else None,
				"orders": orders,
				"tableBookings": table_bookings,
				"banquetBookings": banquet_bookings
			})

		return {"success": True, "data": {"customers": customers}}
	except Exception as e:
		frappe.log_error(f"get_restaurant_customers error: {e}", "Customer_API")
		return {"success": False, "error": str(e)}

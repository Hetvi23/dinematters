# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Customer APIs for cross-restaurant analytics.
"""

import frappe
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api
from dinematters.dinematters.utils.permission_helpers import get_user_restaurant_ids
from dinematters.dinematters.utils.customer_helpers import normalize_phone, canonical_phone, _find_existing_customer_by_phone


def update_customer_last_visited(doc, event=None):
	"""Update Customer.last_visited when Order/Table Booking/Banquet Booking is submitted."""
	customer_id = getattr(doc, "platform_customer", None)
	if not customer_id or not frappe.db.exists("Customer", customer_id):
		return
	if not frappe.db.has_column("Customer", "last_visited"):
		return
	ts = doc.creation or doc.modified
	frappe.db.set_value("Customer", customer_id, "last_visited", ts)
	frappe.db.commit()


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

		# Orders (include feedback)
		order_fields = ["name", "restaurant", "order_number", "total", "status", "creation"]
		if frappe.db.has_column("Order", "customer_rating"):
			order_fields.extend(["customer_rating", "customer_feedback"])
		orders = frappe.get_all(
			"Order",
			filters={"platform_customer": customer_id},
			fields=order_fields
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
def get_customer_by_phone(phone, restaurant_id):
	"""
	Get customer details by phone number and restaurant ID.
	Returns customer info plus orders and bookings at this restaurant.
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		restaurant_ids = get_user_restaurant_ids(frappe.session.user)
		if "System Manager" not in frappe.get_roles() and restaurant not in restaurant_ids:
			return {"success": False, "error": "Permission denied"}

		existing_doc = _find_existing_customer_by_phone(phone)
		if not existing_doc:
			return {"success": False, "error": "Customer not found"}

		cid = existing_doc.name
		c = frappe.db.get_value(
			"Customer",
			cid,
			["name", "phone", "mobile_no", "customer_name", "email", "verified_at"],
			as_dict=True
		)
		if not c:
			return {"success": False, "error": "Customer not found"}

		order_fields = ["name", "order_number", "total", "status", "creation", "customer_phone"]
		if frappe.db.has_column("Order", "customer_rating"):
			order_fields.extend(["customer_rating", "customer_feedback"])
		orders = frappe.get_all(
			"Order",
			filters={"restaurant": restaurant, "platform_customer": cid},
			fields=order_fields
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

		phone_val = c.phone or c.mobile_no
		if not phone_val and orders:
			phone_val = orders[0].get("customer_phone")
		if not phone_val and table_bookings:
			phone_val = table_bookings[0].get("customer_phone")
		if not phone_val and banquet_bookings:
			phone_val = banquet_bookings[0].get("customer_phone")

		last_dates = []
		for o in orders:
			if o.get("creation"):
				last_dates.append(o["creation"])
		for b in table_bookings + banquet_bookings:
			if b.get("creation"):
				last_dates.append(b["creation"])
		last_visited = max(last_dates) if last_dates else None

		return {
			"success": True,
			"data": {
				"id": c.name,
				"phone": phone_val,
				"customerName": c.customer_name,
				"email": c.email,
				"verifiedAt": str(c.verified_at) if c.verified_at else None,
				"lastVisited": str(last_visited) if last_visited else None,
				"orders": orders,
				"tableBookings": table_bookings,
				"banquetBookings": banquet_bookings
			}
		}
	except Exception as e:
		frappe.log_error(f"get_customer_by_phone error: {e}", "Customer_API")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_restaurant_customers(restaurant_id, search=None, page=1, page_size=20):
	"""
	Restaurant: Get customers who have orders/bookings at this restaurant only. Supports search (name, phone), pagination.
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		restaurant_ids = get_user_restaurant_ids(frappe.session.user)
		if "System Manager" not in frappe.get_roles() and restaurant not in restaurant_ids:
			return {"success": False, "error": "Permission denied"}

		page = max(1, int(page))
		page_size = max(1, min(100, int(page_size)))
		search_term = (search or "").strip().lower() if search else None

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

			order_fields = ["name", "order_number", "total", "status", "creation", "customer_phone"]
			if frappe.db.has_column("Order", "customer_rating"):
				order_fields.extend(["customer_rating", "customer_feedback"])
			orders = frappe.get_all(
				"Order",
				filters={"restaurant": restaurant, "platform_customer": cid},
				fields=order_fields
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

			if search_term:
				name_match = (c.customer_name or "").lower().find(search_term) >= 0
				ph = (phone or "")
				phone_match = search_term in ph or search_term in ph.lower()
				if not name_match and not phone_match:
					continue

			last_dates = []
			for o in orders:
				if o.get("creation"):
					last_dates.append(o["creation"])
			for b in table_bookings + banquet_bookings:
				if b.get("creation"):
					last_dates.append(b["creation"])
			last_visited = max(last_dates) if last_dates else None

			customers.append({
				"id": c.name,
				"phone": phone,
				"customerName": c.customer_name,
				"verifiedAt": str(c.verified_at) if c.verified_at else None,
				"lastVisited": str(last_visited) if last_visited else None,
				"orders": orders,
				"tableBookings": table_bookings,
				"banquetBookings": banquet_bookings
			})

		# Deduplicate by canonical phone: merge customers with same phone (e.g. +91 7487871213 vs 7487871213)
		by_canonical = {}
		for cust in customers:
			canonical = canonical_phone(cust.get("phone") or "")
			if not canonical or len(canonical) != 10:
				canonical = cust.get("id") or cust.get("phone") or str(id(cust))
			if canonical not in by_canonical:
				by_canonical[canonical] = cust
			else:
				existing = by_canonical[canonical]
				existing["orders"] = (existing.get("orders") or []) + (cust.get("orders") or [])
				existing["tableBookings"] = (existing.get("tableBookings") or []) + (cust.get("tableBookings") or [])
				existing["banquetBookings"] = (existing.get("banquetBookings") or []) + (cust.get("banquetBookings") or [])
				# Prefer verified, then better name, then newer lastVisited
				if cust.get("verifiedAt") and not existing.get("verifiedAt"):
					existing["verifiedAt"] = cust["verifiedAt"]
					existing["id"] = cust["id"]
					existing["customerName"] = cust.get("customerName") or existing.get("customerName")
				if (cust.get("lastVisited") or "") > (existing.get("lastVisited") or ""):
					existing["lastVisited"] = cust.get("lastVisited")

		customers = list(by_canonical.values())

		# Recompute lastVisited from merged orders/bookings
		for cust in customers:
			all_dates = []
			for o in cust.get("orders") or []:
				if o.get("creation"):
					all_dates.append(o["creation"])
			for b in (cust.get("tableBookings") or []) + (cust.get("banquetBookings") or []):
				if b.get("creation"):
					all_dates.append(b["creation"])
			cust["lastVisited"] = str(max(all_dates)) if all_dates else None

		customers.sort(key=lambda x: (x.get("lastVisited") or "", x.get("customerName") or ""), reverse=True)
		total_count = len(customers)
		start = (page - 1) * page_size
		customers = customers[start:start + page_size]

		is_admin = "System Manager" in frappe.get_roles()
		return {"success": True, "data": {"customers": customers, "isAdmin": is_admin, "totalCount": total_count}}
	except Exception as e:
		frappe.log_error(f"get_restaurant_customers error: {e}", "Customer_API")
		return {"success": False, "error": str(e)}

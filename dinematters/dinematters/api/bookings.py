# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Table and Banquet Bookings
All endpoints require restaurant_id for SaaS multi-tenancy
"""

import frappe
from frappe import _
from frappe.utils import flt, get_datetime_str, getdate, today
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api
from dinematters.dinematters.utils.customer_helpers import require_verified_phone, get_or_create_customer
import json


# ========== TABLE BOOKING APIs ==========

@frappe.whitelist(allow_guest=True)
def create_table_booking(restaurant_id, number_of_diners, date, time_slot, customer_info=None, session_id=None):
	"""
	POST /api/method/dinematters.dinematters.api.bookings.create_table_booking
	Create a new table reservation
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Parse customer_info if string
		if isinstance(customer_info, str):
			customer_info = json.loads(customer_info) if customer_info else {}
		customer_info = customer_info or {}
		
		# OTP gate: require verified phone when verify_my_user is on
		phone = customer_info.get("phone")
		if phone and not require_verified_phone(restaurant_id, phone):
			return {
				"success": False,
				"error": {"code": "PHONE_NOT_VERIFIED", "message": "Please verify your phone with OTP first"}
			}
		
		# Get platform customer for linking
		platform_customer = None
		if phone:
			cust = get_or_create_customer(phone, customer_info.get("fullName"), customer_info.get("email"))
			platform_customer = cust.name if cust else None
		
		# Get user
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Create table booking
		booking_doc = frappe.get_doc({
			"doctype": "Table Booking",
			"restaurant": restaurant,
			"user": user,
			"session_id": session_id,
			"number_of_diners": int(number_of_diners),
			"date": date,
			"time_slot": time_slot,
			"status": "pending",
			"customer_name": customer_info.get("fullName"),
			"customer_phone": customer_info.get("phone"),
			"customer_email": customer_info.get("email"),
			"platform_customer": platform_customer,
			"notes": customer_info.get("notes")
		})
		booking_doc.insert(ignore_permissions=True)
		
		# Format response
		booking_data = {
			"id": str(booking_doc.name),
			"bookingNumber": booking_doc.booking_number,
			"numberOfDiners": booking_doc.number_of_diners,
			"date": str(booking_doc.date),
			"timeSlot": booking_doc.time_slot,
			"status": booking_doc.status,
			"createdAt": get_datetime_str(booking_doc.creation)
		}
		
		if booking_doc.customer_name:
			booking_data["customerInfo"] = {
				"fullName": booking_doc.customer_name,
				"phone": booking_doc.customer_phone,
				"email": booking_doc.customer_email,
				"notes": booking_doc.notes
			}
		
		return {
			"success": True,
			"data": {
				"booking": booking_data
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in create_table_booking: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "BOOKING_CREATE_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_table_bookings(restaurant_id, status=None, date_from=None, date_to=None, page=1, limit=20, session_id=None):
	"""
	GET /api/method/dinematters.dinematters.api.bookings.get_table_bookings
	Get user's table bookings
	"""
	try:
		# Validate restaurant (allow guest access for public bookings)
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Get user
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Build filters
		filters = {"restaurant": restaurant}
		if user:
			filters["user"] = user
		elif session_id:
			filters["session_id"] = session_id
		
		if status:
			filters["status"] = status
		
		if date_from:
			filters["date"] = [">=", date_from]
		if date_to:
			if "date" in filters and isinstance(filters["date"], list):
				filters["date"].append(["<=", date_to])
			else:
				filters["date"] = ["<=", date_to]
		
		# Pagination
		page = int(page) or 1
		limit = int(limit) or 20
		start = (page - 1) * limit
		
		# Get bookings
		bookings = frappe.get_all(
			"Table Booking",
			fields=[
				"name as id",
				"booking_number",
				"number_of_diners",
				"date",
				"time_slot",
				"status",
				"creation"
			],
			filters=filters,
			limit_start=start,
			limit_page_length=limit,
			order_by="date desc, creation desc"
		)
		
		# Format bookings
		formatted_bookings = []
		for booking in bookings:
			formatted_bookings.append({
				"id": str(booking["id"]),
				"bookingNumber": booking["booking_number"],
				"numberOfDiners": booking["number_of_diners"],
				"date": str(booking["date"]),
				"timeSlot": booking["time_slot"],
				"status": booking["status"],
				"createdAt": get_datetime_str(booking["creation"])
			})
		
		# Get total count
		total = frappe.db.count("Table Booking", filters=filters)
		total_pages = (total + limit - 1) // limit if limit > 0 else 1
		
		return {
			"success": True,
			"data": {
				"bookings": formatted_bookings,
				"pagination": {
					"page": page,
					"limit": limit,
					"total": total,
					"totalPages": total_pages
				}
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_table_bookings: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "BOOKING_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_available_time_slots(restaurant_id, date, number_of_diners=None):
	"""
	GET /api/method/dinematters.dinematters.api.bookings.get_available_time_slots
	Get available time slots for table booking on a specific date
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Default time slots (can be configured per restaurant)
		all_slots = [
			"11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
			"2:00 PM", "2:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
			"8:00 PM", "8:15 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM"
		]
		
		# Get booked slots for this date
		booked_slots = frappe.get_all(
			"Table Booking",
			filters={
				"restaurant": restaurant,
				"date": date,
				"status": ["!=", "cancelled"]
			},
			pluck="time_slot"
		)
		
		available_slots = [slot for slot in all_slots if slot not in booked_slots]
		unavailable_slots = booked_slots
		
		return {
			"success": True,
			"data": {
				"date": date,
				"availableSlots": available_slots,
				"unavailableSlots": unavailable_slots
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_available_time_slots: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "SLOT_FETCH_ERROR",
				"message": str(e)
			}
		}


# ========== BANQUET BOOKING APIs ==========

@frappe.whitelist(allow_guest=True)
def create_banquet_booking(restaurant_id, number_of_guests, event_type, date, time_slot, customer_info=None, session_id=None):
	"""
	POST /api/method/dinematters.dinematters.api.bookings.create_banquet_booking
	Create a new banquet/event booking
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Parse customer_info if string
		if isinstance(customer_info, str):
			customer_info = json.loads(customer_info) if customer_info else {}
		customer_info = customer_info or {}
		
		# OTP gate: require verified phone when verify_my_user is on
		phone = customer_info.get("phone")
		if phone and not require_verified_phone(restaurant_id, phone):
			return {
				"success": False,
				"error": {"code": "PHONE_NOT_VERIFIED", "message": "Please verify your phone with OTP first"}
			}
		
		# Get platform customer for linking
		platform_customer = None
		if phone:
			cust = get_or_create_customer(phone, customer_info.get("fullName"), customer_info.get("email"))
			platform_customer = cust.name if cust else None
		
		# Get user
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Create banquet booking
		booking_doc = frappe.get_doc({
			"doctype": "Banquet Booking",
			"restaurant": restaurant,
			"user": user,
			"session_id": session_id,
			"number_of_guests": int(number_of_guests),
			"event_type": event_type,
			"date": date,
			"time_slot": time_slot,
			"status": "pending",
			"customer_name": customer_info.get("fullName"),
			"customer_phone": customer_info.get("phone"),
			"customer_email": customer_info.get("email"),
			"platform_customer": platform_customer,
			"notes": customer_info.get("notes")
		})
		booking_doc.insert(ignore_permissions=True)
		
		# Format response
		booking_data = {
			"id": str(booking_doc.name),
			"bookingNumber": booking_doc.booking_number,
			"numberOfGuests": booking_doc.number_of_guests,
			"eventType": booking_doc.event_type,
			"date": str(booking_doc.date),
			"timeSlot": booking_doc.time_slot,
			"status": booking_doc.status,
			"createdAt": get_datetime_str(booking_doc.creation)
		}
		
		if booking_doc.customer_name:
			booking_data["customerInfo"] = {
				"fullName": booking_doc.customer_name,
				"phone": booking_doc.customer_phone,
				"email": booking_doc.customer_email,
				"notes": booking_doc.notes
			}
		
		return {
			"success": True,
			"data": {
				"booking": booking_data
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in create_banquet_booking: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "BOOKING_CREATE_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_banquet_bookings(restaurant_id, status=None, event_type=None, date_from=None, date_to=None, page=1, limit=20, session_id=None):
	"""
	GET /api/method/dinematters.dinematters.api.bookings.get_banquet_bookings
	Get user's banquet bookings
	"""
	try:
		# Validate restaurant (allow guest access for public bookings)
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Get user
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Build filters
		filters = {"restaurant": restaurant}
		if user:
			filters["user"] = user
		elif session_id:
			filters["session_id"] = session_id
		
		if status:
			filters["status"] = status
		
		if event_type:
			filters["event_type"] = event_type
		
		if date_from:
			filters["date"] = [">=", date_from]
		if date_to:
			if "date" in filters and isinstance(filters["date"], list):
				filters["date"].append(["<=", date_to])
			else:
				filters["date"] = ["<=", date_to]
		
		# Pagination
		page = int(page) or 1
		limit = int(limit) or 20
		start = (page - 1) * limit
		
		# Get bookings
		bookings = frappe.get_all(
			"Banquet Booking",
			fields=[
				"name as id",
				"booking_number",
				"number_of_guests",
				"event_type",
				"date",
				"time_slot",
				"status",
				"creation"
			],
			filters=filters,
			limit_start=start,
			limit_page_length=limit,
			order_by="date desc, creation desc"
		)
		
		# Format bookings
		formatted_bookings = []
		for booking in bookings:
			formatted_bookings.append({
				"id": str(booking["id"]),
				"bookingNumber": booking["booking_number"],
				"numberOfGuests": booking["number_of_guests"],
				"eventType": booking["event_type"],
				"date": str(booking["date"]),
				"timeSlot": booking["time_slot"],
				"status": booking["status"],
				"createdAt": get_datetime_str(booking["creation"])
			})
		
		# Get total count
		total = frappe.db.count("Banquet Booking", filters=filters)
		total_pages = (total + limit - 1) // limit if limit > 0 else 1
		
		return {
			"success": True,
			"data": {
				"bookings": formatted_bookings,
				"pagination": {
					"page": page,
					"limit": limit,
					"total": total,
					"totalPages": total_pages
				}
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_banquet_bookings: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "BOOKING_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_banquet_available_time_slots(restaurant_id, date, number_of_guests=None, event_type=None):
	"""
	GET /api/method/dinematters.dinematters.api.bookings.get_banquet_available_time_slots
	Get available time slots for banquet booking on a specific date
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Default time slots for banquets (typically fewer slots)
		all_slots = [
			"11:00 AM", "12:00 PM", "2:00 PM", "6:00 PM", "8:00 PM"
		]
		
		# Get booked slots for this date
		booked_slots = frappe.get_all(
			"Banquet Booking",
			filters={
				"restaurant": restaurant,
				"date": date,
				"status": ["!=", "cancelled"]
			},
			pluck="time_slot"
		)
		
		available_slots = [slot for slot in all_slots if slot not in booked_slots]
		unavailable_slots = booked_slots
		
		return {
			"success": True,
			"data": {
				"date": date,
				"availableSlots": available_slots,
				"unavailableSlots": unavailable_slots
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_banquet_available_time_slots: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "SLOT_FETCH_ERROR",
				"message": str(e)
			}
		}



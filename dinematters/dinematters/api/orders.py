# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
API endpoints for Orders
Matches format from BACKEND_API_DOCUMENTATION.md
"""

import frappe
from frappe import _
from frappe.utils import flt, now_datetime, get_datetime_str, add_to_date
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api, validate_product_belongs_to_restaurant
from dinematters.dinematters.utils.currency_helpers import get_restaurant_currency_info
from dinematters.dinematters.utils.customer_helpers import (
	require_verified_phone,
	get_or_create_customer,
	normalize_phone,
	_find_customer_by_normalized_phone,
	get_phone_variants_for_lookup,
)
import json
import random
import string
from datetime import datetime

def load_customization_options(product_doc):
	"""
	Load customization options for a product
	Frappe doesn't automatically load nested child tables, so we need to manually load options
	"""
	if not product_doc.customization_questions:
		return
	
	for question in product_doc.customization_questions:
		# Load options for this question
		options_list = frappe.get_all(
			"Customization Option",
			filters={
				"parent": question.name,
				"parenttype": "Customization Question",
				"parentfield": "options"
			},
			fields=["option_id", "label", "price", "is_vegetarian", "is_default", "display_order"],
			order_by="display_order asc"
		)
		
		# Convert to objects and attach to question
		question.options = []
		for opt in options_list:
			# Create a simple object with the option data
			option_obj = frappe._dict(opt)
			question.options.append(option_obj)

@frappe.whitelist(allow_guest=True)
def create_order(restaurant_id, items, cooking_requests=None, customer_info=None, delivery_info=None, session_id=None, table_number=None, coupon_code=None, payment_method=None):
	"""
	POST /api/v1/orders
	Place a new order
	Requires restaurant_id for SaaS multi-tenancy
	Optional: coupon_code for applying discount
	Optional: payment_method - 'pay_at_counter' | 'pay_online'
	  - pay_at_counter: status = Pending Verification, not pushed to KOT until staff accepts
	  - pay_online or omit: order goes through payment flow (create_payment_order), status set on payment
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Parse JSON strings if needed
		if isinstance(items, str):
			items = json.loads(items)
		if isinstance(cooking_requests, str):
			cooking_requests = json.loads(cooking_requests) if cooking_requests else []
		if isinstance(customer_info, str):
			customer_info = json.loads(customer_info) if customer_info else {}
		if isinstance(delivery_info, str):
			delivery_info = json.loads(delivery_info) if delivery_info else {}
		customer_info = customer_info or {}
		
		# OTP gate: require verified phone when verify_my_user is on
		phone = customer_info.get("phone")
		if phone and not require_verified_phone(restaurant_id, phone):
			return {
				"success": False,
				"error": {"code": "PHONE_NOT_VERIFIED", "message": "Please verify your phone with OTP first"}
			}

		platform_customer = None
		if phone:
			cust = get_or_create_customer(phone, customer_info.get("name"), customer_info.get("email"))
			platform_customer = cust.name if cust else None
		
		# Get user
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Validate items
		if not items or len(items) == 0:
			return {
				"success": False,
				"error": {
					"code": "VALIDATION_ERROR",
					"message": "Order must contain at least one item"
				}
			}
		
		# Generate order ID and order number
		order_id = generate_order_id()
		order_number = generate_order_number()
		
		# Calculate totals
		subtotal = 0
		discount = 0
		
		# Process order items
		order_items = []
		for item in items:
			dish_id = item.get("dishId")
			quantity = cint(item.get("quantity", 1))
			customizations = item.get("customizations", {})
			
			# Validate product exists
			if not frappe.db.exists("Menu Product", dish_id):
				return {
					"success": False,
					"error": {
						"code": "PRODUCT_NOT_FOUND",
						"message": f"Product {dish_id} not found"
					}
				}
			
			product = frappe.get_doc("Menu Product", dish_id)
			load_customization_options(product)
			
			# Validate product belongs to restaurant
			if product.restaurant != restaurant:
				return {
					"success": False,
					"error": {
						"code": "PRODUCT_NOT_FOUND",
						"message": f"Product {dish_id} does not belong to restaurant {restaurant_id}"
					}
				}
			
			# Calculate unit price
			unit_price = flt(product.price)
			original_price = flt(product.original_price) if product.original_price else unit_price
			
			# Add customization prices
			if customizations and product.customization_questions:
				for question in product.customization_questions:
					question_id = question.question_id
					if question_id in customizations:
						selected_options = customizations[question_id]
						if isinstance(selected_options, str):
							selected_options = [selected_options]
						
						for option_id in selected_options:
							for option in question.options:
								if option.option_id == option_id:
									unit_price += flt(option.price) or 0
									break
			
			total_price = unit_price * quantity
			subtotal += total_price
			
			# Calculate discount if original price exists
			if original_price > unit_price:
				discount += (original_price - unit_price) * quantity
			
			order_items.append({
				"product": dish_id,
				"quantity": quantity,
				"customizations": json.dumps(customizations) if customizations else None,
				"unit_price": unit_price,
				"original_price": original_price if original_price != unit_price else None,
				"total_price": total_price
			})
		
		# Calculate tax and delivery fee (can be configured)
		tax = calculate_tax(subtotal)
		delivery_fee = flt(delivery_info.get("deliveryFee", 0)) if delivery_info else 0
		
		# Apply coupon discount if provided, or detect auto-offers
		coupon_discount = 0
		applied_coupon = None
		applied_coupon_code = None
		
		if coupon_code:
			try:
				# Validate coupon with enhanced validation
				from dinematters.dinematters.api.coupons import validate_coupon
				
				# Prepare cart items for combo validation
				cart_items_for_validation = [{"dishId": item.get("product")} for item in order_items]
				
				coupon_result = validate_coupon(
					restaurant_id, 
					coupon_code, 
					subtotal,
					customer_id=platform_customer,
					cart_items=json.dumps(cart_items_for_validation)
				)
				
				if coupon_result.get("success"):
					coupon_data = coupon_result.get("data", {}).get("coupon", {})
					coupon_discount = flt(coupon_data.get("discountAmount", 0))
					applied_coupon = coupon_data.get("id")
					applied_coupon_code = coupon_data.get("code")
					discount += coupon_discount
			except Exception as e:
				frappe.log_error(f"Coupon validation error: {str(e)}")
				# Continue without coupon if validation fails
		else:
			# No coupon code provided - check for auto-offers
			try:
				from dinematters.dinematters.api.coupons import get_applicable_offers
				
				# Prepare cart items for auto-offer detection
				cart_items_for_offers = [{"dishId": item.get("product")} for item in order_items]
				
				offers_result = get_applicable_offers(
					restaurant_id,
					json.dumps(cart_items_for_offers),
					subtotal,
					customer_id=platform_customer
				)
				
				if offers_result.get("success"):
					best_offer = offers_result.get("data", {}).get("bestOffer")
					if best_offer:
						coupon_discount = flt(best_offer.get("discountAmount", 0))
						applied_coupon = best_offer.get("id")
						applied_coupon_code = best_offer.get("code")
						discount += coupon_discount
			except Exception as e:
				frappe.log_error(f"Auto-offer detection error: {str(e)}")
				# Continue without auto-offer if detection fails
		
		total = subtotal - discount + tax + delivery_fee
		
		# Parse table_number from QR code if provided
		parsed_table_number = None
		if table_number:
			from dinematters.dinematters.api.cart import parse_table_number_from_qr
			parsed_table_number = parse_table_number_from_qr(table_number, restaurant_id)
		
		# Determine order status and payment method based on payment flow
		# pay_at_counter: pending_verification + pay_at_counter - staff must accept before KOT
		# pay_online or omit: confirmed - order is created and immediately visible in Real Time Orders
		initial_status = "confirmed"
		order_payment_method = None
		if payment_method:
			pm = str(payment_method).strip().lower()
			if pm in ("pay_at_counter", "pay at counter"):
				order_payment_method = "pay_at_counter"
				initial_status = "pending_verification"
			elif pm in ("pay_online", "pay online"):
				order_payment_method = "pay_online"
				initial_status = "confirmed"
		
		# Create order document
		order_doc = frappe.get_doc({
			"doctype": "Order",
			"order_id": order_id,
			"order_number": order_number,
			"restaurant": restaurant,
			"customer": user,
			"customer_name": customer_info.get("name") if customer_info else None,
			"customer_email": customer_info.get("email") if customer_info else None,
			"customer_phone": customer_info.get("phone") if customer_info else None,
			"platform_customer": platform_customer,
			"subtotal": subtotal,
			"discount": discount,
			"tax": tax,
			"delivery_fee": delivery_fee,
			"total": total,
			"coupon": applied_coupon,
			"cooking_requests": json.dumps(cooking_requests) if cooking_requests else None,
			"status": initial_status,
			"payment_status": "pending",
			"payment_method": order_payment_method,
			"table_number": parsed_table_number,
			"delivery_address": delivery_info.get("address") if delivery_info else None,
			"delivery_city": delivery_info.get("city") if delivery_info else None,
			"delivery_state": delivery_info.get("state") if delivery_info else None,
			"delivery_zip_code": delivery_info.get("zipCode") if delivery_info else None,
			"delivery_instructions": delivery_info.get("instructions") if delivery_info else None,
			"estimated_delivery": add_to_date(now_datetime(), minutes=30)  # Default 30 minutes
		})
		
		# Add order items
		for item_data in order_items:
			order_doc.append("order_items", item_data)
		
		order_doc.insert(ignore_permissions=True)
		
		# Track coupon usage if coupon was applied
		if applied_coupon and platform_customer:
			try:
				# Create coupon usage record
				usage_doc = frappe.get_doc({
					"doctype": "Coupon Usage",
					"coupon": applied_coupon,
					"customer": platform_customer,
					"order": order_doc.name,
					"restaurant": restaurant,
					"discount_amount": coupon_discount
				})
				usage_doc.insert(ignore_permissions=True)
				
				# Increment coupon usage count
				frappe.db.set_value("Coupon", applied_coupon, "usage_count", 
					frappe.db.get_value("Coupon", applied_coupon, "usage_count") + 1)
				frappe.db.commit()
			except Exception as e:
				frappe.log_error(f"Error tracking coupon usage: {str(e)}")
				# Don't fail order if usage tracking fails
		
		# Format response
		formatted_order = format_order(order_doc)
		
		# Clear cart after order placement (for this restaurant)
		from dinematters.dinematters.api.cart import clear_cart
		clear_cart(restaurant_id, session_id)
		
		return {
			"success": True,
			"data": {
				"order": formatted_order
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in create_order: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "ORDER_CREATE_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_orders(restaurant_id, status=None, page=1, limit=20, session_id=None):
	"""
	GET /api/v1/orders
	Get user's orders for restaurant
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Build filters
		filters = {"restaurant": restaurant}
		if user:
			filters["customer"] = user
		elif session_id:
			# For guest users, we might need to track by session or phone/email
			# For now, return empty if no user
			pass
		
		if status:
			filters["status"] = status
		
		# Pagination
		page = cint(page) or 1
		limit = cint(limit) or 20
		start = (page - 1) * limit
		
		# Get orders
		orders = frappe.get_all(
			"Order",
			fields=[
				"order_id as id",
				"order_number",
				"status",
				"total",
				"creation as createdAt",
				"estimated_delivery as estimatedDelivery"
			],
			filters=filters,
			limit_start=start,
			limit_page_length=limit,
			order_by="creation desc"
		)
		
		# Format dates
		for order in orders:
			if order.get("createdAt"):
				order["createdAt"] = get_datetime_str(order["createdAt"])
			if order.get("estimatedDelivery"):
				order["estimatedDelivery"] = get_datetime_str(order["estimatedDelivery"])
		
		# Get total count
		total = frappe.db.count("Order", filters=filters)
		total_pages = (total + limit - 1) // limit if limit > 0 else 1
		
		# Get currency info for restaurant
		currency_info = get_restaurant_currency_info(restaurant)
		
		return {
			"success": True,
			"data": {
				"orders": orders,
				"pagination": {
					"page": page,
					"limit": limit,
					"total": total,
					"totalPages": total_pages
				},
				"currency": currency_info.get("currency", "INR"),
				"currencySymbol": currency_info.get("symbol", "₹"),
				"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_orders: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "ORDER_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_customer_orders(restaurant_id, phone, page=1, limit=20, include_items=False):
	"""
	GET /api/v1/customer-orders
	Get orders for a customer by phone and restaurant.
	For frontend "My Orders" - requires verified phone (OTP).
	Input: restaurant_id, phone, page, limit, include_items (optional, default false)
	Response: orders list with pagination; items included when include_items=true.
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id)

		normalized = normalize_phone(phone)
		if not normalized or len(normalized) != 10:
			return {
				"success": False,
				"error": {"code": "INVALID_PHONE", "message": "Invalid phone number"}
			}

		if not require_verified_phone(restaurant_id, phone):
			return {
				"success": False,
				"error": {"code": "PHONE_NOT_VERIFIED", "message": "Please verify your phone with OTP first"}
			}

		customer_id = _find_customer_by_normalized_phone(normalized)
		phone_variants = get_phone_variants_for_lookup(normalized)

		page = cint(page) or 1
		limit = cint(limit) or 20
		start = (page - 1) * limit

		ph = ", ".join(["%s"] * len(phone_variants))
		if customer_id:
			where_sql = "restaurant = %s AND (platform_customer = %s OR customer_phone IN (" + ph + "))"
			params = [restaurant, customer_id] + phone_variants
		else:
			where_sql = "restaurant = %s AND customer_phone IN (" + ph + ")"
			params = [restaurant] + phone_variants

		base_cols = "name, order_id, order_number, status, total, subtotal, discount, creation, estimated_delivery"
		feedback_cols = ""
		if frappe.db.has_column("Order", "customer_rating"):
			feedback_cols = ", customer_rating, customer_feedback"
		if frappe.db.has_column("Order", "food_rating"):
			feedback_cols += ", food_rating, service_rating"

		order_list = frappe.db.sql("""
			SELECT """ + base_cols + feedback_cols + """
			FROM `tabOrder`
			WHERE """ + where_sql + """
			ORDER BY creation DESC
			LIMIT %s OFFSET %s
		""", params + [limit, start], as_dict=True)

		total = frappe.db.sql(
			"SELECT COUNT(*) FROM `tabOrder` WHERE " + where_sql,
			params,
			as_list=True
		)[0][0]
		total_pages = (total + limit - 1) // limit if limit > 0 else 1

		orders = []
		has_feedback_cols = frappe.db.has_column("Order", "customer_rating")
		for o in order_list:
			order_data = {
				"id": o.get("order_id") or o.get("name"),
				"order_number": o.get("order_number"),
				"status": o.get("status"),
				"total": flt(o.get("total")),
				"subtotal": flt(o.get("subtotal")),
				"discount": flt(o.get("discount") or 0),
				"createdAt": get_datetime_str(o.get("creation")),
				"estimatedDelivery": get_datetime_str(o.get("estimated_delivery")) if o.get("estimated_delivery") else None,
				"customerRating": cint(o.get("customer_rating")) if has_feedback_cols and o.get("customer_rating") is not None else None,
				"customerFeedback": ((o.get("customer_feedback") or "").strip() or None) if has_feedback_cols else None,
				"foodRating": cint(o.get("food_rating")) if o.get("food_rating") is not None else None,
				"serviceRating": cint(o.get("service_rating")) if o.get("service_rating") is not None else None,
			}
			if include_items:
				order_doc = frappe.get_doc("Order", o.get("name"))
				order_data["items"] = _format_order_items_light(order_doc)
			orders.append(order_data)

		return {
			"success": True,
			"data": {
				"orders": orders,
				"pagination": {"page": page, "limit": limit, "total": total, "totalPages": total_pages}
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_customer_orders: {str(e)}")
		return {
			"success": False,
			"error": {"code": "ORDER_FETCH_ERROR", "message": str(e)}
		}


def _format_order_items_light(order_doc):
	"""Format order items with lightweight dish: id, name, media, price."""
	from dinematters.dinematters.api.products import format_product
	items = []
	for item in order_doc.order_items:
		product = frappe.get_doc("Menu Product", item.product)
		full = format_product(product)
		dish = {
			"id": full.get("id"),
			"name": full.get("name"),
			"price": flt(item.unit_price),
		}
		if full.get("media"):
			dish["media"] = full["media"]
		items.append({
			"dishId": item.product,
			"quantity": item.quantity,
			"dish": dish
		})
	return items


@frappe.whitelist(allow_guest=True)
def get_order(restaurant_id, order_id):
	"""
	GET /api/v1/orders/:orderId
	Get single order details
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		if not frappe.db.exists("Order", order_id):
			return {
				"success": False,
				"error": {
					"code": "ORDER_NOT_FOUND",
					"message": f"Order {order_id} not found"
				}
			}
		
		order_doc = frappe.get_doc("Order", order_id)
		
		# Validate order belongs to restaurant
		if order_doc.restaurant != restaurant:
			return {
				"success": False,
				"error": {
					"code": "ORDER_NOT_FOUND",
					"message": f"Order {order_id} not found for restaurant {restaurant_id}"
				}
			}
		
		formatted_order = format_order(order_doc)
		
		return {
			"success": True,
			"data": {
				"order": formatted_order
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_order: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "ORDER_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist()
def update_order_status(order_id, status):
	"""
	PATCH /api/v1/orders/:orderId/status
	Update order status (admin/backend only)
	Simple status update using db.set_value to avoid validation issues
	"""
	try:
		if not frappe.db.exists("Order", order_id):
			return {
				"success": False,
				"error": {
					"code": "ORDER_NOT_FOUND",
					"message": f"Order {order_id} not found"
				}
			}
		
		# Validate status
		valid_statuses = ["pending_verification", "confirmed", "preparing", "ready", "In Billing", "delivered", "billed", "cancelled"]
		if status not in valid_statuses:
			return {
				"success": False,
				"error": {
					"code": "INVALID_STATUS",
					"message": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
				}
			}
		
		# Use db.set_value to update only the status field without full validation
		frappe.db.set_value("Order", order_id, "status", status)
		frappe.db.commit()
		
		return {
			"success": True,
			"message": "Order status updated",
			"data": {
				"status": status
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in update_order_status: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "ORDER_UPDATE_ERROR",
				"message": str(e)
			}
		}


# Helper functions

def format_order(order_doc):
	"""Format order document to match API documentation format"""
	from dinematters.dinematters.api.products import format_product
	
	# Format order items
	items = []
	recalculated_subtotal = 0
	
	for item in order_doc.order_items:
		product = frappe.get_doc("Menu Product", item.product)
		load_customization_options(product)
		customizations = json.loads(item.customizations) if item.customizations else {}
		
		# Recalculate unit price with customizations (fixes old orders with incorrect pricing)
		unit_price = flt(product.price)
		if customizations and product.customization_questions:
			for question in product.customization_questions:
				question_id = question.question_id
				if question_id in customizations:
					selected_options = customizations[question_id]
					if isinstance(selected_options, str):
						selected_options = [selected_options]
					
					for option_id in selected_options:
						for option in question.options:
							if option.option_id == option_id:
								unit_price += flt(option.price) or 0
								break
		
		total_price = unit_price * item.quantity
		recalculated_subtotal += total_price
		
		item_data = {
			"dishId": item.product,
			"dish": format_product(product),
			"quantity": item.quantity,
			"customizations": customizations,
			"unitPrice": unit_price,
			"totalPrice": total_price
		}
		
		if item.original_price:
			item_data["originalPrice"] = flt(item.original_price)
		
		items.append(item_data)
	
	# Parse cooking requests
	cooking_requests = []
	if order_doc.cooking_requests:
		cooking_requests = json.loads(order_doc.cooking_requests)
	
	# Get currency info for restaurant
	currency_info = get_restaurant_currency_info(order_doc.restaurant)
	
	# Recalculate tax and total based on corrected subtotal
	recalculated_tax = calculate_tax(recalculated_subtotal)
	recalculated_total = recalculated_subtotal - flt(order_doc.discount) + recalculated_tax + flt(order_doc.delivery_fee)
	
	order_data = {
		"id": order_doc.order_id,
		"orderNumber": order_doc.order_number,
		"items": items,
		"subtotal": recalculated_subtotal,
		"discount": flt(order_doc.discount),
		"tax": recalculated_tax,
		"deliveryFee": flt(order_doc.delivery_fee),
		"total": recalculated_total,
		"cookingRequests": cooking_requests,
		"status": order_doc.status,
		"createdAt": get_datetime_str(order_doc.creation),
		"estimatedDelivery": get_datetime_str(order_doc.estimated_delivery) if order_doc.estimated_delivery else None,
		"currency": currency_info.get("currency", "USD"),
		"currencySymbol": currency_info.get("symbol", "$"),
		"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
	}
	
	# Add table_number if available
	if order_doc.table_number:
		order_data["tableNumber"] = order_doc.table_number
	
	# Add customer info if available
	if order_doc.customer_name:
		order_data["customerInfo"] = {
			"name": order_doc.customer_name,
			"email": order_doc.customer_email,
			"phone": order_doc.customer_phone
		}
	
	# Add delivery info if available
	if order_doc.delivery_address:
		order_data["deliveryInfo"] = {
			"address": order_doc.delivery_address,
			"city": order_doc.delivery_city,
			"state": order_doc.delivery_state,
			"zipCode": order_doc.delivery_zip_code,
			"instructions": order_doc.delivery_instructions
		}
	
	# Add coupon info if available
	if order_doc.coupon:
		try:
			coupon_doc = frappe.get_doc("Coupon", order_doc.coupon)
			order_data["coupon"] = {
				"id": str(coupon_doc.name),
				"code": coupon_doc.code,
				"discount": flt(coupon_doc.discount_value),
				"type": coupon_doc.discount_type or "flat",
				"description": coupon_doc.description,
				"detailedDescription": coupon_doc.detailed_description
			}
		except frappe.DoesNotExistError:
			# Coupon was deleted, just include the reference
			order_data["coupon"] = order_doc.coupon

	# Add feedback if available
	if frappe.db.has_column("Order", "customer_rating"):
		order_data["customerRating"] = cint(order_doc.customer_rating) if order_doc.customer_rating else None
		order_data["customerFeedback"] = order_doc.customer_feedback or None
	if frappe.db.has_column("Order", "food_rating"):
		fr = getattr(order_doc, "food_rating", None)
		order_data["foodRating"] = cint(fr) if fr is not None else None
	if frappe.db.has_column("Order", "service_rating"):
		sr = getattr(order_doc, "service_rating", None)
		order_data["serviceRating"] = cint(sr) if sr is not None else None
	
	return order_data


def generate_order_id():
	"""Generate unique order ID"""
	timestamp = int(datetime.now().timestamp())
	random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
	return f"order-{timestamp}-{random_str}"


def generate_order_number():
	"""Generate human-readable order number: ORD-YYYY-NNN"""
	year = datetime.now().year
	# Get count of orders this year
	count = frappe.db.count("Order", filters={
		"creation": [">=", f"{year}-01-01"],
		"creation": ["<=", f"{year}-12-31"]
	})
	sequence = str(count + 1).zfill(3)
	return f"ORD-{year}-{sequence}"


def calculate_tax(subtotal):
	"""Calculate tax (can be configured based on business rules)"""
	# For now, return 0. Can be configured later
	return 0


def cint(value):
	"""Convert to integer"""
	from frappe.utils import cint as frappe_cint
	return frappe_cint(value)


@frappe.whitelist(allow_guest=True)
def post_order_feedback(restaurant_id, order_id, phone, food_rating=None, service_rating=None, suggestion=None):
	"""
	POST feedback for an order. Customer-facing, requires verified phone.
	Input: restaurant_id, order_id, phone, food_rating (1-5), service_rating (1-5), suggestion (optional)
	Verifies phone owns the order (customer_phone or platform_customer match).
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id)

		normalized = normalize_phone(phone)
		if not normalized or len(normalized) != 10:
			return {
				"success": False,
				"error": {"code": "INVALID_PHONE", "message": "Invalid phone number"}
			}

		if not require_verified_phone(restaurant_id, phone):
			return {
				"success": False,
				"error": {"code": "PHONE_NOT_VERIFIED", "message": "Please verify your phone with OTP first"}
			}

		order_name = frappe.db.get_value("Order", {"order_id": order_id}, "name")
		if not order_name:
			order_name = order_id
		if not frappe.db.exists("Order", order_name):
			return {
				"success": False,
				"error": {"code": "ORDER_NOT_FOUND", "message": "Order not found"}
			}

		order = frappe.get_doc("Order", order_name)
		if order.restaurant != restaurant:
			return {
				"success": False,
				"error": {"code": "ORDER_NOT_FOUND", "message": "Order not found for this restaurant"}
			}

		phone_variants = get_phone_variants_for_lookup(normalized)
		customer_id = _find_customer_by_normalized_phone(normalized)
		order_phone_normalized = normalize_phone(order.customer_phone or "")
		order_phone_ok = order_phone_normalized == normalized or (order.customer_phone and order.customer_phone.strip() in phone_variants)
		order_customer_ok = customer_id and order.platform_customer == customer_id
		if not order_phone_ok and not order_customer_ok:
			return {
				"success": False,
				"error": {"code": "UNAUTHORIZED", "message": "This order does not belong to this phone number"}
			}

		if food_rating is not None:
			r = int(food_rating)
			if 1 <= r <= 5:
				frappe.db.set_value("Order", order_name, "food_rating", r)
		if service_rating is not None:
			r = int(service_rating)
			if 1 <= r <= 5:
				frappe.db.set_value("Order", order_name, "service_rating", r)
		if suggestion is not None:
			frappe.db.set_value("Order", order_name, "customer_feedback", str(suggestion).strip() or None)
		if food_rating is not None or service_rating is not None:
			avg = None
			f = int(food_rating) if food_rating is not None else None
			s = int(service_rating) if service_rating is not None else None
			if f is not None and s is not None:
				avg = round((f + s) / 2)
			elif f is not None:
				avg = f
			elif s is not None:
				avg = s
			if avg is not None:
				frappe.db.set_value("Order", order_name, "customer_rating", avg)
		frappe.db.commit()

		return {"success": True, "message": "Feedback submitted"}
	except Exception as e:
		frappe.log_error(f"post_order_feedback error: {e}", "Order_Feedback")
		return {"success": False, "error": {"code": "FEEDBACK_ERROR", "message": str(e)}}


@frappe.whitelist()
def update_order_feedback(order_id, customer_rating=None, customer_feedback=None):
	"""
	Update customer rating and feedback for an order.
	Restaurant staff (with access to the order's restaurant) or System Manager.
	"""
	try:
		if not frappe.db.exists("Order", order_id):
			return {"success": False, "error": "Order not found"}

		order = frappe.get_doc("Order", order_id)
		restaurant_id = order.restaurant

		# Permission: restaurant access or System Manager
		from dinematters.dinematters.utils.permission_helpers import get_user_restaurant_ids
		restaurant_ids = get_user_restaurant_ids(frappe.session.user)
		if "System Manager" not in frappe.get_roles() and restaurant_id not in restaurant_ids:
			return {"success": False, "error": "Permission denied"}

		if customer_rating is not None:
			rating = int(customer_rating)
			if 1 <= rating <= 5:
				order.customer_rating = rating
		if customer_feedback is not None:
			order.customer_feedback = str(customer_feedback).strip() or None

		order.flags.ignore_permissions = True
		order.save()

		return {"success": True, "message": "Feedback updated"}
	except Exception as e:
		frappe.log_error(f"update_order_feedback error: {e}", "Order_Feedback")
		return {"success": False, "error": str(e)}


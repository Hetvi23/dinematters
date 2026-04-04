# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
API endpoints for Orders
Matches format from BACKEND_API_DOCUMENTATION.md
"""

import frappe
from frappe import _
from frappe.utils import flt, cint, now_datetime, get_datetime_str, add_to_date
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api, validate_product_belongs_to_restaurant
from dinematters.dinematters.utils.currency_helpers import get_restaurant_currency_info
from dinematters.dinematters.utils.feature_gate import require_plan
from dinematters.dinematters.utils.customer_helpers import (
	require_verified_phone,
	validate_customer_session,
	get_or_create_customer,
	normalize_phone,
	_find_customer_by_normalized_phone,
	get_phone_variants_for_lookup,
	is_phone_verified,
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
@require_plan('LUX')
def create_order(restaurant_id, items, cooking_requests=None, customer_info=None, delivery_info=None, session_id=None, table_number=None, coupon_code=None, payment_method=None, order_type=None, packaging_fee=None, delivery_fee=None, pickup_time=None, loyalty_coins_redeemed=0, referral_id=None, tax=None, cgst=None, sgst=None, tax_percent=None):
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
		restaurant_doc = frappe.get_doc("Restaurant", restaurant)
		
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
		delivery_info = delivery_info or {}
		order_type = (order_type or "dine_in").strip().lower()
		if order_type not in ("dine_in", "takeaway", "delivery"):
			return {
				"success": False,
				"error": {
					"code": "VALIDATION_ERROR",
					"message": "Invalid order type"
				}
			}

		if order_type == "takeaway" and not restaurant_doc.get("enable_takeaway"):
			return {
				"success": False,
				"error": {
					"code": "ORDER_TYPE_DISABLED",
					"message": "Takeaway is not enabled for this restaurant"
				}
			}

		if order_type == "delivery" and not restaurant_doc.get("enable_delivery"):
			return {
				"success": False,
				"error": {
					"code": "ORDER_TYPE_DISABLED",
					"message": "Delivery is not enabled for this restaurant"
				}
			}

		if order_type in ("takeaway", "delivery"):
			if not customer_info.get("name") or not customer_info.get("phone"):
				return {
					"success": False,
					"error": {
						"code": "VALIDATION_ERROR",
						"message": "Customer name and phone are required for takeaway and delivery orders"
					}
				}

		if order_type == "delivery":
			if not delivery_info.get("address"):
				return {
					"success": False,
					"error": {
						"code": "VALIDATION_ERROR",
						"message": "Delivery address is required for delivery orders"
					}
				}
		
		# OTP/Session gate: require verified phone + valid session token when verify_my_user is on
		phone = customer_info.get("phone")
		if phone:
			# Check if verification is active for this restaurant
			config = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_id}, "verify_my_user")
			if config:
				# Secure Session Check: Validate the X-Customer-Token from headers
				session_token = frappe.request.headers.get("X-Customer-Token") if frappe.request else None
				if not validate_customer_session(phone, session_token):
					return {
						"success": False,
						"error": {"code": "PHONE_NOT_VERIFIED", "message": "Secure session expired or invalid. Please verify with OTP again."}
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
		
		# Process order items to validate products and calculate base unit prices
		order_items = []
		for item in items:
			dish_id = item.get("dishId")
			quantity = cint(item.get("quantity", 1))
			customizations = item.get("customizations", {})
			
			if not frappe.db.exists("Menu Product", dish_id):
				return {"success": False, "error": {"code": "PRODUCT_NOT_FOUND", "message": f"Product {dish_id} not found"}}
			
			product = frappe.get_doc("Menu Product", dish_id)
			load_customization_options(product)
			
			if product.restaurant != restaurant:
				return {"success": False, "error": {"code": "PRODUCT_NOT_FOUND", "message": f"Product {dish_id} invalid for restaurant"}}
			
			# Calculate unit price (base + customizations)
			unit_price = flt(product.price)
			if customizations and product.customization_questions:
				for question in product.customization_questions:
					qid = question.question_id
					if qid in customizations:
						selected = customizations[qid]
						if isinstance(selected, str): selected = [selected]
						for opt_id in selected:
							for opt in question.options:
								if opt.option_id == opt_id:
									unit_price += flt(opt.price) or 0
									break
			
			order_items.append({
				"product": dish_id,
				"quantity": quantity,
				"customizations": json.dumps(customizations) if customizations else None,
				"unit_price": unit_price,
				"total_price": unit_price * quantity
			})

		# Use the NEW centralized pricing engine for production-level consistency
		from dinematters.dinematters.utils.pricing import calculate_cart_totals
		
		# Prepare items for pricing utility
		pricing_items = []
		for item in order_items:
			pricing_items.append({
				"quantity": item["quantity"],
				"unitPrice": item["unit_price"],
				"dishId": item["product"]
			})

		# Accurate fulfillment mapping for core pricing engine
		fulfillment_map = {
			"dine_in": "Dine-in",
			"takeaway": "Takeaway",
			"delivery": "Delivery"
		}
		delivery_type = fulfillment_map.get(order_type, "Dine-in")

		pricing_result = calculate_cart_totals(
			restaurant=restaurant,
			items=pricing_items,
			coupon_code=coupon_code,
			loyalty_coins=cint(loyalty_coins_redeemed),
			customer=platform_customer,
			delivery_type=delivery_type
		)

		# Map pricing results back to variables used in order_doc creation
		subtotal = pricing_result["subtotal"]
		discount = pricing_result["discount"]
		tax = pricing_result["tax"]
		cgst = pricing_result["cgst"]
		sgst = pricing_result["sgst"]
		tax_percent = pricing_result["taxRate"]
		delivery_fee = pricing_result["deliveryFee"]
		packaging_fee = pricing_result["packagingFee"]
		total = pricing_result["total"]
		
		applied_coupon_code = pricing_result["appliedCoupon"]
		applied_coupon = frappe.db.get_value("Coupon", {"code": applied_coupon_code, "restaurant": restaurant}, "name") if applied_coupon_code else None
		coupon_discount = pricing_result["discount"]
		loyalty_discount = pricing_result["loyaltyDiscount"]
		loyalty_coins = cint(loyalty_discount) # ₹1 per coin


		
		# Parse table_number from QR code if provided
		parsed_table_number = None
		if order_type == "dine_in" and table_number:
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
		
		estimated_minutes = cint(restaurant_doc.get("estimated_prep_time", 30) or 30)
		estimated_delivery = add_to_date(now_datetime(), minutes=estimated_minutes)
		pickup_datetime = None
		if pickup_time:
			try:
				pickup_datetime = datetime.fromisoformat(str(pickup_time))
			except Exception:
				pickup_datetime = None

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
			"cgst": cgst,
			"sgst": sgst,
			"tax_percent": tax_percent,
			"order_type": order_type,
			"packaging_fee": packaging_fee,
			"delivery_fee": delivery_fee,
			"total": total,
			"coupon": applied_coupon,
			"cooking_requests": json.dumps(cooking_requests) if cooking_requests else None,
			"status": initial_status,
			"payment_status": "pending",
			"payment_method": order_payment_method,
			"table_number": parsed_table_number,
			"delivery_address": delivery_info.get("address") if delivery_info else None,
			"delivery_landmark": delivery_info.get("landmark") if delivery_info else None,
			"delivery_city": delivery_info.get("city") if delivery_info else None,
			"delivery_state": delivery_info.get("state") if delivery_info else None,
			"delivery_zip_code": delivery_info.get("zipCode") if delivery_info else None,
			"delivery_location_pin": delivery_info.get("locationPin") if delivery_info else None,
			"delivery_instructions": delivery_info.get("instructions") if delivery_info else None,
			"pickup_time": pickup_datetime,
			"estimated_delivery": estimated_delivery,
			"loyalty_coins_redeemed": loyalty_coins,
			"loyalty_discount": loyalty_discount,
			"referral_link": frappe.db.get_value("Referral Link", {"identifier": referral_id}, "name") if referral_id else None
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
		
		# Process Loyalty Earning and Referral Rewards
		try:
			from dinematters.dinematters.utils.loyalty import earn_loyalty_coins, redeem_loyalty_coins, add_loyalty_coins
			
			loyalty_prog = frappe.get_doc("Restaurant Loyalty Config", {"restaurant": restaurant, "is_active": 1})
			if loyalty_prog and platform_customer:
				# 1. Earn points on current order (10% on total)
				earn_loyalty_coins(
					customer=platform_customer,
					restaurant=restaurant,
					amount_paid=order_doc.total,
					reason="Order",
					ref_doctype="Order",
					ref_name=order_doc.name
				)
				
				# 2. Handle Referral Conversion Reward
				if order_doc.referral_link:
					# Check if this is the customer's first order at this restaurant
					order_count = frappe.db.count("Order", {"platform_customer": platform_customer, "restaurant": restaurant, "name": ["!=", order_doc.name]})
					if order_count == 0:
						ref_link = frappe.get_doc("Referral Link", order_doc.referral_link)
						
						# 2. Handle Referral Conversion Reward (Fallback for non-verified or guest users)
						from dinematters.dinematters.api.loyalty import process_referral_welcome_bonus
						referral_id = ref_link.identifier
						if referral_id:
							process_referral_welcome_bonus(platform_customer, restaurant, referral_id)
						
						# 3. Reward Referrer for the order
						add_loyalty_coins(
							customer=ref_link.referrer,
							restaurant=restaurant,
							coins=loyalty_prog.referral_order_reward_coins,
							reason="Referral Order",
							ref_doctype="Order",
							ref_name=order_doc.name
						)
				
				# 3. Deduct points if redeemed
				if loyalty_coins > 0:
					redeem_loyalty_coins(
						customer=platform_customer,
						restaurant=restaurant,
						coins=loyalty_coins,
						reason="Redemption",
						ref_doctype="Order",
						ref_name=order_doc.name
					)
				
				# 4. Renew Referrer's Sharing Limit
				try:
					from dinematters.dinematters.api.loyalty import reset_referral_cycle
					reset_referral_cycle(platform_customer, restaurant)
				except Exception as e:
					frappe.log_error(f"Error resetting referral cycle: {str(e)}")
					
			frappe.db.commit()
		except Exception as e:
			frappe.log_error(f"Error in loyalty earning/referral logic: {str(e)}")
		
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
def get_orders(restaurant_id, status=None, page=1, limit=20, session_id=None, admin_mode=False, date_from=None, date_to=None, search_query=None, recent_only=False, phone=None):
	"""
	GET /api/v1/orders
	Get user's orders for restaurant
	Requires restaurant_id for SaaS multi-tenancy
	Optional: phone — for PRO WhatsApp guest orders (no OTP), filter by customer_phone
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Normalize phone if provided
		if phone:
			from dinematters.dinematters.utils.customer_helpers import normalize_phone
			phone = normalize_phone(str(phone))
		
		# Build filters
		filters = {"restaurant": restaurant}
		
		# Exclude tokenization orders
		filters["is_tokenization"] = ["!=", 1]
		
		# In admin mode, don't filter by customer
		if not admin_mode:
			if phone:
				# PRO WhatsApp guest: filter by phone number captured at checkout
				filters["customer_phone"] = phone
			elif user:
				filters["customer"] = user
			elif session_id:
				# For guest users, track by session ID
				filters["session_id"] = session_id
			else:
				# If no identifier provided, return empty list for security
				return {
					"success": True,
					"data": {
						"orders": [],
						"pagination": {"page": page, "limit": limit, "total": 0, "totalPages": 0},
						"currency": "INR",
						"currencySymbol": "₹"
					}
				}

		else:
			# Admin mode - add additional filters
			if date_from:
				filters["creation"] = [">=", date_from]
			if date_to:
				if "creation" in filters:
					filters["creation"][1] = "<="
					filters["creation"].append(date_to)
				else:
					filters["creation"] = ["<=", date_to]
			
			# Search query filter for admin mode
			if search_query:
				# Add OR condition for search
				search_filters = {
					"restaurant": restaurant,
					"is_tokenization": ["!=", 1],
					"or": [
						{"order_number": ["like", f"%{search_query}%"]},
						{"customer": ["like", f"%{search_query}%"]},
						{"customer_phone": ["like", f"%{search_query}%"]},
						{"coupon": ["like", f"%{search_query}%"]}
					]
				}
				if status and status != 'all':
					search_filters["status"] = status
				if date_from:
					search_filters["creation"] = [">=", date_from]
				if date_to:
					if "creation" in search_filters:
						search_filters["creation"][1] = "<="
						search_filters["creation"].append(date_to)
					else:
						search_filters["creation"] = ["<=", date_to]
				filters = search_filters

		if recent_only:
			# Only show orders from the last 24 hours
			# Using >= add_to_date(now_datetime(), hours=-24)
			filters["creation"] = [">=", add_to_date(now_datetime(), hours=-24)]
		
		if status:
			filters["status"] = status
		
		# Pagination
		page = cint(page) or 1
		limit = cint(limit) or 20
		start = (page - 1) * limit
		
		# Get orders
		if admin_mode:
			# Admin mode - get more fields
			orders = frappe.get_all(
				"Order",
				fields=[
					"name",
					"order_number",
					"status",
					"total",
					"creation",
					"modified",
					"customer",
					"customer_name",
					"customer_phone",
					"table_number",
					"coupon",
					"payment_method",
					"estimated_delivery",
					"restaurant"
				],
				filters=filters,
				limit_start=start,
				limit_page_length=limit,
				order_by="creation desc"
			)
		else:
			# Customer mode - limited fields
			orders = frappe.get_all(
				"Order",
				fields=[
					"order_id as id",
					"order_number",
					"status",
					"total",
					"creation as createdAt",
					"estimated_delivery as estimatedDelivery",
					"delivery_partner as deliveryPartner",
					"delivery_rider_phone as deliveryRiderPhone",
					"delivery_tracking_url as deliveryTrackingUrl",
					"subtotal",
					"tax",
					"discount",
					"packaging_fee as packagingFee",
					"delivery_fee as deliveryFee",
					"total",
					"payment_method as paymentMethod",
					"payment_status as paymentStatus"
				],
				filters=filters,
				limit_start=start,
				limit_page_length=limit,
				order_by="creation desc"
			)
		
		# Format dates
		for order in orders:
			if admin_mode:
				# Admin mode - format creation and modified dates
				if order.get("creation"):
					order["creation"] = get_datetime_str(order["creation"])
				if order.get("modified"):
					order["modified"] = get_datetime_str(order["modified"])
				if order.get("estimated_delivery"):
					order["estimated_delivery"] = get_datetime_str(order["estimated_delivery"])
			else:
				# Customer mode - format with field names
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
def get_customer_orders(restaurant_id, phone, page=1, limit=20, include_items=False, recent_only=False):
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

		# Production-ready auth gate:
		# - When verify_my_user=ON: require a valid session token OR a DB-verified phone.
		#   The DB check acts as a grace fallback for expired tokens (e.g. after Redis restart).
		#   This prevents the "keeps verifying my user" loop while maintaining security.
		# - When verify_my_user=OFF: skip auth entirely — any phone can retrieve their order history.
		session_token = frappe.request.headers.get("X-Customer-Token") if frappe.request else None
		verify_required = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant_id}, "verify_my_user")
		
		# Bypass strict auth for recent WhatsApp shadow orders to allow guest tracking
		is_shadow_request = recent_only or (frappe.request.headers.get("X-Shadow-Request") == "true") if frappe.request else recent_only
		
		if verify_required:
			has_valid_session = validate_customer_session(phone, session_token)
			has_verified_phone = is_phone_verified(phone)
			
			# If no valid session/verified phone, only allow if this is a recent shadow order request
			if not has_valid_session and not has_verified_phone:
				if not is_shadow_request:
					return {
						"success": False,
						"error": {"code": "SECURE_SESSION_INVALID", "message": "Please log in to view your orders."}
					}
				# For shawdow/recent requests, the query below will naturally filter to <= 24h
				# We just need to make sure we also filter for is_whatsapp_order if it's a guest
				pass

		is_authenticated = has_valid_session or has_verified_phone if verify_required else True
		
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

		if recent_only:
			# Use add_to_date for consistent 24-hour window
			twenty_four_hours_ago = add_to_date(now_datetime(), hours=-24)
			where_sql += " AND creation >= %s"
			params.append(twenty_four_hours_ago)

		# Security: If guest is not authenticated, strictly only allow fetching WhatsApp orders
		if not is_authenticated:
			where_sql += " AND is_whatsapp_order = 1"

		base_cols = "name, order_id, order_number, status, total, subtotal, discount, tax, cgst, sgst, tax_percent, packaging_fee, delivery_fee, payment_method, payment_status, creation, estimated_delivery, delivery_partner, delivery_id, delivery_status, delivery_eta, delivery_rider_name, delivery_rider_phone, delivery_tracking_url, order_type"
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
				"tax": flt(o.get("tax") or 0),
				"packagingFee": flt(o.get("packaging_fee") or 0),
				"deliveryFee": flt(o.get("delivery_fee") or 0),
				"paymentMethod": o.get("payment_method"),
				"paymentStatus": o.get("payment_status"),
				"createdAt": get_datetime_str(o.get("creation")),
				"estimatedDelivery": get_datetime_str(o.get("estimated_delivery")) if o.get("estimated_delivery") else None,
				"orderType": o.get("order_type"),
				"deliveryPartner": o.get("delivery_partner"),
				"deliveryId": o.get("delivery_id"),
				"deliveryStatus": o.get("delivery_status"),
				"deliveryEta": get_datetime_str(o.get("delivery_eta")) if o.get("delivery_eta") else None,
				"deliveryRiderName": o.get("delivery_rider_name"),
				"deliveryRiderPhone": o.get("delivery_rider_phone"),
				"deliveryTrackingUrl": o.get("delivery_tracking_url"),
				"cgst": flt(o.get("cgst") or 0),
				"sgst": flt(o.get("sgst") or 0),
				"taxPercent": flt(o.get("tax_percent") or 0),
				"billDetails": _get_bill_details(frappe._dict(o)),
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
			"customizations": json.loads(item.customizations) if item.customizations else {},
			"totalPrice": flt(item.total_price),
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
	tax_info = calculate_tax(recalculated_subtotal, order_doc.restaurant, order_doc.discount)
	recalculated_tax = tax_info.get("total_tax", 0)
	cgst = tax_info.get("cgst", 0)
	sgst = tax_info.get("sgst", 0)
	
	recalculated_total = recalculated_subtotal - flt(order_doc.discount) + recalculated_tax + flt(order_doc.delivery_fee) + flt(getattr(order_doc, "packaging_fee", 0) or 0)
	
	order_data = {
		"id": order_doc.order_id,
		"orderNumber": order_doc.order_number,
		"items": items,
		"orderType": getattr(order_doc, "order_type", None) or "dine_in",
		"subtotal": recalculated_subtotal,
		"discount": flt(order_doc.discount),
		"tax": recalculated_tax,
		"cgst": cgst,
		"sgst": sgst,
		"packagingFee": flt(getattr(order_doc, "packaging_fee", 0) or 0),
		"deliveryFee": flt(order_doc.delivery_fee),
		"total": recalculated_total,
		"cookingRequests": cooking_requests,
		"status": order_doc.status,
		"createdAt": get_datetime_str(order_doc.creation),
		"estimatedDelivery": get_datetime_str(order_doc.estimated_delivery) if order_doc.estimated_delivery else None,
		"deliveryPartner": order_doc.delivery_partner,
		"deliveryId": order_doc.delivery_id,
		"deliveryStatus": order_doc.delivery_status,
		"deliveryEta": get_datetime_str(order_doc.delivery_eta) if order_doc.delivery_eta else None,
		"deliveryRiderName": order_doc.delivery_rider_name,
		"deliveryRiderPhone": order_doc.delivery_rider_phone,
		"deliveryTrackingUrl": order_doc.delivery_tracking_url,
		"pickupTime": get_datetime_str(getattr(order_doc, "pickup_time", None)) if getattr(order_doc, "pickup_time", None) else None,
		"currency": currency_info.get("currency", "USD"),
		"currencySymbol": currency_info.get("symbol", "$"),
		"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
	}
	
	# Add modular billDetails for premium previews
	order_data["billDetails"] = _get_bill_details(order_doc, recalculated_subtotal)
	
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
			"landmark": getattr(order_doc, "delivery_landmark", None),
			"city": order_doc.delivery_city,
			"state": order_doc.delivery_state,
			"zipCode": order_doc.delivery_zip_code,
			"locationPin": getattr(order_doc, "delivery_location_pin", None),
			"instructions": order_doc.delivery_instructions
		}
	
	# Add bill details breakdown
	order_data["billDetails"] = _get_bill_details(order_doc)
	
	# Add coupon details if available
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


def _get_bill_details(order_doc, recalculated_subtotal=None):
	"""
	Universal helper to generate modular billDetails array.
	Used by format_order, get_customer_orders, etc.
	"""
	subtotal = recalculated_subtotal if recalculated_subtotal is not None else flt(order_doc.subtotal)
	
	bill_details = [
		{"label": "Item Total", "value": subtotal, "type": "subtotal"}
	]
	
	if flt(order_doc.discount) > 0:
		bill_details.append({"label": "Item Discount", "value": -flt(order_doc.discount), "type": "discount"})
	
	if flt(getattr(order_doc, "loyalty_discount", 0)) > 0:
		bill_details.append({"label": "Loyalty Discount", "value": -flt(order_doc.loyalty_discount), "type": "discount"})
	
	if flt(order_doc.cgst) > 0:
		tax_rate_str = f"({flt(order_doc.tax_percent or 0)/2}%)" if order_doc.tax_percent else ""
		bill_details.append({"label": f"CGST {tax_rate_str}", "value": flt(order_doc.cgst), "type": "tax"})
		
	if flt(order_doc.sgst) > 0:
		tax_rate_str = f"({flt(order_doc.tax_percent or 0)/2}%)" if order_doc.tax_percent else ""
		bill_details.append({"label": f"SGST {tax_rate_str}", "value": flt(order_doc.sgst), "type": "tax"})
	
	# Fallback if cgst/sgst missing but tax exists
	if flt(order_doc.tax) > 0 and (flt(order_doc.cgst) == 0 or flt(order_doc.sgst) == 0):
		bill_details.append({"label": "Taxes & Charges", "value": flt(order_doc.tax), "type": "tax"})
		
	if flt(getattr(order_doc, "packaging_fee", 0)) > 0:
		bill_details.append({"label": "Packaging Charge", "value": flt(order_doc.packaging_fee), "type": "fee"})
		
	if flt(getattr(order_doc, "delivery_fee", 0)) > 0:
		bill_details.append({"label": "Delivery Fee", "value": flt(order_doc.delivery_fee), "type": "fee"})
	
	bill_details.append({"label": "Total Payable", "value": flt(order_doc.total), "type": "total"})
		
	return bill_details


def calculate_tax(subtotal, restaurant, discount=0):
	"""
	Internal helper to estimate tax based on restaurant settings.
	Consistent with Order.before_save logic.
	"""
	tax_rate = frappe.db.get_value("Restaurant", restaurant, "tax_rate")
	if tax_rate is None: tax_rate = 5.0
	
	taxable_amount = max(0, flt(subtotal) - flt(discount))
	tax_amount = round(taxable_amount * (flt(tax_rate) / 100.0), 2)
	
	cgst = round(tax_amount / 2.0, 2)
	sgst = round(tax_amount - cgst, 2)
	
	return {
		"total_tax": tax_amount,
		"cgst": cgst,
		"sgst": sgst,
		"tax_percent": flt(tax_rate)
	}


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


@frappe.whitelist()
def get_admin_orders(restaurant_id, status=None, page=1, limit=20, date_from=None, date_to=None, search_query=None):
	"""
	GET /api/method/dinematters.dinematters.api.orders.get_admin_orders
	Get ALL orders for a restaurant (admin view)
	Requires restaurant permissions
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Build filters - no customer filter for admin view
		filters = {"restaurant": restaurant}
		
		# Exclude tokenization orders from admin view
		filters["is_tokenization"] = ["!=", 1]
		
		if status and status != 'all':
			filters["status"] = status
		
		# Date filters
		if date_from:
			filters["creation"] = [">=", date_from]
		if date_to:
			if "creation" in filters:
				filters["creation"][1] = "<="
				filters["creation"].append(date_to)
			else:
				filters["creation"] = ["<=", date_to]
		
		# Search query filter
		if search_query:
			# Add OR condition for search
			search_filters = {
				"restaurant": restaurant,
				"is_tokenization": ["!=", 1],
				"or": [
					{"order_number": ["like", f"%{search_query}%"]},
					{"customer": ["like", f"%{search_query}%"]},
					{"customer_phone": ["like", f"%{search_query}%"]},
					{"coupon": ["like", f"%{search_query}%"]}
				]
			}
			if status and status != 'all':
				search_filters["status"] = status
			if date_from:
				search_filters["creation"] = [">=", date_from]
			if date_to:
				if "creation" in search_filters:
					search_filters["creation"][1] = "<="
					search_filters["creation"].append(date_to)
				else:
					search_filters["creation"] = ["<=", date_to]
			filters = search_filters
		
		# Pagination
		page = cint(page) or 1
		limit = cint(limit) or 20
		start = (page - 1) * limit
		
		# Get orders with more fields for admin view
		orders = frappe.get_all(
			"Order",
			fields=[
				"name",
				"order_number",
				"status",
				"total",
				"creation",
				"modified",
				"customer",
				"customer_name",
				"customer_phone",
				"subtotal",
				"discount",
				"tax",
				"cgst",
				"sgst",
				"tax_percent",
				"packaging_fee",
				"delivery_fee",
				"restaurant"
			],
			filters=filters,
			limit_start=start,
			limit_page_length=limit,
			order_by="creation desc"
		)
		
		# Format dates and billing
		for order in orders:
			if order.get("creation"):
				order["creation"] = get_datetime_str(order["creation"])
			if order.get("modified"):
				order["modified"] = get_datetime_str(order["modified"])
			if order.get("estimated_delivery"):
				order["estimated_delivery"] = get_datetime_str(order["estimated_delivery"])
			
			# Add modular billDetails
			order["billDetails"] = _get_bill_details(frappe._dict(order))
		
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
		frappe.log_error(f"Error in get_admin_orders: {str(e)}")
		return {"success": False, "error": str(e)}


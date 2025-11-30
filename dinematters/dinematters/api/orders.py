# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
API endpoints for Orders
Matches format from BACKEND_API_DOCUMENTATION.md
"""

import frappe
from frappe import _
from frappe.utils import flt, now_datetime, get_datetime_str, add_to_date
import json
import random
import string
from datetime import datetime


@frappe.whitelist()
def create_order(items, cooking_requests=None, customer_info=None, delivery_info=None, session_id=None):
	"""
	POST /api/v1/orders
	Place a new order
	"""
	try:
		# Parse JSON strings if needed
		if isinstance(items, str):
			items = json.loads(items)
		if isinstance(cooking_requests, str):
			cooking_requests = json.loads(cooking_requests) if cooking_requests else []
		if isinstance(customer_info, str):
			customer_info = json.loads(customer_info) if customer_info else {}
		if isinstance(delivery_info, str):
			delivery_info = json.loads(delivery_info) if delivery_info else {}
		
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
		total = subtotal - discount + tax + delivery_fee
		
		# Create order document
		order_doc = frappe.get_doc({
			"doctype": "Order",
			"order_id": order_id,
			"order_number": order_number,
			"customer": user,
			"customer_name": customer_info.get("name") if customer_info else None,
			"customer_email": customer_info.get("email") if customer_info else None,
			"customer_phone": customer_info.get("phone") if customer_info else None,
			"subtotal": subtotal,
			"discount": discount,
			"tax": tax,
			"delivery_fee": delivery_fee,
			"total": total,
			"cooking_requests": json.dumps(cooking_requests) if cooking_requests else None,
			"status": "pending",
			"payment_status": "pending",
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
		
		# Format response
		formatted_order = format_order(order_doc)
		
		# Clear cart after order placement
		from dinematters.dinematters.api.cart import clear_cart
		clear_cart(session_id)
		
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


@frappe.whitelist()
def get_orders(status=None, page=1, limit=20, session_id=None):
	"""
	GET /api/v1/orders
	Get user's orders
	"""
	try:
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Build filters
		filters = {}
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
		
		return {
			"success": True,
			"data": {
				"orders": orders,
				"pagination": {
					"page": page,
					"limit": limit,
					"total": total,
					"totalPages": total_pages
				}
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


@frappe.whitelist()
def get_order(order_id):
	"""
	GET /api/v1/orders/:orderId
	Get single order details
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
		
		order_doc = frappe.get_doc("Order", order_id)
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
		valid_statuses = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"]
		if status not in valid_statuses:
			return {
				"success": False,
				"error": {
					"code": "INVALID_STATUS",
					"message": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
				}
			}
		
		order_doc = frappe.get_doc("Order", order_id)
		order_doc.status = status
		order_doc.save(ignore_permissions=True)
		
		return {
			"success": True,
			"message": "Order status updated",
			"data": {
				"order": format_order(order_doc)
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
	for item in order_doc.order_items:
		product = frappe.get_doc("Menu Product", item.product)
		customizations = json.loads(item.customizations) if item.customizations else {}
		
		item_data = {
			"dishId": item.product,
			"dish": format_product(product),
			"quantity": item.quantity,
			"customizations": customizations,
			"unitPrice": flt(item.unit_price),
			"totalPrice": flt(item.total_price)
		}
		
		if item.original_price:
			item_data["originalPrice"] = flt(item.original_price)
		
		items.append(item_data)
	
	# Parse cooking requests
	cooking_requests = []
	if order_doc.cooking_requests:
		cooking_requests = json.loads(order_doc.cooking_requests)
	
	order_data = {
		"id": order_doc.order_id,
		"orderNumber": order_doc.order_number,
		"items": items,
		"subtotal": flt(order_doc.subtotal),
		"discount": flt(order_doc.discount),
		"tax": flt(order_doc.tax),
		"deliveryFee": flt(order_doc.delivery_fee),
		"total": flt(order_doc.total),
		"cookingRequests": cooking_requests,
		"status": order_doc.status,
		"createdAt": get_datetime_str(order_doc.creation),
		"estimatedDelivery": get_datetime_str(order_doc.estimated_delivery) if order_doc.estimated_delivery else None
	}
	
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


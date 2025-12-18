# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
API endpoints for Cart operations
Matches format from BACKEND_API_DOCUMENTATION.md
"""

import frappe
from frappe import _
from frappe.utils import flt, now_datetime, get_datetime_str
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api, validate_product_belongs_to_restaurant
import json
import random
import string
from datetime import datetime


@frappe.whitelist(allow_guest=True)
def add_to_cart(restaurant_id, dish_id, quantity=1, customizations=None, session_id=None, table_number=None):
	"""
	POST /api/v1/cart/add
	Add item to cart
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Get user or use session_id
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id") or generate_session_id()
		
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
		
		# Validate product belongs to restaurant
		if product.restaurant != restaurant:
			return {
				"success": False,
				"error": {
					"code": "PRODUCT_NOT_FOUND",
					"message": f"Product {dish_id} not found for restaurant {restaurant_id}"
				}
			}
		
		if not product.is_active:
			return {
				"success": False,
				"error": {
					"code": "PRODUCT_NOT_ACTIVE",
					"message": f"Product {dish_id} is not active"
				}
			}
		
		# Parse customizations
		if isinstance(customizations, str):
			customizations = json.loads(customizations) if customizations else {}
		customizations = customizations or {}
		
		# Calculate unit price (base + customizations)
		unit_price = flt(product.price)
		
		# Add customization prices
		if customizations and product.customization_questions:
			for question in product.customization_questions:
				question_id = question.question_id
				if question_id in customizations:
					selected_options = customizations[question_id]
					if isinstance(selected_options, str):
						selected_options = [selected_options]
					
					for option_id in selected_options:
						# Find option in question
						for option in question.options:
							if option.option_id == option_id:
								unit_price += flt(option.price) or 0
								break
		
		# Check if identical item exists in cart (for same restaurant)
		existing_entry = find_existing_cart_entry(user, session_id, restaurant, dish_id, customizations)
		
		if existing_entry:
			# Update quantity
			entry_doc = frappe.get_doc("Cart Entry", existing_entry)
			new_quantity = cint(quantity) + entry_doc.quantity
			entry_doc.quantity = new_quantity
			entry_doc.total_price = unit_price * new_quantity
			
			# Update table_number if provided
			if table_number:
				parsed_table_number = parse_table_number_from_qr(table_number, restaurant_id)
				entry_doc.table_number = parsed_table_number
			
			entry_doc.save(ignore_permissions=True)
			entry_id = entry_doc.entry_id
		else:
			# Create new entry
			entry_id = generate_entry_id(dish_id)
			# Parse table_number from QR code if provided
			parsed_table_number = None
			if table_number:
				parsed_table_number = parse_table_number_from_qr(table_number, restaurant_id)
			
			entry_doc = frappe.get_doc({
				"doctype": "Cart Entry",
				"entry_id": entry_id,
				"restaurant": restaurant,
				"user": user,
				"session_id": session_id,
				"product": dish_id,
				"quantity": cint(quantity),
				"customizations": json.dumps(customizations) if customizations else None,
				"unit_price": unit_price,
				"total_price": unit_price * cint(quantity),
				"table_number": parsed_table_number
			})
			entry_doc.insert(ignore_permissions=True)
		
		# Get cart summary (for this restaurant)
		cart_summary = get_cart_summary(user, session_id, restaurant)
		
		cart_item_data = {
					"entryId": entry_id,
					"dishId": dish_id,
					"quantity": cint(quantity) if not existing_entry else entry_doc.quantity,
					"customizations": customizations,
					"unitPrice": unit_price,
					"totalPrice": entry_doc.total_price
		}
		
		# Add tableNumber if available
		if parsed_table_number:
			cart_item_data["tableNumber"] = parsed_table_number
		elif existing_entry and entry_doc.table_number:
			cart_item_data["tableNumber"] = entry_doc.table_number
		
		return {
			"success": True,
			"data": {
				"cartItem": cart_item_data,
				"cart": cart_summary
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in add_to_cart: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "CART_ADD_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_cart(restaurant_id, session_id=None):
	"""
	GET /api/v1/cart
	Get current cart for restaurant
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Get user or use session_id
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		# Build filters
		filters = {"restaurant": restaurant}
		if user:
			filters["user"] = user
		elif session_id:
			filters["session_id"] = session_id
		
		# Get cart entries for this restaurant
		entries = frappe.get_all(
			"Cart Entry",
			fields=["*"],
			filters=filters,
			order_by="creation desc"
		)
		
		# Format cart items
		items = []
		from dinematters.dinematters.api.products import format_product
		
		for entry in entries:
			if not frappe.db.exists("Menu Product", entry.product):
				continue
			product = frappe.get_doc("Menu Product", entry.product)
			customizations = json.loads(entry.customizations) if entry.customizations else {}
			
			item = {
				"entryId": entry.entry_id,
				"dishId": entry.product,
				"dish": format_product(product),
				"quantity": entry.quantity,
				"customizations": customizations,
				"unitPrice": flt(entry.unit_price),
				"totalPrice": flt(entry.total_price)
			}
			
			# Add table_number if available
			if entry.get("table_number"):
				item["tableNumber"] = entry.table_number
			
			items.append(item)
		
		# Calculate summary from all items
		subtotal = sum(item["totalPrice"] for item in items)
		total_items = len(items)
		
		summary = {
			"totalItems": total_items,
			"subtotal": subtotal,
			"discount": 0,
			"tax": 0,
			"deliveryFee": 0,
			"total": subtotal
		}
		
		return {
			"success": True,
			"data": {
				"items": items,
				"summary": summary
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_cart: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "CART_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def update_cart_item(restaurant_id, entry_id, quantity):
	"""
	PATCH /api/v1/cart/items/:entryId
	Update cart item quantity
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		if not frappe.db.exists("Cart Entry", entry_id):
			return {
				"success": False,
				"error": {
					"code": "CART_ITEM_NOT_FOUND",
					"message": f"Cart item {entry_id} not found"
				}
			}
		
		entry_doc = frappe.get_doc("Cart Entry", entry_id)
		
		# Validate entry belongs to restaurant
		if entry_doc.restaurant != restaurant:
			return {
				"success": False,
				"error": {
					"code": "CART_ITEM_NOT_FOUND",
					"message": f"Cart item {entry_id} not found for restaurant {restaurant_id}"
				}
			}
		
		entry_doc.quantity = cint(quantity)
		entry_doc.total_price = entry_doc.unit_price * cint(quantity)
		entry_doc.save(ignore_permissions=True)
		
		return {
			"success": True,
			"message": "Cart item updated"
		}
	except Exception as e:
		frappe.log_error(f"Error in update_cart_item: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "CART_UPDATE_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def remove_cart_item(restaurant_id, entry_id):
	"""
	DELETE /api/v1/cart/items/:entryId
	Remove item from cart
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		if not frappe.db.exists("Cart Entry", entry_id):
			return {
				"success": False,
				"error": {
					"code": "CART_ITEM_NOT_FOUND",
					"message": f"Cart item {entry_id} not found"
				}
			}
		
		entry_doc = frappe.get_doc("Cart Entry", entry_id)
		
		# Validate entry belongs to restaurant
		if entry_doc.restaurant != restaurant:
			return {
				"success": False,
				"error": {
					"code": "CART_ITEM_NOT_FOUND",
					"message": f"Cart item {entry_id} not found for restaurant {restaurant_id}"
				}
			}
		
		# Use db.delete to avoid Redis Queue dependency
		frappe.db.delete("Cart Entry", {"entry_id": entry_id})
		frappe.db.commit()
		
		return {
			"success": True,
			"message": "Item removed from cart"
		}
	except Exception as e:
		frappe.log_error(f"Error in remove_cart_item: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "CART_REMOVE_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def clear_cart(restaurant_id, session_id=None):
	"""
	DELETE /api/v1/cart
	Clear entire cart for restaurant
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		user = frappe.session.user if frappe.session.user != "Guest" else None
		if not user and not session_id:
			session_id = frappe.session.get("session_id")
		
		filters = {"restaurant": restaurant}
		if user:
			filters["user"] = user
		elif session_id:
			filters["session_id"] = session_id
		
		entries = frappe.get_all("Cart Entry", filters=filters)
		entry_ids = [entry.name for entry in entries]
		if entry_ids:
			frappe.db.delete("Cart Entry", {"name": ["in", entry_ids]})
			frappe.db.commit()
		
		return {
			"success": True,
			"message": "Cart cleared"
		}
	except Exception as e:
		frappe.log_error(f"Error in clear_cart: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "CART_CLEAR_ERROR",
				"message": str(e)
			}
		}


# Helper functions

def find_existing_cart_entry(user, session_id, restaurant, dish_id, customizations):
	"""Find existing cart entry with same product, restaurant, and customizations"""
	filters = {"product": dish_id, "restaurant": restaurant}
	if user:
		filters["user"] = user
	elif session_id:
		filters["session_id"] = session_id
	
	entries = frappe.get_all("Cart Entry", filters=filters)
	
	for entry in entries:
		entry_doc = frappe.get_doc("Cart Entry", entry.name)
		entry_customizations = json.loads(entry_doc.customizations) if entry_doc.customizations else {}
		
		# Compare customizations (simple dict comparison)
		if customizations == entry_customizations:
			return entry.name
	
	return None


def generate_entry_id(dish_id):
	"""Generate unique entry ID: {dishId}-{timestamp}-{random}"""
	timestamp = int(datetime.now().timestamp())
	random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
	return f"{dish_id}-{timestamp}-{random_str}"


def generate_session_id():
	"""Generate session ID for guest users"""
	return ''.join(random.choices(string.ascii_letters + string.digits, k=32))


def get_cart_summary(user, session_id, restaurant):
	"""Calculate cart summary (subtotal, discount, tax, total) for restaurant"""
	filters = {"restaurant": restaurant}
	if user:
		filters["user"] = user
	elif session_id:
		filters["session_id"] = session_id
	
	entries = frappe.get_all("Cart Entry", fields=["total_price", "unit_price"], filters=filters)
	
	subtotal = sum(flt(entry.total_price) for entry in entries)
	total_items = sum(1 for entry in entries)
	
	# For now, discount, tax, delivery fee are 0
	# Can be calculated based on business rules
	discount = 0
	tax = 0
	delivery_fee = 0
	total = subtotal - discount + tax + delivery_fee
	
	return {
		"totalItems": total_items,
		"subtotal": subtotal,
		"discount": discount,
		"tax": tax,
		"deliveryFee": delivery_fee,
		"total": total
	}


def cint(value):
	"""Convert to integer"""
	from frappe.utils import cint as frappe_cint
	return frappe_cint(value)


def parse_table_number_from_qr(qr_data, restaurant_id):
	"""
	Parse table number from QR code data.
	QR code format: restaurant-id/table-number
	Returns table number (int) or None if invalid
	"""
	try:
		if not qr_data:
			return None
		
		# Check if QR data matches format: restaurant-id/table-number
		if "/" in qr_data:
			parts = qr_data.split("/")
			if len(parts) == 2:
				qr_restaurant_id = parts[0]
				table_num_str = parts[1]
				
				# Validate restaurant ID matches
				if qr_restaurant_id == restaurant_id:
					table_number = cint(table_num_str)
					if table_number and table_number > 0:
						return table_number
		
		# If format doesn't match, try to parse as direct table number
		table_number = cint(qr_data)
		if table_number and table_number > 0:
			return table_number
		
		return None
	except Exception as e:
		frappe.log_error(f"Error parsing table number from QR: {str(e)}", "Table Number Parse")
		return None


@frappe.whitelist(allow_guest=True)
def parse_qr_code(qr_data):
	"""
	API endpoint to parse QR code and return table information
	POST /api/method/dinematters.dinematters.api.cart.parse_qr_code
	"""
	try:
		if not qr_data:
			return {
				"success": False,
				"error": {
					"code": "INVALID_QR_CODE",
					"message": "QR code data is required"
				}
			}
		
		# Parse QR code format: restaurant-id/table-number
		if "/" not in qr_data:
			return {
				"success": False,
				"error": {
					"code": "INVALID_QR_FORMAT",
					"message": "Invalid QR code format. Expected: restaurant-id/table-number"
				}
			}
		
		parts = qr_data.split("/")
		if len(parts) != 2:
			return {
				"success": False,
				"error": {
					"code": "INVALID_QR_FORMAT",
					"message": "Invalid QR code format. Expected: restaurant-id/table-number"
				}
			}
		
		restaurant_id = parts[0]
		table_number = cint(parts[1])
		
		# Validate restaurant exists
		if not frappe.db.exists("Restaurant", {"restaurant_id": restaurant_id}):
			return {
				"success": False,
				"error": {
					"code": "RESTAURANT_NOT_FOUND",
					"message": f"Restaurant {restaurant_id} not found"
				}
			}
		
		# Validate table number
		restaurant = frappe.get_doc("Restaurant", {"restaurant_id": restaurant_id})
		if not restaurant.tables or table_number > restaurant.tables:
			return {
				"success": False,
				"error": {
					"code": "INVALID_TABLE_NUMBER",
					"message": f"Table number {table_number} is invalid for this restaurant"
				}
			}
		
		return {
			"success": True,
			"data": {
				"restaurantId": restaurant_id,
				"tableNumber": table_number,
				"qrData": qr_data
			}
		}
	except Exception as e:
		frappe.log_error(f"Error parsing QR code: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "QR_PARSE_ERROR",
				"message": str(e)
			}
		}


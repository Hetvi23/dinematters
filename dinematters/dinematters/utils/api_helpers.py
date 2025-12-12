# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API helper functions for restaurant validation and context
"""

import frappe
from frappe import _
from dinematters.dinematters.utils.permissions import validate_restaurant_access, get_user_restaurant_ids


def get_restaurant_from_id(restaurant_id):
	"""Get restaurant name from restaurant_id"""
	if not restaurant_id:
		return None
	
	# Try to get by restaurant_id field first
	restaurant = frappe.db.get_value("Restaurant", {"restaurant_id": restaurant_id}, "name")
	
	# If not found, try by name (for backward compatibility)
	if not restaurant:
		restaurant = frappe.db.get_value("Restaurant", {"name": restaurant_id}, "name")
	
	return restaurant


def validate_restaurant_for_api(restaurant_id, user=None):
	"""
	Validate restaurant for API calls
	Returns restaurant name if valid, raises exception if not
	"""
	if not restaurant_id:
		frappe.throw(_("restaurant_id is required"), exc=frappe.ValidationError)
	
	# Get restaurant name
	restaurant = get_restaurant_from_id(restaurant_id)
	
	if not restaurant:
		frappe.throw(
			_("Restaurant {0} not found").format(restaurant_id),
			exc=frappe.DoesNotExistError
		)
	
	# Check if restaurant is active
	if not frappe.db.get_value("Restaurant", restaurant, "is_active"):
		frappe.throw(
			_("Restaurant {0} is not active").format(restaurant_id),
			exc=frappe.ValidationError
		)
	
	# Validate user access (if user provided)
	if user:
		if not validate_restaurant_access(user, restaurant):
			frappe.throw(
				_("You don't have access to restaurant {0}").format(restaurant_id),
				exc=frappe.PermissionError
			)
	
	return restaurant


def get_restaurant_context(restaurant_id):
	"""Get restaurant context for API responses"""
	restaurant = get_restaurant_from_id(restaurant_id)
	
	if not restaurant:
		return None
	
	restaurant_doc = frappe.get_doc("Restaurant", restaurant)
	
	return {
		"id": restaurant_doc.restaurant_id,
		"name": restaurant_doc.restaurant_name,
		"logo": restaurant_doc.logo,
		"address": restaurant_doc.address,
		"city": restaurant_doc.city,
		"state": restaurant_doc.state,
		"zip_code": restaurant_doc.zip_code,
		"country": restaurant_doc.country,
		"tax_rate": restaurant_doc.tax_rate,
		"default_delivery_fee": restaurant_doc.default_delivery_fee,
		"currency": restaurant_doc.currency,
		"timezone": restaurant_doc.timezone
	}


def validate_product_belongs_to_restaurant(product_id, restaurant_id):
	"""Validate that product belongs to restaurant"""
	restaurant = get_restaurant_from_id(restaurant_id)
	
	if not restaurant:
		return False
	
	product_restaurant = frappe.db.get_value("Menu Product", product_id, "restaurant")
	
	return product_restaurant == restaurant


def validate_all_products_belong_to_restaurant(product_ids, restaurant_id):
	"""Validate that all products belong to restaurant"""
	restaurant = get_restaurant_from_id(restaurant_id)
	
	if not restaurant:
		return False
	
	# Get all products
	products = frappe.get_all(
		"Menu Product",
		filters={"name": ["in", product_ids]},
		fields=["name", "restaurant"]
	)
	
	# Check all belong to restaurant
	for product in products:
		if product.restaurant != restaurant:
			return False
	
	return True


def get_restaurant_from_product(product_id):
	"""Get restaurant from product"""
	restaurant = frappe.db.get_value("Menu Product", product_id, "restaurant")
	return restaurant


def get_restaurant_from_category(category_id):
	"""Get restaurant from category"""
	restaurant = frappe.db.get_value("Menu Category", category_id, "restaurant")
	return restaurant


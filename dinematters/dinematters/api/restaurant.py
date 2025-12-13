# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Restaurant lookup and information
"""

import frappe
from frappe import _
from frappe.utils import get_url
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api, get_restaurant_context


@frappe.whitelist(allow_guest=True)
def get_restaurant_id(restaurant_name):
	"""
	GET /api/method/dinematters.dinematters.api.restaurant.get_restaurant_id
	Get restaurant_id from restaurant_name
	
	Parameters:
	- restaurant_name (required): The restaurant name to lookup
	
	Returns:
	{
		"success": true,
		"data": {
			"restaurant_id": "the-gallery-cafe",
			"restaurant_name": "The Gallery Cafe",
			"is_active": true
		}
	}
	"""
	try:
		if not restaurant_name:
			return {
				"success": False,
				"error": {
					"code": "VALIDATION_ERROR",
					"message": "restaurant_name is required"
				}
			}
		
		# Try to find restaurant by restaurant_name (exact match first)
		restaurant = frappe.db.get_value(
			"Restaurant",
			{"restaurant_name": restaurant_name},
			["name", "restaurant_id", "restaurant_name", "is_active"],
			as_dict=True
		)
		
		# If not found, try case-insensitive search
		if not restaurant:
			restaurants = frappe.get_all(
				"Restaurant",
				filters={"restaurant_name": ["like", f"%{restaurant_name}%"]},
				fields=["name", "restaurant_id", "restaurant_name", "is_active"],
				limit=1
			)
			if restaurants:
				restaurant = restaurants[0]
		
		if not restaurant:
			return {
				"success": False,
				"error": {
					"code": "RESTAURANT_NOT_FOUND",
					"message": f"Restaurant '{restaurant_name}' not found"
				}
			}
		
		return {
			"success": True,
			"data": {
				"restaurant_id": restaurant.restaurant_id,
				"restaurant_name": restaurant.restaurant_name,
				"is_active": bool(restaurant.is_active)
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_restaurant_id: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "RESTAURANT_LOOKUP_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_restaurant_info(restaurant_id):
	"""
	GET /api/method/dinematters.dinematters.api.restaurant.get_restaurant_info
	Get full restaurant information by restaurant_id
	
	Parameters:
	- restaurant_id (required): The restaurant identifier
	
	Returns:
	{
		"success": true,
		"data": {
			"id": "the-gallery-cafe",
			"name": "The Gallery Cafe",
			"logo": "...",
			"address": "...",
			...
		}
	}
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id)
		restaurant_context = get_restaurant_context(restaurant_id)
		
		if not restaurant_context:
			return {
				"success": False,
				"error": {
					"code": "RESTAURANT_NOT_FOUND",
					"message": f"Restaurant {restaurant_id} not found"
				}
			}
		
		return {
			"success": True,
			"data": restaurant_context
		}
	except Exception as e:
		frappe.log_error(f"Error in get_restaurant_info: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "RESTAURANT_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def list_restaurants(active_only=True):
	"""
	GET /api/method/dinematters.dinematters.api.restaurant.list_restaurants
	Get list of all restaurants
	
	Parameters:
	- active_only (optional, default: true): Only return active restaurants
	
	Returns:
	{
		"success": true,
		"data": {
			"restaurants": [
				{
					"restaurant_id": "the-gallery-cafe",
					"restaurant_name": "The Gallery Cafe",
					"is_active": true
				}
			]
		}
	}
	"""
	try:
		filters = {}
		if active_only:
			filters["is_active"] = 1
		
		restaurants = frappe.get_all(
			"Restaurant",
			filters=filters,
			fields=["restaurant_id", "restaurant_name", "is_active"],
			order_by="restaurant_name"
		)
		
		return {
			"success": True,
			"data": {
				"restaurants": restaurants
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in list_restaurants: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "RESTAURANT_LIST_ERROR",
				"message": str(e)
			}
		}

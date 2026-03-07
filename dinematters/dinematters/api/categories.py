# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
API endpoints for Categories
Matches format from BACKEND_API_DOCUMENTATION.md
"""

import frappe
from frappe import _
from frappe.utils import get_url
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api
from dinematters.dinematters.media.utils import format_media_field


@frappe.whitelist(allow_guest=True)
def get_categories(restaurant_id):
	"""
	GET /api/v1/categories
	Get all categories with product counts
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		categories = frappe.get_all(
			"Menu Category",
			fields=[
				"category_id as id",
				"category_name as name",
				"display_name as displayName",
				"description",
				"is_special as isSpecial",
				"category_image"
			],
			filters={"restaurant": restaurant},
			order_by="display_order, category_name"
		)
		
		# Format categories and calculate product counts
		formatted_categories = []
		for cat in categories:
			# Count products in this category for this restaurant
			product_count = frappe.db.count(
				"Menu Product",
				filters={"category_name": cat["name"], "is_active": 1, "restaurant": restaurant}
			)
			
			category_data = {
				"id": cat["id"],
				"name": cat["name"],
				"displayName": cat["displayName"],
				"description": cat["description"] or "",
				"isSpecial": bool(cat.get("isSpecial", False)),
				"productCount": product_count
			}
			
			# Use centralized media fetcher for CDN URLs and blur placeholders
			if cat.get("category_image"):
				format_media_field(category_data, "category_image", "Menu Category", cat.get("name"), "category_image", "image")
			
			formatted_categories.append(category_data)
		
		return {
			"success": True,
			"data": {
				"categories": formatted_categories
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_categories: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "CATEGORY_FETCH_ERROR",
				"message": str(e)
			}
		}




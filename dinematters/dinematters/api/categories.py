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
			
			# Robust image resolution:
			# 1. Try to find an explicit Media Asset for the category (high quality CDN URL)
			has_category_media_asset = frappe.db.get_value(
				"Media Asset",
				{
					"owner_doctype": "Menu Category",
					"owner_name": cat.get("id"),
					"media_role": "category_image",
					"status": "ready"
				},
				"name"
			)
			
			# 2. Try to find a fallback product image (fallback)
			first_product_media = frappe.db.get_value(
				"Product Media",
				{
					"parenttype": "Menu Product",
					"media_type": "image",
					"parent": ["in", frappe.get_all(
						"Menu Product", 
						filters={"category": cat["id"], "is_active": 1, "restaurant": restaurant}, 
						pluck="name"
					)]
				},
				["name", "media_url"],
				order_by="idx asc",
				as_dict=True
			)
			
			if has_category_media_asset:
				format_media_field(category_data, "category_image", "Menu Category", cat.get("id"), "category_image", "image")
			elif first_product_media:
				# Use product thumbnail
				category_data["category_image"] = first_product_media["media_url"]
				format_media_field(
					category_data, 
					"category_image", 
					"Product Media", 
					first_product_media["name"], 
					"media_url", 
					"image"
				)
			elif cat.get("category_image"):
				# Fallback to legacy field if it exists
				category_data["category_image"] = cat.get("category_image")
				format_media_field(category_data, "category_image", "Menu Category", cat.get("id"), "category_image", "image")
			else:
				# Final fallback: generic icon
				category_data["image"] = "/images/icons/burger.png"
			
			formatted_categories.append(category_data)
		
		# Add virtual categories if products exist
		# Top Picks
		top_picks_count = frappe.db.count("Menu Product", filters={"product_type": "Popular", "is_active": 1, "restaurant": restaurant})
		if top_picks_count > 0:
			top_picks = {
				"id": "top-picks",
				"name": "Top Picks",
				"displayName": "Top Picks",
				"description": "Our most popular dishes",
				"isSpecial": True,
				"productCount": top_picks_count
			}
			# Fallback to first product image for Top Picks
			first_tp_media = frappe.db.get_value(
				"Product Media",
				{
					"parenttype": "Menu Product",
					"media_type": "image",
					"parent": ["in", frappe.get_all("Menu Product", filters={"product_type": "Popular", "is_active": 1, "restaurant": restaurant}, pluck="name")]
				},
				["name", "media_url"],
				order_by="idx asc",
				as_dict=True
			)
			if first_tp_media:
				top_picks["category_image"] = first_tp_media["media_url"]
				format_media_field(top_picks, "category_image", "Product Media", first_tp_media["name"], "product_image", "image")
			else:
				top_picks["image"] = "/images/icons/burger.png"
			
			formatted_categories.insert(0, top_picks)
			
		# Chef Special
		chef_special_count = frappe.db.count("Menu Product", filters={"product_type": "Chef Special", "is_active": 1, "restaurant": restaurant})
		if chef_special_count > 0:
			chef_special = {
				"id": "chef-special",
				"name": "Chef Special",
				"displayName": "Chef Special",
				"description": "Chef's signature dish",
				"isSpecial": True,
				"productCount": chef_special_count,
				"image": "/animations/Chef.gif"
			}
			formatted_categories.insert(1 if top_picks_count > 0 else 0, chef_special)
		
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




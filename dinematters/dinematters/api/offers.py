# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Offers
All endpoints require restaurant_id for SaaS multi-tenancy
"""

import frappe
from frappe import _
from frappe.utils import get_url, getdate, today
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api


@frappe.whitelist(allow_guest=True)
def get_offers(restaurant_id, featured=None, category=None, active_only=True):
	"""
	GET /api/method/dinematters.dinematters.api.offers.get_offers
	Get all active offers for a restaurant
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Build filters
		filters = {"restaurant": restaurant}
		
		if active_only:
			filters["is_active"] = 1
			# Check validity dates if set
			today_date = today()
			# Only filter if dates are set
			date_filters = []
			if frappe.db.exists("Offer", {"restaurant": restaurant, "valid_from": ["is", "set"]}):
				date_filters.append(["valid_from", "<=", today_date])
			if frappe.db.exists("Offer", {"restaurant": restaurant, "valid_to": ["is", "set"]}):
				date_filters.append(["valid_to", ">=", today_date])
			if date_filters:
				filters.extend(date_filters)
		
		if featured is not None:
			filters["featured"] = 1 if featured else 0
		
		if category:
			filters["category"] = category
		
		# Get offers
		offers = frappe.get_all(
			"Offer",
			fields=[
				"name as id",
				"title",
				"image_src",
				"image_alt",
				"description",
				"discount",
				"valid_until",
				"category",
				"featured",
				"is_active",
				"valid_from",
				"valid_to"
			],
			filters=filters,
			order_by="display_order asc, title asc"
		)
		
		# Format offers
		formatted_offers = []
		for offer in offers:
			offer_data = {
				"id": str(offer["id"]),
				"title": offer["title"],
				"description": offer.get("description", ""),
				"discount": offer.get("discount", ""),
				"validUntil": offer.get("valid_until", ""),
				"category": offer.get("category", ""),
				"featured": bool(offer.get("featured", False)),
				"isActive": bool(offer.get("is_active", False))
			}
			
			if offer.get("image_src"):
				image_src = offer["image_src"]
				if image_src.startswith("/files/"):
					image_src = get_url(image_src)
				offer_data["imageSrc"] = image_src
			
			if offer.get("image_alt"):
				offer_data["imageAlt"] = offer["image_alt"]
			
			if offer.get("valid_from"):
				offer_data["validFrom"] = str(offer["valid_from"])
			if offer.get("valid_to"):
				offer_data["validTo"] = str(offer["valid_to"])
			
			formatted_offers.append(offer_data)
		
		return {
			"success": True,
			"data": {
				"offers": formatted_offers
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_offers: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "OFFER_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist()
def create_offer(restaurant_id, title, description=None, discount=None, valid_until=None, category=None, featured=False, is_active=True, image_src=None, image_alt=None, valid_from=None, valid_to=None):
	"""
	POST /api/method/dinematters.dinematters.api.offers.create_offer
	Create a new offer (Admin only)
	"""
	try:
		# Validate restaurant access
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		
		# Create offer
		offer_doc = frappe.get_doc({
			"doctype": "Offer",
			"restaurant": restaurant,
			"title": title,
			"description": description,
			"discount": discount,
			"valid_until": valid_until,
			"category": category,
			"featured": 1 if featured else 0,
			"is_active": 1 if is_active else 0,
			"image_src": image_src,
			"image_alt": image_alt,
			"valid_from": valid_from,
			"valid_to": valid_to
		})
		offer_doc.insert(ignore_permissions=True)
		
		# Format response
		offer_data = {
			"id": str(offer_doc.name),
			"title": offer_doc.title,
			"description": offer_doc.description or "",
			"discount": offer_doc.discount or "",
			"validUntil": offer_doc.valid_until or "",
			"category": offer_doc.category or "",
			"featured": bool(offer_doc.featured),
			"isActive": bool(offer_doc.is_active)
		}
		
		if offer_doc.image_src:
			image_src = offer_doc.image_src
			if image_src.startswith("/files/"):
				image_src = get_url(image_src)
			offer_data["imageSrc"] = image_src
		
		if offer_doc.image_alt:
			offer_data["imageAlt"] = offer_doc.image_alt
		
		if offer_doc.valid_from:
			offer_data["validFrom"] = str(offer_doc.valid_from)
		if offer_doc.valid_to:
			offer_data["validTo"] = str(offer_doc.valid_to)
		
		offer_data["createdAt"] = str(offer_doc.creation)
		
		return {
			"success": True,
			"data": {
				"offer": offer_data
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in create_offer: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "OFFER_CREATE_ERROR",
				"message": str(e)
			}
		}


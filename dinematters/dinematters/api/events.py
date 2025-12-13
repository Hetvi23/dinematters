# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Events
All endpoints require restaurant_id for SaaS multi-tenancy
"""

import frappe
from frappe import _
from frappe.utils import get_url
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api


@frappe.whitelist(allow_guest=True)
def get_events(restaurant_id, featured=None, category=None, upcoming_only=True):
	"""
	GET /api/method/dinematters.dinematters.api.events.get_events
	Get all events for a restaurant
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Build filters
		filters = {"restaurant": restaurant, "is_active": 1}
		
		if featured is not None:
			filters["featured"] = 1 if featured else 0
		
		if category:
			filters["category"] = category
		
		if upcoming_only:
			filters["status"] = ["in", ["upcoming", "recurring"]]
		
		# Get events
		events = frappe.get_all(
			"Event",
			fields=[
				"name as id",
				"title",
				"image_src",
				"image_alt",
				"description",
				"date",
				"time",
				"location",
				"category",
				"featured",
				"status",
				"is_active"
			],
			filters=filters,
			order_by="display_order asc, title asc"
		)
		
		# Format events
		formatted_events = []
		for event in events:
			event_data = {
				"id": str(event["id"]),
				"title": event["title"],
				"description": event.get("description", ""),
				"date": event.get("date", ""),
				"time": event.get("time", ""),
				"location": event.get("location", ""),
				"category": event.get("category", ""),
				"featured": bool(event.get("featured", False)),
				"status": event.get("status", "upcoming")
			}
			
			if event.get("image_src"):
				image_src = event["image_src"]
				if image_src.startswith("/files/"):
					image_src = get_url(image_src)
				event_data["imageSrc"] = image_src
			
			if event.get("image_alt"):
				event_data["imageAlt"] = event["image_alt"]
			
			formatted_events.append(event_data)
		
		return {
			"success": True,
			"data": {
				"events": formatted_events
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_events: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "EVENT_FETCH_ERROR",
				"message": str(e)
			}
		}



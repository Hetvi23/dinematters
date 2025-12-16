# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Events
All endpoints require restaurant_id for SaaS multi-tenancy
"""

import frappe
from frappe import _
from frappe.utils import get_url, formatdate, format_time, getdate
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
				"is_active",
				"repeat_this_event",
				"repeat_on",
				"repeat_till",
				"monday",
				"tuesday",
				"wednesday",
				"thursday",
				"friday",
				"saturday",
				"sunday"
			],
			filters=filters,
			order_by="display_order asc, title asc"
		)
		
		# Format events
		formatted_events = []
		for event in events:
			# Format date and time as strings (maintain API structure)
			date_str = ""
			if event.get("date"):
				date_str = formatdate(event["date"], "yyyy-mm-dd")
			
			time_str = ""
			if event.get("time"):
				time_str = format_time(event["time"], "HH:mm:ss")
			
			event_data = {
				"id": str(event["id"]),
				"title": event["title"],
				"description": event.get("description", ""),
				"date": date_str,
				"time": time_str,
				"location": event.get("location", ""),
				"category": event.get("category", ""),
				"featured": bool(event.get("featured", False)),
				"status": event.get("status", "upcoming")
			}
			
			# Add recurring event information if applicable
			if event.get("repeat_this_event"):
				event_data["recurring"] = {
					"repeatThisEvent": True,
					"repeatOn": event.get("repeat_on", ""),
					"repeatTill": formatdate(event["repeat_till"], "yyyy-mm-dd") if event.get("repeat_till") else None
				}
				
				# Add day-of-week information for weekly recurrence
				if event.get("repeat_on") == "Weekly":
					weekdays = []
					if event.get("monday"):
						weekdays.append("Monday")
					if event.get("tuesday"):
						weekdays.append("Tuesday")
					if event.get("wednesday"):
						weekdays.append("Wednesday")
					if event.get("thursday"):
						weekdays.append("Thursday")
					if event.get("friday"):
						weekdays.append("Friday")
					if event.get("saturday"):
						weekdays.append("Saturday")
					if event.get("sunday"):
						weekdays.append("Sunday")
					
					if weekdays:
						event_data["recurring"]["weekdays"] = weekdays
			else:
				event_data["recurring"] = {
					"repeatThisEvent": False
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



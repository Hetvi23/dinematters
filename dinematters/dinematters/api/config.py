# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Restaurant Configuration
All endpoints require restaurant_id for SaaS multi-tenancy
"""

import frappe
from frappe import _
from frappe.utils import get_url
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api, get_restaurant_context
from dinematters.dinematters.utils.currency_helpers import get_restaurant_currency_info
import json


@frappe.whitelist(allow_guest=True)
def get_restaurant_config(restaurant_id):
	"""
	GET /api/method/dinematters.dinematters.api.config.get_restaurant_config
	Get restaurant branding, configuration, and settings
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Get restaurant context
		restaurant_context = get_restaurant_context(restaurant_id)
		
		# Get or create restaurant config
		config = frappe.db.get_value(
			"Restaurant Config",
			{"restaurant": restaurant},
			["restaurant_name", "tagline", "subtitle", "description", "primary_color", "default_theme",
			 "logo", "hero_video", "apple_touch_icon", "color_palette_violet", "color_palette_indigo",
			 "color_palette_blue", "color_palette_green", "color_palette_yellow", "color_palette_orange",
			 "color_palette_red", "currency", "enable_table_booking", "enable_banquet_booking",
			 "enable_events", "enable_offers", "enable_coupons", "enable_experience_lounge",
			 "google_review_link", "instagram_profile_link", "facebook_profile_link", "whatsapp_phone_number"],
			as_dict=True
		)
		
		# If config doesn't exist, get from Restaurant doctype
		if not config:
			restaurant_doc = frappe.get_doc("Restaurant", restaurant)
			config = {
				"restaurant_name": restaurant_doc.restaurant_name,
				"tagline": "",
				"subtitle": "",
				"description": restaurant_doc.description,
				"primary_color": "#DB782F",
				"default_theme": "light",
				"logo": restaurant_doc.logo,
				"hero_video": "",
				"apple_touch_icon": "",
				"currency": restaurant_doc.currency or "USD",
				"enable_table_booking": 1,
				"enable_banquet_booking": 1,
				"enable_events": 1,
				"enable_offers": 1,
				"enable_coupons": 1,
				"enable_experience_lounge": 1,
				"google_review_link": "",
				"instagram_profile_link": "",
				"facebook_profile_link": "",
				"whatsapp_phone_number": ""
			}
		
		# Build color palette
		color_palette = {}
		if config.get("color_palette_violet"):
			color_palette["violet"] = config["color_palette_violet"]
		if config.get("color_palette_indigo"):
			color_palette["indigo"] = config["color_palette_indigo"]
		if config.get("color_palette_blue"):
			color_palette["blue"] = config["color_palette_blue"]
		if config.get("color_palette_green"):
			color_palette["green"] = config["color_palette_green"]
		if config.get("color_palette_yellow"):
			color_palette["yellow"] = config["color_palette_yellow"]
		if config.get("color_palette_orange"):
			color_palette["orange"] = config["color_palette_orange"]
		if config.get("color_palette_red"):
			color_palette["red"] = config["color_palette_red"]

		# For Dinematters UI, treat primary color and color palette as the same concept:
		# if an explicit primary_color is not set, derive it from the first available
		# palette color so the API always exposes a usable branding.primaryColor.
		primary_color = config.get("primary_color")
		if not primary_color:
			primary_color = next(iter(color_palette.values()), "#DB782F")
		
		# Format logo and icons
		logo = config.get("logo")
		if logo and logo.startswith("/files/"):
			logo = get_url(logo)
		
		apple_touch_icon = config.get("apple_touch_icon")
		if apple_touch_icon and apple_touch_icon.startswith("/files/"):
			apple_touch_icon = get_url(apple_touch_icon)

		# Normalize hero video URL (if stored as a /files/ path, convert to absolute URL)
		hero_video = config.get("hero_video", "")
		if hero_video and isinstance(hero_video, str) and hero_video.startswith("/files/"):
			hero_video = get_url(hero_video)
		
		# Get currency info with symbol
		currency_info = get_restaurant_currency_info(restaurant)
		
		# Include restaurant basic info and location (google map URL from restaurant context)
		response_data = {
			"restaurant": {
				"name": config.get("restaurant_name", ""),
				"tagline": config.get("tagline", ""),
				"subtitle": config.get("subtitle", ""),
				"description": config.get("description", ""),
				"googleMapUrl": (restaurant_context.get("google_map_url") if restaurant_context else "") or ""
			},
			"branding": {
				"primaryColor": primary_color,
				"defaultTheme": config.get("default_theme", "light"),
				"logo": logo,
				"heroVideo": hero_video or config.get("hero_video", ""),
				"appleTouchIcon": apple_touch_icon,
				"colorPalette": color_palette if color_palette else {
					"violet": "#A992B2",
					"indigo": "#8892B0",
					"blue": "#87ABCA",
					"green": "#9AAF7A",
					"yellow": "#E0C682",
					"orange": "#DB782F",
					"red": "#D68989"
				}
			},
			"pricing": {
				"currency": currency_info.get("currency", "USD"),
				"symbol": currency_info.get("symbol", "$"),
				"symbolOnRight": currency_info.get("symbolOnRight", False)
			},
			"settings": {
				"enableTableBooking": bool(config.get("enable_table_booking", 1)),
				"enableBanquetBooking": bool(config.get("enable_banquet_booking", 1)),
				"enableEvents": bool(config.get("enable_events", 1)),
				"enableOffers": bool(config.get("enable_offers", 1)),
				"enableCoupons": bool(config.get("enable_coupons", 1)),
				"enableExperienceLounge": bool(config.get("enable_experience_lounge", 1))
			},
			"socialMedia": {
				"googleReviewLink": config.get("google_review_link", ""),
				"instagramProfileLink": config.get("instagram_profile_link", ""),
				"facebookProfileLink": config.get("facebook_profile_link", ""),
				"whatsappPhoneNumber": config.get("whatsapp_phone_number", "")
			},
			# placeholder for feature cards (will be populated below)
			"homeFeatures": []
		}

		# Try to include Home Feature images (menu, book-table, legacy, offers-events, dine-play)
		try:
			features_resp = get_home_features(restaurant_id)
			if isinstance(features_resp, dict) and features_resp.get("success"):
				response_data["homeFeatures"] = features_resp.get("data", {}).get("features", [])
		except Exception:
			# Non-fatal: if fetching features fails, continue without them
			pass

		return {
			"success": True,
			"data": response_data
		}
	except Exception as e:
		frappe.log_error(f"Error in get_restaurant_config: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "CONFIG_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_home_features(restaurant_id):
	"""
	GET /api/method/dinematters.dinematters.api.config.get_home_features
	Get configuration for which features to display on the home page
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Get home features
		features = frappe.get_all(
			"Home Feature",
			fields=[
				"name",
				"feature_id as id",
				"title",
				"subtitle",
				"image_src",
				"image_alt",
				"route",
				"size",
				"is_enabled",
				"is_mandatory",
				"display_order"
			],
			filters={"restaurant": restaurant},
			order_by="display_order asc"
		)
		
		# If no features exist, create default ones
		if not features:
			default_features = [
				{"id": "menu", "title": "Explore our Menu", "subtitle": "Food, Taste, Love",
				 "image_src": "/files/explore.svg", "route": "/main-menu", "size": "large", "is_mandatory": 1},
				{"id": "book-table", "title": "Book your Tables", "subtitle": "& banquets",
				 "image_src": "/files/book-table.svg", "route": "/book-table", "size": "small", "is_mandatory": 1},
				{"id": "legacy", "title": "The Place", "subtitle": "& it's legacy",
				 "image_src": "/files/legacy.svg", "route": "/legacy", "size": "small", "is_mandatory": 1},
				{"id": "offers-events", "title": "Offers & Events", "subtitle": "Treasure mine.",
				 "image_src": "/files/events-offers.svg", "route": "/events", "size": "small", "is_mandatory": 0},
				{"id": "dine-play", "title": "Dine & Play", "subtitle": "Enjoy your bites",
				 "image_src": "/files/experience-lounge.svg", "route": "/experience-lounge-splash", "size": "small", "is_mandatory": 0}
			]
			
			for idx, feat in enumerate(default_features, 1):
				feat_doc = frappe.get_doc({
					"doctype": "Home Feature",
					"restaurant": restaurant,
					"feature_id": feat["id"],
					"title": feat["title"],
					"subtitle": feat.get("subtitle", ""),
					"image_src": feat.get("image_src", ""),
					"image_alt": feat.get("title", ""),
					"route": feat.get("route", ""),
					"size": feat.get("size", "small"),
					"is_enabled": 1,
					"is_mandatory": feat.get("is_mandatory", 0),
					"display_order": idx
				})
				feat_doc.insert(ignore_permissions=True)
			
			# Re-fetch
			features = frappe.get_all(
				"Home Feature",
				fields=["feature_id as id", "title", "subtitle", "image_src", "image_alt", "route",
				        "size", "is_enabled", "is_mandatory", "display_order"],
				filters={"restaurant": restaurant},
				order_by="display_order asc"
			)
		
		# Format features
		formatted_features = []
		for feature in features:
			image_src = feature.get("image_src", "")
			if image_src and image_src.startswith("/files/"):
				image_src = get_url(image_src)
			
			formatted_features.append({
				"name": feature.get("name"),
				"id": feature["id"],
				"title": feature["title"],
				"subtitle": feature.get("subtitle", ""),
				"imageSrc": image_src,
				"imageAlt": feature.get("image_alt", feature["title"]),
				"size": feature.get("size", "small"),
				"route": feature.get("route", ""),
				"isEnabled": bool(feature.get("is_enabled", 1)),
				"isMandatory": bool(feature.get("is_mandatory", 0)),
				"displayOrder": feature.get("display_order", 0)
			})
		
		return {
			"success": True,
			"data": {
				"features": formatted_features
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_home_features: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "FEATURES_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist()
def update_home_features(restaurant_id, features):
	"""
	POST /api/method/dinematters.dinematters.api.config.update_home_features
	Update home features configuration (Admin only)
	"""
	try:
		# Validate restaurant access
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		
		# Parse features if string
		if isinstance(features, str):
			features = json.loads(features) if features else []
		features = features or []
		
		# Update features
		updated_features = []
		for feat_data in features:
			feature_id = feat_data.get("id")
			if not feature_id:
				continue
			
			# Find existing feature
			feature_name = frappe.db.get_value(
				"Home Feature",
				{"restaurant": restaurant, "feature_id": feature_id},
				"name"
			)
			
			if feature_name:
				feature_doc = frappe.get_doc("Home Feature", feature_name)
				# Only update if not mandatory (mandatory features cannot be disabled)
				if not feature_doc.is_mandatory:
					if "isEnabled" in feat_data:
						feature_doc.is_enabled = 1 if feat_data["isEnabled"] else 0
					if "displayOrder" in feat_data:
						feature_doc.display_order = int(feat_data["displayOrder"])
					feature_doc.save(ignore_permissions=True)
				
				updated_features.append({
					"id": feature_doc.feature_id,
					"isEnabled": bool(feature_doc.is_enabled),
					"isMandatory": bool(feature_doc.is_mandatory),
					"displayOrder": feature_doc.display_order
				})
		
		# Get all features for response
		all_features = frappe.get_all(
			"Home Feature",
			fields=["feature_id as id", "is_enabled", "is_mandatory", "display_order"],
			filters={"restaurant": restaurant},
			order_by="display_order asc"
		)
		
		formatted_all = []
		for feat in all_features:
			formatted_all.append({
				"id": feat["id"],
				"isEnabled": bool(feat["is_enabled"]),
				"isMandatory": bool(feat["is_mandatory"]),
				"displayOrder": feat["display_order"]
			})
		
		return {
			"success": True,
			"message": "Home features configuration updated",
			"data": {
				"features": formatted_all
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in update_home_features: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "FEATURES_UPDATE_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def get_filters(restaurant_id):
	"""
	GET /api/method/dinematters.dinematters.api.config.get_filters
	Get filter configurations for menu products
	Returns filter definitions with labels, descriptions, and colors
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Define filter configurations
		filters = [
			{
				"id": "veg",
				"label": "Vegetarian",
				"shortLabel": "Veg",
				"description": "Show only vegetarian dishes",
				"color": "#9AAF7A"  # Green from color palette
			},
			{
				"id": "nonVeg",
				"label": "Non-Vegetarian",
				"shortLabel": "Non-Veg",
				"description": "Show only non-vegetarian dishes",
				"color": "#D68989"  # Red from color palette
			},
			{
				"id": "topPicks",
				"label": "Top Picks",
				"shortLabel": "Top Picks",
				"description": "Show chef's recommended dishes",
				"color": "#DB782F"  # Orange (primary color)
			},
			{
				"id": "offer",
				"label": "Offers",
				"shortLabel": "Offers",
				"description": "Show dishes with special offers and discounts",
				"color": "#E0C682"  # Yellow from color palette
			}
		]
		
		# Try to get custom colors from restaurant config if available
		config = frappe.db.get_value(
			"Restaurant Config",
			{"restaurant": restaurant},
			["color_palette_green", "color_palette_red", "primary_color", "color_palette_yellow"],
			as_dict=True
		)
		
		if config:
			# Update filter colors if custom colors are set
			if config.get("color_palette_green"):
				filters[0]["color"] = config["color_palette_green"]
			if config.get("color_palette_red"):
				filters[1]["color"] = config["color_palette_red"]
			if config.get("primary_color"):
				filters[2]["color"] = config["primary_color"]
			if config.get("color_palette_yellow"):
				filters[3]["color"] = config["color_palette_yellow"]
		
		return {
			"success": True,
			"data": {
				"filters": filters
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_filters: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "FILTERS_FETCH_ERROR",
				"message": str(e)
			}
		}



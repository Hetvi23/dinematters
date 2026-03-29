# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Restaurant Configuration
All endpoints require restaurant_id for SaaS multi-tenancy
"""

import frappe
from frappe import _
from frappe.utils import get_url, flt, cint
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api, get_restaurant_context
from dinematters.dinematters.media.utils import get_media_asset_data
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
			 "color_palette_red", "menu_theme_background_active", "menu_theme_background_preview", "menu_theme_background_history", 
			 "menu_theme_wallpapers", "menu_theme_main_index",
			 "currency", "menu_layout", "enable_table_booking", "enable_banquet_booking",
			 "menu_theme_background_enabled", "menu_theme_paid_until",
			 "enable_events", "enable_offers", "enable_coupons", "enable_experience_lounge", "verify_my_user",
			 "enable_loyalty",
			 "google_review_link", "instagram_profile_link", "facebook_profile_link", "whatsapp_phone_number"],
			as_dict=True
		)
		
		# Get restaurant document for plan_type
		restaurant_doc = frappe.get_doc("Restaurant", restaurant)
		
		# If config doesn't exist, get from Restaurant doctype
		if not config:
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
				"menu_theme_background_active": "",
				"menu_theme_background_preview": "",
				"menu_theme_background_history": [],
				"menu_theme_background_enabled": 1,
				"currency": restaurant_doc.currency or "INR",
				"enable_table_booking": 1,
				"enable_banquet_booking": 1,
				"enable_events": 1,
				"enable_offers": 1,
				"enable_coupons": 1,
				"enable_experience_lounge": 1,
				"verify_my_user": 0,
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
		
		# Get Media Assets using centralized utility
		config_name = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant}, "name")
		
		# Get logo with variants and blur placeholder
		logo_data = get_media_asset_data(
			"Restaurant Config",
			config_name,
			"restaurant_config_logo",
			config.get("logo")
		)
		logo = logo_data["url"]
		logo_blur = logo_data.get("blur_placeholder")
		logo_variants = logo_data.get("variants", {})
		logo_srcset = logo_data.get("srcset")
		
		# Get hero video
		hero_data = get_media_asset_data(
			"Restaurant Config",
			config_name,
			"restaurant_config_hero_video",
			config.get("hero_video")
		)
		hero_video = hero_data["url"]
		
		# Get apple touch icon with variants
		icon_data = get_media_asset_data(
			"Restaurant Config",
			config_name,
			"apple_touch_icon",
			config.get("apple_touch_icon")
		)
		apple_touch_icon = icon_data["url"]
		icon_variants = icon_data.get("variants", {})
		
		# Get currency info with symbol
		currency_info = get_restaurant_currency_info(restaurant)
		
		# Monetization Enforcement
		plan_type = restaurant_doc.plan_type or "LITE"
		menu_theme_background_enabled = bool(config.get("menu_theme_background_enabled", 1))
		
		if plan_type == "LITE" and menu_theme_background_enabled:
			from frappe.utils import getdate, today
			paid_until = getdate(config.get("menu_theme_paid_until")) if config.get("menu_theme_paid_until") else None
			if not paid_until or paid_until < getdate(today()):
				# Period expired, treat as disabled for customer app
				menu_theme_background_enabled = False
		
		# Include restaurant basic info and location (google map URL from restaurant context)
		response_data = {
			"restaurant": {
				"name": config.get("restaurant_name", ""),
				"tagline": config.get("tagline", ""),
				"subtitle": config.get("subtitle", ""),
				"description": config.get("description", ""),
				"latitude": config.get("latitude") or restaurant_doc.latitude,
				"longitude": config.get("longitude") or restaurant_doc.longitude,
				"googleMapUrl": (restaurant_context.get("google_map_url") if restaurant_context else "") or ""
			},
			"branding": {
				"primaryColor": primary_color,
				"defaultTheme": config.get("default_theme", "light"),
				"logo": logo,
				"logoBlurPlaceholder": logo_blur,
				"logoVariants": logo_variants,
				"logoSrcset": logo_srcset,
				"heroVideo": hero_video or config.get("hero_video", ""),
				"appleTouchIcon": apple_touch_icon,
				"appleTouchIconVariants": icon_variants,
				"menuThemeBackgroundEnabled": menu_theme_background_enabled,
				"menuThemeBackground": config.get("menu_theme_background_active", "") if menu_theme_background_enabled else "",
				"menuThemeBackgroundPreview": config.get("menu_theme_background_preview", "") if menu_theme_background_enabled else "",
				"menuThemeBackgroundHistory": config.get("menu_theme_background_history", []) if menu_theme_background_enabled else [],
				"menuThemeWallpapers": json.loads(config.get("menu_theme_wallpapers") or "[]") if menu_theme_background_enabled else [],
				"menuThemeMainIndex": config.get("menu_theme_main_index", 0) if menu_theme_background_enabled else 0,
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
				"currency": currency_info.get("currency", "INR"),
				"symbol": currency_info.get("symbol", "₹"),
				"symbolOnRight": currency_info.get("symbolOnRight", False)
			},
			"settings": {
				"menuLayout": config.get("menu_layout") or "2 Columns",
				"enableTableBooking": bool(config.get("enable_table_booking")),
				"enableBanquetBooking": bool(config.get("enable_banquet_booking")),
				"enableEvents": bool(config.get("enable_events")),
				"enableOffers": bool(config.get("enable_offers")),
				"enableCoupons": bool(config.get("enable_coupons")),
				"enableExperienceLounge": bool(config.get("enable_experience_lounge")),
				"verifyMyUser": bool(config.get("verify_my_user")),
				"enableLoyalty": bool(restaurant_doc.get("enable_loyalty")),
				"defaultDeliveryFee": flt(restaurant_doc.get("default_delivery_fee", 0)),
				"order_settings": {
					"enable_takeaway": bool(restaurant_doc.get("enable_takeaway", 1)),
					"enable_delivery": bool(restaurant_doc.get("enable_delivery", 0)),
					"no_ordering": bool(restaurant_doc.get("no_ordering", 0)),
					"default_packaging_fee": flt(restaurant_doc.get("default_packaging_fee", 0)),
					"minimum_order_value": flt(restaurant_doc.get("minimum_order_value", 0)),
					"estimated_prep_time": cint(restaurant_doc.get("estimated_prep_time", 30) or 30)
				}
			},
			"socialMedia": {
				"googleReviewLink": config.get("google_review_link", ""),
				"instagramProfileLink": config.get("instagram_profile_link", ""),
				"facebookProfileLink": config.get("facebook_profile_link", ""),
				"whatsappPhoneNumber": config.get("whatsapp_phone_number", "")
			},
			"subscription": {
				"planType": restaurant_doc.plan_type or "LITE",
				"features": {
					"ordering": restaurant_doc.plan_type == "PRO",
					"videoUpload": restaurant_doc.plan_type == "PRO",
					"analytics": restaurant_doc.plan_type == "PRO",
					"aiRecommendations": restaurant_doc.plan_type == "PRO",
					"loyalty": restaurant_doc.plan_type == "PRO",
					"coupons": restaurant_doc.plan_type == "PRO",
					"games": restaurant_doc.plan_type == "PRO"
				}
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
		
		# Get home features (include 'name' for Media Asset lookup)
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
			
			# Re-fetch (include 'name' for Media Asset lookup)
			features = frappe.get_all(
				"Home Feature",
				fields=["name", "feature_id as id", "title", "subtitle", "image_src", "image_alt", "route",
				        "size", "is_enabled", "is_mandatory", "display_order"],
				filters={"restaurant": restaurant},
				order_by="display_order asc"
			)
		
		# Format features with Media Asset data
		from dinematters.dinematters.media.utils import format_media_field, get_media_assets_batch
		
		# Batch fetch all media assets for these features
		feature_names = [f.get("name") for f in features if f.get("name")]
		media_batch = get_media_assets_batch("Home Feature", feature_names, ["home_feature_image"])
		
		formatted_features = []
		for feature in features:
			feature_name = feature.get("name")
			feature_data = {
				"name": feature_name,
				"id": feature["id"],
				"title": feature["title"],
				"subtitle": feature.get("subtitle", ""),
				"image_src": feature.get("image_src", ""),
				"imageAlt": feature.get("image_alt", feature["title"]),
				"size": feature.get("size", "small"),
				"route": feature.get("route", ""),
				"isEnabled": bool(feature.get("is_enabled", 1)),
				"isMandatory": bool(feature.get("is_mandatory", 0)),
				"displayOrder": feature.get("display_order", 0)
			}
			
			# Check if we have batched media data
			media_data = media_batch.get((feature_name, "home_feature_image"))
			if media_data:
				# Apply batched data
				output_key = "imageSrc"
				feature_data[output_key] = media_data["url"]
				if media_data.get("blur_placeholder"):
					feature_data[f"{output_key}BlurPlaceholder"] = media_data["blur_placeholder"]
				if media_data.get("variants"):
					feature_data[f"{output_key}Variants"] = media_data["variants"]
				if media_data.get("srcset"):
					feature_data[f"{output_key}Srcset"] = media_data["srcset"]
			else:
				# Fallback to single-call formatter (legacy/safety)
				format_media_field(feature_data, "image_src", "Home Feature", feature_name, "home_feature_image", "imageSrc")
			
			# Remove raw image_src field
			feature_data.pop("image_src", None)
			
			formatted_features.append(feature_data)

		# Filter features based on subscription plan
		plan_type = frappe.db.get_value("Restaurant", restaurant, "plan_type") or "LITE"
		if plan_type == "LITE":
			# Lite restaurants only show: menu, legacy
			# Restricted features: book-table, offers-events, dine-play
			restricted_ids = ["book-table", "offers-events", "dine-play"]
			formatted_features = [f for f in formatted_features if f["id"] not in restricted_ids]

		# De-duplicate by feature id so each restaurant has at most one
		# card per logical home feature (menu, book-table, etc.).
		# If duplicates exist, prefer the one with an image, then the one
		# that is enabled, while keeping display order where possible.
		by_id = {}
		for feat in formatted_features:
			existing = by_id.get(feat["id"])
			if not existing:
				by_id[feat["id"]] = feat
				continue

			# Prefer entry that has an image
			existing_has_image = bool(existing.get("imageSrc"))
			new_has_image = bool(feat.get("imageSrc"))

			if new_has_image and not existing_has_image:
				by_id[feat["id"]] = feat
				continue

			# If image presence is same, prefer enabled over disabled
			if feat.get("isEnabled") and not existing.get("isEnabled"):
				by_id[feat["id"]] = feat
				continue

			# Otherwise keep the first one (stable)

		deduped_features = sorted(by_id.values(), key=lambda f: f.get("displayOrder", 0))
		
		return {
			"success": True,
			"data": {
				"features": deduped_features
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



@frappe.whitelist()
def update_order_settings(restaurant_id, settings):
	"""
	POST /api/method/dinematters.dinematters.api.config.update_order_settings
	Update multiple order-related settings in a single transaction
	"""
	try:
		# Validate restaurant access
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		
		# Parse settings if string
		if isinstance(settings, str):
			settings = json.loads(settings)
		
		# Get restaurant document
		restaurant_doc = frappe.get_doc("Restaurant", restaurant)
		
		# Update fields
		updated_fields = []
		allowed_fields = [
			"enable_takeaway", 
			"enable_delivery", 
			"no_ordering",
			"default_packaging_fee", 
			"minimum_order_value", 
			"estimated_prep_time", 
			"default_delivery_fee"
		]
		
		for field in allowed_fields:
			if field in settings:
				value = settings[field]
				# Ensure correct type for Check fields
				if field in ["enable_takeaway", "enable_delivery", "no_ordering"]:
					value = 1 if value else 0
				# Ensure correct type for Numeric fields
				elif field in ["default_packaging_fee", "minimum_order_value", "default_delivery_fee"]:
					value = flt(value)
				elif field == "estimated_prep_time":
					value = cint(value)
					
				restaurant_doc.set(field, value)
				updated_fields.append(field)
		
		if updated_fields:
			restaurant_doc.save(ignore_permissions=True)
		
		return {
			"success": True,
			"message": _("Order settings updated successfully"),
			"data": {
				"updated_fields": updated_fields
			}
		}
	except Exception as e:
		import traceback
		error_trace = traceback.format_exc()
		frappe.log_error(f"Error in update_order_settings for restaurant {restaurant_id}: {error_trace}", "Order Settings Update Error")
		
		# Extract a clean error message if possible
		error_msg = str(e)
		if not error_msg:
			if isinstance(e, frappe.MandatoryError):
				error_msg = _("Missing mandatory fields")
			elif isinstance(e, frappe.ValidationError):
				error_msg = _("Validation failed")
			else:
				error_msg = _("An unexpected error occurred while saving settings")
		
		return {
			"success": False,
			"error": {
				"code": "SETTINGS_UPDATE_ERROR",
				"message": error_msg,
				"details": error_trace if frappe.conf.developer_mode else None
			}
		}

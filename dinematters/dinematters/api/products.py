# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
API endpoints for Products/Dishes
Matches format from BACKEND_API_DOCUMENTATION.md
"""

import frappe
from frappe import _
from frappe.utils import flt, cint
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api
from dinematters.dinematters.media.utils import get_media_asset_data
from dinematters.dinematters.utils.currency_helpers import get_restaurant_currency_info
import json
from collections import defaultdict


@frappe.whitelist(allow_guest=True)
def get_top_picks(restaurant_id):
	"""
	GET /api/v1/top-picks
	Optimized Top Picks API with Caching and Priority Selection.
	Priority:
	1. Explicit top-picks
	2. Items with media (has_no_media=0)
	3. Newest items (creation desc)
	Stable results (no randomness).
	"""
	try:
		# Use cache for performance
		cache_key = f"top_picks:{restaurant_id}"
		cached_response = frappe.cache().get_value(cache_key)
		if cached_response:
			return json.loads(cached_response)

		# Strict media prioritization: 
		# Only return non-media products if ABSOLUTELY no media products exist for this restaurant.
		has_any_media = frappe.db.exists("Menu Product", {"restaurant": restaurant, "is_active": 1, "has_no_media": 0})
		media_filter = " AND has_no_media = 0" if has_any_media else ""
		
		# Single prioritized query for all fallback logic
		# 1. product_type == 'top-picks' gets highest priority (0)
		# 2. Stable order by display_order and creation date
		products = frappe.db.sql(f"""
			SELECT 
				name as docname, product_id as id, product_name as name, price, original_price,
				category_name as category, product_type as type, description, is_vegetarian,
				calories, estimated_time as estimatedTime, serving_size as servingSize,
				has_no_media, main_category as mainCategory, display_order, is_active,
				recommendations
			FROM `tabMenu Product`
			WHERE 
				restaurant = %s AND is_active = 1 {media_filter}
			ORDER BY 
				(CASE WHEN product_type = 'top-picks' THEN 0 ELSE 1 END) ASC,
				display_order ASC,
				creation DESC
			LIMIT 10
		""", (restaurant), as_dict=True)

		# Format products with media only (minimal payload for fast home page)
		formatted_products = format_products_for_listing_minimal(products)
		
		# Get currency info for restaurant
		currency_info = get_restaurant_currency_info(restaurant)
		
		result = {
			"success": True,
			"data": {
				"products": formatted_products,
				"currency": currency_info.get("currency", "INR"),
				"currencySymbol": currency_info.get("symbol", "₹"),
				"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
			}
		}

		# Cache results for 1 hour
		frappe.cache().set_value(cache_key, json.dumps(result), expires_in_sec=3600)
		
		return result
	except Exception as e:
		frappe.log_error(f"Error in get_top_picks: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "TOP_PICKS_FETCH_ERROR",
				"message": str(e)
			}
		}




@frappe.whitelist(allow_guest=True)
def get_products(restaurant_id, category=None, type=None, vegetarian=None, search=None, page=1, limit=50):
	"""
	GET /api/v1/products
	Get all products/dishes with filters and pagination
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Build filters
		filters = {"is_active": 1, "restaurant": restaurant}
		
		if category:
			filters["category_name"] = category
		
		if type:
			filters["product_type"] = type
		
		if vegetarian is not None:
			filters["is_vegetarian"] = cint(vegetarian)
		
		# Search filter
		or_filters = {}
		if search:
			or_filters = {
				"product_name": ["like", f"%{search}%"],
				"description": ["like", f"%{search}%"],
				"product_id": ["like", f"%{search}%"]
			}
		
		# Pagination
		page = cint(page) or 1
		limit = cint(limit) or 50
		start = (page - 1) * limit
		
		# Get products
		products = frappe.get_all(
			"Menu Product",
			fields=[
				"name as docname",
				"product_id as id",
				"product_name as name",
				"price",
				"original_price",
				"category_name as category",
				"product_type as type",
				"description",
				"is_vegetarian",
				"calories",
				"estimated_time as estimatedTime",
				"serving_size as servingSize",
				"has_no_media",
				"main_category as mainCategory",
				"display_order",
				"is_active",
				"recommendations"
			],
			filters=filters,
			or_filters=or_filters if or_filters else None,
			limit_start=start,
			limit_page_length=limit,
			order_by="display_order, product_name"
		)
		
		# Get total count for pagination
		# Note: frappe.db.count doesn't support or_filters, so we use get_all with limit=0
		if or_filters:
			total = len(frappe.get_all("Menu Product", filters=filters, or_filters=or_filters, limit=0))
		else:
			total = frappe.db.count("Menu Product", filters=filters)
		
		# Format products with media and customizations using bulk-loaded child tables
		formatted_products = format_products_for_listing(products)
		
		# Calculate pagination
		total_pages = (total + limit - 1) // limit if limit > 0 else 1
		
		# Get currency info for restaurant
		currency_info = get_restaurant_currency_info(restaurant)
		
		return {
			"success": True,
			"data": {
				"products": formatted_products,
				"pagination": {
					"page": page,
					"limit": limit,
					"total": total,
					"totalPages": total_pages
				},
				"currency": currency_info.get("currency", "INR"),
				"currencySymbol": currency_info.get("symbol", "₹"),
				"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_products: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "PRODUCT_FETCH_ERROR",
				"message": str(e)
			}
		}



def format_products_for_listing(products):
	"""
	Full version of product formatting that includes nested data
	(customizations and recommendations) for the main menu page.
	"""
	if not products:
		return []

	product_names = [product["docname"] for product in products if product.get("docname")]
	media_by_product = get_product_media_map(product_names)
	questions_by_product, question_names = get_customization_questions_map(product_names)
	options_by_question = get_customization_options_map(question_names)

	formatted_products = []
	for product in products:
		docname = product.get("docname")
		formatted_products.append(
			format_product_from_row(
				product,
				media_by_product.get(docname, []),
				questions_by_product.get(docname, []),
				options_by_question
			)
		)

	return formatted_products



def format_products_for_listing_minimal(products):
	"""
	Minimal version of product formatting that excludes heavy nested data
	(customizations and recommendations) for fast home page access.
	"""
	if not products:
		return []

	product_names = [product["docname"] for product in products if product.get("docname")]
	media_by_product = get_product_media_map(product_names)

	# Fetch which products have customizations (bulk check)
	customization_data = frappe.get_all(
		"Customization Question",
		filters={
			"parent": ["in", product_names],
			"parenttype": "Menu Product",
			"parentfield": "customization_questions"
		},
		fields=["parent"]
	)
	has_customizations_set = {row["parent"] for row in customization_data}

	formatted_products = []
	for product in products:
		formatted_products.append(
			format_product_from_row_minimal(
				product,
				media_by_product.get(product.get("docname"), []),
				product.get("docname") in has_customizations_set
			)
		)

	return formatted_products


def get_product_media_map(product_names):
	media_by_product = defaultdict(list)
	if not product_names:
		return media_by_product

	media_rows = frappe.get_all(
		"Product Media",
		filters={
			"parent": ["in", product_names],
			"parenttype": "Menu Product",
			"parentfield": "product_media"
		},
		fields=["name", "parent", "media_url", "media_type", "display_order", "alt_text", "caption"],
		order_by="parent asc, display_order asc, idx asc"
	)

	for media_row in media_rows:
		media_by_product[media_row["parent"]].append(media_row)

	return media_by_product


def get_customization_questions_map(product_names):
	questions_by_product = defaultdict(list)
	question_names = []
	if not product_names:
		return questions_by_product, question_names

	question_rows = frappe.get_all(
		"Customization Question",
		filters={
			"parent": ["in", product_names],
			"parenttype": "Menu Product",
			"parentfield": "customization_questions"
		},
		fields=["name", "parent", "question_id", "title", "subtitle", "question_type", "is_required", "display_order"],
		order_by="parent asc, display_order asc, idx asc"
	)

	for question_row in question_rows:
		questions_by_product[question_row["parent"]].append(question_row)
		question_names.append(question_row["name"])

	return questions_by_product, question_names


def get_customization_options_map(question_names):
	options_by_question = defaultdict(list)
	if not question_names:
		return options_by_question

	option_rows = frappe.get_all(
		"Customization Option",
		filters={
			"parent": ["in", question_names],
			"parenttype": "Customization Question",
			"parentfield": "options"
		},
		fields=["parent", "option_id", "label", "price", "is_vegetarian", "is_default"],
		order_by="parent asc, display_order asc, idx asc"
	)

	for option_row in option_rows:
		options_by_question[option_row["parent"]].append(option_row)

	return options_by_question



def format_product_from_row(product_row, media_rows, customization_questions, options_by_question):
	"""
	Full row formatting including customizations and recommendations.
	"""
	# Start with the same base as minimal
	product = format_product_from_row_minimal(
		product_row, 
		media_rows, 
		has_customizations=len(customization_questions) > 0
	)
	
	# Add customizations (Full version)
	if customization_questions:
		questions = []
		for q in customization_questions:
			q_data = {
				"id": q.get("question_id"),
				"title": q.get("title"),
				"type": q.get("question_type"),
				"required": bool(q.get("is_required")),
				"displayOrder": cint(q.get("display_order"))
			}
			if q.get("subtitle"):
				q_data["subtitle"] = q.get("subtitle")
				
			options = []
			for opt in options_by_question.get(q.get("name"), []):
				opt_data = {
					"id": opt.get("option_id"),
					"label": opt.get("label"),
					"price": flt(opt.get("price")) or 0
				}
				if opt.get("is_vegetarian") is not None:
					opt_data["isVegetarian"] = bool(opt.get("is_vegetarian"))
				if opt.get("is_default"):
					opt_data["isDefault"] = True
				options.append(opt_data)
			
			if options:
				q_data["options"] = options
			questions.append(q_data)
		
		if questions:
			product["customizationQuestions"] = questions

	# Add recommendations
	recs = product_row.get("recommendations")
	if recs:
		try:
			recommendations = json.loads(recs) if isinstance(recs, str) else recs
			if recommendations and isinstance(recommendations, list):
				ids = [r.get("id") for r in recommendations if isinstance(r, dict) and r.get("id")]
				if ids:
					product["recommendedDishIds"] = ids
					product["recommendedProducts"] = ids
		except Exception:
			pass

	return product



def format_product_from_row_minimal(product_row, media_rows=None, has_customizations=False):
	"""
	Minimal row formatting excluding customizations and recommendations.
	"""
	product = {
		"id": product_row["id"],
		"name": product_row["name"],
		"price": flt(product_row.get("price")),
		"category": product_row.get("category"),
		"description": product_row.get("description") or "",
		"isVegetarian": bool(product_row.get("is_vegetarian")),
		"calories": cint(product_row.get("calories")) or 0,
		"servingSize": product_row.get("servingSize") or "1",
		"displayOrder": cint(product_row.get("display_order")) if product_row.get("display_order") is not None else 0,
		"isActive": bool(product_row.get("is_active")) if product_row.get("is_active") is not None else True,
		"hasCustomizations": has_customizations
	}

	if product_row.get("original_price"):
		product["originalPrice"] = flt(product_row.get("original_price"))

	if product_row.get("type"):
		product["type"] = product_row.get("type")

	if product_row.get("estimatedTime"):
		product["estimatedTime"] = cint(product_row.get("estimatedTime"))

	if product_row.get("mainCategory"):
		product["mainCategory"] = product_row.get("mainCategory")

	media = []
	for media_item in media_rows or []:
		media_asset_data = get_media_asset_data(
			"Product Media",
			media_item.get("name"),
			f"product_{media_item.get('media_type') or 'image'}",
			media_item.get("media_url")
		)

		if media_asset_data["url"]:
			media_data = {
				"url": media_asset_data["url"],
				"type": media_item.get("media_type") or "image",
				"blurPlaceholder": media_asset_data.get("blur_placeholder"),
				"variants": media_asset_data.get("variants", {}),
				"srcset": media_asset_data.get("srcset")
			}

			if media_item.get("alt_text"):
				media_data["altText"] = media_item.get("alt_text")
			if media_item.get("caption"):
				media_data["caption"] = media_item.get("caption")
			if media_item.get("display_order"):
				media_data["displayOrder"] = media_item.get("display_order")

			media.append(media_data)

	if media:
		product["media"] = media
	elif product_row.get("has_no_media"):
		product["hasNoMedia"] = True

	return product


@frappe.whitelist(allow_guest=True)
def get_product(restaurant_id, product_id):
	"""
	GET /api/v1/products/:productId
	Get single product by ID
	Requires restaurant_id for SaaS multi-tenancy
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		if not frappe.db.exists("Menu Product", product_id):
			return {
				"success": False,
				"error": {
					"code": "PRODUCT_NOT_FOUND",
					"message": f"Product with ID {product_id} not found"
				}
			}
		
		product_doc = frappe.get_doc("Menu Product", product_id)
		
		# Validate product belongs to restaurant
		if product_doc.restaurant != restaurant:
			return {
				"success": False,
				"error": {
					"code": "PRODUCT_NOT_FOUND",
					"message": f"Product {product_id} not found for restaurant {restaurant_id}"
				}
			}
		
		if not product_doc.is_active:
			return {
				"success": False,
				"error": {
					"code": "PRODUCT_NOT_ACTIVE",
					"message": f"Product {product_id} is not active"
				}
			}
		
		formatted_product = format_product(product_doc)
		
		# Get currency info for restaurant
		currency_info = get_restaurant_currency_info(restaurant)
		
		return {
			"success": True,
			"data": {
				"product": formatted_product,
				"currency": currency_info.get("currency", "INR"),
				"currencySymbol": currency_info.get("symbol", "₹"),
				"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_product: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "PRODUCT_FETCH_ERROR",
				"message": str(e)
			}
		}


def format_product(product_doc):
	"""
	Format a Menu Product document to match API documentation format
	"""
	# Base product data
	product = {
		"id": product_doc.product_id,
		"name": product_doc.product_name,
		"price": flt(product_doc.price),
		"category": product_doc.category_name,
		"description": product_doc.description or "",
		"isVegetarian": bool(product_doc.is_vegetarian),
		"calories": cint(product_doc.calories) or 0,
		"servingSize": product_doc.serving_size or "1",
		"displayOrder": cint(product_doc.display_order) or 0,
		"isActive": bool(product_doc.is_active) if hasattr(product_doc, 'is_active') else True
	}
	
	# Optional fields
	if product_doc.original_price:
		product["originalPrice"] = flt(product_doc.original_price)
	
	if product_doc.product_type:
		product["type"] = product_doc.product_type
	
	if product_doc.estimated_time:
		product["estimatedTime"] = cint(product_doc.estimated_time)
	
	if product_doc.main_category:
		product["mainCategory"] = product_doc.main_category
	
	# Media - Using centralized Media Asset utility
	media = []
	if product_doc.product_media:
		for media_item in product_doc.product_media:
			# Use centralized utility to get Media Asset data
			media_asset_data = get_media_asset_data(
				"Product Media",
				media_item.name,
				f"product_{media_item.media_type or 'image'}",
				media_item.media_url
			)
			
			if media_asset_data["url"]:
				media_data = {
					"url": media_asset_data["url"],
					"type": media_item.media_type or "image",
					"blurPlaceholder": media_asset_data.get("blur_placeholder"),
					"variants": media_asset_data.get("variants", {}),
					"srcset": media_asset_data.get("srcset")
				}
				
				if media_item.alt_text:
					media_data["altText"] = media_item.alt_text
				if media_item.caption:
					media_data["caption"] = media_item.caption
				if media_item.display_order:
					media_data["displayOrder"] = media_item.display_order
				
				media.append(media_data)
	
	if media:
		product["media"] = media
	elif product_doc.has_no_media:
		product["hasNoMedia"] = True
	
	# Customization Questions
	if product_doc.customization_questions:
		customization_questions = []
		for question in product_doc.customization_questions:
			question_data = {
				"id": question.question_id,
				"title": question.title,
				"type": question.question_type,
				"required": bool(question.is_required)
			}
			
			if question.subtitle:
				question_data["subtitle"] = question.subtitle
			
			# Get options - need to manually load nested child table
			# Customization Option is a child table of Customization Question
			options_list = frappe.get_all(
				"Customization Option",
				filters={
					"parent": question.name,
					"parenttype": "Customization Question",
					"parentfield": "options"
				},
				fields=["option_id", "label", "price", "is_vegetarian", "is_default"],
				order_by="display_order asc"
			)
			
			if options_list:
				options = []
				for opt in options_list:
					option_data = {
						"id": opt.option_id,
						"label": opt.label,
						"price": flt(opt.price) or 0
					}
					
					if opt.is_vegetarian is not None:
						option_data["isVegetarian"] = bool(opt.is_vegetarian)
					
					if opt.is_default:
						option_data["isDefault"] = True
					
					options.append(option_data)
				
				question_data["options"] = options
			
			customization_questions.append(question_data)
		
		if customization_questions:
			product["customizationQuestions"] = customization_questions
	
	# Recommendations
	if hasattr(product_doc, 'recommendations') and product_doc.recommendations:
		try:
			recommendations = (
				json.loads(product_doc.recommendations)
				if isinstance(product_doc.recommendations, str)
				else product_doc.recommendations
			)
			if recommendations and isinstance(recommendations, list):
				# Keep full objects for internal / admin use
				product["recommendations"] = recommendations

				# Frontend contract (see RECOMMENDATIONS_API.md):
				# - recommendedDishIds: primary field, array of dish IDs
				# - recommendedProducts: backward-compatible alias with the same IDs
				ids = [r.get("id") for r in recommendations if isinstance(r, dict) and r.get("id")]
				if ids:
					product["recommendedDishIds"] = ids
					product["recommendedProducts"] = ids
		except Exception:
			# If JSON parsing fails, skip recommendations gracefully
			pass
	
	return product


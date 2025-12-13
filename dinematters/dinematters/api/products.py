# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
API endpoints for Products/Dishes
Matches format from BACKEND_API_DOCUMENTATION.md
"""

import frappe
from frappe import _
from frappe.utils import cint, flt
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api


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
				"main_category as mainCategory"
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
		
		# Format products with media and customizations
		formatted_products = []
		for product in products:
			product_doc = frappe.get_doc("Menu Product", product["id"])
			formatted_product = format_product(product_doc)
			formatted_products.append(formatted_product)
		
		# Calculate pagination
		total_pages = (total + limit - 1) // limit if limit > 0 else 1
		
		return {
			"success": True,
			"data": {
				"products": formatted_products,
				"pagination": {
					"page": page,
					"limit": limit,
					"total": total,
					"totalPages": total_pages
				}
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
		
		return {
			"success": True,
			"data": {
				"product": formatted_product
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
		"servingSize": product_doc.serving_size or "1"
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
	
	# Media
	media = []
	if product_doc.product_media:
		for media_item in product_doc.product_media:
			if media_item.media_url:
				# Get full URL if it's a file attachment
				media_url = media_item.media_url
				if media_url.startswith("/files/"):
					media_url = frappe.utils.get_url(media_url)
				media.append(media_url)
	
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
	
	return product


# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for Coupons
All endpoints require restaurant_id for SaaS multi-tenancy
"""

import frappe
from frappe import _
from frappe.utils import flt, getdate, today
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api, get_restaurant_from_id


@frappe.whitelist(allow_guest=True)
def get_coupons(restaurant_id, active_only=True):
	"""
	GET /api/method/dinematters.dinematters.api.coupons.get_coupons
	Get all available coupons for a restaurant
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Build filters
		filters = {"restaurant": restaurant}
		
		if active_only:
			filters["is_active"] = 1
			# Check validity dates (only if dates are set)
			today_date = today()
			# Build date filters - only apply if dates exist
			date_filters = []
			# Get all active coupons first, then filter in Python
			# This is more flexible than SQL filters for optional dates
		
		# Get coupons
		coupons = frappe.get_all(
			"Coupon",
			fields=[
				"name as id",
				"code",
				"discount_value as discount",
				"min_order_amount",
				"discount_type as type",
				"category",
				"description",
				"detailed_description",
				"is_active",
				"valid_from",
				"valid_until"
			],
			filters=filters,
			order_by="code asc"
		)
		
		# Format coupons and filter by dates if active_only
		formatted_coupons = []
		today_date = today() if active_only else None
		
		for coupon in coupons:
			# Check validity dates if active_only
			if active_only and today_date:
				valid_from = coupon.get("valid_from")
				valid_until = coupon.get("valid_until")
				if valid_from and getdate(valid_from) > getdate(today_date):
					continue  # Not valid yet
				if valid_until and getdate(valid_until) < getdate(today_date):
					continue  # Expired
			
			coupon_data = {
				"id": str(coupon["id"]),
				"code": coupon["code"],
				"discount": flt(coupon["discount"]),
				"minOrderAmount": flt(coupon.get("min_order_amount", 0)),
				"type": coupon.get("type", "flat"),
				"isActive": bool(coupon.get("is_active", False))
			}
			
			if coupon.get("category"):
				coupon_data["category"] = coupon["category"]
			if coupon.get("description"):
				coupon_data["description"] = coupon["description"]
			if coupon.get("detailed_description"):
				coupon_data["detailedDescription"] = coupon["detailed_description"]
			if coupon.get("valid_from"):
				coupon_data["validFrom"] = str(coupon["valid_from"])
			if coupon.get("valid_until"):
				coupon_data["validUntil"] = str(coupon["valid_until"])
			
			formatted_coupons.append(coupon_data)
		
		return {
			"success": True,
			"data": {
				"coupons": formatted_coupons
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_coupons: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "COUPON_FETCH_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist(allow_guest=True)
def validate_coupon(restaurant_id, coupon_code, cart_total=0):
	"""
	POST /api/method/dinematters.dinematters.api.coupons.validate_coupon
	Validate a coupon code and check eligibility
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Find coupon
		coupon = frappe.db.get_value(
			"Coupon",
			{"code": coupon_code, "restaurant": restaurant},
			["name", "code", "discount_value", "min_order_amount", "discount_type", "category", "is_active", "valid_from", "valid_until", "max_uses", "usage_count"],
			as_dict=True
		)
		
		if not coupon:
			return {
				"success": False,
				"error": {
					"code": "COUPON_NOT_FOUND",
					"message": f"Coupon code {coupon_code} not found"
				}
			}
		
		# Check if active
		if not coupon.is_active:
			return {
				"success": False,
				"error": {
					"code": "COUPON_INACTIVE",
					"message": "Coupon is not active"
				}
			}
		
		# Check validity dates
		today_date = today()
		if coupon.valid_from and getdate(coupon.valid_from) > getdate(today_date):
			return {
				"success": False,
				"error": {
					"code": "COUPON_NOT_VALID_YET",
					"message": "Coupon is not valid yet"
				}
			}
		
		if coupon.valid_until and getdate(coupon.valid_until) < getdate(today_date):
			return {
				"success": False,
				"error": {
					"code": "COUPON_EXPIRED",
					"message": "Coupon has expired"
				}
			}
		
		# Check minimum order amount
		cart_total = flt(cart_total)
		if coupon.min_order_amount and cart_total < coupon.min_order_amount:
			return {
				"success": False,
				"error": {
					"code": "MIN_ORDER_NOT_MET",
					"message": f"Minimum order amount of {coupon.min_order_amount} required"
				}
			}
		
		# Check max uses
		if coupon.max_uses and coupon.usage_count and coupon.usage_count >= coupon.max_uses:
			return {
				"success": False,
				"error": {
					"code": "COUPON_LIMIT_REACHED",
					"message": "Coupon usage limit reached"
				}
			}
		
		# Calculate discount amount
		discount_amount = flt(coupon.discount_value)
		if coupon.discount_type == "percent":
			discount_amount = (cart_total * flt(coupon.discount_value)) / 100
		
		# Return valid coupon
		coupon_data = {
			"id": str(coupon.name),
			"code": coupon.code,
			"discount": flt(coupon.discount_value),
			"minOrderAmount": flt(coupon.min_order_amount or 0),
			"type": coupon.discount_type or "flat",
			"isEligible": True,
			"discountAmount": discount_amount
		}
		
		if coupon.category:
			coupon_data["category"] = coupon.category
		
		return {
			"success": True,
			"data": {
				"coupon": coupon_data
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in validate_coupon: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "COUPON_VALIDATION_ERROR",
				"message": str(e)
			}
		}



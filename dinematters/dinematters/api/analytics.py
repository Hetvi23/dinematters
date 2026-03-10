# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Analytics API for Offer System
Provides insights into coupon usage, offer performance, and revenue impact
"""

import frappe
from frappe import _
from frappe.utils import flt, getdate, today, add_days
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api
import json


@frappe.whitelist()
def get_offer_analytics(restaurant_id, start_date=None, end_date=None):
	"""
	Get comprehensive analytics for offers and coupons
	
	Returns:
	- Total offers created
	- Active vs inactive offers
	- Coupon usage statistics
	- Revenue impact (discount given vs revenue generated)
	- Top performing offers
	- Offer type breakdown
	"""
	try:
		# Validate restaurant
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Default date range: last 30 days
		if not end_date:
			end_date = today()
		if not start_date:
			start_date = add_days(end_date, -30)
		
		# Get all offers for restaurant
		offers = frappe.get_all(
			"Coupon",
			filters={"restaurant": restaurant},
			fields=["name", "code", "offer_type", "is_active", "usage_count", "max_uses"]
		)
		
		# Offer breakdown
		total_offers = len(offers)
		active_offers = len([o for o in offers if o.is_active])
		inactive_offers = total_offers - active_offers
		
		# Offer type breakdown
		offer_types = {}
		for offer in offers:
			offer_type = offer.offer_type or "coupon"
			offer_types[offer_type] = offer_types.get(offer_type, 0) + 1
		
		# Get coupon usage data
		usage_data = frappe.db.sql("""
			SELECT 
				cu.coupon,
				c.code,
				c.offer_type,
				COUNT(*) as usage_count,
				SUM(cu.discount_amount) as total_discount,
				c.discount_value,
				c.discount_type
			FROM `tabCoupon Usage` cu
			JOIN `tabCoupon` c ON cu.coupon = c.name
			WHERE cu.restaurant = %s
			AND cu.usage_date BETWEEN %s AND %s
			GROUP BY cu.coupon
			ORDER BY usage_count DESC
			LIMIT 10
		""", (restaurant, start_date, end_date), as_dict=True)
		
		# Calculate total discount given
		total_discount_given = sum([flt(u.total_discount) for u in usage_data])
		total_redemptions = sum([u.usage_count for u in usage_data])
		
		# Get revenue impact (orders with coupons vs without)
		revenue_data = frappe.db.sql("""
			SELECT 
				COUNT(*) as total_orders,
				SUM(subtotal) as total_subtotal,
				SUM(discount) as total_discount,
				SUM(total) as total_revenue
			FROM `tabOrder`
			WHERE restaurant = %s
			AND creation BETWEEN %s AND %s
			AND coupon IS NOT NULL
		""", (restaurant, start_date, end_date), as_dict=True)
		
		orders_with_coupons = revenue_data[0] if revenue_data else {
			"total_orders": 0,
			"total_subtotal": 0,
			"total_discount": 0,
			"total_revenue": 0
		}
		
		# Get orders without coupons for comparison
		revenue_no_coupon = frappe.db.sql("""
			SELECT 
				COUNT(*) as total_orders,
				SUM(total) as total_revenue
			FROM `tabOrder`
			WHERE restaurant = %s
			AND creation BETWEEN %s AND %s
			AND (coupon IS NULL OR coupon = '')
		""", (restaurant, start_date, end_date), as_dict=True)
		
		orders_without_coupons = revenue_no_coupon[0] if revenue_no_coupon else {
			"total_orders": 0,
			"total_revenue": 0
		}
		
		# Calculate average order value
		avg_order_with_coupon = (
			flt(orders_with_coupons["total_revenue"]) / orders_with_coupons["total_orders"]
			if orders_with_coupons["total_orders"] > 0 else 0
		)
		
		avg_order_without_coupon = (
			flt(orders_without_coupons["total_revenue"]) / orders_without_coupons["total_orders"]
			if orders_without_coupons["total_orders"] > 0 else 0
		)
		
		# Top performing offers
		top_offers = []
		for usage in usage_data[:5]:
			top_offers.append({
				"code": usage.code,
				"offerType": usage.offer_type or "coupon",
				"usageCount": usage.usage_count,
				"totalDiscount": flt(usage.total_discount),
				"avgDiscount": flt(usage.total_discount) / usage.usage_count if usage.usage_count > 0 else 0
			})
		
		return {
			"success": True,
			"data": {
				"dateRange": {
					"startDate": start_date,
					"endDate": end_date
				},
				"offerSummary": {
					"totalOffers": total_offers,
					"activeOffers": active_offers,
					"inactiveOffers": inactive_offers,
					"offerTypeBreakdown": offer_types
				},
				"usageStatistics": {
					"totalRedemptions": total_redemptions,
					"totalDiscountGiven": total_discount_given,
					"avgDiscountPerRedemption": total_discount_given / total_redemptions if total_redemptions > 0 else 0
				},
				"revenueImpact": {
					"ordersWithCoupons": orders_with_coupons["total_orders"],
					"ordersWithoutCoupons": orders_without_coupons["total_orders"],
					"revenueWithCoupons": flt(orders_with_coupons["total_revenue"]),
					"revenueWithoutCoupons": flt(orders_without_coupons["total_revenue"]),
					"avgOrderValueWithCoupon": avg_order_with_coupon,
					"avgOrderValueWithoutCoupon": avg_order_without_coupon,
					"totalSubtotal": flt(orders_with_coupons["total_subtotal"]),
					"totalDiscount": flt(orders_with_coupons["total_discount"])
				},
				"topPerformingOffers": top_offers
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_offer_analytics: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "ANALYTICS_ERROR",
				"message": str(e)
			}
		}


@frappe.whitelist()
def get_coupon_performance(restaurant_id, coupon_id):
	"""
	Get detailed performance metrics for a specific coupon
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id)
		
		# Get coupon details
		coupon = frappe.get_doc("Coupon", coupon_id)
		
		if coupon.restaurant != restaurant:
			return {
				"success": False,
				"error": {
					"code": "UNAUTHORIZED",
					"message": "Coupon does not belong to this restaurant"
				}
			}
		
		# Get usage history
		usage_history = frappe.get_all(
			"Coupon Usage",
			filters={"coupon": coupon_id},
			fields=["usage_date", "discount_amount", "customer", "order"],
			order_by="usage_date desc",
			limit=100
		)
		
		# Get unique customers
		unique_customers = len(set([u.customer for u in usage_history]))
		
		# Calculate daily usage trend
		daily_usage = {}
		for usage in usage_history:
			date_key = str(getdate(usage.usage_date))
			if date_key not in daily_usage:
				daily_usage[date_key] = {"count": 0, "discount": 0}
			daily_usage[date_key]["count"] += 1
			daily_usage[date_key]["discount"] += flt(usage.discount_amount)
		
		return {
			"success": True,
			"data": {
				"coupon": {
					"code": coupon.code,
					"offerType": coupon.offer_type or "coupon",
					"discountType": coupon.discount_type,
					"discountValue": flt(coupon.discount_value),
					"usageCount": coupon.usage_count or 0,
					"maxUses": coupon.max_uses,
					"isActive": coupon.is_active
				},
				"performance": {
					"totalRedemptions": len(usage_history),
					"uniqueCustomers": unique_customers,
					"avgRedemptionsPerCustomer": len(usage_history) / unique_customers if unique_customers > 0 else 0,
					"totalDiscountGiven": sum([flt(u.discount_amount) for u in usage_history]),
					"avgDiscountPerRedemption": sum([flt(u.discount_amount) for u in usage_history]) / len(usage_history) if usage_history else 0
				},
				"dailyTrend": [
					{
						"date": date,
						"count": data["count"],
						"discount": data["discount"]
					}
					for date, data in sorted(daily_usage.items())
				],
				"recentUsage": [
					{
						"date": str(u.usage_date),
						"discount": flt(u.discount_amount),
						"customer": u.customer,
						"order": u.order
					}
					for u in usage_history[:20]
				]
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_coupon_performance: {str(e)}")
		return {
			"success": False,
			"error": {
				"code": "PERFORMANCE_ERROR",
				"message": str(e)
			}
		}

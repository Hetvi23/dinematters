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


# Production-grade analytics engine with tiered feature gating
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


@frappe.whitelist(allow_guest=True)
def log_event(restaurant_id, event_type, event_value=None, session_id=None, platform="web"):
	"""
	Logs a guest interaction event. Whitelisted for guests.
	"""
	try:
		# Ensure restaurant_id is lowercase slugs
		restaurant_id = restaurant_id.lower() if restaurant_id else restaurant_id
		
		if not restaurant_id or not event_type:
			return {"success": False, "message": "Missing required fields"}

		# Validate restaurant exists
		if not frappe.db.exists("Restaurant", restaurant_id):
			return {"success": False, "message": "Invalid restaurant"}

		doc = frappe.get_doc({
			"doctype": "Analytics Event",
			"restaurant": restaurant_id,
			"event_type": event_type,
			"event_value": event_value,
			"session_id": session_id or "anonymous",
			"platform": platform
		})
		doc.insert(ignore_permissions=True)
		frappe.db.commit()

		return {"success": True}
	except Exception as e:
		frappe.log_error(f"Error in log_event: {str(e)}")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_dashboard_summary(restaurant_id):
	"""
	Returns a tiered summary of analytics for the merchant dashboard.
	"""
	try:
		# Ensure restaurant_id is lowercase (DocNames in DineMatters are lowercase slugs)
		restaurant_id = restaurant_id.lower() if restaurant_id else restaurant_id
		
		# Validate restaurant & check subscription tier
		restaurant = frappe.get_doc("Restaurant", restaurant_id)
		# Assume plan is stored on Restaurant or available via a helper
		from dinematters.dinematters.utils.feature_gate import get_restaurant_plan
		plan = get_restaurant_plan(restaurant_id) # Returns 'SILVER', 'GOLD', or 'DIAMOND'

		# Use tomorrow's date for end_date to include all events from today (April 10)
		end_date = add_days(today(), 1)
		start_date_7d = add_days(today(), -7) # Exactly 7 days ago

		# 1. Traffic Stats (Always available, but SILVER leads with this)
		traffic_stats = frappe.db.sql("""
			SELECT 
				COUNT(*) as total_views,
				COUNT(DISTINCT session_id) as unique_visitors
			FROM `tabAnalytics Event`
			WHERE restaurant = %s 
			AND event_type = 'menu_view'
			AND creation BETWEEN %s AND %s
		""", (restaurant_id, start_date_7d, end_date), as_dict=True)[0]

		# Calculate growth (current 7d vs previous 7d)
		start_date_prev = add_days(start_date_7d, -7)
		prev_traffic = frappe.db.sql("""
			SELECT COUNT(*) as total_views
			FROM `tabAnalytics Event`
			WHERE restaurant = %s 
			AND event_type = 'menu_view'
			AND creation BETWEEN %s AND %s
		""", (restaurant_id, start_date_prev, start_date_7d), as_dict=True)[0]

		growth = 0
		if prev_traffic.total_views > 0:
			growth = ((traffic_stats.total_views - prev_traffic.total_views) / prev_traffic.total_views) * 100

		# 2. Lifetime Analytics (Production-Grade Optimization: Index ensures this is fast)
		lifetime_scans = frappe.db.count("Analytics Event", {
			"restaurant": restaurant_id,
			"event_type": "menu_view"
		})

		summary = {
			"success": True,
			"tier": plan,
			"traffic": {
				"totalViews": traffic_stats.total_views,
				"uniqueVisitors": traffic_stats.unique_visitors,
				"growth": round(growth, 1),
				"lifetimeScans": lifetime_scans
			}
		}

		# 1.1 Calculate Peak Hour (Production Insight)
		peak_hour_data = frappe.db.sql("""
			SELECT HOUR(creation) as hour, COUNT(*) as count
			FROM `tabAnalytics Event`
			WHERE restaurant = %s AND event_type = 'menu_view'
			AND creation BETWEEN %s AND %s
			GROUP BY hour ORDER BY count DESC LIMIT 1
		""", (restaurant_id, start_date_7d, end_date), as_dict=True)
		
		if peak_hour_data:
			h = peak_hour_data[0].hour
			am_pm = "AM" if h < 12 else "PM"
			display_h = h % 12
			if display_h == 0: display_h = 12
			summary["traffic"]["peakHour"] = f"{display_h} {am_pm}"
			summary["traffic"]["peakHourLabel"] = "Most busy time"

		# 1.2 Top Category by Scans (Tease for SILVER, data for GOLD)
		# We'll use the 'Top Category' logic but specifically from analytics events if available, 
		# otherwise fallback to Menu Category list
		summary["traffic"]["topCategory"] = frappe.db.sql("""
			SELECT event_value, COUNT(*) as count
			FROM `tabAnalytics Event`
			WHERE restaurant = %s AND event_type = 'category_view'
			GROUP BY event_value ORDER BY count DESC LIMIT 1
		""", (restaurant_id), as_dict=True)

		# 2. GOLD/DIAMOND Features (Revenue, Conversion, etc.)
		if plan in ['GOLD', 'DIAMOND']:
			# Get order stats
			order_stats = frappe.db.sql("""
				SELECT 
					COUNT(*) as total_orders,
					SUM(total) as revenue
				FROM `tabOrder`
				WHERE restaurant = %s
				AND creation BETWEEN %s AND %s
			""", (restaurant_id, start_date_7d, end_date), as_dict=True)[0]

			summary["enhanced"] = {
				"totalOrders": order_stats.total_orders,
				"revenue": flt(order_stats.revenue),
				"conversionRate": round((order_stats.total_orders / traffic_stats.total_views * 100), 2) if traffic_stats.total_views > 0 else 0
			}
			
			# Item views vs Orders (locked for SILVER)
			summary["topPerformers"] = frappe.db.sql("""
				SELECT 
					event_value as item_name,
					COUNT(*) as views
				FROM `tabAnalytics Event`
				WHERE restaurant = %s AND event_type = 'item_view'
				AND creation BETWEEN %s AND %s
				GROUP BY event_value
				ORDER BY views DESC
				LIMIT 8
			""", (restaurant_id, start_date_7d, end_date), as_dict=True)

			# Engagement Metrics (Conversion)
			order_stats = summary.get("enhanced", {})
			scans = summary.get("traffic", {}).get("totalViews", 0)
			
			summary["enhanced"]["conversionRate"] = round((order_stats.get("total_orders", 0) / scans * 100), 2) if scans > 0 else 0
			summary["enhanced"]["avgOrderValue"] = flt(order_stats.get("revenue", 0) / order_stats.get("total_orders", 1)) if order_stats.get("total_orders", 0) > 0 else 0

		return summary
	except Exception as e:
		frappe.log_error(f"Error in get_dashboard_summary: {str(e)}")
		return {"success": False, "error": str(e)}

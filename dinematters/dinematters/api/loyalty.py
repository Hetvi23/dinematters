# Copyright (c) 2026, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, cint, now_datetime, get_datetime_str
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api
from dinematters.dinematters.utils.customer_helpers import normalize_phone, get_or_create_customer
import json
import random
import string

@frappe.whitelist(allow_guest=True)
def get_loyalty_summary(restaurant_id, phone):
	"""
	GET /api/method/dinematters.dinematters.api.loyalty.get_loyalty_summary
	Get customer's loyalty balance and history for a specific restaurant
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id)
		normalized_phone = normalize_phone(phone)
		if not normalized_phone:
			return {"success": False, "error": {"code": "INVALID_PHONE", "message": "Invalid phone number"}}
		
		customer = get_or_create_customer(normalized_phone)
		
		# Get all point entries
		entries = frappe.get_all(
			"Restaurant Loyalty Entry",
			filters={"customer": customer.name, "restaurant": restaurant},
			fields=["transaction_type", "coins", "reason", "posting_date", "reference_doctype", "reference_name", "creation"],
			order_by="creation desc"
		)
		
		balance = 0
		for entry in entries:
			if entry.transaction_type == "Earn":
				balance += entry.coins
			else:
				balance -= entry.coins
		
		return {
			"success": True,
			"data": {
				"balance": balance,
				"transactions": entries
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in get_loyalty_summary: {str(e)}")
		return {"success": False, "error": {"code": "LOYALTY_FETCH_ERROR", "message": str(e)}}

@frappe.whitelist(allow_guest=True)
def generate_referral_link(restaurant_id, phone, platform="WhatsApp"):
	"""
	POST /api/method/dinematters.dinematters.api.loyalty.generate_referral_link
	Generate or get a unique referral link for a customer
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id)
		normalized_phone = normalize_phone(phone)
		
		if not normalized_phone:
			return {"success": False, "error": {"code": "INVALID_PHONE", "message": "Invalid phone number"}}
		
		customer = get_or_create_customer(normalized_phone)
		
		# Check if link already exists
		existing_link = frappe.db.get_value(
			"Referral Link",
			{"referrer": customer.name, "restaurant": restaurant, "platform": platform},
			["name", "identifier"],
			as_dict=True
		)
		
		if existing_link:
			identifier = existing_link.identifier
		else:
			# Generate unique identifier
			identifier = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
			while frappe.db.exists("Referral Link", {"identifier": identifier}):
				identifier = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
			
			link_doc = frappe.get_doc({
				"doctype": "Referral Link",
				"referrer": customer.name,
				"restaurant": restaurant,
				"identifier": identifier,
				"platform": platform,
				"is_active": 1
			})
			link_doc.insert(ignore_permissions=True)
		
		# Build the full URL
		# For local testing, we might use a placeholder. In production, we'd use the restaurant's subdomain/base URL.
		config = frappe.get_doc("Restaurant Config", {"restaurant": restaurant})
		base_url = config.google_review_link or "https://dinematters.com" # Fallback
		# Actually, referral links should point to the restaurant's menu
		# Assuming structure: base_url/r/{identifier}
		referral_url = f"{base_url.rstrip('/')}/r/{identifier}"
		
		return {
			"success": True,
			"data": {
				"identifier": identifier,
				"link": referral_url
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in generate_referral_link: {str(e)}")
		return {"success": False, "error": {"code": "REFERRAL_LINK_ERROR", "message": str(e)}}

@frappe.whitelist(allow_guest=True)
def track_referral_visit(identifier, ip_address=None, user_agent=None):
	"""
	POST /api/method/dinematters.dinematters.api.loyalty.track_referral_visit
	Track a visit to a referral link and reward the referrer if unique
	"""
	try:
		link_name = frappe.db.get_value("Referral Link", {"identifier": identifier}, "name")
		if not link_name:
			return {"success": False, "error": {"code": "LINK_NOT_FOUND", "message": "Invalid referral link"}}
		
		link_doc = frappe.get_doc("Referral Link", link_name)
		
		# Check if this IP has visited this link before
		is_unique = not frappe.db.exists("Referral Visit", {
			"referral_link": link_name,
			"ip_address": ip_address
		})
		
		visit_doc = frappe.get_doc({
			"doctype": "Referral Visit",
			"referral_link": link_name,
			"ip_address": ip_address,
			"user_agent": user_agent,
			"is_unique": 1 if is_unique else 0,
			"timestamp": now_datetime()
		})
		visit_doc.insert(ignore_permissions=True)
		
		# If unique, check if threshold for share reward is met
		if is_unique:
			loyalty_prog = frappe.get_doc("Restaurant Loyalty Config", {"restaurant": link_doc.restaurant, "is_active": 1})
			if loyalty_prog:
				unique_visits = frappe.db.count("Referral Visit", {
					"referral_link": link_name,
					"is_unique": 1
				})
				
				if unique_visits == loyalty_prog.min_unique_opens_for_reward:
					# Initial threshold reward
					credit_loyalty_points(
						customer=link_doc.referrer,
						restaurant=link_doc.restaurant,
						coins=loyalty_prog.share_reward_coins,
						reason="Referral Share (Initial Threshold)",
						ref_doctype="Referral Link",
						ref_name=link_name
					)
				elif unique_visits > loyalty_prog.min_unique_opens_for_reward and unique_visits <= loyalty_prog.max_opens_rewarded_per_share:
					# Micro reward for engagement
					credit_loyalty_points(
						customer=link_doc.referrer,
						restaurant=link_doc.restaurant,
						coins=loyalty_prog.coins_per_unique_open,
						reason=f"Referral Engagement (Unique Open #{unique_visits})",
						ref_doctype="Referral Link",
						ref_name=link_name
					)
		
		return {
			"success": True,
			"data": {
				"restaurant_id": link_doc.restaurant,
				"is_unique": is_unique
			}
		}
	except Exception as e:
		frappe.log_error(f"Error in track_referral_visit: {str(e)}")
		return {"success": False, "error": {"code": "TRACKING_ERROR", "message": str(e)}}

def credit_loyalty_points(customer, restaurant, coins, reason, ref_doctype=None, ref_name=None, transaction_type="Earn"):
	"""Helper function to create a Restaurant Loyalty Entry"""
	if coins <= 0:
		return
		
	entry = frappe.get_doc({
		"doctype": "Restaurant Loyalty Entry",
		"customer": customer,
		"restaurant": restaurant,
		"coins": coins,
		"transaction_type": transaction_type,
		"reason": reason,
		"reference_doctype": ref_doctype,
		"reference_name": ref_name,
		"posting_date": frappe.utils.today()
	})
	entry.insert(ignore_permissions=True)
	frappe.db.commit()

@frappe.whitelist(allow_guest=True)
def get_loyalty_config(restaurant_id):
	"""Get loyalty configurations for admin"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id)
		if not frappe.db.exists("Restaurant Loyalty Config", {"restaurant": restaurant}):
			return {"success": True, "data": None}
			
		prog_name = frappe.db.get_value("Restaurant Loyalty Config", {"restaurant": restaurant}, "name")
		config = frappe.get_doc("Restaurant Loyalty Config", prog_name)
		return {"success": True, "data": config}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Loyalty Get Config Error")
		return {"success": False, "error": str(e)}

@frappe.whitelist()
def update_loyalty_config(restaurant_id, config, enable_loyalty=None):
	"""Update loyalty configurations for admin"""
	try:
		# Correct logging: title is first, message (config) is second
		frappe.log_error("Loyalty API Update Call", f"Updating for {restaurant_id} with config: {config}")
		
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		if isinstance(config, str):
			config = json.loads(config)
			
		# Handle Restaurant Loyalty Config record
		if frappe.db.exists("Restaurant Loyalty Config", {"restaurant": restaurant}):
			prog_name = frappe.db.get_value("Restaurant Loyalty Config", {"restaurant": restaurant}, "name")
			prog_doc = frappe.get_doc("Restaurant Loyalty Config", prog_name)
			prog_doc.update(config)
			prog_doc.save(ignore_permissions=True)
			frappe.log_error("Restaurant Loyalty Config Updated", f"Updated {prog_doc.name}")
		else:
			config["doctype"] = "Restaurant Loyalty Config"
			config["restaurant"] = restaurant
			prog_doc = frappe.get_doc(config)
			prog_doc.insert(ignore_permissions=True)
			frappe.log_error("Restaurant Loyalty Config Created", f"Created {prog_doc.name}")
		
		# Update Restaurant enable_loyalty
		if enable_loyalty is not None:
			frappe.db.set_value("Restaurant", restaurant, "enable_loyalty", 1 if enable_loyalty else 0)
			frappe.db.set_value("Restaurant Config", {"restaurant": restaurant}, "enable_loyalty", 1 if enable_loyalty else 0)
			
		frappe.db.commit()
		return {"success": True}
	except Exception as e:
		frappe.log_error("Loyalty Save Error", frappe.get_traceback())
		return {"success": False, "error": str(e)}
@frappe.whitelist()
def get_customer_insights(restaurant_id, search_query=None):
	"""
	Get list of customers with their points for a restaurant.
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		
		# Build basic filters
		filters = {"restaurant": restaurant}
		
		# Get all customers who have ever had a loyalty entry at this restaurant
		# Or just get all customers and calculate their balance?
		# Better: Get all platform customers linked to this restaurant via orders or loyalty entries
		
		# Find customers via Restaurant Loyalty Entry
		customer_names = frappe.get_all(
			"Restaurant Loyalty Entry",
			filters={"restaurant": restaurant},
			pluck="customer",
			distinct=True
		)
		
		# Also find customers via Orders
		order_customers = frappe.get_all(
			"Order",
			filters={"restaurant": restaurant, "platform_customer": ["is", "set"]},
			pluck="platform_customer",
			distinct=True
		)
		
		all_customer_ids = list(set(customer_names + order_customers))
		
		if search_query:
			# Filter these IDs by customer name/phone
			matching_customers = frappe.get_all(
				"Customer",
				filters={
					"name": ["in", all_customer_ids],
					"or": [
						{"full_name": ["like", f"%{search_query}%"]},
						{"phone": ["like", f"%{search_query}%"]}
					]
				},
				pluck="name"
			)
			all_customer_ids = matching_customers
			
		results = []
		for cust_id in all_customer_ids:
			customer = frappe.get_doc("Customer", cust_id)
			
			# Get balance
			entries = frappe.get_all(
				"Restaurant Loyalty Entry",
				filters={"customer": cust_id, "restaurant": restaurant},
				fields=["transaction_type", "coins"]
			)
			
			balance = 0
			for entry in entries:
				if entry.transaction_type == "Earn":
					balance += entry.coins
				else:
					balance -= entry.coins
			
			results.append({
				"id": customer.name,
				"name": customer.customer_name or customer.name,
				"phone": customer.phone,
				"balance": balance,
				"last_active": customer.modified
			})
			
		# Sort by balance descending
		results.sort(key=lambda x: x["balance"], reverse=True)
		
		return {"success": True, "data": results}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Loyalty Insights Error")
		return {"success": False, "error": str(e)}

@frappe.whitelist()
def adjust_customer_points(restaurant_id, customer_id, coins, reason, transaction_type="Earn"):
	"""
	Manually adjust customer points (for admin use).
	"""
	try:
		restaurant = validate_restaurant_for_api(restaurant_id, frappe.session.user)
		coins = cint(coins)
		
		if coins <= 0:
			return {"success": False, "error": "Coins must be greater than 0"}
			
		entry = frappe.get_doc({
			"doctype": "Restaurant Loyalty Entry",
			"customer": customer_id,
			"restaurant": restaurant,
			"coins": coins,
			"transaction_type": transaction_type,
			"reason": reason or "Manual Adjustment",
			"posting_date": frappe.utils.today()
		})
		entry.insert(ignore_permissions=True)
		frappe.db.commit()
		
		return {"success": True, "message": f"Successfully {transaction_type.lower()}ed {coins} coins"}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Loyalty Adjustment Error")
		return {"success": False, "error": str(e)}

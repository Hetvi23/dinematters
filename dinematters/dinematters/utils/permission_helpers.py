# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Permission helper functions for Restaurant-based access control
"""

import frappe
from dinematters.dinematters.utils.permissions import get_user_restaurant_ids


def get_restaurant_permission_query_conditions(user, doctype):
	"""Get permission query conditions for restaurant-based doctypes
	This filters data based on Restaurant User records (role-based approach)
	Role Permissions control what actions users can perform (read/write/create/delete)
	"""
	if not user:
		user = frappe.session.user
	
	if user == "Administrator":
		return ""
	
	restaurant_ids = get_user_restaurant_ids(user)
	
	if not restaurant_ids:
		return "1=0"  # No access
	
	# Build condition
	restaurant_list = ",".join([f'"{r}"' for r in restaurant_ids])
	
	# For Restaurant doctype, filter by name directly
	if doctype == "Restaurant":
		return f"`tab{doctype}`.name IN ({restaurant_list})"
	
	# For other doctypes, filter by restaurant field
	return f"`tab{doctype}`.restaurant IN ({restaurant_list})"


def has_restaurant_permission(doc, user=None):
	"""Check if user has permission to access restaurant-based document
	Role Permissions control what actions users can perform (read/write/create/delete)
	This function only checks if user has access to the restaurant (data filtering)
	"""
	if not user:
		user = frappe.session.user
	
	if user == "Administrator":
		return True
	
	# For Restaurant doctype, check by name
	if doc.doctype == "Restaurant":
		restaurant_ids = get_user_restaurant_ids(user)
		return doc.name in restaurant_ids
	
	# For other doctypes, check restaurant field
	if not hasattr(doc, "restaurant") or not doc.restaurant:
		return False
	
	# Check user has access to this restaurant
	restaurant_ids = get_user_restaurant_ids(user)
	return doc.restaurant in restaurant_ids


# Specific permission functions for each doctype

def get_menu_product_permissions(user, doctype="Menu Product"):
	"""Get permission query for Menu Product"""
	return get_restaurant_permission_query_conditions(user, doctype)


def has_menu_product_permission(doc, user, ptype):
	"""Check permission for Menu Product"""
	return has_restaurant_permission(doc, user)


def get_menu_category_permissions(user, doctype="Menu Category"):
	"""Get permission query for Menu Category"""
	return get_restaurant_permission_query_conditions(user, doctype)


def has_menu_category_permission(doc, user, ptype):
	"""Check permission for Menu Category"""
	return has_restaurant_permission(doc, user)


def get_order_permissions(user, doctype="Order"):
	"""Get permission query for Order"""
	return get_restaurant_permission_query_conditions(user, doctype)


def has_order_permission(doc, user, ptype):
	"""Check permission for Order"""
	return has_restaurant_permission(doc, user)


def get_cart_entry_permissions(user, doctype="Cart Entry"):
	"""Get permission query for Cart Entry"""
	return get_restaurant_permission_query_conditions(user, doctype)


def has_cart_entry_permission(doc, user, ptype):
	"""Check permission for Cart Entry"""
	return has_restaurant_permission(doc, user)


def get_restaurant_user_permission_query_conditions(user, doctype="Restaurant User"):
	"""Get permission query for Restaurant User - filter by restaurants user has access to"""
	if not user:
		user = frappe.session.user
	
	if user == "Administrator":
		return ""
	
	restaurant_ids = get_user_restaurant_ids(user)
	
	if not restaurant_ids:
		return "1=0"  # No access
	
	# Build condition - Restaurant User has a restaurant field
	restaurant_list = ",".join([f'"{r}"' for r in restaurant_ids])
	return f"`tab{doctype}`.restaurant IN ({restaurant_list})"


def has_restaurant_user_permission(doc, user, ptype):
	"""Check permission for Restaurant User"""
	return has_restaurant_permission(doc, user)



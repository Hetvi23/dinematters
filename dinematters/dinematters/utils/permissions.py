# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Utility functions for Restaurant User Permissions
"""

import frappe
from frappe.permissions import add_user_permission, remove_user_permission
from frappe import _


def create_restaurant_user_permission(user, restaurant, is_default=0):
	"""Create User Permission for restaurant"""
	try:
		# Check if permission already exists
		if frappe.db.exists("User Permission", {
			"user": user,
			"allow": "Restaurant",
			"for_value": restaurant
		}):
			return
		
		# Create User Permission
		add_user_permission(
			doctype="Restaurant",
			name=restaurant,
			user=user,
			is_default=is_default,
			ignore_permissions=True
		)
	except Exception as e:
		frappe.log_error(f"Error creating restaurant user permission: {str(e)}", "Restaurant Permission")


def remove_restaurant_user_permission(user, restaurant):
	"""Remove User Permission for restaurant"""
	try:
		remove_user_permission(
			doctype="Restaurant",
			name=restaurant,
			user=user,
			ignore_permissions=True
		)
	except Exception as e:
		frappe.log_error(f"Error removing restaurant user permission: {str(e)}", "Restaurant Permission")


def assign_user_to_restaurant(user, restaurant, role="Restaurant Staff", is_default=0):
	"""Assign user to restaurant (creates Restaurant User + User Permission)"""
	# Check if Restaurant User already exists
	if frappe.db.exists("Restaurant User", {"user": user, "restaurant": restaurant}):
		frappe.throw(_("User is already assigned to this restaurant"))
	
	# Create Restaurant User
	restaurant_user = frappe.get_doc({
		"doctype": "Restaurant User",
		"user": user,
		"restaurant": restaurant,
		"role": role,
		"is_default": is_default,
		"is_active": 1
	})
	restaurant_user.insert(ignore_permissions=True)
	
	return restaurant_user


def remove_user_from_restaurant(user, restaurant):
	"""Remove user from restaurant"""
	restaurant_user = frappe.db.get_value(
		"Restaurant User",
		{"user": user, "restaurant": restaurant},
		"name"
	)
	
	if restaurant_user:
		frappe.delete_doc("Restaurant User", restaurant_user, ignore_permissions=True)
		return True
	return False


def get_user_restaurants(user):
	"""Get all restaurants assigned to user"""
	restaurants = frappe.get_all(
		"Restaurant User",
		filters={"user": user, "is_active": 1},
		fields=["restaurant", "role", "is_default", "name"],
		order_by="is_default desc, restaurant asc"
	)
	return restaurants


def get_default_restaurant(user):
	"""Get user's default restaurant"""
	restaurant = frappe.db.get_value(
		"Restaurant User",
		{"user": user, "is_default": 1, "is_active": 1},
		"restaurant"
	)
	return restaurant


def get_user_restaurant_ids(user):
	"""Get list of restaurant IDs user has access to"""
	if user == "Administrator":
		# Administrator has access to all restaurants
		restaurants = frappe.get_all("Restaurant", filters={"is_active": 1}, pluck="name")
		return restaurants
	
	# Get restaurants from User Permissions
	user_perms = frappe.get_all(
		"User Permission",
		filters={"user": user, "allow": "Restaurant"},
		pluck="for_value"
	)
	return user_perms


def validate_restaurant_access(user, restaurant):
	"""Validate user has access to restaurant"""
	if user == "Administrator":
		return True
	
	# Check if restaurant exists and is active
	if not frappe.db.exists("Restaurant", {"name": restaurant, "is_active": 1}):
		return False
	
	# Check user permissions
	restaurant_ids = get_user_restaurant_ids(user)
	return restaurant in restaurant_ids



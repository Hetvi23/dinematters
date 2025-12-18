# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for UI - doctype meta, permissions, etc.
"""

import frappe
from frappe import _
import json


@frappe.whitelist()
def get_doctype_meta(doctype):
	"""Get doctype metadata including fields and permissions"""
	try:
		meta = frappe.get_meta(doctype)
		
		# Get fields - meta.fields is a list of DocField objects
		fields = []
		if meta.fields:
			for field in meta.fields:
				# Skip system fields and section breaks
				if field.fieldtype in ['Section Break', 'Column Break', 'Tab Break', 'HTML', 'Button']:
					continue
				
				field_data = {
					'fieldname': field.fieldname,
					'label': field.label or field.fieldname,
					'fieldtype': field.fieldtype,
					'options': getattr(field, 'options', None),
					'required': getattr(field, 'reqd', 0) == 1,
					'read_only': getattr(field, 'read_only', 0) == 1,
					'default': getattr(field, 'default', None),
					'description': getattr(field, 'description', None),
					'hidden': getattr(field, 'hidden', 0) == 1,
					'depends_on': getattr(field, 'depends_on', None),
					'fetch_from': getattr(field, 'fetch_from', None),
				}
				
				# Add child table info
				if field.fieldtype == 'Table':
					field_data['child_doctype'] = field.options
				
				fields.append(field_data)
		
		# Get permissions for current user
		permissions = get_user_permissions(doctype)
		
		# Check if workflow exists
		has_workflow = False
		try:
			from frappe.model.workflow import get_workflow_name
			workflow_name = get_workflow_name(doctype)
			has_workflow = bool(workflow_name)
		except:
			pass
		
		# Return in format expected by frappe-react-sdk (wrapped in 'message')
		return {
			'doctype': doctype,
			'name_field': meta.get('title_field') or 'name',
			'autoname': meta.get('autoname'),
			'fields': fields,
			'permissions': permissions,
			'is_submittable': getattr(meta, 'is_submittable', 0) == 1,
			'has_workflow': has_workflow,
		}
	except Exception as e:
		frappe.log_error(f"Error getting doctype meta for {doctype}: {str(e)}")
		return {
			'success': False,
			'error': str(e)
		}


@frappe.whitelist()
def get_user_permissions(doctype):
	"""Get user permissions for a doctype"""
	try:
		user = frappe.session.user
		
		# Check permissions
		can_read = frappe.has_permission(doctype, 'read', user=user)
		can_write = frappe.has_permission(doctype, 'write', user=user)
		can_create = frappe.has_permission(doctype, 'create', user=user)
		can_delete = frappe.has_permission(doctype, 'delete', user=user)
		can_submit = frappe.has_permission(doctype, 'submit', user=user) if frappe.get_meta(doctype).is_submittable else False
		can_cancel = frappe.has_permission(doctype, 'cancel', user=user) if frappe.get_meta(doctype).is_submittable else False
		
		return {
			'read': can_read,
			'write': can_write,
			'create': can_create,
			'delete': can_delete,
			'submit': can_submit,
			'cancel': can_cancel,
		}
	except Exception as e:
		frappe.log_error(f"Error getting permissions: {str(e)}")
		return {
			'read': False,
			'write': False,
			'create': False,
			'delete': False,
			'submit': False,
			'cancel': False,
		}


@frappe.whitelist()
def get_all_doctypes():
	"""Get list of all dinematters doctypes"""
	try:
		# Try both 'Dinematters' and 'dinematters' module names
		doctypes = frappe.get_all('DocType', 
			filters={'module': ('in', ['Dinematters', 'dinematters'])},
			fields=['name'],
			order_by='name'
		)
		
		# If no results, try without module filter to see what we have
		if not doctypes:
			# Log for debugging
			all_modules = frappe.get_all('Module Def', fields=['name'], filters={'app_name': 'dinematters'})
			frappe.log_error(f"No doctypes found. Available modules: {all_modules}", "get_all_doctypes")
		
		# Get labels from DocType meta and filter by permissions
		doctypes_with_labels = []
		user = frappe.session.user
		is_administrator = user == "Administrator"
		
		# Get user's restaurant access for restaurant-based doctypes (skip for Administrator)
		from dinematters.dinematters.utils.permissions import get_user_restaurant_ids
		user_restaurant_ids = get_user_restaurant_ids(user) if not is_administrator else []
		
		# Restaurant-based doctypes (from hooks.py)
		restaurant_based_doctypes = [
			"Menu Product", "Menu Category", "Order", "Cart Entry",
			"Coupon", "Offer", "Event", "Game", "Table Booking", 
			"Banquet Booking", "Restaurant Config", "Home Feature", "Legacy Content"
		]
		
		for dt in doctypes:
			try:
				# Administrator has access to all doctypes - skip permission checks
				if is_administrator:
					# Administrator can see all modules
					meta = frappe.get_meta(dt['name'])
					label = getattr(meta, 'label', None)
					if not label:
						label = dt['name'].replace('_', ' ').replace('-', ' ').title()
					doctypes_with_labels.append({
						'name': dt['name'],
						'label': label
					})
					continue
				
				# For non-administrator users:
				# For restaurant-based doctypes, check if user has access to any restaurant
				if dt['name'] in restaurant_based_doctypes:
					if not user_restaurant_ids:
						continue  # User has no restaurant access
				
				# Check if user has read permission for this doctype (role-based)
				# This checks Role Permissions table
				if not frappe.has_permission(dt['name'], 'read', raise_exception=False):
					continue
				
				meta = frappe.get_meta(dt['name'])
				# Get label from meta - it's a property
				label = getattr(meta, 'label', None)
				if not label:
					# Fallback to formatted name
					label = dt['name'].replace('_', ' ').replace('-', ' ').title()
				doctypes_with_labels.append({
					'name': dt['name'],
					'label': label
				})
			except Exception as e:
				# If permission check fails or meta not available, skip this doctype
				frappe.log_error(f"Error processing {dt['name']}: {str(e)}", "get_all_doctypes")
				continue
		
		doctypes = doctypes_with_labels
		
		# If no doctypes found, return empty result
		if not doctypes:
			return {}
		
		# Group by category - includes all setup wizard doctypes
		categories = {
			'Restaurant Setup': ['Restaurant', 'Restaurant Config', 'Restaurant User'],
			'Menu Management': ['Menu Product', 'Menu Category', 'Product Media', 'Customization Question', 'Customization Option'],
			'Orders': ['Order', 'Order Item', 'Cart Entry'],
			'Bookings': ['Table Booking', 'Banquet Booking'],
			'Marketing & Promotions': ['Offer', 'Coupon', 'Event', 'Game', 'Home Feature'],
			'Legacy': ['Legacy Content', 'Legacy Gallery Image', 'Legacy Instagram Reel', 'Legacy Member', 'Legacy Signature Dish', 'Legacy Testimonial', 'Legacy Testimonial Image'],
			'Tools': ['Menu Image Extractor', 'Menu Image Item', 'Extracted Category', 'Extracted Dish'],
		}
		
		result = {}
		for category, doctype_list in categories.items():
			matching = [dt for dt in doctypes if dt['name'] in doctype_list]
			if matching:  # Only add category if it has items
				result[category] = matching
		
		# Add uncategorized - all doctypes that don't match any category
		all_categorized = []
		for doctype_list in categories.values():
			all_categorized.extend(doctype_list)
		
		uncategorized = [dt for dt in doctypes if dt['name'] not in all_categorized]
		if uncategorized:
			result['Other'] = uncategorized
		
		# Log result for debugging
		if not result or sum(len(v) for v in result.values()) == 0:
			frappe.log_error(f"No doctypes in result. Found {len(doctypes)} doctypes: {[d['name'] for d in doctypes]}", "get_all_doctypes")
		
		return result
	except Exception as e:
		import traceback
		frappe.log_error(f"Error getting doctypes: {str(e)}\n{traceback.format_exc()}", "get_all_doctypes")
		# Return empty result structure instead of error dict
		return {}


@frappe.whitelist()
def get_user_restaurants():
	"""Get restaurants that the current user has permission to access"""
	try:
		from dinematters.dinematters.utils.permissions import get_user_restaurant_ids
		
		user = frappe.session.user
		restaurant_ids = get_user_restaurant_ids(user)
		
		if not restaurant_ids:
			return {
				'restaurants': []
			}
		
		# Get restaurant details
		restaurants = frappe.get_all(
			"Restaurant",
			filters={"name": ["in", restaurant_ids]},
			fields=["name", "restaurant_id", "restaurant_name", "owner_email", "is_active", "creation", "modified"],
			order_by="creation desc"
		)
		
		return {
			'restaurants': restaurants
		}
	except Exception as e:
		frappe.log_error(f"Error getting user restaurants: {str(e)}")
		return {
			'restaurants': []
		}


@frappe.whitelist()
def get_restaurant_setup_progress(restaurant_id):
	"""Get setup progress for a restaurant - check which steps are completed"""
	try:
		from dinematters.dinematters.utils.permissions import validate_restaurant_access
		
		# Validate user has access
		if not validate_restaurant_access(frappe.session.user, restaurant_id):
			frappe.throw("You don't have permission to access this restaurant")
		
		progress = {
			'restaurant': frappe.db.exists("Restaurant", restaurant_id),
			'config': frappe.db.exists("Restaurant Config", {"restaurant": restaurant_id}),
			'users': frappe.db.exists("Restaurant User", {"restaurant": restaurant_id}),
			'categories': frappe.db.exists("Menu Category", {"restaurant": restaurant_id}),
			'products': frappe.db.exists("Menu Product", {"restaurant": restaurant_id}),
			'offers': frappe.db.exists("Offer", {"restaurant": restaurant_id}),
			'coupons': frappe.db.exists("Coupon", {"restaurant": restaurant_id}),
			'events': frappe.db.exists("Event", {"restaurant": restaurant_id}),
			'games': frappe.db.exists("Game", {"restaurant": restaurant_id}),
			'home_features': frappe.db.exists("Home Feature", {"restaurant": restaurant_id}),
			'table_booking': frappe.db.exists("Table Booking", {"restaurant": restaurant_id}),
			'banquet_booking': frappe.db.exists("Banquet Booking", {"restaurant": restaurant_id}),
		}
		
		return progress
	except Exception as e:
		frappe.log_error(f"Error getting restaurant setup progress: {str(e)}")
		return {
			'error': str(e)
		}


@frappe.whitelist()
def get_setup_wizard_steps():
	"""Get steps for restaurant setup wizard - comprehensive setup"""
	return {
		'steps': [
			{
				'id': 'restaurant',
				'title': 'Create Restaurant',
				'description': 'Set up your restaurant basic information (name, address, owner details)',
				'doctype': 'Restaurant',
				'required': True,
				'depends_on': None,
			},
			{
				'id': 'config',
				'title': 'Restaurant Configuration',
				'description': 'Configure branding, colors, settings, tax, delivery fees, and features',
				'doctype': 'Restaurant Config',
				'required': True,
				'depends_on': 'restaurant',
			},
			{
				'id': 'users',
				'title': 'Staff Members',
				'description': 'View and manage staff members for your restaurant (Owner is automatically created)',
				'doctype': 'Restaurant User',
				'required': False,
				'depends_on': 'restaurant',
				'view_only': True,  # Show list instead of form
			},
			{
				'id': 'categories',
				'title': 'Menu Categories',
				'description': 'View and manage menu categories for your restaurant',
				'doctype': 'Menu Category',
				'required': False,
				'depends_on': 'restaurant',
				'view_only': True,  # Show list instead of form
			},
			{
				'id': 'products',
				'title': 'Menu Products',
				'description': 'View and manage menu products for your restaurant',
				'doctype': 'Menu Product',
				'required': False,
				'depends_on': 'restaurant',
				'view_only': True,  # Show list instead of form
			},
			{
				'id': 'offers',
				'title': 'Create Offers',
				'description': 'Set up special offers and promotions for your restaurant',
				'doctype': 'Offer',
				'required': False,
				'depends_on': 'restaurant',
			},
			{
				'id': 'coupons',
				'title': 'Create Coupons',
				'description': 'Set up discount coupons for customers',
				'doctype': 'Coupon',
				'required': False,
				'depends_on': 'restaurant',
			},
			{
				'id': 'events',
				'title': 'Create Events',
				'description': 'Set up events, special occasions, or themed nights',
				'doctype': 'Event',
				'required': False,
				'depends_on': 'restaurant',
			},
			{
				'id': 'games',
				'title': 'Add Games',
				'description': 'Add interactive games for customer engagement',
				'doctype': 'Game',
				'required': False,
				'depends_on': 'restaurant',
			},
			{
				'id': 'home_features',
				'title': 'Home Features',
				'description': 'Configure features to display on your restaurant homepage',
				'doctype': 'Home Feature',
				'required': False,
				'depends_on': 'restaurant',
			},
			{
				'id': 'table_booking',
				'title': 'Table Booking Setup',
				'description': 'Configure table booking settings and availability',
				'doctype': 'Table Booking',
				'required': False,
				'depends_on': 'restaurant',
			},
			{
				'id': 'banquet_booking',
				'title': 'Banquet Booking Setup',
				'description': 'Set up banquet and large party booking options',
				'doctype': 'Banquet Booking',
				'required': False,
				'depends_on': 'restaurant',
			},
		]
	}


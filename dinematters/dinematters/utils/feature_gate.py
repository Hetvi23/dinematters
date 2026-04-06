# Copyright (c) 2026, Dinematters and contributors
# For license information, please see license.txt

"""
Feature Gate System for Subscription-based Access Control

This module provides decorators and utilities to restrict feature access
based on restaurant subscription plans (SILVER vs GOLD).
"""

import frappe
from frappe import _
from frappe.exceptions import PermissionError
from functools import wraps


# Feature to Plan Mapping
# Features listed here require specific plan types
FEATURE_PLAN_MAP = {
    # DIAMOND Only features (Transactional/Full Automation)
    'ordering': ['DIAMOND'],
    'loyalty': ['DIAMOND'],
    'pos_integration': ['DIAMOND'],
    'coupons': ['DIAMOND'],
    'data_export': ['DIAMOND'],
    'customer': ['DIAMOND'],
    'order_settings': ['DIAMOND'],
    'customer_pay_and_usage': ['DIAMOND'],
    
    # GOLD & DIAMOND features (Digital/Branding/Analytics/Table/Games)
    'games': ['GOLD', 'DIAMOND'],
    'video_upload': ['GOLD', 'DIAMOND'],
    'analytics': ['GOLD', 'DIAMOND'],
    'ai_recommendations': ['GOLD', 'DIAMOND'],
    'custom_branding': ['GOLD', 'DIAMOND'],
    'table_booking': ['GOLD', 'DIAMOND'],
    'events': ['GOLD', 'DIAMOND'],
    'offers': ['GOLD', 'DIAMOND'],
    'experience_lounge': ['GOLD', 'DIAMOND'],
}


def require_plan(*required_plans):
    """
    Decorator to restrict endpoint access based on subscription plan
    
    Usage:
        @frappe.whitelist()
        @require_plan('GOLD')
        def create_order(restaurant_id, order_data):
            # This endpoint is only accessible to GOLD plan restaurants
            ...
    
    Args:
        *required_plans: Variable number of plan types that can access this feature
                        (e.g., 'GOLD', 'SILVER')
    
    Raises:
        PermissionError: If restaurant's plan is not in required_plans
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract restaurant_id from kwargs or first positional argument
            restaurant_id = kwargs.get('restaurant_id') or kwargs.get('restaurant') or (args[0] if args else None)
            
            if not restaurant_id:
                frappe.throw(
                    _('Restaurant ID is required for this operation'),
                    PermissionError
                )
            
            # Get restaurant document
            try:
                restaurant = frappe.get_doc('Restaurant', restaurant_id)
            except frappe.DoesNotExistError:
                frappe.throw(
                    _('Restaurant {0} does not exist').format(restaurant_id),
                    frappe.DoesNotExistError
                )
            
            # Check if restaurant's plan is in required plans
            if restaurant.plan_type not in required_plans:
                frappe.throw(
                    _('This feature requires {0} plan. Your current plan is {1}. Please upgrade to access this feature.').format(
                        ' or '.join(required_plans),
                        restaurant.plan_type or 'SILVER'
                    ),
                    PermissionError
                )
            
            # Plan check passed, execute the function
            return func(*args, **kwargs)
        
        return wrapper
    return decorator


@frappe.whitelist()
def check_feature_access(restaurant_id, feature_name):
    """
    Check if a restaurant has access to a specific feature
    
    Args:
        restaurant_id (str): Restaurant ID
        feature_name (str): Feature identifier (e.g., 'ordering', 'analytics')
    
    Returns:
        dict: {
            'has_access': bool,
            'current_plan': str,
            'required_plans': list,
            'feature': str
        }
    """
    if not restaurant_id:
        frappe.throw(_('Restaurant ID is required'))
    
    # Get restaurant document
    try:
        restaurant = frappe.get_doc('Restaurant', restaurant_id)
    except frappe.DoesNotExistError:
        frappe.throw(_('Restaurant {0} does not exist').format(restaurant_id))
    
    # Get required plans for this feature. Fallback to all plans if not mapped.
    required_plans = FEATURE_PLAN_MAP.get(feature_name, ['SILVER', 'GOLD', 'DIAMOND'])
    
    # Check if current plan has access
    has_access = restaurant.plan_type in required_plans
    
    return {
        'has_access': has_access,
        'current_plan': restaurant.plan_type or 'SILVER',
        'required_plans': required_plans,
        'feature': feature_name
    }


def get_plan_features(plan_type):
    """
    Get list of all features available for a specific plan
    
    Args:
        plan_type (str): Plan type ('SILVER', 'GOLD', or 'DIAMOND')
    
    Returns:
        list: List of feature names available for this plan
    """
    base_features = ['basic_menu', 'qr_code', 'website']
    
    if plan_type == 'DIAMOND':
        # DIAMOND has access to everything
        return list(FEATURE_PLAN_MAP.keys()) + base_features
    elif plan_type == 'GOLD':
        # GOLD has access to digital/branding features but no transactional ones
        gold_features = [f for f, plans in FEATURE_PLAN_MAP.items() if 'GOLD' in plans]
        return gold_features + base_features
    else:
        # SILVER only has access to base features
        return base_features


def check_image_upload_limit(restaurant_id):
    """
    Check if restaurant has reached image upload limit (SILVER plan only)
    
    Args:
        restaurant_id (str): Restaurant ID
    
    Returns:
        dict: {
            'can_upload': bool,
            'current_count': int,
            'max_limit': int,
            'plan_type': str
        }
    
    Raises:
        PermissionError: If SILVER plan has reached image limit
    """
    restaurant = frappe.get_doc('Restaurant', restaurant_id)
    
    # GOLD and DIAMOND plans have unlimited images
    if restaurant.plan_type in ['GOLD', 'DIAMOND']:
        return {
            'can_upload': True,
            'current_count': restaurant.current_image_count or 0,
            'max_limit': -1,  # Unlimited
            'plan_type': restaurant.plan_type
        }
    
    # SILVER plan has limit
    current_count = restaurant.current_image_count or 0
    max_limit = restaurant.max_images_silver or 200
    
    can_upload = current_count < max_limit
    
    if not can_upload:
        frappe.throw(
            _('Image upload limit reached ({0}/{1}). Upgrade to GOLD or DIAMOND for unlimited images.').format(
                current_count,
                max_limit
            ),
            PermissionError
        )
    
    return {
        'can_upload': can_upload,
        'current_count': current_count,
        'max_limit': max_limit,
        'plan_type': 'SILVER'
    }


def increment_image_count(restaurant_id):
    """
    Increment image count for restaurant (used after successful upload)
    
    Args:
        restaurant_id (str): Restaurant ID
    """
    frappe.db.set_value(
        'Restaurant',
        restaurant_id,
        'current_image_count',
        frappe.db.get_value('Restaurant', restaurant_id, 'current_image_count') + 1
    )
    frappe.db.commit()


def decrement_image_count(restaurant_id):
    """
    Decrement image count for restaurant (used after image deletion)
    
    Args:
        restaurant_id (str): Restaurant ID
    """
    current = frappe.db.get_value('Restaurant', restaurant_id, 'current_image_count') or 0
    if current > 0:
        frappe.db.set_value(
            'Restaurant',
            restaurant_id,
            'current_image_count',
            current - 1
        )
        frappe.db.commit()


def get_restaurant_plan(restaurant_id):
	"""
	Helper to get the current plan tier for a restaurant
	"""
	if not restaurant_id:
		return "SILVER"
	
	plan = frappe.db.get_value("Restaurant", restaurant_id, "plan_type")
	return plan if plan else "SILVER"

# Copyright (c) 2026, Dinematters and contributors
# For license information, please see license.txt

"""
Feature Gate System for Subscription-based Access Control

This module provides decorators and utilities to restrict feature access
based on restaurant subscription plans (LITE vs PRO).
"""

import frappe
from frappe import _
from frappe.exceptions import PermissionError
from functools import wraps


# Feature to Plan Mapping
# Features listed here require specific plan types
FEATURE_PLAN_MAP = {
    'ordering': ['PRO'],
    'video_upload': ['PRO'],
    'analytics': ['PRO'],
    'ai_recommendations': ['PRO'],
    'loyalty': ['PRO'],
    'coupons': ['PRO'],
    'pos_integration': ['PRO'],
    'data_export': ['PRO'],
    'games': ['PRO'],
    'table_booking': ['PRO'],
    'custom_branding': ['PRO'],
}


def require_plan(*required_plans):
    """
    Decorator to restrict endpoint access based on subscription plan
    
    Usage:
        @frappe.whitelist()
        @require_plan('PRO')
        def create_order(restaurant_id, order_data):
            # This endpoint is only accessible to PRO plan restaurants
            ...
    
    Args:
        *required_plans: Variable number of plan types that can access this feature
                        (e.g., 'PRO', 'LITE')
    
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
                        restaurant.plan_type or 'LITE'
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
    
    # Get required plans for this feature
    required_plans = FEATURE_PLAN_MAP.get(feature_name, ['LITE', 'PRO'])
    
    # Check if current plan has access
    has_access = restaurant.plan_type in required_plans
    
    return {
        'has_access': has_access,
        'current_plan': restaurant.plan_type or 'LITE',
        'required_plans': required_plans,
        'feature': feature_name
    }


def get_plan_features(plan_type):
    """
    Get list of all features available for a specific plan
    
    Args:
        plan_type (str): Plan type ('LITE' or 'PRO')
    
    Returns:
        list: List of feature names available for this plan
    """
    if plan_type == 'PRO':
        # PRO has access to all features
        return list(FEATURE_PLAN_MAP.keys()) + ['basic_menu', 'qr_code', 'website']
    else:
        # LITE only has access to features not in FEATURE_PLAN_MAP
        return ['basic_menu', 'qr_code', 'website']


def check_image_upload_limit(restaurant_id):
    """
    Check if restaurant has reached image upload limit (LITE plan only)
    
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
        PermissionError: If LITE plan has reached image limit
    """
    restaurant = frappe.get_doc('Restaurant', restaurant_id)
    
    # PRO plan has unlimited images
    if restaurant.plan_type == 'PRO':
        return {
            'can_upload': True,
            'current_count': restaurant.current_image_count or 0,
            'max_limit': -1,  # Unlimited
            'plan_type': 'PRO'
        }
    
    # LITE plan has limit
    current_count = restaurant.current_image_count or 0
    max_limit = restaurant.max_images_lite or 200
    
    can_upload = current_count < max_limit
    
    if not can_upload:
        frappe.throw(
            _('Image upload limit reached ({0}/{1}). Upgrade to PRO for unlimited images.').format(
                current_count,
                max_limit
            ),
            PermissionError
        )
    
    return {
        'can_upload': can_upload,
        'current_count': current_count,
        'max_limit': max_limit,
        'plan_type': 'LITE'
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

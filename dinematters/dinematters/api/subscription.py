# Copyright (c) 2026, Dinematters and contributors
# For license information, please see license.txt

"""
Subscription API Endpoints

Provides API endpoints for subscription plan management and feature access checks.
"""

import frappe
from frappe import _
from dinematters.dinematters.utils.feature_gate import check_feature_access, get_plan_features


@frappe.whitelist()
def get_restaurant_plan(restaurant_id):
    """
    Get current subscription plan for a restaurant
    
    Args:
        restaurant_id (str): Restaurant ID
    
    Returns:
        dict: Restaurant plan information
    """
    if not restaurant_id:
        frappe.throw(_('Restaurant ID is required'))
    
    restaurant = frappe.get_doc('Restaurant', restaurant_id)
    
    return {
        'restaurant_id': restaurant.name,
        'restaurant_name': restaurant.restaurant_name,
        'plan_type': restaurant.plan_type or 'SILVER',
        'plan_activated_on': restaurant.plan_activated_on,
        'plan_changed_by': restaurant.plan_changed_by,
        'features': get_plan_features(restaurant.plan_type or 'SILVER'),
        'limits': {
            'max_images': restaurant.max_images_silver if restaurant.plan_type == 'SILVER' else -1,
            'current_images': restaurant.current_image_count or 0,
            'video_upload': restaurant.plan_type in ['GOLD', 'DIAMOND'],
            'ordering': restaurant.plan_type == 'DIAMOND',
        },
        'metrics': {
            'total_orders': restaurant.total_orders or 0,
            'total_revenue': restaurant.total_revenue or 0,
            'commission_earned': restaurant.commission_earned or 0,
        } if restaurant.plan_type == 'DIAMOND' else None
    }


@frappe.whitelist()
def check_access(restaurant_id, feature_name):
    """
    Check if restaurant has access to a specific feature
    
    Args:
        restaurant_id (str): Restaurant ID
        feature_name (str): Feature identifier
    
    Returns:
        dict: Feature access information
    """
    return check_feature_access(restaurant_id, feature_name)


@frappe.whitelist()
def get_plan_comparison(restaurant_id=None):
    """
    Get feature comparison between SILVER and GOLD plans
    
    Args:
        restaurant_id (str, optional): Restaurant ID to show personalized rates
        
    Returns:
        dict: Plan comparison data
    """
    commission_rate = "1.5%"
    if restaurant_id:
        try:
            rate = frappe.db.get_value("Restaurant", restaurant_id, "platform_fee_percent")
            if rate is not None:
                commission_rate = f"{float(rate)}%"
        except Exception:
            pass

    return {
        'SILVER': {
            'name': 'DineMatters Silver',
            'price': 'Free',
            'commission': '0%',
            'features': {
                'included': [
                    'Digital QR menu (photo-only)',
                    'Basic restaurant website',
                    'Menu management (unlimited items)',
                    'Photo uploads (max 200 images)',
                    'Restaurant logo upload',
                    'Custom colors & theme',
                    'Contact & location display',
                    'Social media links',
                    'Mobile-responsive design',
                ],
                'excluded': [
                    'Online ordering',
                    'Video content',
                    'AI recommendations',
                    'Analytics dashboard',
                    'Loyalty programs',
                    'Coupons/discounts',
                    'POS integration',
                    'Data export',
                ],
                'branding': 'Mandatory "Powered by DineMatters" branding',
                'qr_logo': 'DineMatters logo watermark on QR codes'
            }
        },
        'GOLD': {
            'name': 'DineMatters Gold (Digital)',
            'price': '₹999 / mo',
            'commission': '0%',
            'features': {
                'included': [
                    'All SILVER features',
                    'Video content support',
                    'AI-powered recommendations',
                    'Analytics dashboard',
                    'Unlimited photo uploads',
                    'Custom logo on QR codes',
                    'Priority support',
                    'Gamification (spin/scratch)',
                    'Custom branding (subtle footer)',
                    'No transaction fees',
                ],
                'excluded': [
                    'Online ordering',
                    'Loyalty programs',
                    'Coupons & discounts',
                    'POS integration',
                    'Customer CRM Data',
                ],
                'branding': 'Subtle "Powered by DineMatters" footer',
                'qr_logo': 'Your custom restaurant logo on QR codes'
            }
        },
        'DIAMOND': {
            'name': 'DineMatters Diamond (Automation)',
            'price': '₹999 Floor / mo',
            'commission': commission_rate,
            'features': {
                'included': [
                    'All GOLD features',
                    'Online ordering & payments',
                    'Loyalty programs',
                    'Coupons & discounts',
                    'POS integration',
                    'Customer CRM Data access',
                    'Table & Banquet booking',
                    'Data export (CSV/PDF)',
                ],
                'branding': 'Minimal branding footer',
                'qr_logo': 'Your custom restaurant logo on QR codes'
            }
        }
    }


@frappe.whitelist()
def get_upgrade_benefits(restaurant_id):
    """
    Get personalized upgrade benefits for a restaurant
    
    Args:
        restaurant_id (str): Restaurant ID
    
    Returns:
        dict: Upgrade benefits and recommendations
    """
    restaurant = frappe.get_doc('Restaurant', restaurant_id)
    
    return {
        'already_diamond': False,
        'current_plan': restaurant.plan_type,
        'benefits': [
            {
                'category': 'Revenue Generation (DIAMOND Only)',
                'items': [
                    'Accept online orders and payments',
                    'Loyalty programs to retain customers',
                    'Coupons & automatic discounts',
                    f'Just {float(restaurant.platform_fee_percent or 1.5)}% commission on growth',
                ]
            },
            {
                'category': 'Digital Excellence (GOLD & DIAMOND)',
                'items': [
                    'AI-powered menu recommendations',
                    'Unlimited high-quality image uploads',
                    'Professional video content support',
                    'Custom branding & logo on QR codes',
                ]
            },
            {
                'category': 'Business Intelligence',
                'items': [
                    'Real-time analytics dashboard',
                    'Customer behavior insights (DIAMOND)',
                    'POS integration (DIAMOND)',
                ]
            },
        ],
        'cta': 'Upgrade to DIAMOND for Full Automation' if restaurant.plan_type == 'GOLD' else 'Upgrade to GOLD for Digital Power'
    }

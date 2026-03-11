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
        'plan_type': restaurant.plan_type or 'LITE',
        'plan_activated_on': restaurant.plan_activated_on,
        'plan_changed_by': restaurant.plan_changed_by,
        'features': get_plan_features(restaurant.plan_type or 'LITE'),
        'limits': {
            'max_images': restaurant.max_images_lite if restaurant.plan_type == 'LITE' else -1,
            'current_images': restaurant.current_image_count or 0,
            'video_upload': restaurant.plan_type == 'PRO',
            'ordering': restaurant.plan_type == 'PRO',
        },
        'metrics': {
            'total_orders': restaurant.total_orders or 0,
            'total_revenue': restaurant.total_revenue or 0,
            'commission_earned': restaurant.commission_earned or 0,
        } if restaurant.plan_type == 'PRO' else None
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
def get_plan_comparison():
    """
    Get feature comparison between LITE and PRO plans
    
    Returns:
        dict: Plan comparison data
    """
    return {
        'LITE': {
            'name': 'Dinematters Lite',
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
                'branding': 'Mandatory "Powered by Dinematters" branding',
                'qr_logo': 'Dinematters logo watermark on QR codes'
            }
        },
        'PRO': {
            'name': 'Dinematters Pro',
            'price': 'Pay per order',
            'commission': '1.5%',
            'features': {
                'included': [
                    'All LITE features',
                    'Online ordering',
                    'Video content support',
                    'AI-powered recommendations',
                    'Analytics dashboard',
                    'Loyalty programs',
                    'Coupons & discounts',
                    'POS integration',
                    'Data export',
                    'Unlimited photo uploads',
                    'Custom logo on QR codes',
                    'Priority support',
                ],
                'branding': 'Subtle "Powered by Dinematters" footer',
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
    
    if restaurant.plan_type == 'PRO':
        return {
            'already_pro': True,
            'message': 'You are already on the PRO plan with full feature access!'
        }
    
    # Calculate potential benefits
    current_images = restaurant.current_image_count or 0
    max_images = restaurant.max_images_lite or 200
    images_remaining = max(0, max_images - current_images)
    
    return {
        'already_pro': False,
        'current_plan': 'LITE',
        'benefits': [
            {
                'category': 'Revenue Generation',
                'items': [
                    'Accept online orders and payments',
                    'Increase revenue by 30-40% on average',
                    'Only pay 1.5% commission on orders',
                ]
            },
            {
                'category': 'Customer Engagement',
                'items': [
                    'AI-powered menu recommendations',
                    'Loyalty programs to retain customers',
                    'Gamification (spin-the-wheel, scratch cards)',
                ]
            },
            {
                'category': 'Business Insights',
                'items': [
                    'Real-time analytics dashboard',
                    'Customer behavior insights',
                    'Menu performance metrics',
                    'Revenue reports and data export',
                ]
            },
            {
                'category': 'Media & Branding',
                'items': [
                    f'Unlimited image uploads (currently {images_remaining} remaining)',
                    'Video content support',
                    'Custom logo on QR codes',
                    'Less prominent branding',
                ]
            },
        ],
        'locked_features_count': len([f for f in ['ordering', 'video_upload', 'analytics', 'ai_recommendations', 'loyalty', 'coupons', 'games']]),
        'cta': 'Upgrade to PRO and unlock all features'
    }

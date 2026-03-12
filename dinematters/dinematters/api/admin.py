import frappe
from frappe import _

@frappe.whitelist()
def check_admin_access():
    """
    Check if current user has admin access
    Returns success with allowed boolean
    """
    try:
        # Check if user is System Manager or has specific role
        user_roles = frappe.get_roles()
        
        # Allow System Managers and specific admin roles
        admin_roles = ['System Manager', 'Administrator', 'Dinematters Admin']
        has_admin_access = any(role in admin_roles for role in user_roles)
        
        return {
            'success': True,
            'data': {
                'allowed': has_admin_access
            }
        }
    except Exception as e:
        frappe.log_error(f"Error checking admin access: {str(e)}", "Admin API Error")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_all_restaurants():
    """
    Get all restaurants with their plan details
    Only accessible by admin users
    """
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {
                'success': False,
                'error': 'Admin access required'
            }
        
        # Check if RestaurantConfig table exists
        config_table_exists = frappe.db.table_exists('RestaurantConfig')
        
        if config_table_exists:
            # Get all restaurants with their subscription details
            restaurants = frappe.db.sql("""
                SELECT 
                    r.name,
                    r.restaurant_id,
                    r.restaurant_name,
                    r.owner_email,
                    r.is_active,
                    r.creation,
                    r.modified,
                    COALESCE(rc.subscription_plan, r.plan_type, 'LITE') as plan_type
                FROM `tabRestaurant` r
                LEFT JOIN `tabRestaurantConfig` rc ON r.name = rc.parent
                ORDER BY r.creation DESC
            """, as_dict=True)
        else:
            # Get restaurants without config table (use plan_type from Restaurant table)
            restaurants = frappe.db.sql("""
                SELECT 
                    r.name,
                    r.restaurant_id,
                    r.restaurant_name,
                    r.owner_email,
                    r.is_active,
                    r.creation,
                    r.modified,
                    COALESCE(r.plan_type, 'LITE') as plan_type
                FROM `tabRestaurant` r
                ORDER BY r.creation DESC
            """, as_dict=True)
        
        # Convert is_active to integer for consistency
        for restaurant in restaurants:
            restaurant['is_active'] = int(restaurant['is_active'] or 0)
            # Ensure plan_type is valid
            if restaurant['plan_type'] not in ['LITE', 'PRO']:
                restaurant['plan_type'] = 'LITE'
        
        return {
            'success': True,
            'data': {
                'restaurants': restaurants
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting all restaurants: {str(e)}", "Admin API Error")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def update_restaurant_plan(restaurant_id, plan_type):
    """
    Update restaurant's subscription plan
    Only accessible by admin users
    """
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {
                'success': False,
                'error': 'Admin access required'
            }
        
        # Validate plan_type
        if plan_type not in ['LITE', 'PRO']:
            return {
                'success': False,
                'error': 'Invalid plan type. Must be LITE or PRO'
            }
        
        # Get restaurant record
        restaurant = frappe.get_doc('Restaurant', {'restaurant_id': restaurant_id})
        if not restaurant:
            return {
                'success': False,
                'error': 'Restaurant not found'
            }
        
        # Check if RestaurantConfig table exists
        if not frappe.db.table_exists('RestaurantConfig'):
            # Update the Restaurant table directly since RestaurantConfig doesn't exist
            try:
                restaurant.plan_type = plan_type
                restaurant.plan_changed_by = frappe.session.user
                restaurant.plan_change_reason = f"Plan changed to {plan_type} by admin"
                if plan_type != restaurant.plan_activated_on:
                    restaurant.plan_activated_on = frappe.utils.now()
                restaurant.save(ignore_permissions=True)
                frappe.db.commit()
                
                return {
                    'success': True,
                    'data': {
                        'restaurant_id': restaurant_id,
                        'plan_type': plan_type,
                        'updated_by': frappe.session.user,
                        'note': f'Plan updated to {plan_type} in Restaurant table'
                    }
                }
            except Exception as e:
                frappe.log_error(f"Error updating restaurant plan: {str(e)}", "Plan Update Error")
                return {
                    'success': False,
                    'error': f'Failed to update plan: {str(e)}'
                }
        
        # Get or create restaurant config
        config = frappe.get_doc('RestaurantConfig', restaurant.name)
        if not config:
            # Create config if it doesn't exist
            config = frappe.new_doc('RestaurantConfig')
            config.parent = restaurant.name
            config.parenttype = 'Restaurant'
            config.parentfield = 'config'
            config.insert()
        
        # Update subscription plan
        config.subscription_plan = plan_type
        
        # Update subscription features based on plan
        if plan_type == 'PRO':
            config.subscription_features = {
                'ordering': True,
                'videoUpload': True,
                'analytics': True,
                'aiRecommendations': True,
                'loyalty': True,
                'coupons': True,
                'games': True
            }
        else:  # LITE
            config.subscription_features = {
                'ordering': False,
                'videoUpload': False,
                'analytics': False,
                'aiRecommendations': False,
                'loyalty': False,
                'coupons': False,
                'games': False
            }
        
        config.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Log the change
        frappe.logger().info(
            f"Restaurant {restaurant_id} plan updated to {plan_type} by {frappe.session.user}"
        )
        
        return {
            'success': True,
            'data': {
                'restaurant_id': restaurant_id,
                'plan_type': plan_type,
                'updated_by': frappe.session.user
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating restaurant plan: {str(e)}", "Admin API Error")
        frappe.db.rollback()
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def toggle_restaurant_status(restaurant_id, is_active):
    """
    Toggle restaurant active status
    Only accessible by admin users
    """
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {
                'success': False,
                'error': 'Admin access required'
            }
        
        # Validate is_active
        if is_active not in [0, 1]:
            return {
                'success': False,
                'error': 'Invalid status. Must be 0 (inactive) or 1 (active)'
            }
        
        # Get restaurant record
        restaurant = frappe.get_doc('Restaurant', {'restaurant_id': restaurant_id})
        if not restaurant:
            return {
                'success': False,
                'error': 'Restaurant not found'
            }
        
        # Update restaurant status
        try:
            restaurant.is_active = is_active
            restaurant.save(ignore_permissions=True)
            frappe.db.commit()
            
            return {
                'success': True,
                'data': {
                    'restaurant_id': restaurant_id,
                    'is_active': is_active,
                    'updated_by': frappe.session.user,
                    'note': f'Restaurant {"activated" if is_active else "deactivated"} successfully'
                }
            }
        except Exception as e:
            frappe.log_error(f"Error updating restaurant status: {str(e)}", "Status Update Error")
            return {
                'success': False,
                'error': f'Failed to update status: {str(e)}'
            }
        
    except Exception as e:
        frappe.log_error(f"Error in toggle_restaurant_status: {str(e)}", "Admin API Error")
        return {
            'success': False,
            'error': str(e)
        }
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {
                'success': False,
                'error': 'Admin access required'
            }
        
        # Get subscription statistics
        stats = frappe.db.sql("""
            SELECT 
                COUNT(*) as total_restaurants,
                SUM(CASE WHEN COALESCE(rc.subscription_plan, 'LITE') = 'LITE' THEN 1 ELSE 0 END) as lite_count,
                SUM(CASE WHEN COALESCE(rc.subscription_plan, 'LITE') = 'PRO' THEN 1 ELSE 0 END) as pro_count,
                SUM(CASE WHEN r.is_active = 1 THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN r.is_active = 0 THEN 1 ELSE 0 END) as inactive_count
            FROM `tabRestaurant` r
            LEFT JOIN `tabRestaurantConfig` rc ON r.name = rc.parent
        """, as_dict=True)
        
        if stats:
            return {
                'success': True,
                'data': stats[0]
            }
        else:
            return {
                'success': True,
                'data': {
                    'total_restaurants': 0,
                    'lite_count': 0,
                    'pro_count': 0,
                    'active_count': 0,
                    'inactive_count': 0
                }
            }
        
    except Exception as e:
        frappe.log_error(f"Error getting subscription stats: {str(e)}", "Admin API Error")
        return {
            'success': False,
            'error': str(e)
        }

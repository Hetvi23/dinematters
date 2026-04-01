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
                    COALESCE(r.coins_balance, 0) as coins_balance,
                    COALESCE(r.platform_fee_percent, 1.5) as platform_fee_percent,
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
                    COALESCE(r.coins_balance, 0) as coins_balance,
                    COALESCE(r.platform_fee_percent, 1.5) as platform_fee_percent,
                    COALESCE(r.plan_type, 'LITE') as plan_type
                FROM `tabRestaurant` r
                ORDER BY r.creation DESC
            """, as_dict=True)
        
        # Convert is_active to integer for consistency
        for restaurant in restaurants:
            restaurant['is_active'] = int(restaurant['is_active'] or 0)
            # Ensure plan_type is valid
            if restaurant['plan_type'] not in ['LITE', 'PRO', 'LUX']:
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
        if plan_type not in ['LITE', 'PRO', 'LUX']:
            return {
                'success': False,
                'error': 'Invalid plan type. Must be LITE, PRO or LUX'
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
        if plan_type == 'LUX':
             config.subscription_features = {
                'ordering': True,
                'videoUpload': True,
                'analytics': True,
                'aiRecommendations': True,
                'loyalty': True,
                'coupons': True,
                'games': True,
                'pos_integration': True,
                'table_booking': True,
                'experience_lounge': True
            }
        elif plan_type == 'PRO':
            config.subscription_features = {
                'ordering': True,
                'videoUpload': True,
                'analytics': True,
                'aiRecommendations': True,
                'loyalty': True,
                'coupons': True,
                'games': True,
                'pos_integration': False,
                'table_booking': True,
                'experience_lounge': False
            }
        else:  # LITE
            config.subscription_features = {
                'ordering': False,
                'videoUpload': False,
                'analytics': False,
                'aiRecommendations': False,
                'loyalty': False,
                'coupons': False,
                'games': False,
                'pos_integration': False,
                'table_booking': False,
                'experience_lounge': False
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
                SUM(CASE WHEN COALESCE(rc.subscription_plan, 'LITE') = 'LUX' THEN 1 ELSE 0 END) as lux_count,
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
                    'lux_count': 0,
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

@frappe.whitelist()
def delete_restaurant(restaurant_id):
    """
    Permanently delete a restaurant and ALL associated data.
    This includes: Configuration, Menu, Orders, Customers, Media, etc.
    Only accessible by system administrators.
    """
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {
                'success': False,
                'error': 'Admin access required'
            }
        
        # Get restaurant record
        restaurant = frappe.get_doc('Restaurant', {'restaurant_id': restaurant_id})
        if not restaurant:
            return {
                'success': False,
                'error': f'Restaurant {restaurant_id} not found'
            }
        
        # List of DocTypes to clear where the field 'restaurant' matches the restaurant record ID
        doctypes_to_clear = [
            "Restaurant Config", "Restaurant Media", "Restaurant Social Link",
            "Menu Category", "Menu Product", "Menu Product Addon", "Customization Option", "Customization Question",
            "Order", "Order Item", "Table Booking", "Banquet Booking", "Restaurant Table", 
            "Cart Entry", "Restaurant User", "Coupon", "Coupon Usage", "Offer", "Auto Offer", "Combo Offer", "Promo",
            "Game", "Event", "Home Feature", "Media Asset", "Media Upload Session", "Media Variant", "Product Media",
            "AI Credit Transaction", "Monthly Billing Ledger", "Monthly Revenue Ledger", "Razorpay Webhook Log",
            "Plan Change Log", "Referral Link", "Referral Visit", "Otp Verification Log",
            "Tokenization Attempt", "Menu Recommendation", "Menu Image Extractor", "Menu Image Item",
            "Extracted Category", "Extracted Dish",
            "Restaurant Loyalty Config", "Restaurant Loyalty Entry",
            "Legacy Content", "Legacy Gallery Image", "Legacy Instagram Reel",
            "Legacy Member", "Legacy Signature Dish", "Legacy Testimonial", "Legacy Testimonial Image"
        ]

        # For each DocType, delete all records linked to this restaurant
        cleanup_report = []
        
        for dt in doctypes_to_clear:
            try:
                # Check if the doctype exists in this installation
                if not frappe.db.table_exists(dt):
                    continue
                
                # Find the names of records to delete using the primary restaurant name
                records = frappe.get_all(dt, filters={'restaurant': restaurant.name}, pluck='name')
                
                if records:
                    for record_name in records:
                        # For each record, delete it and its files
                        # delete_doc(dt, name, ignore_permissions=True, delete_permanently=True)
                        frappe.delete_doc(dt, record_name, ignore_permissions=True, delete_permanently=True)
                    
                    cleanup_report.append(f"Deleted {len(records)} records from {dt}")
                    
            except Exception as inner_e:
                frappe.log_error(f"Error deleting from {dt}: {str(inner_e)}", "Restaurant Delete Error")
                # Continue with others even if one fails
                cleanup_report.append(f"FAILED to delete from {dt}: {str(inner_e)}")

        # Special handling for RestaurantConfig (linked via parent)
        if frappe.db.table_exists('RestaurantConfig'):
            try:
                configs = frappe.get_all('RestaurantConfig', filters={'parent': restaurant.name}, pluck='name')
                for cfg in configs:
                    frappe.delete_doc('RestaurantConfig', cfg, ignore_permissions=True)
                if configs:
                    cleanup_report.append(f"Deleted {len(configs)} RestaurantConfig records")
            except Exception as e:
                frappe.log_error(f"Error deleting RestaurantConfig: {str(e)}", "Restaurant Delete Error")

        # Delete any associated files in tabFile that were attached to these record types
        # Note: This is partly handled by frappe.delete_doc if files are linked via fields,
        # but manual cleanup ensures "every single entry" is gone.
        try:
            # We also clear files attached specifically to the Restaurant doc itself
            frappe.db.sql("""
                DELETE FROM `tabFile` 
                WHERE (attached_to_doctype = 'Restaurant' AND attached_to_name = %s)
            """, (restaurant.name,))
        except Exception as e:
            frappe.log_error(f"Error cleaning up files: {str(e)}", "Restaurant Delete Error")

        # Finally, delete the Restaurant record itself
        restaurant_name = restaurant.name
        frappe.delete_doc('Restaurant', restaurant_name, ignore_permissions=True, delete_permanently=True)
        cleanup_report.append(f"Deleted Restaurant record: {restaurant_id}")

        # Commit all changes
        frappe.db.commit()

        return {
            'success': True,
            'message': f"Restaurant {restaurant_id} deleted successfully.",
            'report': cleanup_report
        }

    except Exception as e:
        frappe.log_error(f"Error in delete_restaurant API: {str(e)}", "Admin API Error")
        frappe.db.rollback()
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def admin_give_coins(restaurant_id, amount, reason="Admin Grant"):
    """
    Give coins to a restaurant manually from admin.
    """
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {'success': False, 'error': 'Admin access required'}
            
        # Validate amount
        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError("Amount must be positive")
        except:
            return {'success': False, 'error': 'Invalid amount'}
            
        # Get restaurant
        restaurant = frappe.get_doc('Restaurant', {'restaurant_id': restaurant_id})
        if not restaurant:
            return {'success': False, 'error': 'Restaurant not found'}
            
        # Update balance
        current_bal = float(restaurant.coins_balance or 0)
        new_bal = current_bal + amount
        
        frappe.db.set_value('Restaurant', restaurant.name, 'coins_balance', new_bal)
        
        # Log the transaction (audit trail)
        frappe.get_doc({
            "doctype": "AI Credit Transaction",
            "restaurant": restaurant.name,
            "amount": amount,
            "type": "Credit",
            "remarks": f"Admin: {reason} (+{amount} coins)",
            "transaction_date": frappe.utils.now(),
            "status": "Success"
        }).insert(ignore_permissions=True)
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f"Successfully credited {amount} coins to {restaurant_id}",
            'new_balance': new_bal
        }
    except Exception as e:
        frappe.log_error(f"Error in admin_give_coins: {str(e)}", "Admin API Error")
        frappe.db.rollback()
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def admin_update_restaurant_settings(restaurant_id, updates):
    """
    Update administrative settings for a restaurant.
    """
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {'success': False, 'error': 'Admin access required'}
            
        # Get restaurant
        restaurant = frappe.get_doc('Restaurant', {'restaurant_id': restaurant_id})
        if not restaurant:
            return {'success': False, 'error': 'Restaurant not found'}
        
        # Parse updates if it's a string
        if isinstance(updates, str):
            import json
            updates = json.loads(updates)
            
        # Prevent non-admin fields from being updated here if needed, 
        # but for now we follow the user's request for platform_fee_percent
        allowed_fields = ['platform_fee_percent', 'is_active', 'restaurant_name', 'owner_email']
        
        for field, value in updates.items():
            if field in allowed_fields:
                if field == 'platform_fee_percent':
                    try:
                        value = float(value)
                    except:
                        continue
                setattr(restaurant, field, value)
        
        restaurant.save(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f"Restaurant settings updated successfully for {restaurant_id}",
            'data': {
                'restaurant_id': restaurant_id,
                'updated_fields': list(updates.keys())
            }
        }
    except Exception as e:
        frappe.log_error(f"Error in admin_update_restaurant_settings: {str(e)}", "Admin API Error")
        frappe.db.rollback()
        return {'success': False, 'error': str(e)}


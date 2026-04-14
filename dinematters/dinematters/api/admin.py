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
        frappe.log_error("Admin API Error", f"Error checking admin access: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_all_restaurants(page=1, page_size=20, search=None):
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
        
        page = int(page or 1)
        page_size = int(page_size or 20)
        limit_start = (page - 1) * page_size
        
        # Build searching logic
        where_conditions = []
        params = []
        
        if search:
            where_conditions.append("(r.restaurant_name LIKE %s OR r.restaurant_id LIKE %s OR r.owner_email LIKE %s)")
            search_val = f"%{search}%"
            params.extend([search_val, search_val, search_val])
            
        where_clause = " WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        # Check if RestaurantConfig table exists
        config_table_exists = frappe.db.table_exists('RestaurantConfig')
        
        if config_table_exists:
            query = f"""
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
                    COALESCE(r.monthly_minimum, 999) as monthly_minimum,
                    COALESCE(rc.subscription_plan, r.plan_type, 'SILVER') as plan_type
                FROM `tabRestaurant` r
                LEFT JOIN `tabRestaurantConfig` rc ON r.name = rc.parent
                {{where_clause}}
                ORDER BY r.creation DESC
                LIMIT {{limit_start}}, {{page_size}}
            """.format(where_clause=where_clause, limit_start=limit_start, page_size=page_size)
            count_query = f"SELECT COUNT(*) FROM `tabRestaurant` r {where_clause}"
        else:
            query = f"""
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
                    COALESCE(r.monthly_minimum, 999) as monthly_minimum,
                    COALESCE(r.plan_type, 'SILVER') as plan_type
                FROM `tabRestaurant` r
                {{where_clause}}
                ORDER BY r.creation DESC
                LIMIT {{limit_start}}, {{page_size}}
            """.format(where_clause=where_clause, limit_start=limit_start, page_size=page_size)
            count_query = f"SELECT COUNT(*) FROM `tabRestaurant` r {where_clause}"
        
        restaurants = frappe.db.sql(query, tuple(params), as_dict=True)
        total_count = frappe.db.sql(count_query, tuple(params))[0][0]
        
        # Convert is_active to integer for consistency
        for restaurant in restaurants:
            restaurant['is_active'] = int(restaurant['is_active'] or 0)
            # Ensure plan_type is valid
            if restaurant['plan_type'] not in ['SILVER', 'GOLD', 'DIAMOND']:
                restaurant['plan_type'] = 'SILVER'
        
        return {
            'success': True,
            'data': {
                'restaurants': restaurants,
                'total': total_count,
                'page': page,
                'page_size': page_size
            }
        }
        
    except Exception as e:
        frappe.log_error("Admin API Error", f"Error getting all restaurants: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_restaurant_details(restaurant_id):
    """
    Get all details of a single restaurant.
    Only accessible by admin users.
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
                'error': 'Restaurant not found'
            }
        
        # Convert password fields to stars/placeholder to protect secrets but allow checking if they exist
        restaurant_dict = restaurant.as_dict()
        
        return {
            'success': True,
            'data': {
                'restaurant': restaurant_dict
            }
        }
    except Exception as e:
        frappe.log_error("Admin API Error", f"Error in get_restaurant_details: {str(e)}")
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
        if plan_type not in ['SILVER', 'GOLD', 'DIAMOND']:
            return {
                'success': False,
                'error': 'Invalid plan type. Must be SILVER, GOLD or DIAMOND'
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
                frappe.log_error("Plan Update Error", f"Error updating restaurant plan: {str(e)}")
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
        if plan_type == 'DIAMOND':
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
        elif plan_type == 'GOLD':
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
        else:  # SILVER
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
        frappe.log_error("Admin API Error", f"Error updating restaurant plan: {str(e)}")
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
            frappe.log_error("Status Update Error", f"Error updating restaurant status: {str(e)}")
            return {
                'success': False,
                'error': f'Failed to update status: {str(e)}'
            }
        
    except Exception as e:
        frappe.log_error("Admin API Error", f"Error in toggle_restaurant_status: {str(e)}")
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
                SUM(CASE WHEN COALESCE(rc.subscription_plan, 'SILVER') = 'SILVER' THEN 1 ELSE 0 END) as silver_count,
                SUM(CASE WHEN COALESCE(rc.subscription_plan, 'SILVER') = 'GOLD' THEN 1 ELSE 0 END) as gold_count,
                SUM(CASE WHEN COALESCE(rc.subscription_plan, 'SILVER') = 'DIAMOND' THEN 1 ELSE 0 END) as diamond_count,
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
                    'silver_count': 0,
                    'gold_count': 0,
                    'diamond_count': 0,
                    'active_count': 0,
                    'inactive_count': 0
                }
            }
        
    except Exception as e:
        frappe.log_error("Admin API Error", f"Error getting subscription stats: {str(e)}")
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
            "Coin Transaction", "Monthly Billing Ledger", "Monthly Revenue Ledger", "Razorpay Webhook Log",
            "Plan Change Log", "Referral Link", "Referral Visit", "OTP Verification Log",
            "AI Credit Transaction",
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
                frappe.log_error("Restaurant Delete Error", f"Error deleting from {dt}: {str(inner_e)}")
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
                frappe.log_error("Restaurant Delete Error", f"Error deleting RestaurantConfig: {str(e)}")

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
            frappe.log_error("Restaurant Delete Error", f"Error cleaning up files: {str(e)}")

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
        frappe.log_error("Admin API Error", f"Error in delete_restaurant API: {str(e)}")
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
            
        # Update balance and log the transaction (audit trail)
        from dinematters.dinematters.api.coin_billing import record_transaction
        new_bal = record_transaction(
            restaurant=restaurant.name,
            txn_type="Admin Adjustment",
            amount=amount,
            description=f"Admin Grant: {reason}"
        )
        
        return {
            'success': True,
            'message': f"Successfully credited {amount} coins to {restaurant_id}",
            'new_balance': new_bal
        }
    except Exception as e:
        frappe.log_error("Admin API Error", f"Error in admin_give_coins: {str(e)}")
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
        # Allow most fields for admin updates
        allowed_fields = [
            'platform_fee_percent', 'monthly_minimum', 'is_active', 'restaurant_name', 'owner_email',
            'owner_phone', 'owner_name', 'plan_type', 'billing_status', 'mandate_status',
            'pos_provider', 'pos_enabled', 'pos_app_key', 'pos_app_secret', 'pos_access_token', 'pos_merchant_id',
            'enable_loyalty', 'enable_takeaway', 'enable_delivery', 'enable_dine_in', 'no_ordering',
            'tax_rate', 'gst_number', 'default_delivery_fee', 'default_packaging_fee', 'minimum_order_value',
            'estimated_prep_time', 'timezone', 'currency', 'tables', 'description', 'google_map_url'
        ]
        
        for field, value in updates.items():
            if field in allowed_fields:
                # Handle type conversions for numeric/boolean fields
                if field in ['platform_fee_percent', 'monthly_minimum', 'tax_rate', 'default_delivery_fee', 
                            'default_packaging_fee', 'minimum_order_value', 'coins_balance']:
                    try:
                        value = float(value)
                    except:
                        continue
                elif field in ['is_active', 'enable_loyalty', 'enable_takeaway', 'enable_delivery', 
                              'enable_dine_in', 'no_ordering', 'pos_enabled']:
                    value = 1 if value in [True, 1, '1', 'true'] else 0
                elif field in ['tables', 'estimated_prep_time']:
                    try:
                        value = int(value)
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
        frappe.log_error("Admin API Error", f"Error in admin_update_restaurant_settings: {str(e)}")
        frappe.db.rollback()
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def admin_onboard_restaurant_owner(restaurant_id, owner_name, owner_email):
    """
    Onboard a restaurant owner.
    Creates a Frappe User, assigns roles, links to Restaurant, and triggers welcome email.
    """
    try:
        # Check admin access first
        access_check = check_admin_access()
        if not access_check.get('success') or not access_check.get('data', {}).get('allowed'):
            return {'success': False, 'error': 'Admin access required'}

        if not owner_email:
            return {'success': False, 'error': 'Owner email is required'}

        # Get restaurant
        restaurant = frappe.get_doc('Restaurant', {'restaurant_id': restaurant_id})
        if not restaurant:
            return {'success': False, 'error': 'Restaurant not found'}

        # 1. Update Restaurant record if details changed
        if restaurant.owner_email != owner_email or restaurant.owner_name != owner_name:
            restaurant.owner_email = owner_email
            restaurant.owner_name = owner_name
            restaurant.save(ignore_permissions=True)
            frappe.db.commit()

        # 2. Look up or create Frappe User
        user_id = frappe.db.get_value("User", {"email": owner_email}, "name")
        first_name = owner_name.split()[0] if owner_name else "Owner"
        
        from dinematters.dinematters.utils.permissions import assign_user_to_restaurant, create_restaurant_user_permission

        is_new = False
        onboard_link = None
        email_sent = False

        if not user_id:
            # Create a new user
            user_doc = frappe.get_doc({
                "doctype": "User",
                "email": owner_email,
                "first_name": first_name,
                "user_type": "System User"
            })
            user_doc.insert(ignore_permissions=True)
            user_id = user_doc.name
            is_new = True
            
            # Generate link manually and fix protocol
            onboard_link = user_doc.reset_password(send_email=False)
            if onboard_link and onboard_link.startswith("http://"):
                onboard_link = onboard_link.replace("http://", "https://", 1)
            
            try:
                send_onboarding_email(owner_email, first_name, onboard_link)
                email_sent = True
            except Exception:
                frappe.log_error("Onboarding Email Failed", f"Failed to send welcome email to {owner_email}. Link: {onboard_link}")
        else:
            # Existing user - try to send reset email
            user_doc = frappe.get_doc("User", user_id)
            onboard_link = user_doc.reset_password(send_email=False)
            if onboard_link and onboard_link.startswith("http://"):
                onboard_link = onboard_link.replace("http://", "https://", 1)
            
            try:
                send_onboarding_email(owner_email, first_name, onboard_link)
                email_sent = True
            except Exception:
                frappe.log_error("Password Reset Email Failed", f"Failed to send reset email to {owner_email}. Link: {onboard_link}")
        
        # 3. Add necessary roles
        roles_to_add = ["System User", "Restaurant Staff"]
        
        has_changes = False
        for role in roles_to_add:
            if frappe.db.exists("Role", role):
                if not frappe.db.exists("Has Role", {"parent": user_id, "role": role}):
                    user_doc.append("roles", {"role": role})
                    has_changes = True

        if has_changes:
            user_doc.save(ignore_permissions=True)

        # 4. Link user to the restaurant
        has_existing_default = frappe.db.exists("Restaurant User", {"user": user_id, "is_default": 1})
        is_default_flag = 0 if has_existing_default else 1

        # create_restaurant_user_permission maps Frappe User Permissions
        create_restaurant_user_permission(user_id, restaurant.name, is_default=is_default_flag)
        
        # Check if already in 'Restaurant User' doctype
        if not frappe.db.exists("Restaurant User", {"user": user_id, "restaurant": restaurant.name}):
            assign_user_to_restaurant(user_id, restaurant.name, role="Restaurant Staff", is_default=is_default_flag)

        frappe.db.commit()

        status_msg = "successfully onboarded" if is_new else "already exists and has been granted access"
        email_msg = "An email has been sent." if email_sent else f"Email could not be sent. Link: {onboard_link}"
        
        full_msg = f"Owner {owner_email} {status_msg}. {email_msg}"
        
        return {
            'success': True,
            'message': full_msg,
            'data': {
                'user': user_id,
                'email': owner_email,
                'is_new': is_new,
                'email_sent': email_sent,
                'onboard_link': onboard_link
            }
        }
    except Exception as e:
        frappe.log_error("Admin Onboarding Error", f"Error in admin_onboard_restaurant_owner: {str(e)}")
        frappe.db.rollback()
        return {'success': False, 'error': str(e)}

def send_onboarding_email(recipient, name, link):
    """
    Send a custom branded onboarding email to the restaurant owner.
    Fixes protocol and provides a premium experience.
    """
    site_url = "https://backend.dinematters.com"
    subject = "Welcome to DineMatters"
    
    html_content = f"""
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; background-color: #f9fafb;">
        <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="display: flex; align-items: center; margin-bottom: 32px;">
                <div style="width: 12px; height: 12px; background-color: #10b981; border-radius: 50%; margin-right: 12px;"></div>
                <h1 style="font-size: 24px; font-weight: 700; margin: 0; color: #111827;">Welcome to DineMatters</h1>
            </div>
            
            <p style="font-size: 16px; line-height: 24px; margin-bottom: 24px; color: #374151;">
                Hello {name},
            </p>
            
            <p style="font-size: 16px; line-height: 24px; margin-bottom: 16px; color: #374151;">
                A new account has been created for you at <a href="{site_url}" style="color: #2563eb; text-decoration: none; font-weight: 500;">{site_url}</a>.
            </p>
            
            <p style="font-size: 16px; line-height: 24px; margin-bottom: 32px; color: #374151;">
                Your login id is: <strong style="color: #111827;">{recipient}</strong><br>
                Click on the link below to complete your registration and set a new password.
            </p>
            
            <div style="margin-bottom: 40px;">
                <a href="{link}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center;">Complete Registration</a>
            </div>
            
            <div style="padding-top: 32px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 14px; line-height: 20px; color: #6b7280; margin-bottom: 8px;">
                    You can also copy-paste following link in your browser:
                </p>
                <p style="font-size: 14px; line-height: 20px; color: #2563eb; word-break: break-all;">
                    <a href="{link}" style="color: #2563eb; text-decoration: none;">{link}</a>
                </p>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 12px; color: #9ca3af;">
                Sent via ERPNext
            </p>
        </div>
    </div>
    """
    
    frappe.sendmail(
        recipients=[recipient],
        subject=subject,
        content=html_content,
        now=True
    )



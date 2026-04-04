"""
DineMatters Subscription Billing Tasks
Handles daily floor recovery and deferred plan transitions.
"""

import frappe
from frappe.utils import getdate, nowdate, add_days
from dinematters.dinematters.api.coin_billing import deduct_coins

def process_daily_subscription_floors():
    """
    Nightly task (23:59) to ensure PRO (₹33.30 flat) and LUX (₹43.30 min) restaurants are billed correctly.
    """
    today = getdate()
    
    # 1. Fetch all paid restaurants (PRO and LUX)
    pro_lux_restaurants = frappe.get_all("Restaurant", 
        filters={"plan_type": ["in", ["PRO", "LUX"]], "is_active": 1}, 
        fields=["name", "plan_type", "coins_balance", "timezone", "monthly_minimum"]
    )
    
    for res in pro_lux_restaurants:
        try:
            from datetime import datetime, time, timedelta
            import pytz
            
            res_tz = pytz.timezone(res.timezone or "UTC")
            local_now = datetime.now(res_tz)
            local_today_date = local_now.date()

            # 2.1 Calculate UTC range for the restaurant's local "Today"
            # This avoids reliance on MySQL CONVERT_TZ which is often unconfigured
            start_of_day_local = res_tz.localize(datetime.combine(local_today_date, time.min))
            end_of_day_local = start_of_day_local + timedelta(days=1)
            
            start_utc = start_of_day_local.astimezone(pytz.utc)
            end_utc = end_of_day_local.astimezone(pytz.utc)

            # 3. Check for Idempotency: Has a floor recovery already been processed for this restaurant today?
            # We search for 'Daily {PRO/LUX} Floor' in the local today's time range
            already_processed = frappe.db.exists("Coin Transaction", {
                "restaurant": res.name,
                "transaction_type": ["in", ["Daily PRO Floor", "Daily LUX Floor"]],
                "creation": [">=", start_utc.strftime("%Y-%m-%d %H:%M:%S")],
                "creation": ["<", end_utc.strftime("%Y-%m-%d %H:%M:%S")]
            })
            
            if already_processed:
                continue

            # 4. Calculate commissions already paid in the restaurant's UTC-equivalent today
            daily_commissions = frappe.db.sql("""
                SELECT SUM(amount) 
                FROM `tabCoin Transaction` 
                WHERE restaurant = %s 
                AND transaction_type = 'Commission Deduction'
                AND creation >= %s AND creation < %s
            """, (res.name, start_utc, end_utc))[0][0] or 0.0
            
            # 5. Determine Floor Target
            # Dynamic floor target from Restaurant record (e.g. ₹999 or ₹1299 / 30)
            # This is now plan-aware since Restaurant.validate automatically sets these defaults.
            floor_target = float(res.monthly_minimum or 0.0) / 30.0
            
            shortfall = max(0, floor_target - abs(float(daily_commissions)))
            
            if shortfall > 0:
                deduct_coins(
                    restaurant=res.name,
                    amount=shortfall,
                    type=f"Daily {res.plan_type} {'Subscription' if res.plan_type == 'PRO' else 'Floor'}",
                    description=f"Daily {res.plan_type} {'Fee' if res.plan_type == 'PRO' else 'Minimum Floor Recovery'} (Target: ₹{floor_target:.2f}, Commissions Paid: ₹{abs(float(daily_commissions)):.2f})"
                )
        except Exception as e:
            frappe.log_error(f"Daily floor recovery failed for {res.name}: {str(e)}", "Billing Task Error")

def sync_restaurant_subscription(restaurant):
    """
    Core fail-safe function to flip a restaurant to its new scheduled plan.
    Ensures idempotency and handles plan metadata.
    """
    res_doc = frappe.get_doc("Restaurant", restaurant)
    today = getdate()

    # check if switch is required (deferred plan exists and date is reached/passed)
    if not res_doc.deferred_plan_type or not res_doc.plan_change_date:
        return False
    
    if getdate(res_doc.plan_change_date) > today:
        return False

    try:
        previous_plan = res_doc.plan_type
        new_plan = res_doc.deferred_plan_type
        
        # Atomically update to avoid race conditions during JIT + scheduler
        frappe.db.set_value("Restaurant", restaurant, {
            "plan_type": new_plan,
            "plan_activated_on": frappe.utils.now_datetime(),
            "deferred_plan_type": None,
            "plan_change_date": None
        })
        
        # Log the success for billing audit
        frappe.log_error(f"Subscription Switch Success: {restaurant} moved from {previous_plan} to {new_plan}. (Source: JIT/Scheduler Sync)", "Subscription Info")
        
        # If we have a Config record, ensure it is also sync'd (optional but recommended)
        config_name = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant}, "name")
        if config_name:
            # We don't change config fields yet, but we could trigger a feature re-validation if needed
            pass

        return True
    except Exception as e:
        frappe.log_error(f"Subscription Sync failed for {restaurant}: {str(e)}", "Subscription Error")
        return False

def apply_deferred_plan_changes():
    """
    Midnight task (00:01) to flip restaurants to their new scheduled plans.
    """
    today = getdate()
    
    # 1. Find all restaurants with a plan change scheduled for today or earlier
    pending_res = frappe.get_all("Restaurant", 
        filters={
            "deferred_plan_type": ["is", "set"],
            "plan_change_date": ["<=", today]
        },
        fields=["name"]
    )
    
    for res in pending_res:
        sync_restaurant_subscription(res.name)

    frappe.db.commit()

def process_lite_feature_renewals():
    """
    Daily task to renew premium features for LITE restaurants (e.g., Menu Theme Background).
    Deducts 100 coins every 30 days if feature is enabled.
    """
    from frappe.utils import today, add_days, getdate
    
    # 1. Find all LITE restaurants with Menu Theme Background enabled
    lite_configs = frappe.db.sql("""
        SELECT 
            rc.name, rc.restaurant, rc.menu_theme_paid_until 
        FROM 
            `tabRestaurant Config` rc
        JOIN 
            `tabRestaurant` r ON r.name = rc.restaurant
        WHERE 
            r.plan_type = 'LITE' 
            AND rc.menu_theme_background_enabled = 1
            AND (rc.menu_theme_paid_until IS NULL OR rc.menu_theme_paid_until <= %s)
    """, (today(),), as_dict=1)

    for config in lite_configs:
        try:
            # Double-check plan type just in case of a race condition or stale cache
            actual_plan = frappe.db.get_value("Restaurant", config.restaurant, "plan_type")
            if actual_plan != 'LITE':
                # Skip and clear the paid_until since it shouldn't apply to premium tiers
                frappe.db.set_value("Restaurant Config", config.name, "menu_theme_paid_until", None)
                continue
                
            # Attempt to deduct 100 coins
            deduct_coins(
                restaurant=config.restaurant,
                amount=100,
                type="AI Deduction",
                description="Menu Theme Background monthly renewal fee (Autopay)"
            )
            
            # If successful, extend for 30 more days
            new_expiry = add_days(today(), 30)
            frappe.db.set_value("Restaurant Config", config.name, "menu_theme_paid_until", new_expiry)
            
        except Exception as e:
            # If deduction fails (e.g., insufficient coins), disable the feature
            frappe.db.set_value("Restaurant Config", config.name, "menu_theme_background_enabled", 0)
            frappe.log_error(f"Menu Theme Auto-renewal failed for {config.restaurant} (Disabled): {str(e)}", "Billing Task Info")

    frappe.db.commit()

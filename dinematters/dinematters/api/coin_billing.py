"""
DineMatters Coin Billing System
Unified wallet for AI credits, Commissions, and Platform Fees.
1 Coin = ₹1
"""
import frappe
import razorpay
import math
from datetime import datetime
from frappe import _
from dinematters.dinematters.utils.razorpay_utils import get_razorpay_client, get_razorpay_config

# ─── Constants ───────────────────────────────────────────────────────────────
INR_PER_COIN = 1
COINS_PER_ENHANCEMENT = 10  # ₹10
COINS_PER_GENERATION = 16   # ₹16
AUTO_RECHARGE_DAILY_LIMIT = 5000.0  # Safety cap per day
AUTO_RECHARGE_HARD_CAP = 15000.0   # RBI AFA Limit for single transaction

# ─── Internal helpers ─────────────────────────────────────────────────────────

# (Internal Razorpay helper moved to utils.razorpay_utils)


def record_transaction(restaurant, txn_type, amount, description="", payment_id=None, ref_doctype=None, ref_name=None, gst_amount=0, total_paid=0, fail_below=None):
    """Atomically update restaurant balance and create a transaction log."""
    # Re-read balance with row lock
    balance_info = frappe.db.sql(
        "SELECT coins_balance FROM `tabRestaurant` WHERE name = %s FOR UPDATE",
        (restaurant,)
    )
    current_balance = (balance_info[0][0] if balance_info and balance_info[0][0] is not None else 0.0)

    is_deduction = txn_type in ["AI Deduction", "Commission Deduction", "Daily SILVER Floor", "Daily GOLD Floor", "Daily DIAMOND Floor", "Daily GOLD Subscription", "Daily DIAMOND Subscription", "Lead Unlock"]
    
    if is_deduction:
        new_balance = current_balance - abs(amount)
    elif txn_type in ["Purchase", "Free Coins", "Refund", "Autopay Recharge"]:
        new_balance = current_balance + abs(amount)
    elif txn_type == "Admin Adjustment":
        new_balance = current_balance + amount
    else:
        new_balance = current_balance + amount
    
    # Atomic Guardrail: Stop if balance would fall below allowed limit
    if fail_below is not None and new_balance < fail_below:
        frappe.throw(
            _("Transaction failed: Insufficient DineMatters Coins. Required: {0}, Available: {1} (Limit: {2})").format(
                abs(amount), current_balance, fail_below
            ), 
            frappe.ValidationError
        )

    frappe.db.set_value("Restaurant", restaurant, "coins_balance", new_balance)

    txn = frappe.get_doc({
        "doctype": "Coin Transaction",
        "restaurant": restaurant,
        "transaction_type": txn_type,
        "amount": -abs(amount) if is_deduction else abs(amount),
        "gst_amount": gst_amount,
        "total_paid_inr": total_paid or (amount + gst_amount),
        "balance_after": new_balance,
        "description": description,
        "payment_id": payment_id,
        "reference_doctype": ref_doctype,
        "reference_name": ref_name,
    })
    txn.insert(ignore_permissions=True)
    
    # Trigger auto-recharge check if balance falls below threshold
    if txn_type in ["AI Deduction", "Commission Deduction", "Daily SILVER Floor", "Daily GOLD Floor", "Daily DIAMOND Floor", "Daily GOLD Subscription", "Daily DIAMOND Subscription"]:
        check_and_trigger_auto_recharge(restaurant, new_balance)

        # Check for system suspension (-300 grace limit)
        if new_balance < -300:
             res_doc = frappe.get_doc("Restaurant", restaurant)
             res_doc.suspend_restaurant_billing(reason="Exceeded -₹300 Grace Period")

    frappe.db.commit()
    return new_balance


def check_and_trigger_auto_recharge(restaurant, current_balance):
    """Check if balance is below threshold and trigger background recharge."""
    res_doc = frappe.get_doc("Restaurant", restaurant)
    
    if not res_doc.auto_recharge_enabled:
        return

    # Skip if we already have a healthy balance
    if current_balance >= res_doc.auto_recharge_threshold:
        return
        
    # Enforce daily safety limit
    today = datetime.now().date()
    if res_doc.last_auto_recharge_date != today:
        # Reset counter for a new day
        frappe.db.set_value("Restaurant", restaurant, {
            "daily_auto_recharge_count": 0,
            "last_auto_recharge_date": today
        })
        current_daily_vol = 0
    else:
        current_daily_vol = res_doc.daily_auto_recharge_count or 0

    if current_daily_vol + res_doc.auto_recharge_amount > AUTO_RECHARGE_DAILY_LIMIT:
        frappe.log_error(f"Auto-recharge blocked by safety limit for {restaurant}. Daily limit: ₹{AUTO_RECHARGE_DAILY_LIMIT}", "Autopay Safety")
        return

    # Trigger async recharge task
    frappe.enqueue(
        "dinematters.dinematters.api.coin_billing.trigger_auto_recharge",
        restaurant=restaurant,
        enqueue_after_commit=True
    )


def trigger_auto_recharge(restaurant):
    """Charge the restaurant for coins using their saved mandate."""
    try:
        res_doc = frappe.get_doc("Restaurant", restaurant)
        # DYNAMIC RECHARGE LOGIC (Grace + 300 Min)
        # Current logic: abs(negative_balance) + max(configured_amount, 300)
        current_bal = float(res_doc.coins_balance or 0)
        debt_to_clear = abs(min(0, current_bal))
        
        configured_recharge = float(res_doc.auto_recharge_amount or 1000)
        actual_top_up = max(configured_recharge, 300.0)
        
        recharge_amt = debt_to_clear + actual_top_up
        recharge_amt_paise = int(recharge_amt * 100)

        # Safety: Hard Cap for RBI AFA
        if recharge_amt > AUTO_RECHARGE_HARD_CAP:
             recharge_amt = AUTO_RECHARGE_HARD_CAP
             recharge_amt_paise = int(AUTO_RECHARGE_HARD_CAP * 100)

        client = get_razorpay_client()
        
        # Charge via Token (Mandate)
        payment_payload = {
            "amount": recharge_amt_paise,
            "currency": "INR",
            "customer_id": res_doc.razorpay_customer_id,
            "token": res_doc.razorpay_token_id,
            "description": f"DineMatters Hyper-Recharge: ₹{recharge_amt} (Clearing debt + ₹{actual_top_up} Top-up)",
            "notes": {
                "restaurant": restaurant,
                "type": "auto_recharge",
                "debt_cleared": debt_to_clear,
                "topup_added": actual_top_up
                # GOLD WhatsApp guest: filter by phone number captured at checkout
            }
        }
        
        payment = client.payment.create_recursive(payment_payload)
        
        if payment.get("status") in ["captured", "authorized"]:
            # Success! Add coins to wallet
            record_transaction(
                restaurant=restaurant,
                txn_type="Autopay Recharge",
                amount=recharge_amt,
                description=f"Auto-Recharge triggered (Balance was below ₹{res_doc.auto_recharge_threshold})",
                payment_id=payment.get("id")
            )
            
            # Update safety metrics
            frappe.db.sql("""
                UPDATE `tabRestaurant`
                SET daily_auto_recharge_count = daily_auto_recharge_count + %s,
                    last_auto_recharge_date = %s
                WHERE name = %s
            """, (recharge_amt, datetime.now().date(), restaurant))
            
            frappe.db.commit()
            
    except Exception as e:
        frappe.log_error(f"Auto-recharge failed for {restaurant}: {str(e)}", "Autopay Error")


# ─── Public APIs ──────────────────────────────────────────────────────────────

@frappe.whitelist(allow_guest=False)
def deduct_coins(restaurant, amount, type, description="", ref_doctype=None, ref_name=None):
    """
    Public API to deduct coins from a restaurant.
    Throws ValidationError if balance is insufficient.
    """
    # Trigger auto-recharge check early so it can process in background
    balance = frappe.db.get_value("Restaurant", restaurant, "coins_balance") or 0.0
    check_and_trigger_auto_recharge(restaurant, balance)

    # For automated or platform deductions, we allow going down to the grace limit (-300)
    # For user-triggered AI actions, we could be stricter (e.g. fail if < 0), 
    # but currently we allow usage up to the suspension limit.
    fail_limit = -300.0
    
    return record_transaction(
        restaurant=restaurant,
        txn_type=type,
        amount=amount,
        description=description,
        ref_doctype=ref_doctype,
        ref_name=ref_name,
        fail_below=fail_limit
    )


@frappe.whitelist(allow_guest=False)
def refund_coins(restaurant, amount, description="", ref_doctype=None, ref_name=None):
    """Refund coins to a restaurant."""
    return record_transaction(
        restaurant=restaurant,
        txn_type="Refund",
        amount=amount,
        description=description,
        ref_doctype=ref_doctype,
        ref_name=ref_name
    )


@frappe.whitelist(allow_guest=False)
def get_coin_billing_info(restaurant):
    """Returns the restaurant's coin balance and billing settings."""
    from dinematters.dinematters.tasks.subscription_tasks import sync_restaurant_subscription
    
    # Fail-safe: Check for overdue plan switches before returning info
    sync_restaurant_subscription(restaurant)
    
    res = frappe.get_doc("Restaurant", restaurant)
    settings = frappe.get_single("Dinematters Settings")
    
    return {
        "coins_balance": res.coins_balance or 0,
        "auto_recharge_enabled": res.auto_recharge_enabled,
        "auto_recharge_threshold": res.auto_recharge_threshold,
        "auto_recharge_amount": res.auto_recharge_amount,
        "mandate_active": res.mandate_status == "active",
        "daily_limit": AUTO_RECHARGE_DAILY_LIMIT,
        "current_daily_vol": res.daily_auto_recharge_count or 0,
        "deferred_plan_type": res.deferred_plan_type,
        "plan_change_date": res.plan_change_date,
        "billing_status": res.billing_status or "active",
        "onboarding_date": res.onboarding_date,
        "last_auto_recharge_date": res.last_auto_recharge_date,
        # Plan Defaults for Upgrade UI
        "plan_defaults": {
            "silver_monthly": 0.0,
            "gold_monthly": settings.gold_monthly_fee or 999.0,
            "diamond_monthly": settings.diamond_monthly_floor or 1299.0,
            "diamond_commission": settings.diamond_commission_percent or 1.5,
            "diamond_barrier": settings.diamond_upgrade_barrier or 1299.0
        }
    }

@frappe.whitelist(allow_guest=False)
def update_subscription_plan(restaurant, plan_type):
    """
    Schedule a restaurant subscription tier update (SILVER/GOLD/DIAMOND).
    All plan changes follow the 'Tomorrow Rule' (effective at 00:00).
    """
    if plan_type not in ["SILVER", "GOLD", "DIAMOND"]:
        frappe.throw(_("Invalid plan type. Options: SILVER, GOLD, DIAMOND"))
    
    current_plan = frappe.db.get_value("Restaurant", restaurant, "plan_type")
    if current_plan == plan_type:
        return {"success": True, "message": f"Already on {plan_type} plan."}

    # 1. Entrance Barrier Check (Monthly Minimum Coins for GOLD/DIAMOND)
    res_info = frappe.db.get_value("Restaurant", restaurant, ["coins_balance", "monthly_minimum"], as_dict=True)
    balance = float(res_info.coins_balance or 0.0)

    settings = frappe.get_single("Dinematters Settings")

    if plan_type == "GOLD":
        # Check against restaurant's own minimum, fallback to global default
        min_required = float(res_info.monthly_minimum if res_info.monthly_minimum else (settings.gold_monthly_fee or 999.0))
        if balance < min_required:
            frappe.throw(_(f"Insufficient balance to upgrade to GOLD. Minimum {min_required} Coins required. Current: {balance}"), frappe.ValidationError)
    
    if plan_type == "DIAMOND":
        # DIAMOND upgrade barrier is a platform-wide constant (manageable in Settings)
        min_required = float(settings.diamond_upgrade_barrier or 1299.0)
        if balance < min_required:
            frappe.throw(_(f"Insufficient balance to upgrade to DIAMOND. Minimum {min_required} Coins required. Current: {balance}"), frappe.ValidationError)

    # 2. Defer activation to Tomorrow 00:00
    from frappe.utils import add_days, getdate
    tomorrow = add_days(getdate(), 1)
    
    frappe.db.set_value("Restaurant", restaurant, {
        "deferred_plan_type": plan_type,
        "plan_change_date": tomorrow,
        "plan_changed_by": frappe.session.user
    })
    
    frappe.db.commit()
    return {
        "success": True, 
        "deferred": True,
        "plan_type": plan_type,
        "effective_date": tomorrow,
        "message": f"Plan change to {plan_type} scheduled. It will be effective from {tomorrow} at 12:00 AM."
    }

@frappe.whitelist(allow_guest=False)
def update_autopay_settings(restaurant, enabled, threshold, amount):
    """Update autopay configuration."""
    frappe.db.set_value("Restaurant", restaurant, {
        "auto_recharge_enabled": 1 if enabled else 0,
        "auto_recharge_threshold": float(threshold),
        "auto_recharge_amount": float(amount)
    })
    frappe.db.commit()
    return {"success": True}

@frappe.whitelist(allow_guest=False)
def create_coin_purchase_order(restaurant, amount):
    """
    Create Razorpay order for manual coin purchase.
    Implements upfront 18% GST collection.
    """
    base_amount = float(amount)
    gst_rate = 0.18
    gst_amount = base_amount * gst_rate
    total_payable = base_amount + gst_amount
    
    amount_paise = int(total_payable * 100)
    
    client = get_razorpay_client()
    razorpay_order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "payment_capture": 1,
        "notes": {
            "restaurant": restaurant,
            "coins": base_amount,
            "gst_amount": gst_amount,
            "total_payable": total_payable,
            "type": "coin_purchase"
        }
    })
    
    cfg = get_razorpay_config()
    key_id = cfg.get("key_id")
    return {
        "success": True,
        "razorpay_order_id": razorpay_order["id"],
        "amount": amount_paise,
        "base_amount": base_amount,
        "gst_amount": gst_amount,
        "total_payable": total_payable,
        "key_id": key_id
    }
@frappe.whitelist(allow_guest=False)
def verify_coin_purchase(restaurant, razorpay_order_id, razorpay_payment_id, razorpay_signature):
    """
    Verify a successful manual coin purchase and credit the restaurant.
    """
    # 1. Verify Signature
    client = get_razorpay_client()
    cfg = get_razorpay_config()
    key_id = cfg.get("key_id")
    
    params_dict = {
        'razorpay_order_id': razorpay_order_id,
        'razorpay_payment_id': razorpay_payment_id,
        'razorpay_signature': razorpay_signature
    }
    
    try:
        client.utility.verify_payment_signature(params_dict)
    except Exception:
        frappe.log_error(f"Coin purchase verification failed for order {razorpay_order_id}", "Coin Billing")
        frappe.throw(_("Payment verification failed. Please contact support."))

    # 2. Retrieve the order from Razorpay to get the 'notes' (verified amount)
    rzp_order = client.order.fetch(razorpay_order_id)
    notes = rzp_order.get("notes", {})
    coins = float(notes.get("coins", 0))
    gst_amount = float(notes.get("gst_amount", 0))
    total_paid = float(notes.get("total_payable", 0))
    
    if coins <= 0:
        frappe.throw(_("Invalid coin amount in payment notes"))

    # 3. Credit the restaurant
    record_transaction(
        restaurant=restaurant,
        txn_type="Purchase",
        amount=coins,
        description=f"Manual Coin Purchase - Ref: {razorpay_payment_id}",
        payment_id=razorpay_payment_id,
        gst_amount=gst_amount,
        total_paid=total_paid
    )
    
    return {"success": True, "coins_added": coins}

@frappe.whitelist(allow_guest=False)
def get_coin_transactions(restaurant, limit=20, offset=0):
    """Fetch paginated coin transactions for a restaurant."""
    return frappe.db.get_list("Coin Transaction",
        filters={"restaurant": restaurant},
        fields=["name", "transaction_type", "amount", "balance_after", "description", "payment_id", "creation"],
        order_by="creation desc",
        limit_page_length=int(limit),
        limit_start=int(offset)
    )

@frappe.whitelist(allow_guest=False)
def initialize_free_coins(restaurant):
    """
    Give free signup coins to a new restaurant.
    Ensures they only get it once.
    """
    # 60 coins = 30 legacy credits
    coins_to_add = 60 
    
    # Check if they already got free coins or legacy credits
    existing_coins = frappe.db.count("Coin Transaction", {
        "restaurant": restaurant,
        "transaction_type": "Free Coins",
    })
    # Also check legacy to prevent double-dipping during migration
    existing_credits = frappe.db.count("AI Credit Transaction", {
        "restaurant": restaurant,
        "transaction_type": "Free Credits",
    })
    
    if not existing_coins and not existing_credits:
        record_transaction(
            restaurant=restaurant,
            txn_type="Free Coins",
            amount=coins_to_add,
            description=f"Welcome! {coins_to_add} free Coins to get started.",
        )
        return True
    return False

@frappe.whitelist(allow_guest=False)
def process_monthly_subscription_coin_refill():
    """
    Cron job: Grant 60 free coins to all active GOLD/DIAMOND restaurants monthly.
    """
    from frappe.utils import now
    
    # We target GOLD and DIAMOND plans
    restaurants = frappe.get_all("Restaurant", 
        filters={"plan_type": ["in", ["GOLD", "DIAMOND"]], "is_active": 1},
        pluck="name"
    )
    
    for r in restaurants:
        record_transaction(
            restaurant=r,
            txn_type="Free Coins",
            amount=60,
            description="Monthly Subscription Reward: 60 Free Coins",
        )
    
    frappe.db.commit()

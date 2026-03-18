"""
AI Credit Billing System for Dinematters
Handles: credit balance management, deduction, purchase via Razorpay, and admin overrides.

Credit Model:
- 1 credit = ₹2
- 1 image enhancement = 5 credits (₹10)
- New restaurants get 30 free credits on signup

Recharge bundles:
- 20 credits → ₹40
- 50 credits → ₹100
- 100 credits → ₹200
- Custom → calculated at ₹2/credit (min 10 credits)
"""
import frappe
import razorpay
import hmac
import hashlib
from frappe import _

# ─── Constants ───────────────────────────────────────────────────────────────
CREDITS_PER_ENHANCEMENT = 5
INR_PER_CREDIT = 2
FREE_CREDITS_ON_SIGNUP = 30

CREDIT_BUNDLES = {
    "20":  {"credits": 20,  "price_inr": 40},
    "50":  {"credits": 50,  "price_inr": 100},
    "100": {"credits": 100, "price_inr": 200},
}


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _get_razorpay_client():
    """Return site-level Razorpay client."""
    key_id = frappe.conf.get("razorpay_key_id") or frappe.get_conf().get("razorpay_key_id")
    key_secret = frappe.conf.get("razorpay_key_secret") or frappe.get_conf().get("razorpay_key_secret")
    if not key_id or not key_secret:
        frappe.throw(_("Razorpay API keys not configured for the platform"))
    return razorpay.Client(auth=(key_id, key_secret))


def _record_transaction(restaurant, txn_type, credits, description="", payment_id=None, generation_id=None):
    """Atomically update restaurant balance and create a transaction log."""
    # Re-read balance (use SQL direct for reliability across Frappe versions)
    balance = frappe.db.sql(
        "SELECT ai_credits FROM `tabRestaurant` WHERE name = %s FOR UPDATE",
        (restaurant,)
    )
    balance = (balance[0][0] if balance and balance[0][0] is not None else 0)

    if txn_type == "Deduction":
        new_balance = balance - abs(credits)
    elif txn_type == "Admin Adjustment":
        # Admin adjustments support signed integers: negative subtracts, positive adds
        new_balance = balance + credits
    else:
        new_balance = balance + abs(credits)

    frappe.db.set_value("Restaurant", restaurant, "ai_credits", new_balance)

    txn = frappe.get_doc({
        "doctype": "AI Credit Transaction",
        "restaurant": restaurant,
        "transaction_type": txn_type,
        "credits": credits,
        "balance_after": new_balance,
        "description": description,
        "payment_id": payment_id,
        "generation_id": generation_id,
    })
    txn.insert(ignore_permissions=True)
    frappe.db.commit()
    return new_balance


# ─── Public APIs ──────────────────────────────────────────────────────────────

@frappe.whitelist(allow_guest=False)
def get_ai_billing_info(restaurant):
    """
    Returns the restaurant's credit balance and AI usage statistics.
    """
    restaurant_doc = frappe.get_doc("Restaurant", restaurant)
    return {
        "ai_credits": restaurant_doc.ai_credits or 0,
        "total_ai_generations": restaurant_doc.total_ai_generations or 0,
        "total_ai_cost": restaurant_doc.total_ai_cost or 0.0,
        "credits_per_enhancement": CREDITS_PER_ENHANCEMENT,
        "inr_per_credit": INR_PER_CREDIT,
        "cost_per_enhancement_inr": CREDITS_PER_ENHANCEMENT * INR_PER_CREDIT,
        "bundles": CREDIT_BUNDLES,
    }


@frappe.whitelist(allow_guest=False)
def check_credit_balance(restaurant):
    """
    Checks if the restaurant has enough credits for one enhancement.
    Returns: {has_credits: bool, balance: int, required: int}
    """
    balance = frappe.db.get_value("Restaurant", restaurant, "ai_credits") or 0
    return {
        "has_credits": balance >= CREDITS_PER_ENHANCEMENT,
        "balance": balance,
        "required": CREDITS_PER_ENHANCEMENT,
    }


@frappe.whitelist(allow_guest=False)
def create_credit_purchase_order(restaurant, bundle_id, custom_credits=None):
    """
    Creates a Razorpay order for purchasing AI credits.
    bundle_id: one of "20", "50", "100" or "custom"
    custom_credits: int (required when bundle_id="custom", min 10)
    """
    try:
        if bundle_id == "custom":
            custom_credits = int(custom_credits or 0)
            if custom_credits < 10:
                frappe.throw(_("Minimum custom recharge is 10 credits"))
            credits = custom_credits
            price_inr = credits * INR_PER_CREDIT
        elif bundle_id in CREDIT_BUNDLES:
            bundle = CREDIT_BUNDLES[bundle_id]
            credits = bundle["credits"]
            price_inr = bundle["price_inr"]
        else:
            frappe.throw(_("Invalid bundle selected"))

        amount_paise = int(price_inr * 100)
        client = _get_razorpay_client()
        razorpay_order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "restaurant": restaurant,
                "credits": credits,
                "type": "ai_credit_purchase",
                "bundle_id": bundle_id,
            }
        })

        # Store pending purchase record
        pending = frappe.get_doc({
            "doctype": "AI Credit Transaction",
            "restaurant": restaurant,
            "transaction_type": "Purchase",
            "credits": credits,
            "balance_after": 0,  # Will be updated on verification
            "description": f"Credit purchase order created ({credits} credits for ₹{price_inr})",
            "payment_id": razorpay_order["id"],  # Temporary: store order ID until payment verified
        })
        pending.insert(ignore_permissions=True)
        frappe.db.commit()

        key_id = frappe.conf.get("razorpay_key_id") or frappe.get_conf().get("razorpay_key_id")
        return {
            "success": True,
            "razorpay_order_id": razorpay_order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": key_id,
            "credits": credits,
            "price_inr": price_inr,
            "pending_txn_id": pending.name,
        }
    except Exception as e:
        frappe.log_error(f"Credit purchase order failed: {str(e)}", "ai_billing.create_credit_purchase_order")
        return {"success": False, "error": str(e)}


@frappe.whitelist(allow_guest=False)
def verify_credit_purchase(razorpay_order_id, razorpay_payment_id, razorpay_signature, pending_txn_id):
    """
    Verifies Razorpay payment signature and credits the restaurant.
    """
    try:
        key_secret = frappe.conf.get("razorpay_key_secret") or frappe.get_conf().get("razorpay_key_secret")
        if not key_secret:
            frappe.throw(_("Razorpay configuration missing"))

        # Verify signature
        msg = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected_signature = hmac.new(
            key_secret.encode("utf-8"),
            msg.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if expected_signature != razorpay_signature:
            frappe.throw(_("Payment verification failed: invalid signature"))

        # Get the pending transaction to find restaurant and credits
        pending = frappe.get_doc("AI Credit Transaction", pending_txn_id)
        if pending.payment_id != razorpay_order_id:
            frappe.throw(_("Transaction mismatch"))

        restaurant = pending.restaurant
        credits = pending.credits

        # Credit the wallet
        new_balance = _record_transaction(
            restaurant=restaurant,
            txn_type="Purchase",
            credits=credits,
            description=f"Purchased {credits} credits (₹{credits * INR_PER_CREDIT}) - Payment {razorpay_payment_id}",
            payment_id=razorpay_payment_id,
        )

        # Delete the pending placeholder
        frappe.delete_doc("AI Credit Transaction", pending_txn_id, ignore_permissions=True)
        frappe.db.commit()

        return {
            "success": True,
            "credits_added": credits,
            "new_balance": new_balance,
        }
    except Exception as e:
        frappe.log_error(f"Credit verification failed: {str(e)}", "ai_billing.verify_credit_purchase")
        return {"success": False, "error": str(e)}


@frappe.whitelist(allow_guest=False)
def admin_adjust_credits(restaurant, credits, reason):
    """
    Admin override to add or remove credits from a restaurant.
    Positive credits = top-up, negative credits = deduct.
    Requires System Manager role.
    """
    roles = frappe.get_roles(frappe.session.user)
    if "System Manager" not in roles and "Administrator" not in roles:
        frappe.throw(_("Not permitted"), frappe.PermissionError)

    credits = int(credits)
    new_balance = _record_transaction(
        restaurant=restaurant,
        txn_type="Admin Adjustment",
        credits=credits,
        description=f"Admin override by {frappe.session.user}: {reason}",
    )
    return {"success": True, "new_balance": new_balance}


@frappe.whitelist(allow_guest=False)
def get_credit_transactions(restaurant, limit=50):
    """Returns credit transaction history for a restaurant."""
    txns = frappe.get_all(
        "AI Credit Transaction",
        filters={"restaurant": restaurant},
        fields=["name", "creation", "transaction_type", "credits", "balance_after", "description", "payment_id"],
        order_by="creation desc",
        limit=limit,
    )
    return txns


# ─── Called from ai_media.py internally ──────────────────────────────────────

def deduct_credits_for_enhancement(restaurant, generation_id, credits=None):
    """
    Deducts credits for one AI image operation.
    credits defaults to CREDITS_PER_ENHANCEMENT (5) for enhance, pass 8 for generate.
    Raises an exception if balance is insufficient.
    Returns new balance.
    """
    credits_to_deduct = credits if credits is not None else CREDITS_PER_ENHANCEMENT
    balance = frappe.db.get_value("Restaurant", restaurant, "ai_credits", for_update=True) or 0
    if balance < credits_to_deduct:
        frappe.throw(_(
            f"Insufficient AI credits. You need {credits_to_deduct} credits but have {balance}. "
            "Please recharge your AI credit wallet."
        ), frappe.ValidationError)

    new_balance = _record_transaction(
        restaurant=restaurant,
        txn_type="Deduction",
        credits=credits_to_deduct,
        description=f"AI image operation - Generation {generation_id}",
        generation_id=generation_id,
    )

    # Update restaurant metrics
    cost_inr = credits_to_deduct * INR_PER_CREDIT
    frappe.db.sql("""
        UPDATE `tabRestaurant`
        SET total_ai_generations = COALESCE(total_ai_generations, 0) + 1,
            total_ai_cost = COALESCE(total_ai_cost, 0) + %s
        WHERE name = %s
    """, (cost_inr, restaurant))
    frappe.db.commit()
    return new_balance


def refund_credits_for_failed_enhancement(restaurant, generation_id, credits):
    """
    Refunds credits to a restaurant when an AI generation fails.
    """
    new_balance = _record_transaction(
        restaurant=restaurant,
        txn_type="Refund",
        credits=credits,
        description=f"Refund for failed AI generation {generation_id}",
        generation_id=generation_id,
    )

    # Revert metrics (optional, but keep it consistent)
    cost_inr = credits * INR_PER_CREDIT
    frappe.db.sql("""
        UPDATE `tabRestaurant`
        SET total_ai_generations = GREATEST(0, COALESCE(total_ai_generations, 0) - 1),
            total_ai_cost = GREATEST(0, COALESCE(total_ai_cost, 0) - %s)
        WHERE name = %s
    """, (cost_inr, restaurant))
    frappe.db.commit()
    return new_balance


def initialize_free_credits(restaurant):
    """
    Give FREE_CREDITS_ON_SIGNUP free credits to a new restaurant.
    Safe to call multiple times (idempotent).
    """
    existing = frappe.db.count("AI Credit Transaction", {
        "restaurant": restaurant,
        "transaction_type": "Free Credits",
    })
    if not existing:
        _record_transaction(
            restaurant=restaurant,
            txn_type="Free Credits",
            credits=FREE_CREDITS_ON_SIGNUP,
            description=f"Welcome! {FREE_CREDITS_ON_SIGNUP} free AI credits to get started.",
        )

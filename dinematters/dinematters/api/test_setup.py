import frappe

@frappe.whitelist()
def setup_loyalty_for_unvind():
    restaurant_id = "unvind"
    
    # 1. Enable Loyalty in Restaurant Config
    if frappe.db.exists("Restaurant Config", {"restaurant": restaurant_id}):
        frappe.db.set_value("Restaurant Config", {"restaurant": restaurant_id}, "enable_loyalty", 1)
    else:
        frappe.get_doc({
            "doctype": "Restaurant Config",
            "restaurant": restaurant_id,
            "enable_loyalty": 1
        }).insert(ignore_permissions=True)
    
    config = {
        "restaurant": restaurant_id,
        "is_active": 1,
        "points_per_inr": 1,
        "coin_value_in_inr": 1,
        "min_redemption_threshold": 10,
        "share_reward_coins": 20,
        "min_unique_opens_for_reward": 2,
        "coins_per_unique_open": 2,
        "max_opens_rewarded_per_share": 5,
        "referral_order_reward_coins": 100,
        "new_user_welcome_reward_coins": 50,
        "welcome_coupon_discount": 50
    }
    
    if not frappe.db.exists("Restaurant Loyalty Config", {"restaurant": restaurant_id}):
        doc = frappe.get_doc({
            "doctype": "Restaurant Loyalty Config",
            **config
        })
        doc.insert(ignore_permissions=True)
    else:
        name = frappe.db.get_value("Restaurant Loyalty Config", {"restaurant": restaurant_id}, "name")
        doc = frappe.get_doc("Restaurant Loyalty Config", name)
        doc.update(config)
        doc.save(ignore_permissions=True)
    
    frappe.db.commit()
    return "Loyalty set up for unvind"

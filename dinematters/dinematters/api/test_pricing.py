import frappe
from dinematters.dinematters.tasks.subscription_tasks import process_daily_subscription_floors
from frappe.utils import getdate, now_datetime, add_days

def test_it():
    print("--- 🚀 STARTING SUBSCRIPTION E2E TESTING ---")
    
    # 1. SETUP MOCK DATA
    product_id_search = "test-e2e-product"
    
    # Needs a parent restaurant for the product
    temp_res_name = "test-temp-res"
    if not frappe.db.exists("Restaurant", temp_res_name):
        frappe.get_doc({
            "doctype": "Restaurant",
            "restaurant_id": temp_res_name,
            "restaurant_name": "Temp Restaurant",
            "plan_type": "LITE",
            "is_active": 1
        }).insert(ignore_permissions=True)

    existing_product = frappe.db.get_value("Menu Product", {"product_id": product_id_search}, "name")
    if not existing_product:
        p = frappe.get_doc({
            "doctype": "Menu Product",
            "restaurant": temp_res_name,
            "product_name": "Test Product",
            "product_id": product_id_search,
            "price": 1000.0,
            "calories": 0,
            "is_vegetarian": 0,
            "is_active": 1
        }).insert(ignore_permissions=True)
        product_link = p.name
    else:
        product_link = existing_product

    pro_name = "test-pro-res-e2e"
    if not frappe.db.exists("Restaurant", pro_name):
        pro_res = frappe.get_doc({
            "doctype": "Restaurant",
            "restaurant_id": pro_name,
            "restaurant_name": "Test Pro Restaurant E2E",
            "plan_type": "PRO",
            "is_active": 1,
            "coins_balance": 5000,
            "timezone": "UTC",
            "monthly_minimum": 999,
            "tax_rate": 0.0
        }).insert(ignore_permissions=True)
    else:
        frappe.db.set_value("Restaurant", pro_name, {"plan_type": "PRO", "coins_balance": 5000, "monthly_minimum": 999, "tax_rate": 0.0})
    
    lux_name = "test-lux-res-e2e"
    if not frappe.db.exists("Restaurant", lux_name):
        lux_res = frappe.get_doc({
            "doctype": "Restaurant",
            "restaurant_id": lux_name,
            "restaurant_name": "Test Lux Restaurant E2E",
            "plan_type": "LUX",
            "is_active": 1,
            "coins_balance": 5000,
            "timezone": "UTC",
            "monthly_minimum": 1299,
            "tax_rate": 0.0
        }).insert(ignore_permissions=True)
    else:
        frappe.db.set_value("Restaurant", lux_name, {"plan_type": "LUX", "coins_balance": 5000, "monthly_minimum": 1299, "tax_rate": 0.0})

    # Clear today's data to start fresh
    today_start = getdate().strftime("%Y-%m-%d 00:00:00")
    frappe.db.delete("Coin Transaction", {"restaurant": ["in", [pro_name, lux_name]], "creation": [">=", today_start]})
    frappe.db.delete("Order", {"restaurant": ["in", [pro_name, lux_name]], "creation": [">=", today_start]})

    print("\n[SCENARIO 1: LUX ORDER COMMISSION]")
    # Create LUX order for ₹1000. Commission should be ₹15 (1.5%)
    lux_order = frappe.get_doc({
        "doctype": "Order",
        "restaurant": lux_name,
        "order_id": f"TEST-LUX-{frappe.generate_hash(length=8)}",
        "order_number": f"LUX-{frappe.generate_hash(length=4)}",
        "total": 3000.0,
        "subtotal": 3000.0,
        "status": "Accepted",
        "payment_status": "pending",
        "order_items": [{
            "product": product_link,
            "item_name": "Test Item",
            "quantity": 1,
            "unit_price": 3000.0,
            "total_price": 3000.0
        }]
    }).insert(ignore_permissions=True)
    
    # Complete/Bill it to trigger commission
    lux_order.status = "billed"
    lux_order.save() # Triggers on_update -> commission deduction
    
    commission = frappe.db.get_value("Coin Transaction", {
        "restaurant": lux_name,
        "transaction_type": "Commission Deduction",
        "reference_name": lux_order.name
    }, "amount") or 0.0
    
    print(f"LUX Order (₹3000) Commission: ₹{abs(commission)} (Expected: 45.0)")
    assert abs(abs(commission) - 45.0) < 0.01, f"LUX Commission mismatch! Got {abs(commission)}"

    print("\n[SCENARIO 2: PRO ORDER COMMISSION]")
    # Create PRO order for ₹1000. Commission should be ₹0 (Fixed Tier)
    pro_order = frappe.get_doc({
        "doctype": "Order",
        "restaurant": pro_name,
        "order_id": f"TEST-PRO-{frappe.generate_hash(length=8)}",
        "order_number": f"PRO-{frappe.generate_hash(length=4)}",
        "total": 1000.0,
        "subtotal": 1000.0,
        "status": "Accepted",
        "payment_status": "pending",
        "order_items": [{
            "product": product_link,
            "item_name": "Test Item",
            "quantity": 1,
            "unit_price": 1000.0,
            "total_price": 1000.0
        }]
    }).insert(ignore_permissions=True)
    
    pro_order.status = "billed"
    pro_order.save()
    
    pro_comm = frappe.db.get_value("Coin Transaction", {
        "restaurant": pro_name,
        "transaction_type": "Commission Deduction",
        "reference_name": pro_order.name
    }, "amount") or 0.0
    
    print(f"PRO Order (₹1000) Commission: ₹{abs(pro_comm)} (Expected: 0.0)")
    assert abs(pro_comm) < 0.01, f"PRO should not pay order commission! Got {abs(pro_comm)}"

    print("\n[SCENARIO 3: DAILY FLOOR RECOVERY]")
    # LUX has paid ₹15 commission. Daily target is ₹43.30 (1299/30). 
    # Floor Recovery should be 43.30 - 15.00 = 28.30
    # PRO daily target is flat ₹33.30 (999/30). 
    
    process_daily_subscription_floors()
    
    lux_floor = frappe.db.get_value("Coin Transaction", {
        "restaurant": lux_name,
        "transaction_type": "Daily LUX Floor"
    }, "amount") or 0.0
    
    pro_floor = frappe.db.get_value("Coin Transaction", {
        "restaurant": pro_name,
        "transaction_type": "Daily PRO Subscription"
    }, "amount") or 0.0
    
    print(f"LUX Floor Recovery: ₹{abs(lux_floor)} (Expected: 0.0)")
    print(f"PRO Fixed Fee: ₹{abs(pro_floor)} (Expected: 33.30)")
    
    assert abs(lux_floor) < 0.01, f"LUX Floor calculation wrong! Got {lux_floor}"
    assert abs(abs(pro_floor) - 33.30) < 0.01, f"PRO Flat fee calculation wrong! Got {pro_floor}"

    print("\n[SCENARIO 4: DYNAMIC SETTINGS TEST]")
    # Change global PRO fee to ₹450 (Daily: ₹15)
    settings = frappe.get_single("Dinematters Settings")
    original_pro_fee = settings.pro_monthly_fee
    settings.pro_monthly_fee = 450.0
    settings.save()
    
    # Also update the restaurant record as if an admin just saved it (triggering the new controller logic)
    res_pro = frappe.get_doc("Restaurant", pro_name)
    res_pro.plan_type = "LITE" # Change and then change back to trigger validate_plan_change
    res_pro.save()
    res_pro.plan_type = "PRO"
    res_pro.save()
    
    # Clear previous PRO floor for today
    frappe.db.delete("Coin Transaction", {"restaurant": pro_name, "transaction_type": "Daily PRO Subscription", "creation": [">=", today_start]})
    
    # Process again
    process_daily_subscription_floors()
    
    new_pro_floor = frappe.db.get_value("Coin Transaction", {
        "restaurant": pro_name,
        "transaction_type": "Daily PRO Subscription",
        "creation": [">=", today_start]
    }, "amount") or 0.0
    
    print(f"New PRO Fixed Fee (after settings change to ₹450): ₹{abs(new_pro_floor)} (Expected: 15.0)")
    assert abs(abs(new_pro_floor) - 15.0) < 0.01, f"Dynamic PRO fee failed! Got {abs(new_pro_floor)}"

    # RESTORE ORIGINAL SETTINGS (though we rollback eventually, it's good practice)
    settings.pro_monthly_fee = original_pro_fee
    settings.save()

    print("\n✅ ALL DYNAMIC SUBSCRIPTION E2E TESTS PASSED!")
    frappe.db.rollback() 

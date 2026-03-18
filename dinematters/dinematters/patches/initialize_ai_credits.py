"""
Patch: Initialize 30 free AI credits for all existing restaurants that haven't received them yet.
Run with: bench --site <site> run-patch dinematters.dinematters.patches.initialize_ai_credits.execute
"""
import frappe


def execute():
    restaurants = frappe.get_all("Restaurant", pluck="name")
    total = 0
    for r in restaurants:
        existing = frappe.db.count("AI Credit Transaction", {
            "restaurant": r,
            "transaction_type": "Free Credits",
        })
        if not existing:
            from dinematters.dinematters.api.ai_billing import initialize_free_credits
            initialize_free_credits(r)
            total += 1
            print(f"  ✓ Initialized free credits for {r}")
    print(f"Done. Gave free credits to {total} restaurant(s).")

"""
Patch: Initialize 30 free AI credits for all existing restaurants that haven't received them yet.
Run with: bench --site <site> run-patch dinematters.dinematters.patches.initialize_ai_credits.execute
"""
import frappe


def execute():
    restaurants = frappe.get_all("Restaurant", pluck="name")
    total = 0
    for r in restaurants:
        from dinematters.dinematters.api.coin_billing import initialize_free_coins
        if initialize_free_coins(r):
            total += 1
            print(f"  ✓ Initialized free coins for {r}")
    print(f"Done. Gave free coins to {total} restaurant(s).")

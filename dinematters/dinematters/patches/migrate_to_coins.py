import frappe

def execute():
	"""
	One-time migration:
	1. Map ai_credits (₹2 value) to coins_balance (₹1 value) by multiplying by 2.
	2. Initialize coins_balance for all restaurants.
	"""
	frappe.reload_doc("dinematters", "doctype", "restaurant")
	frappe.reload_doc("dinematters", "doctype", "coin_transaction")

	restaurants = frappe.get_all("Restaurant", fields=["name", "ai_credits", "coins_balance"])
	
	for res in restaurants:
		# If coins_balance is already set (non-zero), skip to avoid double migration
		if res.coins_balance:
			continue
			
		ai_credits = res.ai_credits or 0
		if ai_credits > 0:
			new_coins = float(ai_credits) * 2.0
			frappe.db.set_value("Restaurant", res.name, "coins_balance", new_coins)
			
			# Create a migration transaction log
			txn = frappe.get_doc({
				"doctype": "Coin Transaction",
				"restaurant": res.name,
				"transaction_type": "Admin Adjustment",
				"amount": new_coins,
				"balance_after": new_coins,
				"description": f"Initial migration from AI Credits ({ai_credits} credits * 2 = {new_coins} coins)"
			})
			txn.insert(ignore_permissions=True)
	
	frappe.db.commit()

import frappe
from frappe import _
from frappe.utils import flt, cint, today

def is_loyalty_enabled(restaurant):
	"""Check if loyalty is enabled for a restaurant."""
	if not restaurant:
		return False
	return frappe.db.get_value("Restaurant", restaurant, "enable_loyalty")

def get_loyalty_balance(customer, restaurant):
	"""
	Calculate current loyalty coin balance for a customer at a restaurant.
	"""
	if not customer or not restaurant:
		return 0
		
	entries = frappe.get_all(
		"Restaurant Loyalty Entry",
		filters={"customer": customer, "restaurant": restaurant},
		fields=["transaction_type", "coins"]
	)
	
	balance = 0
	for entry in entries:
		if entry.transaction_type == "Earn":
			balance += entry.coins
		else:
			balance -= entry.coins
	return max(0, balance)  # Never return negative balance

def redeem_loyalty_coins(customer, restaurant, coins, reason="Redemption", ref_doctype=None, ref_name=None):
	"""
	Deduct coins from customer's loyalty balance.
	Returns the created entry document or None.
	"""
	if not customer or not restaurant or not coins or coins <= 0:
		return None
	
	# Verify balance
	if not is_loyalty_enabled(restaurant):
		return None
		
	balance = get_loyalty_balance(customer, restaurant)
	if coins > balance:
		coins = balance
		
	if coins <= 0:
		return None

	entry = frappe.get_doc({
		"doctype": "Restaurant Loyalty Entry",
		"customer": customer,
		"restaurant": restaurant,
		"coins": int(coins),
		"transaction_type": "Redeem",
		"reason": reason,
		"reference_doctype": ref_doctype,
		"reference_name": ref_name,
		"posting_date": today()
	})
	entry.insert(ignore_permissions=True)
	# We don't commit here to allow the caller to manage the transaction
	return entry

def earn_loyalty_coins(customer, restaurant, amount_paid, reason="Order", ref_doctype=None, ref_name=None):
	"""
	Calculate and credit 10% loyalty coins based on the final paid price.
	Returns the number of coins earned.
	"""
	if not customer or not restaurant or not amount_paid or amount_paid <= 0:
		return 0
	
	if not is_loyalty_enabled(restaurant):
		return 0
	
	# User requirement: 10% coins based on final paid price
	coins_earned = int(flt(amount_paid) * 0.1)
	
	if coins_earned <= 0:
		return 0
		
	entry = frappe.get_doc({
		"doctype": "Restaurant Loyalty Entry",
		"customer": customer,
		"restaurant": restaurant,
		"coins": coins_earned,
		"transaction_type": "Earn",
		"reason": reason,
		"reference_doctype": ref_doctype,
		"reference_name": ref_name,
		"posting_date": today()
	})
	entry.insert(ignore_permissions=True)
	# We don't commit here to allow the caller to manage the transaction
	
	# Update Order doc if reference is an Order
	if ref_doctype == "Order" and ref_name:
		frappe.db.set_value("Order", ref_name, "coins_earned", coins_earned)
		
	return coins_earned

def add_loyalty_coins(customer, restaurant, coins, reason, ref_doctype=None, ref_name=None):
	"""
	General purpose function to add loyalty coins (fixed amount).
	"""
	if not customer or not restaurant or not coins or coins <= 0:
		return 0
		
	if not is_loyalty_enabled(restaurant):
		return 0
		
	entry = frappe.get_doc({
		"doctype": "Restaurant Loyalty Entry",
		"customer": customer,
		"restaurant": restaurant,
		"coins": int(coins),
		"transaction_type": "Earn",
		"reason": reason,
		"reference_doctype": ref_doctype,
		"reference_name": ref_name,
		"posting_date": today()
	})
	entry.insert(ignore_permissions=True)
	
	# Update Order doc if reference is an Order
	if ref_doctype == "Order" and ref_name:
		current_coins = frappe.db.get_value("Order", ref_name, "coins_earned") or 0
		frappe.db.set_value("Order", ref_name, "coins_earned", current_coins + int(coins))
		
	return int(coins)


def handle_order_cancellation(doc, method=None):
	"""
	Hook function for Order on_update.
	If status changes to 'cancelled', refund redeemed points and revert earned points.
	Uses idempotency checks based on specific reasons.
	"""
	if doc.status != 'cancelled':
		return
	
	# Only proceed if status JUST changed to cancelled (optional but safer)
	# For now, idempotency check on entry reasons is enough to handle repeated calls
	
	if not doc.platform_customer or not doc.restaurant:
		return

	# 1. Refund Redeemed Coins
	if doc.loyalty_coins_redeemed > 0:
		# Idempotency: check if refund already exists for this order
		already_refunded = frappe.db.exists("Restaurant Loyalty Entry", {
			"customer": doc.platform_customer,
			"restaurant": doc.restaurant,
			"reference_doctype": "Order",
			"reference_name": doc.name,
			"reason": "Cancellation Refund"
		})
		if not already_refunded:
			# Create the entry manually to be 100% safe (avoiding add_loyalty_coins side effects on current doc)
			entry = frappe.get_doc({
				"doctype": "Restaurant Loyalty Entry",
				"customer": doc.platform_customer,
				"restaurant": doc.restaurant,
				"coins": int(doc.loyalty_coins_redeemed or 0),
				"transaction_type": "Earn",
				"reason": "Cancellation Refund",
				"reference_doctype": "Order",
				"reference_name": doc.name,
				"posting_date": today()
			})
			entry.insert(ignore_permissions=True)
			# frappe.log_error(f"Loyalty REFUNDED {doc.loyalty_coins_redeemed} for cancelled order {doc.name}", "Loyalty")

	# 2. Revert Earned Coins
	if doc.coins_earned > 0:
		# Idempotency: check if revert already exists
		already_reverted = frappe.db.exists("Restaurant Loyalty Entry", {
			"customer": doc.platform_customer,
			"restaurant": doc.restaurant,
			"reference_doctype": "Order",
			"reference_name": doc.name,
			"reason": "Cancellation Revert"
		})
		if not already_reverted:
			redeem_loyalty_coins(
				customer=doc.platform_customer,
				restaurant=doc.restaurant,
				coins=doc.coins_earned,
				reason="Cancellation Revert",
				ref_doctype="Order",
				ref_name=doc.name
			)
			# frappe.log_error(f"Loyalty REVERTED {doc.coins_earned} for cancelled order {doc.name}", "Loyalty")

	# Final cleanup of the order doc fields via DB
	if doc.coins_earned > 0:
		frappe.db.set_value("Order", doc.name, "coins_earned", 0)


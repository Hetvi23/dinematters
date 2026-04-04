import frappe
from frappe.utils import flt, cint
from dinematters.dinematters.api.coupons import get_coupon_details
from dinematters.dinematters.utils.loyalty import get_loyalty_balance, is_loyalty_enabled

def calculate_cart_totals(restaurant, items, coupon_code=None, loyalty_coins=0, customer=None, delivery_type="Dine-in"):
	"""
	Authoritative pricing calculation engine.
	restaurant: Restaurant ID or name
	items: List of objects with {price, quantity, dishId}
	coupon_code: Optional coupon code to apply
	loyalty_coins: Optional number of loyalty coins to redeem
	customer: Optional Customer ID (for loyalty and coupon limits)
	delivery_type: Optional (Dine-in, Takeaway, Delivery)
	"""
	
	# 1. Calculate Subtotal
	subtotal = 0
	for item in items:
		qty = cint(item.get("quantity") or 1)
		price = flt(item.get("unitPrice") or item.get("price") or 0)
		subtotal += qty * price
	
	# 2. Apply Coupon
	discount_amount = 0
	applied_coupon = None
	if coupon_code:
		coupon_res = get_coupon_details(
			restaurant=restaurant,
			coupon_code=coupon_code,
			cart_total=subtotal,
			customer_id=customer,
			cart_items=items
		)
		if coupon_res.get("success"):
			discount_amount = flt(coupon_res.get("discount_amount"))
			applied_coupon = coupon_res.get("coupon_code")
	
	# 3. Apply Loyalty Discount (₹1 per coin)
	loyalty_discount = 0
	if loyalty_coins > 0 and customer and is_loyalty_enabled(restaurant):
		balance = get_loyalty_balance(customer, restaurant)
		actual_coins = min(cint(loyalty_coins), balance)
		
		# Loyalty is usually applied after coupons
		# Ensure we don't exceed remaining total
		remaining = subtotal - discount_amount
		loyalty_discount = min(flt(actual_coins), max(0, remaining))
	
	# 4. Calculate Tax (on Subtotal - Item/Coupon Discounts)
	# Loyalty is usually a "payment method" discount, but in many F&B systems 
	# tax is calculated on the amount BEFORE loyalty redemption.
	tax_rate_val = frappe.db.get_value("Restaurant", restaurant, "tax_rate")
	tax_rate = flt(tax_rate_val if tax_rate_val is not None else 5.0)
	taxable_amount = max(0, subtotal - discount_amount)
	tax_amount = round(taxable_amount * (tax_rate / 100.0), 2)
	
	cgst = round(tax_amount / 2.0, 2)
	sgst = round(tax_amount - cgst, 2)
	
	# 5. Delivery and Packaging Fees
	delivery_fee = 0
	packaging_fee = 0
	if delivery_type == "Delivery":
		delivery_fee = flt(frappe.db.get_value("Restaurant", restaurant, "default_delivery_fee") or 0)
		packaging_fee = flt(frappe.db.get_value("Restaurant", restaurant, "default_packaging_fee") or 0)
	elif delivery_type == "Takeaway":
		packaging_fee = flt(frappe.db.get_value("Restaurant", restaurant, "default_packaging_fee") or 0)

	# 6. Final Total
	# Total = (Subtotal - Discount) + Tax + Fees - Loyalty
	total = taxable_amount + tax_amount + delivery_fee + packaging_fee - loyalty_discount
	
	# 7. Generate Bill Details (for frontend modular rendering)
	bill_details = [
		{"label": "Item Total", "value": subtotal, "type": "subtotal"}
	]
	if discount_amount > 0:
		bill_details.append({"label": "Item Discount", "value": -discount_amount, "type": "discount"})
	
	if loyalty_discount > 0:
		bill_details.append({"label": "Loyalty Discount", "value": -loyalty_discount, "type": "discount"})
	
	if cgst > 0:
		bill_details.append({"label": f"CGST ({tax_rate/2}%)", "value": cgst, "type": "tax"})
	if sgst > 0:
		bill_details.append({"label": f"SGST ({tax_rate/2}%)", "value": sgst, "type": "tax"})
	
	if packaging_fee > 0:
		bill_details.append({"label": "Packaging Charge", "value": packaging_fee, "type": "fee"})
	if delivery_fee > 0:
		bill_details.append({"label": "Delivery Fee", "value": delivery_fee, "type": "fee"})
	
	bill_details.append({"label": "Total Payable", "value": max(0, total), "type": "total"})

	# 8. Currency Info
	from dinematters.dinematters.utils.currency_helpers import get_restaurant_currency_info
	currency_info = get_restaurant_currency_info(restaurant)
	
	return {
		"subtotal": subtotal,
		"discount": discount_amount,
		"appliedCoupon": applied_coupon,
		"loyaltyDiscount": loyalty_discount,
		"tax": tax_amount,
		"cgst": cgst,
		"sgst": sgst,
		"taxRate": tax_rate,
		"deliveryFee": delivery_fee,
		"packagingFee": packaging_fee,
		"total": total,
		"payableAmount": max(0, total),
		"billDetails": bill_details,
		"currency": currency_info.get("currency", "INR"),
		"currencySymbol": currency_info.get("symbol", "₹"),
		"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
	}

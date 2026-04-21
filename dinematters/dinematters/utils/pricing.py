import frappe
from frappe.utils import flt, cint
from dinematters.dinematters.api.coupons import get_coupon_details
from dinematters.dinematters.utils.loyalty import get_loyalty_balance, is_loyalty_enabled
from dinematters.dinematters.utils.geoutils import calculate_distance, estimate_road_distance

def calculate_cart_totals(restaurant, items, coupon_code=None, loyalty_coins=0, customer=None, delivery_type="Dine-in", latitude=None, longitude=None):
	"""
	Authoritative pricing calculation engine.
	restaurant: Restaurant ID or name
	items: List of objects with {price, quantity, dishId}
	coupon_code: Optional coupon code to apply
	loyalty_coins: Optional number of loyalty coins to redeem
	customer: Optional Customer ID (for loyalty and coupon limits)
	delivery_type: Optional (Dine-in, Takeaway, Delivery)
	latitude: Latitude of delivery location
	longitude: Longitude of delivery location
	"""
    
	# 0. Global Context
	restaurant_doc = frappe.get_doc("Restaurant", restaurant)
	max_dist = flt(restaurant_doc.max_delivery_distance or 10.0)
	serviceable = True
	road_distance = 0
	distance_error = None
	
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
	delivery_details = {}

	if delivery_type == "Delivery":
		# A. Distance Check & Serviceability
		# Logic: Use explicitly passed lat/lng or extract from items metadata
		cust_lat = latitude or (items[0].get("delivery_location", {}).get("latitude") if items else None)
		cust_lng = longitude or (items[0].get("delivery_location", {}).get("longitude") if items else None)

		if cust_lat is not None and cust_lng is not None and restaurant_doc.latitude is not None and restaurant_doc.longitude is not None:
			straight_dist = calculate_distance(restaurant_doc.latitude, restaurant_doc.longitude, cust_lat, cust_lng)
			road_distance = round(estimate_road_distance(straight_dist), 2)
			
			if road_distance > max_dist:
				serviceable = False
				distance_error = f"Location is {road_distance}km away. Max delivery distance is {max_dist}km."

		# B. Dynamic Delivery Fee Calculation
		# If we have location and is serviceable, try to get a real quote
		if serviceable and cust_lat and cust_lng:
			from dinematters.dinematters.logistics.manager import LogisticsManager
			try:
				manager = LogisticsManager(restaurant)
				quote_res = manager.get_quote({
					"address": items[0].get("delivery_location", {}).get("address") if items else None,
					"latitude": cust_lat,
					"longitude": cust_lng,
					"items": items,
					"total": subtotal
				})
				if quote_res.get("success"):
					delivery_fee = flt(quote_res.get("delivery_fee"))
					delivery_details = quote_res
				else:
					# Fallback to default
					delivery_fee = flt(restaurant_doc.default_delivery_fee or 0)
			except Exception:
				delivery_fee = flt(restaurant_doc.default_delivery_fee or 0)
		else:
			# No location provided or not serviceable, use static default if serviceable, else 0
			delivery_fee = flt(restaurant_doc.default_delivery_fee or 0) if serviceable else 0
			
		packaging_fee_val = flt(restaurant_doc.default_packaging_fee or 0)
		if restaurant_doc.packaging_fee_type == "Percentage":
			packaging_fee = round(subtotal * (packaging_fee_val / 100.0), 2)
		else:
			packaging_fee = packaging_fee_val
	elif delivery_type == "Takeaway":
		packaging_fee_val = flt(restaurant_doc.default_packaging_fee or 0)
		if restaurant_doc.packaging_fee_type == "Percentage":
			packaging_fee = round(subtotal * (packaging_fee_val / 100.0), 2)
		else:
			packaging_fee = packaging_fee_val

	# 6. Final Total
	# Total = (Subtotal - Discount) + Tax + Fees - Loyalty
	total = taxable_amount + tax_amount + delivery_fee + packaging_fee - loyalty_discount
	
	# 7. Generate Bill Details
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
		# User Request: Rename to "Packaging and Extra Charges"
		bill_details.append({"label": "Packaging and Extra Charges", "value": packaging_fee, "type": "fee"})
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
		"deliveryDetails": delivery_details, # New: tracking markup and platform fee
		"packagingFee": packaging_fee,
		"total": total,
		"payableAmount": max(0, total),
		"serviceable": serviceable,
		"distance": road_distance,
		"distanceError": distance_error,
		"billDetails": bill_details,
		"currency": currency_info.get("currency", "INR"),
		"currencySymbol": currency_info.get("symbol", "₹"),
		"currencySymbolOnRight": currency_info.get("symbolOnRight", False)
	}

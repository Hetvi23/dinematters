"""
Razorpay Payment Integration API endpoints for Dinematters
"""

import frappe
import razorpay
import json
import math
from frappe import _
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api


def get_razorpay_client(restaurant_id=None):
	"""Get Razorpay client.
	If restaurant_id provided and that Restaurant has merchant credentials set, use them.
	Otherwise fall back to site-level Razorpay keys from site_config / env."""
	key_id = None
	key_secret = None

	if restaurant_id:
		try:
			rest = frappe.get_doc("Restaurant", restaurant_id)
			key_id = rest.get("razorpay_merchant_key_id")
			key_secret = rest.get("razorpay_merchant_key_secret")
		except Exception:
			# ignore and fallback to site keys
			key_id = None
			key_secret = None

	if not key_id or not key_secret:
		key_id = frappe.conf.get("razorpay_key_id") or frappe.get_conf().get("razorpay_key_id")
		key_secret = frappe.conf.get("razorpay_key_secret") or frappe.get_conf().get("razorpay_key_secret")

	if not key_id or not key_secret:
		frappe.throw(_("Razorpay API keys not configured"))

	return razorpay.Client(auth=(key_id, key_secret))


@frappe.whitelist(allow_guest=True)
def create_linked_account(*args, **kwargs):
	"""Legacy Route linked-account functionality removed.
	This endpoint is deprecated and intentionally disabled in the SaaS billing implementation.
	"""
	return {"success": False, "error": "create_linked_account is deprecated in SaaS billing mode"}


@frappe.whitelist(allow_guest=True)
def create_payment_order(restaurant_id, order_items, total_amount, customer_name=None, customer_email=None, customer_phone=None, table_number=None):
	"""Create a Razorpay order for customer payment (SaaS model: no Route/transfers)."""
	try:
		_restaurant_name = validate_restaurant_for_api(restaurant_id)
		restaurant = frappe.get_doc("Restaurant", _restaurant_name)

		# Parse order items if string
		if isinstance(order_items, str):
			order_items = json.loads(order_items)

		# Convert total_amount to paise (integer)
		total_amount_paise = int(float(total_amount) * 100)

		# Calculate platform fee (1.5% by default) for ledgering purposes
		platform_fee_percent = restaurant.platform_fee_percent or 1.5
		platform_fee_paise = int(math.floor(total_amount_paise * platform_fee_percent / 100))

		# Create order in ERPNext first
		order_doc = frappe.get_doc({
			"doctype": "Order",
			"restaurant": restaurant_id,
			"order_id": frappe.generate_hash(length=10),
			"order_number": frappe.generate_hash(length=8),
			"customer_name": customer_name,
			"customer_email": customer_email,
			"customer_phone": customer_phone,
			"table_number": table_number,
			"subtotal": total_amount,
			"total": total_amount,
			"status": "pending",
			"payment_status": "pending",
			"payment_method": "online",
			"platform_fee_amount": platform_fee_paise,
			"order_items": []
		})

		# Add order items
		for item in order_items:
			order_doc.append("order_items", {
				"product": item.get("product_id"),
				"quantity": item.get("quantity", 1),
				"unit_price": float(item.get("rate", 0)),
				"original_price": float(item.get("rate", 0)),
				"total_price": float(item.get("amount", 0))
			})

		# When called from guest/frontend (no session), allow creating order without permissions.
		try:
			if frappe.session.user == "Guest":
				order_doc.insert(ignore_permissions=True)
			else:
				order_doc.insert()
		except Exception:
			# fallback to ignore_permissions
			order_doc.insert(ignore_permissions=True)

		# Create Razorpay order (standard, no transfers)
		# Prefer restaurant-specific merchant keys if configured (so customers pay the merchant)
		client = get_razorpay_client(restaurant_id)
		razorpay_order_data = {
			"amount": total_amount_paise,
			"currency": "INR",
			"payment_capture": 1,
			"notes": {
				"order_id": order_doc.name,
				"restaurant_id": restaurant_id,
				"platform_fee": platform_fee_paise
			}
		}

		razorpay_order = client.order.create(razorpay_order_data)

		# Update order with Razorpay order ID
		order_doc.razorpay_order_id = razorpay_order["id"]
		order_doc.save()

		# Get public key for frontend
		key_id = frappe.conf.get("razorpay_key_id") or frappe.get_conf().get("razorpay_key_id")

		return {
			"success": True,
			"data": {
				"razorpay_order_id": razorpay_order["id"],
				"amount": total_amount_paise,
				"currency": "INR",
				"key_id": key_id,
				"order_id": order_doc.name,
				"platform_fee": platform_fee_paise
			}
		}
	except Exception as e:
		frappe.log_error(f"Razorpay order creation failed: {str(e)}", "razorpay.create_payment_order")
		return {
			"success": False,
			"error": str(e)
		}


@frappe.whitelist(allow_guest=True)
def verify_payment(razorpay_order_id, razorpay_payment_id, razorpay_signature):
	"""Verify payment signature (optional - webhooks are authoritative)"""
	try:
		client = get_razorpay_client()
		
		# Verify signature
		params_dict = {
			'razorpay_order_id': razorpay_order_id,
			'razorpay_payment_id': razorpay_payment_id,
			'razorpay_signature': razorpay_signature
		}
		
		client.utility.verify_payment_signature(params_dict)
		
		# Find order by Razorpay order ID
		order = frappe.get_doc("Order", {"razorpay_order_id": razorpay_order_id})
		
		if order:
			# Update payment details (webhook will be authoritative)
			order.razorpay_payment_id = razorpay_payment_id
			order.transaction_id = razorpay_payment_id
			order.save()
		
		return {
			"success": True,
			"data": {
				"verified": True,
				"order_id": order.name if order else None
			}
		}
		
	except Exception as e:
		frappe.log_error(f"Payment verification failed: {str(e)}", "razorpay.verify_payment")
		return {
			"success": False,
			"error": "Payment verification failed"
		}


@frappe.whitelist(allow_guest=True)
def get_restaurant_payment_stats(restaurant_id):
	"""Get payment statistics for a restaurant"""
	try:
		# Validate restaurant (returns restaurant doc name), then fetch doc
		_restaurant_name = validate_restaurant_for_api(restaurant_id)
		restaurant = frappe.get_doc("Restaurant", _restaurant_name)
		
		# Get current month stats
		from datetime import datetime
		current_month = datetime.now().strftime("%Y-%m")
		
		# Get total orders and revenue for current month
		orders = frappe.db.sql("""
			SELECT 
				COUNT(*) as total_orders,
				SUM(total) as total_revenue,
				SUM(platform_fee_amount) as total_platform_fee
			FROM `tabOrder`
			WHERE restaurant = %s 
			AND payment_status = 'completed'
			AND DATE_FORMAT(creation, '%%Y-%%m') = %s
		""", (restaurant_id, current_month), as_dict=True)
		
		stats = orders[0] if orders else {
			"total_orders": 0,
			"total_revenue": 0,
			"total_platform_fee": 0
		}
		
		# Get monthly minimum info (ensure numeric values)
		monthly_minimum = float(restaurant.monthly_minimum or 999)
		platform_fee_collected = (stats["total_platform_fee"] or 0) / 100.0  # Convert from paise to rupees
		minimum_due = max(0, monthly_minimum - platform_fee_collected)
		
		return {
			"success": True,
			"data": {
				"current_month": current_month,
				"total_orders": stats["total_orders"],
				"total_revenue": stats["total_revenue"],
				"platform_fee_collected": platform_fee_collected,
				"monthly_minimum": monthly_minimum,
				"minimum_due": minimum_due,
				"razorpay_customer_id": restaurant.razorpay_customer_id,
				"billing_status": restaurant.billing_status,
				"razorpay_keys_updated_at": getattr(restaurant, "razorpay_keys_updated_at", None),
				"razorpay_keys_updated_by": getattr(restaurant, "razorpay_keys_updated_by", None),
				"merchant_key_configured": bool(getattr(restaurant, "razorpay_merchant_key_id", None))
			}
		}
		
	except Exception as e:
		frappe.log_error(f"Payment stats fetch failed: {str(e)}", "razorpay.get_payment_stats")
		return {
			"success": False,
			"error": str(e)
		}



@frappe.whitelist()
def create_razorpay_customer_and_token(restaurant_id, customer_name, customer_email, token_id=None):
	"""Create a Razorpay customer record and optionally store a token id for recurring charges."""
	try:
		_restaurant_name = validate_restaurant_for_api(restaurant_id)
		restaurant = frappe.get_doc("Restaurant", _restaurant_name)

		client = get_razorpay_client()

		# Create customer on Razorpay if not exists
		if not restaurant.razorpay_customer_id:
			customer_payload = {
				"name": customer_name,
				"email": customer_email,
				"contact": restaurant.owner_phone or customer_email,
				"notes": {"restaurant": restaurant_id}
			}
			customer = client.customer.create(customer_payload)
			restaurant.razorpay_customer_id = customer.get("id")

		# If a token_id was provided (from frontend tokenization), store it
		if token_id:
			restaurant.razorpay_token_id = token_id
			restaurant.mandate_status = "active"

		restaurant.billing_status = restaurant.billing_status or "active"
		restaurant.save()

		return {"success": True, "customer_id": restaurant.razorpay_customer_id, "token_id": restaurant.razorpay_token_id}
	except Exception as e:
		frappe.log_error(f"Failed to create Razorpay customer/token: {str(e)}", "razorpay.create_customer_token")
		return {"success": False, "error": str(e)}

@frappe.whitelist()
def set_restaurant_razorpay_keys(restaurant_id, key_id, key_secret):
	"""Set per-restaurant Razorpay merchant credentials. Admin-only."""
	try:
		# Only allow System Managers
		roles = frappe.get_roles(frappe.session.user)
		if 'System Manager' not in roles and 'Administrator' not in roles:
			frappe.throw(_("Not permitted"), frappe.PermissionError)

		_restaurant_name = validate_restaurant_for_api(restaurant_id)
		restaurant = frappe.get_doc("Restaurant", _restaurant_name)
		restaurant.razorpay_merchant_key_id = key_id
		restaurant.razorpay_merchant_key_secret = key_secret
		# optional webhook secret
		webhook_secret = frappe.local.form_dict.get('webhook_secret') if hasattr(frappe.local, 'form_dict') else None
		if webhook_secret:
			restaurant.razorpay_webhook_secret = webhook_secret
		# Audit: record who updated keys and when
		try:
			restaurant.razorpay_keys_updated_at = frappe.utils.now_datetime()
			restaurant.razorpay_keys_updated_by = frappe.session.user
		except Exception:
			# ignore if fields missing
			pass
		restaurant.save()
		return {"success": True}
	except Exception as e:
		frappe.log_error(f"Failed to set restaurant razorpay keys: {str(e)}", "razorpay.set_keys")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def can_set_merchant_keys():
	"""Return whether current user can set merchant keys (System Manager or Administrator)."""
	try:
		user = frappe.session.user
		roles = frappe.get_roles(user)
		allowed = 'System Manager' in roles or 'Administrator' in roles
		return {"success": True, "allowed": allowed, "user": user, "roles": roles}
	except Exception as e:
		return {"success": False, "error": str(e)}

@frappe.whitelist(allow_guest=True)
def create_tokenization_order(restaurant_id, amount=1, customer_name=None, customer_email=None):
	"""Create a small Razorpay order to tokenize a merchant card (dev/prod tokenization via Checkout).
	   This creates an Order doc and a Razorpay order; webhook will capture token/customer info."""
	try:
		_restaurant_name = validate_restaurant_for_api(restaurant_id)
		restaurant = frappe.get_doc("Restaurant", _restaurant_name)

		# Create a TokenizationAttempt doc (separate from regular Orders)
		amount_paise = int(float(amount) * 100)
		attempt_doc = frappe.get_doc({
			"doctype": "Tokenization Attempt",
			"restaurant": restaurant_id,
			"order_ref": None,
			"amount": amount_paise,
			"currency": "INR",
			"status": "pending",
			"notes": json.dumps({"requested_by": frappe.session.user}) if frappe.session and getattr(frappe, "session", None) else None
		})
		attempt_doc.insert(ignore_permissions=True)
		# Persist immediately so downstream webhook processing can find this attempt even if later steps fail
		frappe.db.commit()

		# Create Razorpay order and store mapping to TokenizationAttempt
		client = get_razorpay_client()
		razorpay_order = client.order.create({
			"amount": attempt_doc.amount,
			"currency": "INR",
			"payment_capture": 1,
			"notes": {
				"attempt_id": attempt_doc.name,
				"restaurant_id": restaurant_id,
				"type": "tokenization"
			}
		})

		# Update attempt doc with razorpay_order_id for webhook mapping
		try:
			attempt_doc.razorpay_order_id = razorpay_order.get("id")
			attempt_doc.status = "created"
			attempt_doc.save(ignore_permissions=True)
			frappe.db.commit()
		except Exception:
			# best-effort: leave attempt as-is and log
			frappe.log_error(f"Failed to save razorpay_order_id for attempt {attempt_doc.name}", "razorpay.create_token_order")

		key_id = frappe.conf.get("razorpay_key_id") or frappe.get_conf().get("razorpay_key_id")
		return {
			"success": True,
			"data": {
				"razorpay_order_id": razorpay_order.get("id"),
				"amount": attempt_doc.amount,
				"currency": "INR",
				"key_id": key_id,
				"attempt_doc": attempt_doc.name
			}
		}
	except Exception as e:
		frappe.log_error(f"Failed to create tokenization order: {str(e)}", "razorpay.create_token_order")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def schedule_monthly_billing():
	"""Create Monthly Billing Ledger entries for all restaurants for the current month."""
	try:
		from datetime import datetime
		current_month = datetime.now().strftime("%Y-%m")
		# For each active restaurant, compute GMV and create ledger row if not present
		restaurants = frappe.get_all("Restaurant", filters={"is_active": 1}, fields=["name"])
		created = []
		for r in restaurants:
			if frappe.db.exists("Monthly Billing Ledger", {"restaurant": r.name, "billing_month": current_month}):
				continue
			# Sum completed orders for month
			total = frappe.db.sql("""
				SELECT COALESCE(SUM(total),0) FROM `tabOrder` 
				WHERE restaurant=%s AND payment_status='completed' AND DATE_FORMAT(creation, '%%Y-%%m')=%s
			""", (r.name, current_month))[0][0] or 0
			# Convert to paise
			total_paise = int(float(total) * 100)
			calculated_fee = int(math.floor(total_paise * 0.01))
			min_amt = 999 * 100
			max_amt = 3999 * 100
			final_amount = max(min_amt, min(calculated_fee, max_amt))
			ledger = frappe.get_doc({
				"doctype": "Monthly Billing Ledger",
				"restaurant": r.name,
				"billing_month": current_month,
				"total_gmv": total_paise,
				"calculated_fee": calculated_fee,
				"final_amount": final_amount,
				"payment_status": "pending"
			})
			ledger.insert(ignore_permissions=True)
			created.append(ledger.name)
		return {"success": True, "created": created}
	except Exception as e:
		frappe.log_error(f"Monthly billing scheduler failed: {str(e)}", "razorpay.schedule_billing")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def process_retry_charges():
	"""Process Monthly Billing Ledger entries marked for retry whose next_retry_at is due."""
	try:
		from datetime import datetime
		now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
		ledgers = frappe.get_all("Monthly Billing Ledger", filters={"payment_status": "retry", "next_retry_at": ("<=", now)}, fields=["name"])
		for l in ledgers:
			try:
				charge_monthly_bill(l.name)
			except Exception as e:
				frappe.log_error(f"Retry charge failed for {l.name}: {str(e)}", "razorpay.retry_charge")
		return {"success": True, "processed": len(ledgers)}
	except Exception as e:
		frappe.log_error(f"Retry processor failed: {str(e)}", "razorpay.retry_processor")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def charge_monthly_bill(ledger_name):
	"""Attempt to charge a Monthly Billing Ledger using stored token/customer."""
	try:
		ledger = frappe.get_doc("Monthly Billing Ledger", ledger_name)
		if ledger.payment_status == "paid":
			return {"success": False, "error": "Already paid"}

		restaurant = frappe.get_doc("Restaurant", ledger.restaurant)
		if not restaurant.razorpay_customer_id or not restaurant.razorpay_token_id:
			return {"success": False, "error": "Restaurant missing customer/token"}

		client = get_razorpay_client(restaurant.name)

		# Attempt a charge using stored token. Different razorpay client versions expose different resources
		payment_payload = {
			"amount": int(ledger.final_amount),
			"currency": "INR",
			"customer": restaurant.razorpay_customer_id,
			"token": restaurant.razorpay_token_id,
			"capture": 1,
			"notes": {"ledger": ledger.name}
		}

		payment = None
		try:
			# Preferred: client.payments.create
			if hasattr(client, 'payments') and hasattr(client.payments, 'create'):
				payment = client.payments.create(payment_payload)
			# Fallback: client.payment.create
			elif hasattr(client, 'payment') and hasattr(client.payment, 'create'):
				payment = client.payment.create(payment_payload)
			else:
				# Last resort: try generic request
				payment = client.request('POST', '/payments', payment_payload)
		except Exception as e:
			# mark ledger for retry with exponential backoff
			try:
				retry = (ledger.retry_count or 0) + 1
				frappe.db.set_value("Monthly Billing Ledger", ledger.name, "retry_count", retry)
				# exponential backoff in minutes, cap at 1440 (1 day)
				delay_minutes = min(2 ** retry, 1440)
				from datetime import datetime, timedelta
				next_try = (datetime.now() + timedelta(minutes=delay_minutes)).strftime("%Y-%m-%d %H:%M:%S")
				frappe.db.set_value("Monthly Billing Ledger", ledger.name, "next_retry_at", next_try)
				frappe.db.set_value("Monthly Billing Ledger", ledger.name, "payment_status", "retry")
				frappe.db.commit()
			except Exception:
				pass
			frappe.log_error(f"Charge monthly bill failed: {str(e)}", "razorpay.charge_monthly_bill")
			return {"success": False, "error": str(e)}

		# Record payment id and mark as pending until webhook confirms
		try:
			payment_id = payment.get("id") if isinstance(payment, dict) else None
			frappe.db.set_value("Monthly Billing Ledger", ledger.name, "razorpay_payment_id", payment_id)
			frappe.db.set_value("Monthly Billing Ledger", ledger.name, "payment_status", "pending")
			frappe.db.commit()
			return {"success": True, "payment_id": payment_id}
		except Exception as e:
			frappe.log_error(f"Failed to record charge result: {str(e)}", "razorpay.charge_monthly_bill")
			return {"success": False, "error": str(e)}
	except Exception as e:
		frappe.log_error(f"Charge monthly bill failed: {str(e)}", "razorpay.charge_monthly_bill")
		# mark ledger as failed
		try:
			frappe.db.set_value("Monthly Billing Ledger", ledger_name, "payment_status", "failed")
			frappe.db.commit()
		except Exception:
			pass
		return {"success": False, "error": str(e)}
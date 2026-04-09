"""
Razorpay Webhook Handler for Dinematters
"""

import frappe
import json
import hmac
import hashlib
from frappe import _
from datetime import datetime


def verify_razorpay_signature(body, signature, webhook_secret):
	"""Verify Razorpay webhook signature"""
	if not webhook_secret:
		frappe.throw(_("Razorpay webhook secret not configured"))
	
	generated_signature = hmac.new(
		webhook_secret.encode('utf-8'),
		body,
		hashlib.sha256
	).hexdigest()
	
	return hmac.compare_digest(generated_signature, signature)


@frappe.whitelist(allow_guest=True, methods=["POST"])
def razorpay_webhook():
	"""Handle Razorpay webhook events"""
	try:
		# Get raw request data
		request = frappe.local.request
		body = request.get_data()
		signature = request.headers.get("X-Razorpay-Signature", "")
		
		# Get webhook secret from config
		# Try to identify merchant-specific webhook secret (opt-in)
		payload_preview = None
		try:
			payload_preview = json.loads(body.decode('utf-8'))
		except Exception:
			payload_preview = {}

		# Account id may be present at top level
		account_id = payload_preview.get("account_id")
		merchant_secret = None
		if account_id:
			# Use get_doc().get_password to retrieve decrypted password fields.
			try:
				_rest = frappe.get_doc("Restaurant", frappe.db.get_value("Restaurant", {"razorpay_account_id": account_id}))
				merchant_secret = _rest.get_password("razorpay_webhook_secret") or None
			except Exception:
				merchant_secret = None
		# Fallback: check notes.restaurant_id in payload
		if not merchant_secret:
			try:
				restaurant_note = payload_preview.get("payload", {}).get("payment", {}).get("entity", {}).get("notes", {}).get("restaurant_id")
				if not restaurant_note:
					restaurant_note = payload_preview.get("payload", {}).get("order", {}).get("entity", {}).get("notes", {}).get("restaurant_id")
					
				if restaurant_note and frappe.db.exists("Restaurant", restaurant_note):
					try:
						_rest2 = frappe.get_doc("Restaurant", restaurant_note)
						merchant_secret = _rest2.get_password("razorpay_webhook_secret") or merchant_secret
					except Exception:
						pass
			except Exception:
				pass

		# Determine which secret to use: merchant-level if present, otherwise site-level
		webhook_secret = merchant_secret or (frappe.conf.get("razorpay_webhook_secret") or frappe.get_conf().get("razorpay_webhook_secret"))

		# Verify signature
		if not verify_razorpay_signature(body, signature, webhook_secret):
			frappe.log_error("Invalid Razorpay webhook signature", "razorpay.webhook")
			frappe.throw(_("Invalid signature"))
		
		# Parse payload
		payload = json.loads(body.decode('utf-8'))
		event_type = payload.get("event")
		
		# Log webhook for audit
		frappe.log_error(f"Razorpay Webhook: {event_type}\n{json.dumps(payload, indent=2)}", "razorpay.webhook.received")
		
		# Check for duplicate events using event ID
		event_id = payload.get("event_id")
		if event_id and frappe.db.exists("Razorpay Webhook Log", {"event_id": event_id}):
			frappe.log_error(f"Duplicate webhook event: {event_id}", "razorpay.webhook.duplicate")
			return {"success": True, "message": "Duplicate event ignored"}
		
		# Create webhook log entry
		webhook_log = frappe.get_doc({
			"doctype": "Razorpay Webhook Log",
			"event_id": event_id,
			"event_type": event_type,
			"payload": json.dumps(payload),
			"processed": False
		})
		try:
			webhook_log.insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(f"Failed to insert webhook log: {event_id}", "razorpay.webhook.log_insert")

		# Enqueue processing
		try:
			frappe.enqueue('dinematters.dinematters.api.webhook_worker.process_webhook_log',
				webhook_log_name=webhook_log.name,
				queue='long',
				timeout=600,
				user='Administrator'
			)
		except Exception as e:
			frappe.log_error(f"Failed to enqueue webhook processing: {str(e)}", "razorpay.webhook.enqueue_error")

		return {"success": True, "message": "Webhook received"}
		
	except Exception as e:
		frappe.log_error(f"Razorpay webhook processing failed: {str(e)}", "razorpay.webhook.error")
		return {"success": False, "error": str(e)}


def handle_payment_captured(payload):
	"""Handle payment.captured, order.paid, and payment.authorized events"""
	try:
		event = payload.get("event")
		payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
		order_data = payload.get("payload", {}).get("order", {}).get("entity", {})
		
		order_id = payment_data.get("order_id") or order_data.get("id")
		payment_id = payment_data.get("id")
		
		notes = payment_data.get("notes") or order_data.get("notes") or {}
		restaurant_from_notes = notes.get("restaurant_id")
		request_type = notes.get("type")
		
		# Handle Mandate Tokenization
		if request_type == "tokenization" or (order_id and notes.get("attempt_id")):
			try:
				customer_id = payment_data.get("customer_id") or payment_data.get("customer")
				token_id = payment_data.get("token") or (payment_data.get("card") or {}).get("token") or (payment_data.get("card") or {}).get("token_id")

				if restaurant_from_notes and frappe.db.exists("Restaurant", restaurant_from_notes):
					if customer_id:
						frappe.db.set_value("Restaurant", restaurant_from_notes, "razorpay_customer_id", customer_id)
					if token_id:
						frappe.db.set_value("Restaurant", restaurant_from_notes, "razorpay_token_id", token_id)
						frappe.db.set_value("Restaurant", restaurant_from_notes, "mandate_status", "active")
					frappe.db.commit()
				
				# Log capture in Tokenization Attempt
				attempt_id = notes.get("attempt_id") or order_id
				if attempt_id and frappe.db.exists("Tokenization Attempt", attempt_id):
					frappe.db.set_value("Tokenization Attempt", attempt_id, {
						"razorpay_payment_id": payment_id,
						"customer_id": customer_id,
						"token_id": token_id,
						"status": "captured",
						"processed": 1
					})
					frappe.db.commit()

				return {"success": True, "message": "Tokenization recorded", "payment_id": payment_id}
			except Exception as e:
				frappe.log_error(f"Failed to persist tokenization info: {str(e)}", "razorpay.webhook.token_save")
				return {"error": str(e)}

		# Handle Coin Purchase
		if request_type == "coin_purchase":
			try:
				restaurant = restaurant_from_notes or notes.get("restaurant")
				coins = float(notes.get("coins") or 0)
				if restaurant and coins > 0:
					from dinematters.dinematters.api.coin_billing import record_transaction
					record_transaction(
						restaurant=restaurant,
						txn_type="Purchase",
						amount=coins,
						description=f"Coin Purchase: {coins} Coins",
						payment_id=payment_id
					)
					return {"success": True, "message": "Coins added successfully"}
			except Exception as e:
				frappe.log_error(f"Coin purchase failed: {str(e)}", "razorpay.webhook.coin_purchase")
				return {"error": str(e)}

		# Handle Standard Order Payment
		if order_id:
			orders = frappe.get_all("Order", filters={"razorpay_order_id": order_id}, fields=["name", "restaurant", "total", "platform_fee_amount"])
			if orders:
				order_name = orders[0].name
				frappe.db.set_value("Order", order_name, {
					"razorpay_payment_id": payment_id,
					"transaction_id": payment_id,
					"payment_status": "completed",
					"status": "Auto Accepted"
				})
				frappe.db.commit()
				
				# Update monthly ledger
				update_monthly_ledger(orders[0].restaurant, orders[0].total, orders[0].platform_fee_amount)
				return {"success": True, "order_updated": order_name}

		return {"success": True, "message": "Event processed but no specific action taken"}
		
	except Exception as e:
		frappe.log_error(f"Payment capture handler failed: {str(e)}", "razorpay.webhook.payment_captured")
		return {"error": str(e)}


def handle_refund_processed(payload):
	"""Handle refund.processed and refund.created events"""
	try:
		refund_data = payload.get("payload", {}).get("refund", {}).get("entity", {})
		payment_id = refund_data.get("payment_id")
		refund_amount = refund_data.get("amount")
		
		orders = frappe.get_all("Order", filters={"razorpay_payment_id": payment_id}, fields=["name", "restaurant", "total", "platform_fee_amount"])
		
		if orders:
			order = frappe.get_doc("Order", orders[0].name)
			total_amount_paise = int(order.total * 100)
			refund_ratio = refund_amount / total_amount_paise
			platform_fee_refund = int((order.platform_fee_amount or 0) * refund_ratio)
			
			if refund_amount == total_amount_paise:
				frappe.db.set_value("Order", order.name, {"payment_status": "refunded", "status": "cancelled"})
			else:
				frappe.db.set_value("Order", order.name, "payment_status", "partially_refunded")
			
			frappe.db.commit()
			reverse_monthly_ledger(order.restaurant, refund_amount, platform_fee_refund)
		
		return {"success": True, "refund_processed": True}
	except Exception as e:
		frappe.log_error(f"Refund handler failed: {str(e)}", "razorpay.webhook.refund")
		return {"error": str(e)}


def handle_payment_link_paid(payload):
	"""Handle payment_link.paid event"""
	try:
		payment_link_data = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
		payment_link_id = payment_link_data.get("id")
		
		ledgers = frappe.get_all("Monthly Revenue Ledger", filters={"payment_link_id": payment_link_id}, fields=["name"])
		if ledgers:
			frappe.db.set_value("Monthly Revenue Ledger", ledgers[0].name, {
				"status": "paid",
				"paid_date": datetime.now().date()
			})
			frappe.db.commit()
		return {"success": True, "pl_paid": True}
	except Exception as e:
		frappe.log_error(f"Payment link handler failed: {str(e)}", "razorpay.webhook.pl_paid")
		return {"error": str(e)}


def handle_payment_failed(payload):
	"""Handle payment.failed and other failure events"""
	try:
		payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
		payment_id = payment_data.get("id")
		
		# Mark ledger failed if applicable
		ledgers = frappe.get_all("Monthly Billing Ledger", filters={"razorpay_payment_id": payment_id}, fields=["name", "restaurant"])
		if ledgers:
			frappe.db.set_value("Monthly Billing Ledger", ledgers[0].name, "payment_status", "failed")
			frappe.db.set_value("Restaurant", ledgers[0].restaurant, "billing_status", "overdue")
			frappe.db.commit()
		return {"success": True, "failure_recorded": True}
	except Exception as e:
		frappe.log_error(f"Payment failure handler failed: {str(e)}", "razorpay.webhook.failed")
		return {"error": str(e)}


def handle_subscription_event(payload):
	"""Handle subscription.* and token.confirmed events"""
	try:
		event = payload.get("event")
		sub_data = payload.get("payload", {}).get("subscription", {}).get("entity", {})
		payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
		
		if event == "subscription.charged":
			return handle_payment_captured(payload)
			
		customer_id = sub_data.get("customer_id") or payment_data.get("customer_id")
		token_id = payment_data.get("token_id") or payment_data.get("token")
		
		notes = sub_data.get("notes") or payment_data.get("notes") or {}
		restaurant = notes.get("restaurant_id")
		
		if restaurant and frappe.db.exists("Restaurant", restaurant):
			if event in ["subscription.activated", "subscription.authenticated", "token.confirmed"]:
				frappe.db.set_value("Restaurant", restaurant, "mandate_status", "active")
				if token_id:
					frappe.db.set_value("Restaurant", restaurant, "razorpay_token_id", token_id)
				if customer_id:
					frappe.db.set_value("Restaurant", restaurant, "razorpay_customer_id", customer_id)
			elif event in ["subscription.paused", "subscription.pending"]:
				frappe.db.set_value("Restaurant", restaurant, "mandate_status", "paused")
			elif event in ["subscription.cancelled", "subscription.halted"]:
				frappe.db.set_value("Restaurant", restaurant, "mandate_status", "inactive")
			
			frappe.db.commit()
			return {"success": True, "event": event, "restaurant": restaurant}
			
		return {"success": True, "message": "No restaurant mapping found"}
	except Exception as e:
		frappe.log_error(f"Subscription handler failed: {str(e)}", "razorpay.webhook.subscription")
		return {"error": str(e)}


def handle_dispute_event(payload):
	"""Handle payment.dispute.* events"""
	try:
		event = payload.get("event")
		dispute_data = payload.get("payload", {}).get("dispute", {}).get("entity", {})
		payment_id = dispute_data.get("payment_id")
		amount = dispute_data.get("amount", 0) / 100.0
		reason = dispute_data.get("reason_code")
		
		msg = f"CRITICAL: Razorpay Dispute {event} for Payment {payment_id}. Amount: INR {amount}. Reason: {reason}"
		frappe.log_error(msg, "razorpay.dispute_alert")
		return {"success": True, "alert_logged": True}
	except Exception:
		return {"success": False}


def handle_operational_event(payload):
	"""Handle informational/ops events (settlements, downtimes)"""
	try:
		return {"success": True, "event_logged": payload.get("event")}
	except Exception:
		return {"success": False}


def update_monthly_ledger(restaurant_id, order_total, platform_fee_amount):
	"""Update monthly revenue ledger with new order"""
	try:
		current_month = datetime.now().strftime("%Y-%m")
		ledger_name = f"MRL-{restaurant_id}-{current_month}"
		
		if not frappe.db.exists("Monthly Revenue Ledger", ledger_name):
			doc = frappe.get_doc({
				"doctype": "Monthly Revenue Ledger",
				"restaurant": restaurant_id,
				"month": current_month,
				"total_gmv": 0,
				"total_platform_fee": 0,
				"minimum_due": 0,
				"status": "pending"
			})
			doc.insert(ignore_permissions=True)
		
		order_total_paise = int(order_total * 100)
		frappe.db.sql(f"""
			UPDATE `tabMonthly Revenue Ledger` 
			SET total_gmv = total_gmv + %s, total_platform_fee = total_platform_fee + %s
			WHERE name = %s
		""", (order_total_paise, float(platform_fee_amount or 0), ledger_name))
		frappe.db.commit()
		
	except Exception as e:
		frappe.log_error(f"Monthly ledger update failed: {str(e)}", "razorpay.monthly_ledger")


def reverse_monthly_ledger(restaurant_id, refund_amount, platform_fee_refund):
	"""Reverse platform fee in monthly ledger for refunds"""
	try:
		current_month = datetime.now().strftime("%Y-%m")
		ledger_name = f"MRL-{restaurant_id}-{current_month}"
		
		if frappe.db.exists("Monthly Revenue Ledger", ledger_name):
			frappe.db.sql(f"""
				UPDATE `tabMonthly Revenue Ledger` 
				SET total_gmv = GREATEST(0, total_gmv - %s), 
				    total_platform_fee = GREATEST(0, total_platform_fee - %s)
				WHERE name = %s
			""", (refund_amount, platform_fee_refund, ledger_name))
			frappe.db.commit()
		
	except Exception as e:
		frappe.log_error(f"Monthly ledger reversal failed: {str(e)}", "razorpay.monthly_ledger_reverse")
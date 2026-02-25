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
				if restaurant_note and frappe.db.exists("Restaurant", restaurant_note):
					try:
						_rest2 = frappe.get_doc("Restaurant", restaurant_note)
						merchant_secret = _rest2.get_password("razorpay_webhook_secret") or merchant_secret
					except Exception:
						# leave merchant_secret unchanged if retrieval fails
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
		
		# Create webhook log entry (allow Guest to insert raw payload for audit)
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

		# Enqueue processing of this webhook log as an internal user (Administrator)
		try:
			frappe.enqueue('dinematters.dinematters.api.webhook_worker.process_webhook_log',
				webhook_log_name=webhook_log.name,
				queue='long',
				timeout=600,
				user='Administrator'
			)
		except Exception as e:
			# If enqueue fails, log the error and return - worker retry may handle this later
			frappe.log_error(f"Failed to enqueue webhook processing: {str(e)}", "razorpay.webhook.enqueue_error")

		# Respond quickly — actual processing happens in worker
		return {"success": True, "message": "Webhook received"}
		
	except Exception as e:
		frappe.log_error(f"Razorpay webhook processing failed: {str(e)}", "razorpay.webhook.error")
		return {"success": False, "error": str(e)}


def handle_payment_captured(payload):
	"""Handle payment.captured event"""
	try:
		payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
		order_id = payment_data.get("order_id")
		payment_id = payment_data.get("id")
		amount = payment_data.get("amount")
		
		notes = payment_data.get("notes") or {}
		# If notes contains restaurant mapping (tokenization/order), use it
		restaurant_from_notes = notes.get("restaurant_id")
		request_type = notes.get("type")
		# If notes indicate tokenization (even if order_id present), handle tokenization first
		if request_type == "tokenization" or (order_id and notes.get("attempt_id")):
			try:
				# Attempt to map to a TokenizationAttempt (new DocType). Notes may contain attempt_id (preferred)
				attempt_id = notes.get("attempt_id") or notes.get("order_id")
				attempt_doc = None
				if attempt_id and frappe.db.exists("Tokenization Attempt", attempt_id):
					attempt_doc = frappe.get_doc("Tokenization Attempt", attempt_id)
				else:
					# fallback: try find by razorpay_order_id matching this payment's order (if present)
					rows = frappe.get_all("Tokenization Attempt", filters={"razorpay_order_id": payment_data.get("order_id")}, fields=["name"])
					if rows:
						attempt_doc = frappe.get_doc("Tokenization Attempt", rows[0].name)

				customer_id = payment_data.get("customer_id") or payment_data.get("customer")
				token_id = payment_data.get("token") or (payment_data.get("card") or {}).get("token") or (payment_data.get("card") or {}).get("token_id")

				# Persist token/customer on Restaurant if available
				if restaurant_from_notes:
					if customer_id:
						frappe.db.set_value("Restaurant", restaurant_from_notes, "razorpay_customer_id", customer_id)
					if token_id:
						frappe.db.set_value("Restaurant", restaurant_from_notes, "razorpay_token_id", token_id)
						frappe.db.set_value("Restaurant", restaurant_from_notes, "mandate_status", "active")
					frappe.db.commit()

				# If we found an attempt doc, update it
				if attempt_doc:
					try:
						attempt_doc.razorpay_payment_id = payment_id
						if customer_id:
							attempt_doc.customer_id = customer_id
						if token_id:
							attempt_doc.token_id = token_id
						attempt_doc.status = "captured"
						attempt_doc.processed = 1
						attempt_doc.save(ignore_permissions=True)
					except Exception as e:
						frappe.log_error(f"Failed to update TokenizationAttempt {attempt_doc.name}: {str(e)}", "razorpay.webhook.token_save")

				return {"success": True, "message": "Tokenization recorded", "payment_id": payment_id}
			except Exception as e:
				frappe.log_error(f"Failed to persist tokenization info: {str(e)}", "razorpay.webhook.token_save")
				return {"error": str(e)}
		# Fallback to ledger mapping if present
		ledgers = frappe.get_all("Monthly Billing Ledger", filters={"razorpay_payment_id": payment_id}, fields=["name", "restaurant"])
		if ledgers:
			try:
				mb = frappe.get_doc("Monthly Billing Ledger", ledgers[0].name)
				mb.payment_status = "paid"
				mb.payment_date = datetime.now().date()
				try:
					mb.save(ignore_permissions=True)
				except Exception:
					frappe.db.set_value("Monthly Billing Ledger", mb.name, "payment_status", "paid")
					frappe.db.set_value("Monthly Billing Ledger", mb.name, "payment_date", datetime.now().date())
					frappe.db.commit()
				return {"success": True, "ledger_paid": mb.name, "payment_id": payment_id}
			except Exception as e:
				frappe.log_error(f"Failed to mark ledger paid: {str(e)}", "razorpay.webhook.ledger_error")
				return {"error": str(e)}
		else:
			return {"error": "No order_id in payment data"}
		
		# Find order by Razorpay order ID
		orders = frappe.get_all("Order", 
			filters={"razorpay_order_id": order_id},
			fields=["name", "restaurant", "total", "platform_fee_amount"]
		)
		
		if not orders:
			frappe.log_error(f"Order not found for Razorpay order ID: {order_id}", "razorpay.webhook.order_not_found")
			return {"error": "Order not found"}
		
		order_name = orders[0].name
		# Update order status using DB to avoid form validation issues in background worker
		try:
			frappe.db.set_value("Order", order_name, "razorpay_payment_id", payment_id)
			frappe.db.set_value("Order", order_name, "transaction_id", payment_id)
			frappe.db.set_value("Order", order_name, "payment_status", "completed")
			frappe.db.set_value("Order", order_name, "status", "confirmed")
			frappe.db.commit()
		except Exception:
			# fallback to safe doc update if DB updates fail
			try:
				order = frappe.get_doc("Order", order_name)
				order.razorpay_payment_id = payment_id
				order.transaction_id = payment_id
				order.payment_status = "completed"
				order.status = "confirmed"
				order.save(ignore_permissions=True)
			except Exception as ex:
				frappe.log_error(f"Failed to update Order {order_name}: {str(ex)}", "razorpay.webhook.order_update")
		
		# Update monthly revenue ledger
		# Refresh order doc or fetch fields for ledger update
		try:
			order = frappe.get_doc("Order", order_name)
			update_monthly_ledger(order.restaurant, order.total, order.platform_fee_amount)
		except Exception:
			# If order doc cannot be loaded, skip ledger update and log
			frappe.log_error(f"Failed to load order for ledger update: {order_name}", "razorpay.webhook.ledger_skip")
		
		# Also, if this payment corresponds to a Monthly Billing Ledger, mark it paid
		try:
			mb_ledgers = frappe.get_all("Monthly Billing Ledger", filters={"razorpay_payment_id": payment_id}, fields=["name"])
			if mb_ledgers:
				mb = frappe.get_doc("Monthly Billing Ledger", mb_ledgers[0].name)
				mb.payment_status = "paid"
				mb.payment_date = datetime.now().date()
				try:
					mb.save(ignore_permissions=True)
				except Exception:
					frappe.db.set_value("Monthly Billing Ledger", mb.name, "payment_status", "paid")
					frappe.db.set_value("Monthly Billing Ledger", mb.name, "payment_date", datetime.now().date())
					frappe.db.commit()
				# Post accounting journal entry for the received payment
				try:
					# Create simple JE: debit Bank, credit Platform Income
					site_conf = frappe.get_conf()
					bank_account = site_conf.get("razorpay_gl_bank_account")
					income_account = site_conf.get("razorpay_gl_income_account")
					if bank_account and income_account:
						amount = int(mb.final_amount or 0) / 100.0
						je = frappe.get_doc({
							"doctype": "Journal Entry",
							"posting_date": datetime.now().date(),
							"voucher_type": "Bank Entry",
							"user_remark": f"Monthly billing payment for {mb.restaurant} {mb.billing_month}",
							"accounts": [
								{"account": bank_account, "debit_in_account_currency": amount},
								{"account": income_account, "credit_in_account_currency": amount}
							]
						})
						je.insert(ignore_permissions=True)
						frappe.db.set_value("Monthly Billing Ledger", mb.name, "journal_entry", je.name)
						frappe.db.commit()
					else:
						frappe.log_error("GL accounts not configured for journal posting", "razorpay.webhook.journal_skip")
				except Exception as e:
					frappe.log_error(f"Failed to create Journal Entry for ledger {mb.name}: {str(e)}", "razorpay.webhook.journal_error")
		except Exception:
			# non-fatal
			pass

		# If token/customer present in payment (tokenization flow), persist to Restaurant
		try:
			# payment_data may contain customer id and card/token details
			customer_id = payment_data.get("customer_id") or payment_data.get("customer")
			token_id = None
			if payment_data.get("token"):
				token_id = payment_data.get("token")
			elif isinstance(payment_data.get("card"), dict):
				token_id = payment_data.get("card").get("token") or payment_data.get("card").get("token_id")

			# If our Order doc links to a restaurant via notes, load it
			restaurant_name = None
			try:
				r_order = frappe.get_doc("Order", order_name)
				restaurant_name = r_order.restaurant
			except Exception:
				restaurant_name = None

			if restaurant_name and (customer_id or token_id):
				try:
					if customer_id:
						frappe.db.set_value("Restaurant", restaurant_name, "razorpay_customer_id", customer_id)
					if token_id:
						frappe.db.set_value("Restaurant", restaurant_name, "razorpay_token_id", token_id)
						frappe.db.set_value("Restaurant", restaurant_name, "mandate_status", "active")
					frappe.db.commit()
				except Exception:
					# non-fatal
					pass
		except Exception:
			pass

		return {
			"success": True,
			"order_updated": order.name,
			"payment_id": payment_id
		}
		
	except Exception as e:
		frappe.log_error(f"Payment captured handler failed: {str(e)}", "razorpay.webhook.payment_captured")
		return {"error": str(e)}


def handle_transfer_processed(payload):
	"""Deprecated: transfer.processed handling removed in SaaS billing mode"""
	return {"success": False, "error": "transfer.processed handling is deprecated"}


def handle_refund_processed(payload):
	"""Handle refund.processed event"""
	try:
		refund_data = payload.get("payload", {}).get("refund", {}).get("entity", {})
		payment_id = refund_data.get("payment_id")
		refund_amount = refund_data.get("amount")
		
		# Find order by payment ID
		orders = frappe.get_all("Order",
			filters={"razorpay_payment_id": payment_id},
			fields=["name", "restaurant", "total", "platform_fee_amount"]
		)
		
		if orders:
			order = frappe.get_doc("Order", orders[0].name)
			
			# Calculate refund proportions
			total_amount_paise = int(order.total * 100)
			refund_ratio = refund_amount / total_amount_paise
			platform_fee_refund = int(order.platform_fee_amount * refund_ratio)
			
			# Update order status
			if refund_amount == total_amount_paise:
				order.payment_status = "refunded"
				order.status = "cancelled"
			else:
				order.payment_status = "partially_refunded"
			
			order.save()
			
			# Reverse platform fee in monthly ledger
			reverse_monthly_ledger(order.restaurant, refund_amount, platform_fee_refund)
		
		return {
			"success": True,
			"refund_amount": refund_amount,
			"payment_id": payment_id
		}
		
	except Exception as e:
		frappe.log_error(f"Refund processed handler failed: {str(e)}", "razorpay.webhook.refund_processed")
		return {"error": str(e)}


def handle_payment_link_paid(payload):
	"""Handle payment_link.paid event (for monthly minimums)"""
	try:
		payment_link_data = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
		payment_link_id = payment_link_data.get("id")
		
		# Find monthly ledger entry by payment link ID
		ledgers = frappe.get_all("Monthly Revenue Ledger",
			filters={"payment_link_id": payment_link_id},
			fields=["name"]
		)
		
		if ledgers:
			ledger = frappe.get_doc("Monthly Revenue Ledger", ledgers[0].name)
			ledger.status = "paid"
			ledger.paid_date = datetime.now().date()
			# Save with ignore_permissions so webhook processing as Guest can update ledger
			try:
				ledger.save(ignore_permissions=True)
			except Exception:
				# fallback to db update if save fails
				try:
					frappe.db.set_value("Monthly Revenue Ledger", ledger.name, "status", "paid")
					frappe.db.set_value("Monthly Revenue Ledger", ledger.name, "paid_date", datetime.now().date())
					frappe.db.commit()
				except Exception:
					frappe.log_error(f"Failed to mark ledger paid: {ledger.name}", "razorpay.webhook.ledger_update")
		
		return {
			"success": True,
			"payment_link_id": payment_link_id
		}
		
	except Exception as e:
		frappe.log_error(f"Payment link paid handler failed: {str(e)}", "razorpay.webhook.payment_link_paid")
		return {"error": str(e)}


def handle_payment_failed(payload):
	"""Handle payment.failed event for recurring billing failures"""
	try:
		payment_data = payload.get("payload", {}).get("payment", {}).get("entity", {})
		payment_id = payment_data.get("id")
		# Find ledger by payment id
		ledgers = frappe.get_all("Monthly Billing Ledger", filters={"razorpay_payment_id": payment_id}, fields=["name", "restaurant"])
		if ledgers:
			ledger = frappe.get_doc("Monthly Billing Ledger", ledgers[0].name)
			ledger.payment_status = "failed"
			try:
				ledger.save(ignore_permissions=True)
			except Exception:
				frappe.db.set_value("Monthly Billing Ledger", ledger.name, "payment_status", "failed")
				frappe.db.commit()
			# Mark restaurant billing status as overdue and notify
			try:
				restaurant_name = ledgers[0].restaurant
				frappe.db.set_value("Restaurant", restaurant_name, "billing_status", "overdue")
				frappe.db.commit()
			except Exception:
				pass
		return {"success": True, "payment_id": payment_id}
	except Exception as e:
		frappe.log_error(f"Payment failed handler failed: {str(e)}", "razorpay.webhook.payment_failed")
		return {"error": str(e)}


def update_monthly_ledger(restaurant_id, order_total, platform_fee_amount):
	"""Update monthly revenue ledger with new order"""
	try:
		current_month = datetime.now().strftime("%Y-%m")
		
		# Get or create monthly ledger entry
		ledger_name = f"MRL-{restaurant_id}-{current_month}"
		
		if frappe.db.exists("Monthly Revenue Ledger", ledger_name):
			ledger = frappe.get_doc("Monthly Revenue Ledger", ledger_name)
		else:
			ledger = frappe.get_doc({
				"doctype": "Monthly Revenue Ledger",
				"restaurant": restaurant_id,
				"month": current_month,
				"total_gmv": 0,
				"total_platform_fee": 0,
				"minimum_due": 0,
				"status": "pending"
			})
		
		# Update totals
		order_total_paise = int(order_total * 100)
		ledger.total_gmv = (ledger.total_gmv or 0) + order_total_paise
		ledger.total_platform_fee = (ledger.total_platform_fee or 0) + (platform_fee_amount or 0)
		
		ledger.save()
		
	except Exception as e:
		frappe.log_error(f"Monthly ledger update failed: {str(e)}", "razorpay.monthly_ledger")


def reverse_monthly_ledger(restaurant_id, refund_amount, platform_fee_refund):
	"""Reverse platform fee in monthly ledger for refunds"""
	try:
		current_month = datetime.now().strftime("%Y-%m")
		ledger_name = f"MRL-{restaurant_id}-{current_month}"
		
		if frappe.db.exists("Monthly Revenue Ledger", ledger_name):
			ledger = frappe.get_doc("Monthly Revenue Ledger", ledger_name)
			ledger.total_gmv = max(0, (ledger.total_gmv or 0) - refund_amount)
			ledger.total_platform_fee = max(0, (ledger.total_platform_fee or 0) - platform_fee_refund)
			ledger.save()
		
	except Exception as e:
		frappe.log_error(f"Monthly ledger reversal failed: {str(e)}", "razorpay.monthly_ledger_reverse")
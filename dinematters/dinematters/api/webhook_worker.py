import frappe
import json
from dinematters.dinematters.api.webhooks import (
    handle_payment_captured,
    handle_refund_processed,
    handle_payment_link_paid,
)


def process_webhook_log(webhook_log_name=None, webhook_log_doc=None, **kwargs):
    """Background worker: process a stored webhook log entry.

    Call via:
        frappe.enqueue('dinematters.dinematters.api.webhook_worker.process_webhook_log',
            webhook_log_name='RZP-WH-...', user='Administrator')
    """

    if not webhook_log_doc and not webhook_log_name:
        return

    if not webhook_log_doc:
        webhook_log_doc = frappe.get_doc('Razorpay Webhook Log', webhook_log_name)

    # Skip if already processed
    if getattr(webhook_log_doc, 'processed', False):
        return

    try:
        payload = json.loads(webhook_log_doc.payload)
    except Exception:
        frappe.log_error('Invalid webhook payload: ' + (webhook_log_doc.name or ''), 'razorpay.webhook')
        webhook_log_doc.processed = True
        webhook_log_doc.save(ignore_permissions=True)
        return

    event_type = payload.get('event')

    result = None
    if event_type == 'payment.captured':
        result = handle_payment_captured(payload)
    elif event_type == 'refund.processed':
        result = handle_refund_processed(payload)
    elif event_type == 'payment_link.paid':
        result = handle_payment_link_paid(payload)
    elif event_type == 'payment.failed':
        # payment failed for a recurring charge
        try:
            from dinematters.dinematters.api.webhooks import handle_payment_failed
            result = handle_payment_failed(payload)
        except Exception:
            frappe.log_error("Failed to process payment.failed in worker", "razorpay.webhook.worker")
    else:
        frappe.log_error(f'Unhandled webhook event in worker: {event_type}', 'razorpay.webhook.worker')

    # Mark processed and persist result
    webhook_log_doc.reload()
    webhook_log_doc.processed = True
    try:
        webhook_log_doc.processing_result = json.dumps(result) if result else None
    except Exception:
        webhook_log_doc.processing_result = str(result)

    webhook_log_doc.save(ignore_permissions=True)

    return result


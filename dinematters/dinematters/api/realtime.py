# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

import frappe
import json

def notify_order_update(doc, method=None):
	"""
	Publishes real-time update when an Order is created or updated.
	Event: 'order_update'
	Room: User-specific or Session-specific
	"""
	try:
		# Notify the customer
		if doc.customer:
			frappe.publish_realtime(
				event='order_update',
				message={'id': doc.order_id, 'status': doc.status, 'order_number': doc.order_number},
				user=doc.customer
			)
		
		# Also notify via phone if platform_customer exists (for guests who verified phone)
		if doc.platform_customer:
			frappe.publish_realtime(
				event='order_update',
				message={'id': doc.order_id, 'status': doc.status, 'order_number': doc.order_number},
				room=f"customer:{doc.platform_customer}"
			)
	except Exception as e:
		frappe.log_error(f"Error in notify_order_update: {str(e)}", "Realtime Update Error")

def notify_product_update(doc, method=None):
	"""
	Publishes real-time update when a Menu Product is updated.
	Event: 'product_update'
	Room: Restaurant-specific
	"""
	try:
		frappe.publish_realtime(
			event='product_update',
			message={
				'id': doc.product_id,
				'isActive': doc.is_active,
				'price': doc.price,
				'originalPrice': doc.original_price,
				'restaurantId': doc.restaurant
			},
			room=f"restaurant:{doc.restaurant}"
		)
	except Exception as e:
		frappe.log_error(f"Error in notify_product_update: {str(e)}", "Realtime Update Error")

def notify_cart_update(doc, method=None):
	"""
	Publishes real-time update when a Cart Entry is modified.
	Event: 'cart_update'
	"""
	try:
		if doc.user:
			frappe.publish_realtime(
				event='cart_update',
				message={'restaurantId': doc.restaurant},
				user=doc.user
			)
		elif doc.session_id:
			frappe.publish_realtime(
				event='cart_update',
				message={'restaurantId': doc.restaurant},
				room=f"session:{doc.session_id}"
			)
	except Exception as e:
		frappe.log_error(f"Error in notify_cart_update: {str(e)}", "Realtime Update Error")

# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import requests
import json
import hmac
import hashlib
from frappe.utils import flt
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api

from dinematters.dinematters.logistics.manager import LogisticsManager

@frappe.whitelist()
def get_delivery_quote(order_id):
    """Whitelisted API to get a dynamic delivery estimate for an order"""
    try:
        order = frappe.get_doc("Order", order_id)
        validate_restaurant_for_api(order.restaurant, frappe.session.user)
        
        manager = LogisticsManager(order.restaurant)
        return manager.get_quote({
            "address": order.delivery_address,
            "latitude": order.delivery_latitude,
            "longitude": order.delivery_longitude,
            "phone": order.customer_phone,
            "name": order.customer_name,
            "items": order.get("order_items"),
            "total": order.total
        })
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def assign_delivery(order_id, delivery_mode, partner_name=None, rider_name=None, rider_phone=None, eta=None):
    """Entry point for all delivery assignments (Manual or Integrated)"""
    try:
        order = frappe.get_doc("Order", order_id)
        validate_restaurant_for_api(order.restaurant, frappe.session.user)

        if delivery_mode == "manual":
            order.db_set({
                "delivery_partner": partner_name or "manual",
                "delivery_status": "assigned",
                "delivery_rider_name": rider_name,
                "delivery_rider_phone": rider_phone,
                "delivery_eta": eta,
            })
            return {"success": True, "message": _("Manual delivery assigned")}

        if delivery_mode == "auto" or partner_name in ["borzo", "flash"]:
            # If partner_name is not provided, use the restaurant's preferred one
            manager = LogisticsManager(order.restaurant)
            res = manager.book_delivery(order)
            
            if res.get("success"):
                order.db_set({
                    "delivery_partner": partner_name or manager.restaurant.preferred_logistics_provider or "flash",
                    "delivery_id": res.get("delivery_id"),
                    "delivery_status": res.get("status"),
                    "delivery_tracking_url": res.get("tracking_url"),
                    "delivery_fee": res.get("delivery_fee"),
                    "logistics_platform_fee": res.get("logistics_platform_fee")
                })
                return res
            else:
                return {"success": False, "error": res.get("error")}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Delivery Assignment Error"))
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def cancel_delivery(order_id, delivery_id=None):
    """Entry point for delivery cancellations"""
    try:
        order = frappe.get_doc("Order", order_id)
        validate_restaurant_for_api(order.restaurant, frappe.session.user)

        if order.delivery_partner in ["borzo", "flash"] and delivery_id:
            manager = LogisticsManager(order.restaurant)
            manager.cancel_delivery(delivery_id)

        order.db_set({
            "delivery_id": None,
            "delivery_status": "cancelled",
            "delivery_rider_name": None,
            "delivery_rider_phone": None,
            "delivery_tracking_url": None,
        })
        return {"success": True}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Delivery Cancellation Error"))
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def sync_delivery_status(order_id):
    """
    Manually poll the logistics provider for the latest status.
    Useful as a fallback if webhooks are delayed.
    """
    try:
        order = frappe.get_doc("Order", order_id)
        validate_restaurant_for_api(order.restaurant, frappe.session.user)
        
        if not order.delivery_id:
            return {"success": False, "error": _("No delivery assigned to this order")}
            
        manager = LogisticsManager(order.restaurant)
        res = manager.track_delivery(order.delivery_id)
        
        if res.get("success"):
            update_data = {"delivery_status": res.get("status")}
            if res.get("rider_name"): update_data["delivery_rider_name"] = res.get("rider_name")
            if res.get("rider_phone"): update_data["delivery_rider_phone"] = res.get("rider_phone")
            if res.get("tracking_url"): update_data["delivery_tracking_url"] = res.get("tracking_url")
            if res.get("lat") and res.get("lng"):
                update_data["rider_latitude"] = res.get("lat")
                update_data["rider_longitude"] = res.get("lng")
                update_data["rider_last_updated"] = frappe.utils.now_datetime()
                
            order.db_set(update_data)
            frappe.publish_realtime("order_update", {"order_id": order_id}, user="Administrator")
            return res
        else:
            return {"success": False, "error": res.get("error")}
            
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Delivery Sync Error"))
        return {"success": False, "error": str(e)}

@frappe.whitelist(allow_guest=True)
def handle_unified_webhook():
    """Universal gateway for all logistics webhooks (Flash, Borzo, etc)"""
    try:
        provider_name = frappe.request.args.get("provider")
        raw_body = frappe.request.get_data()
        
        # Determine order from payload based on provider
        data = json.loads(raw_body.decode('utf-8'))
        delivery_id = None
        status = None
        lat = lng = None
        rider_name = rider_phone = None

        if provider_name == "borzo":
            # Borzo payload structure
            borzo_order = data.get("order", {})
            delivery_id = str(borzo_order.get("order_id"))
            status = borzo_order.get("status_description") or borzo_order.get("status")
            courier = borzo_order.get("courier", {})
            rider_name = courier.get("name")
            rider_phone = courier.get("phone")
            lat = flt(courier.get("latitude"))
            lng = flt(courier.get("longitude"))
        
        elif provider_name == "flash":
            # uEngage Flash payload structure
            flash_data = data.get("data", {})
            delivery_id = flash_data.get("taskId")
            status = data.get("status_code") # e.g. DISPATCHED, DELIVERED
            rider_name = flash_data.get("rider_name")
            rider_phone = flash_data.get("rider_contact")
            lat = flt(flash_data.get("latitude"))
            lng = flt(flash_data.get("longitude"))

        if not delivery_id:
            return {"status": "error", "message": "Missing delivery id"}

        order_name = frappe.db.get_value("Order", {"delivery_id": delivery_id}, "name")
        if not order_name:
            return {"status": "success", "message": "Order not found in this bench"}

        order = frappe.get_doc("Order", order_name)
        
        # Update metrics
        if status: order.delivery_status = status
        if rider_name: order.delivery_rider_name = rider_name
        if rider_phone: order.delivery_rider_phone = rider_phone
        if lat and lng:
            order.rider_latitude = lat
            order.rider_longitude = lng
            order.rider_last_updated = frappe.utils.now_datetime()

        order.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Push real-time update to dashboard
        frappe.publish_realtime("order_update", {"order_id": order_name}, user="Administrator")

        # Standardize success response for logistics providers (Required by uEngage Flash)
        return {"status": True, "message": "Webhook Processed"}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Unified Logstics Webhook Error"))
        return {"status": "error", "message": str(e)}

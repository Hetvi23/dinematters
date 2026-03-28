# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import requests
import json
from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api

@frappe.whitelist()
def assign_delivery(order_id, delivery_mode, partner_name=None, rider_name=None, rider_phone=None, eta=None):
    """
    Whitelisted API for assigning delivery.
    Replaces the FastAPI proxy '/api/delivery/assign' endpoint.
    """
    frappe.logger().debug(f"[Delivery] Assigning delivery for {order_id} (mode: {delivery_mode})")
    try:
        order = frappe.get_doc("Order", order_id)
        
        # Security check: Ensure user has access to the restaurant of this order
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

        # Borzo automatic assignment
        if delivery_mode == "auto" or partner_name == "borzo":
            res = create_borzo_delivery(order)
            if res.get("success"):
                frappe.logger().debug(f"[Delivery] Borzo assignment success for {order_id}: {res.get('delivery_id')}")
                order.db_set({
                    "delivery_partner": "borzo",
                    "delivery_id": res.get("delivery_id"),
                    "delivery_status": res.get("status"),
                    "delivery_tracking_url": res.get("tracking_url"),
                })
                return {
                    "success": True,
                    "delivery_id": res.get("delivery_id"),
                    "tracking_url": res.get("tracking_url"),
                    "status": res.get("status"),
                }
            else:
                error_msg = res.get("error") or _("Failed to create Borzo delivery")
                frappe.logger().error(f"[Delivery] Borzo assignment failed for {order_id}: {error_msg}")
                return {"success": False, "error": error_msg}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Delivery Assignment Error"))
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def cancel_delivery(order_id, delivery_id=None):
    """
    Whitelisted API for cancelling delivery.
    Replaces the FastAPI proxy '/api/delivery/cancel' endpoint.
    """
    try:
        order = frappe.get_doc("Order", order_id)
        validate_restaurant_for_api(order.restaurant, frappe.session.user)

        if order.delivery_partner == "borzo" and delivery_id:
            cancel_borzo_delivery(delivery_id)

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

def create_borzo_delivery(order):
    """Internal helper to create Borzo delivery"""
    settings = frappe.get_single("Dinematters Settings")
    
    if not settings.borzo_api_token:
        return {"success": False, "error": _("Borzo API token is missing in Dinematters Settings")}

    # Get restaurant info
    restaurant = frappe.get_doc("Restaurant", order.restaurant)
    pickup_address = restaurant.address or f"{restaurant.restaurant_name}, {restaurant.city}"
    
    # Try WhatsApp phone first, then owner phone
    pickup_phone = frappe.db.get_value("Restaurant Config", {"restaurant": restaurant.name}, "whatsapp_phone_number")
    if not pickup_phone:
        pickup_phone = restaurant.owner_phone

    if not pickup_phone:
        return {"success": False, "error": _("Restaurant phone number is not configured")}

    # Build Borzo payload
    points = []
    
    # Pickup
    pickup_point = {
        "address": pickup_address,
        "contact_person": {
            "phone": pickup_phone,
            "name": restaurant.restaurant_name
        }
    }
    if restaurant.latitude and restaurant.longitude:
        pickup_point["latitude"] = float(restaurant.latitude)
        pickup_point["longitude"] = float(restaurant.longitude)
    points.append(pickup_point)

    # Drop
    drop_point = {
        "address": order.delivery_address,
        "contact_person": {
            "phone": order.customer_phone,
            "name": order.customer_name
        },
        "note": f"Order #{order.order_number or order.name}"
    }
    if order.payment_method == "cash":
        drop_point["payment_amount"] = str(order.total)
    
    if order.delivery_latitude and order.delivery_longitude:
        drop_point["latitude"] = float(order.delivery_latitude)
        drop_point["longitude"] = float(order.delivery_longitude)
    elif order.delivery_location_pin and "," in str(order.delivery_location_pin):
        try:
            lat, lng = str(order.delivery_location_pin).split(",")
            drop_point["latitude"] = float(lat.strip())
            drop_point["longitude"] = float(lng.strip())
        except: pass
    points.append(drop_point)

    payload = {
        "type": "standard",
        "matter": "Food Delivery",
        "points": points,
        "callback_url": frappe.utils.get_url("/api/method/dinematters.dinematters.api.delivery.handle_borzo_webhook")
    }

    base_url = "https://robot-in.borzodelivery.com/api/business/1.6" if settings.borzo_mode == "Production" else "https://robotapitest-in.borzodelivery.com/api/business/1.6"
    
    headers = {
        "X-DV-Auth-Token": settings.get_password("borzo_api_token"),
        "Content-Type": "application/json"
    }

    try:
        frappe.logger().debug(f"[Borzo] Request to {base_url}/create-order: {json.dumps(payload)}")
        response = requests.post(f"{base_url}/create-order", json=payload, headers=headers, timeout=30)
        res_data = response.json()
        frappe.logger().debug(f"[Borzo] Response: {response.status_code} - {json.dumps(res_data)}")
        
        if response.status_code == 200 and res_data.get("is_successful"):
            order_res = res_data.get("order", {})
            return {
                "success": True,
                "delivery_id": str(order_res.get("order_id")),
                "status": order_res.get("status_description") or order_res.get("status"),
                "tracking_url": order_res.get("tracking_url")
            }
        else:
            errors = res_data.get("errors", ["Unknown error"])
            error_msg = errors[0] if isinstance(errors, list) else str(errors)
            return {"success": False, "error": error_msg}
    except Exception as e:
        frappe.logger().error(f"[Borzo] Exception in create_borzo_delivery: {str(e)}")
        return {"success": False, "error": str(e)}

def cancel_borzo_delivery(delivery_id):
    """Internal helper to cancel Borzo delivery"""
    settings = frappe.get_single("Dinematters Settings")
    if not settings.borzo_api_token: return

    base_url = "https://robot-in.borzodelivery.com/api/business/1.6" if settings.borzo_mode == "Production" else "https://robotapitest-in.borzodelivery.com/api/business/1.6"
    headers = {
        "X-DV-Auth-Token": settings.get_password("borzo_api_token"),
        "Content-Type": "application/json"
    }

    try:
        requests.post(f"{base_url}/cancel-order", json={"order_id": delivery_id}, headers=headers, timeout=30)
    except: pass

@frappe.whitelist(allow_guest=True)
def handle_borzo_webhook():
    """
    Webhook handler for Borzo status updates and live tracking coordinates.
    """
    try:
        data = frappe.request.get_json()
        frappe.logger().debug(f"[Borzo Webhook] Received: {json.dumps(data)}")
        
        if not data or "order" not in data:
            return {"status": "error", "message": "Invalid payload"}

        borzo_order = data["order"]
        borzo_id = str(borzo_order.get("order_id"))
        
        # Find the order in our system
        order_name = frappe.db.get_value("Order", {"delivery_id": borzo_id}, "name")
        if not order_name:
            frappe.logger().warning(f"[Borzo Webhook] Order not found for Borzo ID: {borzo_id}")
            return {"status": "error", "message": "Order not found"}

        order = frappe.get_doc("Order", order_name)
        
        # Update delivery status
        new_status = borzo_order.get("status_description") or borzo_order.get("status")
        if new_status:
            order.delivery_status = new_status

        # Update courier details if available
        courier = borzo_order.get("courier")
        if courier:
            if courier.get("name"):
                order.delivery_rider_name = courier.get("name")
            if courier.get("phone"):
                order.delivery_rider_phone = courier.get("phone")
            
            # Live Coordinates
            if courier.get("latitude") and courier.get("longitude"):
                order.rider_latitude = float(courier.get("latitude"))
                order.rider_longitude = float(courier.get("longitude"))
                order.rider_last_updated = frappe.utils.now_datetime()
                frappe.logger().debug(f"[Borzo Webhook] Updated coords for {order_name}: {order.rider_latitude}, {order.rider_longitude}")

        order.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Trigger real-time update for frontend (if socketio is available)
        try:
            frappe.publish_realtime("order_update", {"order_id": order_name}, user="Administrator")
        except: pass

        return {"status": "success"}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Borzo Webhook Error"))
        return {"status": "error", "message": str(e)}

import frappe
import requests
import json
from .base import LogisticsProvider

class FlashProvider(LogisticsProvider):
    def __init__(self, settings=None):
        self.settings = settings or frappe.get_single("Dinematters Settings")
        self.is_production = self.settings.flash_mode == "Production"
        # Since the doc doesn't specify URLs, I will use standard uEngage Flash endpoints 
        # normally provided by their team (mocking production/sandbox logic here)
        self.base_url = "https://api.flash.uengage.in/v1" if self.is_production else "https://sandbox-api.flash.uengage.in/v1"
        self.access_token = self.settings.get_password("flash_access_token")

    def get_headers(self):
        return {
            "access-token": self.access_token,
            "Content-Type": "application/json"
        }

    def verify_webhook(self, data, signature):
        # Flash API usually sends a token in headers or use a shared secret.
        # Assuming header-based token verification for now.
        return True

    def calculate_quote(self, restaurant, order_details):
        if not self.access_token:
            return {"success": False, "error": "Flash Access Token is missing in Dinematters Settings"}

        # Global store ID managed by DineMatters — not per restaurant
        store_id = getattr(self.settings, 'flash_store_id', None)
        if not store_id:
            return {"success": False, "error": "Flash Store ID not configured in Dinematters Settings. Contact support."}

        payload = {
            "storeId": store_id,
            "order_details": {
                "latitude": float(order_details.get("latitude")),
                "longitude": float(order_details.get("longitude")),
                "order_amount": float(order_details.get("total") or 0)
            }
        }

        try:
            response = requests.post(f"{self.base_url}/getServiceability", json=payload, headers=self.get_headers(), timeout=30)
            res_data = response.json()
            if response.status_code == 200 and str(res_data.get("status")) == "200":
                payouts = res_data.get("payouts", {})
                return {
                    "success": True,
                    "delivery_fee": float(payouts.get("total") or 0),
                    "eta_mins": 30, # Defaulting since API doesn't guarantee rider_eta in initial payload structure
                    "currency": "INR",
                    "provider": "Flash"
                }
            else:
                return {"success": False, "error": str(res_data.get("message") or res_data)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def create_order(self, restaurant, order):
        if not self.access_token:
            return {"success": False, "error": "Flash Access Token is missing in Dinematters Settings"}

        # Global store ID managed by DineMatters — not per restaurant
        store_id = getattr(self.settings, 'flash_store_id', None)
        if not store_id:
            return {"success": False, "error": "Flash Store ID not configured in Dinematters Settings. Contact support."}

        # Prepare Order Items as per Flash schema
        items = []
        for item in order.get("order_items"):
            items.append({
                "product_id": item.product or item.name,
                "product_name": item.product, # product field in Order Item is the Name of the item
                "product_price": float(item.unit_price or 0),
                "quantity": int(item.quantity or 1)
            })

        payload = {
            "storeId": store_id,
            "order_details": {
                "order_id": order.name,
                "order_amount": float(order.total),
                "payment_mode": "PREPAID" if order.payment_status == "completed" else "COD"
            },
            "pickup_details": {
                "address": restaurant.address,
                "latitude": float(restaurant.latitude),
                "longitude": float(restaurant.longitude),
                "contact_number": restaurant.owner_phone
            },
            "drop_details": {
                "address": order.delivery_address,
                "latitude": float(order.delivery_latitude),
                "longitude": float(order.delivery_longitude),
                "name": order.customer_name,
                "contact_number": order.customer_phone
            },
            "order_items": items,
            "callback_url": frappe.utils.get_url("/api/method/dinematters.dinematters.api.delivery.handle_unified_webhook?provider=flash")
        }

        try:
            response = requests.post(f"{self.base_url}/createTask", json=payload, headers=self.get_headers(), timeout=30)
            res_data = response.json()
            if response.status_code == 200 and res_data.get("status") is True:
                return {
                    "success": True,
                    "delivery_id": res_data.get("taskId"),
                    "status": res_data.get("Status_code") or "ACCEPTED",
                    "tracking_url": None, # Flash webhook will provide tracking URL later
                    "delivery_fee": float(order.delivery_fee) # API doesn't return payout on create, so refer to initial state
                }
            else:
                return {"success": False, "error": res_data.get("message") or "Task creation failed"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def cancel_order(self, delivery_id):
        if not self.access_token: return {"success": False, "error": "Missing access token"}
        store_id = getattr(self.settings, 'flash_store_id', None)
        try:
            response = requests.post(f"{self.base_url}/cancelTask", 
                json={"storeId": store_id, "taskId": str(delivery_id)}, 
                headers=self.get_headers(), timeout=30)
            res_data = response.json()
            return {"success": res_data.get("status") is True, "message": res_data.get("message")}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def track_order(self, delivery_id):
        if not self.access_token: return {"success": False, "error": "Missing access token"}
        store_id = getattr(self.settings, 'flash_store_id', None)
        try:
            payload = {"storeId": store_id, "taskId": str(delivery_id)}
            response = requests.post(f"{self.base_url}/trackTaskStatus", 
                json=payload, headers=self.get_headers(), timeout=30)
            res_data = response.json()
            
            if response.status_code == 200 and res_data.get("status") is True:
                data = res_data.get("data", {})
                return {
                    "success": True,
                    "status": res_data.get("status_code"),
                    "rider_name": data.get("rider_name"),
                    "rider_phone": data.get("rider_contact"),
                    "tracking_url": data.get("tracking_url"),
                    "lat": float(data.get("latitude") or 0) if data.get("latitude") else None,
                    "lng": float(data.get("longitude") or 0) if data.get("longitude") else None
                }
            else:
                return {"success": False, "error": res_data.get("message") or "Tracking failed"}
        except Exception as e:
            return {"success": False, "error": str(e)}

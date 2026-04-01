import frappe
import requests
import json
from dinematters.dinematters.pos.base import POSProvider

class PetpoojaProvider(POSProvider):
    def __init__(self, restaurant_doc):
        super().__init__(restaurant_doc)
        self.api_url = "https://developerapi.petpooja.com/v1/" # Staging: https://sandbox.petpooja.com/v1/

    def sync_menu(self):
        """
        Petpooja usually pushes the menu to us via a POST request to our callback URL.
        Alternatively, we can fetch it if they provide a GET endpoint (less common for Petpooja).
        """
        frappe.log_error(f"Menu sync triggered for {self.restaurant.name}", "Petpooja Sync")
        # In production, we would call Petpooja or wait for their push
        return {"status": "success", "message": "Menu sync initiated. Waiting for Petpooja push."}

    def push_order(self, order_doc):
        """
        Push order to Petpooja 'Save Order' API
        """
        if not self.settings["app_key"] or not self.settings["app_secret"] or not self.settings["access_token"] or not self.settings["merchant_id"]:
            return {"status": "error", "message": "Missing Petpooja credentials (App Key, Secret, or Access Token)"}

        # Format order for Petpooja
        payload = self._format_order(order_doc)
        
        headers = {
            "Content-Type": "application/json"
        }

        try:
            # Petpooja 'Save Order' endpoint
            response = requests.post(
                f"{self.api_url}save_order",
                headers=headers,
                data=json.dumps(payload),
                timeout=15
            )
            response.raise_for_status()
            result = response.json()

            if result.get("success") == "1":
                return {"status": "success", "pos_order_id": result.get("orderID")}
            else:
                return {"status": "error", "message": result.get("message", "Unknown Petpooja error")}

        except Exception as e:
            frappe.log_error(frappe.get_traceback(), "Petpooja Order Push Error")
            return {"status": "error", "message": str(e)}

    def handle_callback(self, data):
        """
        Handle order status update from Petpooja
        """
        petpooja_status = data.get("status")
        client_order_id = data.get("clientorderID")

        if not client_order_id:
            return

        order = frappe.get_doc("Order", client_order_id)
        new_status = self.map_status(petpooja_status)
        
        if new_status and order.status != new_status:
            order.status = new_status
            order.save()
            frappe.db.commit()

    def map_status(self, provider_status):
        """
        Map Petpooja status codes to Dinematters statuses
        """
        mapping = {
            "1": "Accepted",      # Accepted
            "2": "Accepted",      # Cooking
            "3": "Accepted",      # Food Ready
            "4": "Dispatched",    # Dispatched
            "5": "ready",         # Ready
            "10": "delivered",    # Delivered
            "-1": "cancelled"     # Cancelled
        }
        return mapping.get(str(provider_status))

    def _format_order(self, order_doc):
        """
        Map Dinematters Order to Petpooja 'Save Order' 2026 schema
        """
        order_items = []
        for item in order_doc.order_items:
            order_items.append({
                "item_id": item.product,
                "item_name": item.product_name,
                "quantity": str(item.quantity),
                "price": str(item.price),
                "total": str(item.total_price),
                "discount": "0",
                "tax": "0" 
            })

        # Base payload with authentication
        payload = {
            "app_key": self.settings["app_key"],
            "app_secret": self.settings["app_secret"],
            "access_token": self.settings["access_token"],
            "restID": self.settings["merchant_id"],
            "clientorderID": order_doc.name,
            "order": {
                "customer": {
                    "name": order_doc.customer_name or "Guest",
                    "phone": order_doc.customer_phone or "",
                    "email": order_doc.customer_email or "",
                    "address": order_doc.address or ""
                },
                "details": {
                    "order_number": order_doc.order_number,
                    "order_date": order_doc.creation.strftime("%Y-%m-%d %H:%M:%S"),
                    "order_type": "1" if order_doc.order_type == "dine_in" else "2",
                    "subtotal": str(order_doc.subtotal),
                    "tax": str(order_doc.tax),
                    "total": str(order_doc.total),
                    "payment_type": "1" if order_doc.payment_method == "online" else "0",
                    "items": order_items
                }
            }
        }

        # Add table info if dine-in
        if order_doc.order_type == "dine_in" and order_doc.table_number:
            payload["order"]["details"]["table_no"] = str(order_doc.table_number)

        return payload

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
        Petpooja usually pushes the menu to us.
        We provide pull_menu as the standardized way to trigger this.
        """
        return self.pull_menu()

    def pull_menu(self):
        """
        Fetch menu from Petpooja (Pull strategy)
        """
        # In actual Petpooja implementation, this often requires hitting /get_menus
        # For now, we provide the template for the 'Price Override' sync logic
        frappe.log_error(f"Pull Menu triggered for {self.restaurant.name}", "Petpooja Sync")
        
        # This would be the mapping logic once response is received:
        # 1. Resolve Category
        # 2. Sync Product (Boss Logic: Override Price)
        
        return {"status": "success", "message": "Pull Menu initiated for Petpooja."}

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
        Handle order status update from Petpooja (Production Implementation)
        """
        petpooja_status = str(data.get("status"))
        client_order_id = data.get("clientorderID")
        pos_order_id = data.get("orderID")
        app_key = data.get("app_key")

        # Production Security: Validate App Key if provided
        if app_key and app_key != self.settings.get("app_key"):
            frappe.log_error(f"Petpooja callback invalid app_key: {app_key}", "Petpooja Webhook Auth Error")
            return

        if not client_order_id:
            frappe.log_error(f"Petpooja callback missing clientorderID: {json.dumps(data)}", "Petpooja Webhook Error")
            return

        try:
            order = frappe.get_doc("Order", client_order_id)
            
            # Map Petpooja status to DineMatters status
            new_status = self.map_status(petpooja_status)
            if not new_status:
                frappe.log_error(f"Received unknown Petpooja status: {petpooja_status} for order {client_order_id}", "Petpooja Sync Warning")
                return

            # Status Transition Safety: Don't move backwards
            status_priority = {
                "pending": 0,
                "Accepted": 1,
                "preparing": 2,
                "ready": 3,
                "Dispatched": 4,
                "delivered": 5,
                "cancelled": -1
            }

            current_priority = status_priority.get(order.status, 0)
            new_priority = status_priority.get(new_status, 0)

            if new_status == "cancelled":
                # Cancellation is always valid unless already delivered
                if order.status == "delivered":
                    return 
            elif new_priority <= current_priority:
                # Ignore status updates that are older or the same as current
                return

            # Update Order
            order.db_set("status", new_status)
            order.db_set("pos_sync_status", f"Petpooja: {petpooja_status}")
            
            # Real-time update for Merchant and Customer
            from dinematters.dinematters.api.realtime import notify_order_update
            notify_order_update(order)

            # Log for production audit
            frappe.logger().info(f"Petpooja Sync: Order {order.name} status updated to {new_status} (Petpooja: {petpooja_status})")

        except frappe.DoesNotExistError:
            frappe.log_error(f"Petpooja callback for non-existent order: {client_order_id}", "Petpooja Webhook Error")
        except Exception as e:
            frappe.log_error(f"Error handling Petpooja status callback: {str(e)}\n{frappe.get_traceback()}", "Petpooja Sync Error")

    def map_status(self, provider_status):
        """
        Map Petpooja status codes to Dinematters statuses (Unified Engine)
        """
        from dinematters.dinematters.pos.base import DineMattersOrderStatus
        
        mapping = {
            "1": DineMattersOrderStatus.ACCEPTED,
            "2": DineMattersOrderStatus.PREPARING,
            "3": DineMattersOrderStatus.READY,
            "4": DineMattersOrderStatus.DISPATCHED,
            "5": DineMattersOrderStatus.DELIVERED,
            "10": DineMattersOrderStatus.DELIVERED,
            "-1": DineMattersOrderStatus.CANCELLED
        }
        return mapping.get(str(provider_status))

    def _format_order(self, order_doc):
        """
        Map Dinematters Order to Petpooja 'Save Order' 2026 schema
        Supports: Dine-In (1), Takeaway (2), Delivery (3)
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

        # Determine Order Type
        # 1: Dine-In, 2: Takeaway, 3: Delivery
        order_type_map = {
            "dine_in": "1",
            "takeaway": "2",
            "delivery": "3"
        }
        order_type = order_type_map.get(order_doc.order_type, "2")

        # Construct Address for Delivery
        # Petpooja expects a consolidated address or granular fields. 2026 spec prefers granular.
        full_address = order_doc.delivery_address or ""
        if order_doc.delivery_landmark:
            full_address += f" (Landmark: {order_doc.delivery_landmark})"

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
                    "address": full_address,
                    "city": order_doc.delivery_city or "",
                    "zip": order_doc.delivery_zip_code or ""
                },
                "details": {
                    "order_number": order_doc.order_number,
                    "order_date": order_doc.creation.strftime("%Y-%m-%d %H:%M:%S"),
                    "order_type": order_type,
                    "subtotal": str(order_doc.subtotal),
                    "tax": str(order_doc.tax),
                    "total": str(order_doc.total),
                    "payment_type": "1" if order_doc.payment_method == "online" else "0",
                    "discount": str(order_doc.discount or 0.0),
                    "instructions": order_doc.delivery_instructions or "",
                    "items": order_items
                }
            }
        }

        # Add table info if dine-in
        if order_type == "1" and order_doc.table_number:
            payload["order"]["details"]["table_no"] = str(order_doc.table_number)

        return payload

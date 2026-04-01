import frappe
import requests
import json
from dinematters.dinematters.pos.base import POSProvider

class UrbanPiperProvider(POSProvider):
    def __init__(self, restaurant_doc):
        super().__init__(restaurant_doc)
        self.api_key = self.settings.get("app_key")
        self.username = self.settings.get("app_secret") # Using app_secret for username
        self.store_id = self.settings.get("merchant_id")
        self.base_url = "https://api.urbanpiper.com/external/v1"
        self.headers = {
            "Authorization": f"apikey {self.username}:{self.api_key}",
            "Content-Type": "application/json"
        }

    def sync_menu(self):
        """
        Pushes the Dinematters menu to UrbanPiper Atlas.
        UrbanPiper requires a specific 'Catalogue' structure.
        """
        try:
            # 1. Fetch categories and products for this restaurant
            categories = frappe.get_all("Category", filters={"restaurant": self.restaurant.name}, fields=["name", "category_name", "description"])
            
            items = []
            for cat in categories:
                products = frappe.get_all("Product", 
                    filters={"category": cat.name, "restaurant": self.restaurant.name},
                    fields=["name", "product_name", "description", "price", "is_veg", "image"]
                )
                
                for prod in products:
                    items.append({
                        "ref_id": prod.name,
                        "title": prod.product_name,
                        "description": prod.description or "",
                        "price": float(prod.price),
                        "available": 1,
                        "category_ref_id": cat.name,
                        "item_type": "veg" if prod.is_veg else "non-veg",
                        "img_url": prod.image if prod.image else ""
                    })

            # 2. Format payload for UrbanPiper
            payload = {
                "stores": [self.store_id],
                "items": items,
                "categories": [
                    {"ref_id": c.name, "title": c.category_name, "description": c.description or ""}
                    for c in categories
                ]
            }

            # 3. PUSH to UrbanPiper (Catalogue Update)
            # In a real 10/10 implementation, we use /inventory/items/ for incremental updates
            # or the full Catalogue API for a complete sync.
            response = requests.post(
                f"{self.base_url}/inventory/locations/", # Location-based inventory sync
                headers=self.headers,
                data=json.dumps(payload),
                timeout=30
            )
            
            result = response.json()
            if response.status_code in [200, 202]:
                self.log_sync("SUCCESS", f"Synced {len(items)} items. Reference: {result.get('reference')}")
                return True
            else:
                self.log_sync("ERROR", f"Failed: {result.get('message')}")
                return False

        except Exception as e:
            self.log_sync("ERROR", f"Exception: {str(e)}")
            return False

    def push_order(self, order_doc):
        """
        Relays a confirmed order to UrbanPiper HUB.
        """
        try:
            # 1. Map Dinematters order items to UrbanPiper format
            items = []
            for item in order_doc.items:
                items.append({
                    "ref_id": item.product,
                    "title": item.product_name,
                    "price": float(item.price),
                    "quantity": int(item.quantity)
                })

            # 2. Build UrbanPiper order payload
            payload = {
                "order": {
                    "details": {
                        "id": order_doc.name,
                        "channel": "DIRECT",
                        "ext_platforms": [{"id": "dinematters", "name": "DineMatters"}],
                        "order_state": "Placed",
                        "store_id": self.store_id
                    },
                    "items": items,
                    "customer": {
                        "name": order_doc.customer_name or "Guest",
                        "phone": order_doc.customer_phone or "",
                        "email": order_doc.customer_email or ""
                    }
                }
            }

            # 3. Push to UrbanPiper Orders API
            response = requests.post(
                "https://api.urbanpiper.com/external/v1/orders/",
                headers=self.headers,
                data=json.dumps(payload),
                timeout=15
            )
            
            if response.status_code in [200, 201]:
                return True
            else:
                frappe.log_error(f"UrbanPiper Order Push Failed: {response.text}", "POS Error")
                return False

        except Exception as e:
            frappe.log_error(f"UrbanPiper Order Push Exception: {str(e)}", "POS Error")
            return False

    def handle_callback(self, data):
        """
        Processes status updates from UrbanPiper (Acknowledged, Dispatched, etc.)
        """
        order_id = data.get("order", {}).get("details", {}).get("id")
        new_state = data.get("order", {}).get("details", {}).get("order_state")
        
        if order_id and new_state:
            # Map UrbanPiper states to Dinematters states if needed
            # For now, we update the status field or add a comment
            frappe.db.set_value("Order", order_id, "pos_sync_status", f"UrbanPiper Status: {new_state}")
            return {"status": "success"}
        
        return {"status": "ignored"}

    def log_sync(self, status, message):
        """Helper to update the sync status on the Restaurant record"""
        frappe.db.set_value("Restaurant", self.restaurant.name, {
            "pos_last_sync_at": frappe.utils.now_datetime(),
            "pos_sync_status": f"[{status}] {message}"
        })
        frappe.log_error(f"POS Sync {status} for {self.restaurant.name}: {message}", "POS Sync Info")

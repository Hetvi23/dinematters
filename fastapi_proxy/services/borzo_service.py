import httpx
import logging
from typing import Dict, Any, Optional
from config import settings

logger = logging.getLogger(__name__)

class BorzoService:
    def __init__(self):
        self.api_token = settings.borzo_api_token
        self.base_url = settings.borzo_api_url if settings.borzo_mode == "production" else settings.borzo_sandbox_url
        self.headers = {
            "X-DV-Auth-Token": self.api_token,
            "Content-Type": "application/json"
        }

    async def create_delivery(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a delivery order in Borzo.
        """
        if not self.api_token:
            logger.error("Borzo API token is missing")
            return {"success": False, "error": "Borzo API token is missing"}

        # Map points
        points = []
        
        # Pickup point
        pickup_point = {
            "address": order_data.get("pickup_address"),
            "contact_person": {
                "phone": order_data.get("pickup_phone"),
                "name": order_data.get("pickup_name")
            }
        }
        
        pickup_pin = order_data.get("pickup_location_pin")
        if pickup_pin and "," in pickup_pin:
            try:
                lat, lng = pickup_pin.split(",")
                pickup_point["latitude"] = float(lat.strip())
                pickup_point["longitude"] = float(lng.strip())
            except Exception:
                pass
        points.append(pickup_point)
        
        # Drop point
        drop_point = {
            "address": order_data.get("drop_address"),
            "contact_person": {
                "phone": order_data.get("drop_phone"),
                "name": order_data.get("drop_name")
            },
            "note": order_data.get("order_items_summary", "Food Order"),
            "payment_amount": str(order_data.get("cod_amount", 0)) if order_data.get("is_cod") else "0"
        }
        
        drop_pin = order_data.get("drop_location_pin")
        if drop_pin and "," in drop_pin:
            try:
                lat, lng = drop_pin.split(",")
                drop_point["latitude"] = float(lat.strip())
                drop_point["longitude"] = float(lng.strip())
            except Exception:
                pass
        points.append(drop_point)

        payload = {
            "type": "standard",
            "matter": "Food Delivery",
            "points": points
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/create-order",
                    json=payload,
                    headers=self.headers,
                    timeout=30.0
                )
                res_data = response.json()
                
                if response.status_code == 200 and res_data.get("is_successful"):
                    order_res = res_data.get("order", {})
                    return {
                        "success": True,
                        "delivery_id": str(order_res.get("order_id")),
                        "status": order_res.get("status_description") or order_res.get("status"),
                        "tracking_url": order_res.get("tracking_url"),
                        "raw_response": res_data
                    }
                else:
                    error_msg = res_data.get("errors", ["Unknown error"])[0]
                    logger.error(f"Borzo API Error: {error_msg} | Response: {res_data}")
                    return {"success": False, "error": error_msg, "raw_response": res_data}
            except Exception as e:
                logger.error(f"Exception in Borzo create_delivery: {str(e)}")
                return {"success": False, "error": str(e)}

    async def cancel_delivery(self, delivery_id: str) -> Dict[str, Any]:
        """
        Cancels a delivery order in Borzo.
        """
        if not self.api_token:
            return {"success": False, "error": "Borzo API token is missing"}

        payload = {"order_id": delivery_id}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/cancel-order",
                    json=payload,
                    headers=self.headers,
                    timeout=30.0
                )
                res_data = response.json()
                if response.status_code == 200 and res_data.get("is_successful"):
                    return {"success": True}
                else:
                    error_msg = res_data.get("errors", ["Unknown error"])[0]
                    return {"success": False, "error": error_msg}
            except Exception as e:
                return {"success": False, "error": str(e)}

    async def fetch_status(self, delivery_id: str) -> Dict[str, Any]:
        """
        Fetches delivery status from Borzo.
        """
        if not self.api_token:
            return {"success": False, "error": "Borzo API token is missing"}

        params = {"order_id": delivery_id}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/orders",
                    params=params,
                    headers=self.headers,
                    timeout=30.0
                )
                res_data = response.json()
                if response.status_code == 200 and res_data.get("is_successful"):
                    orders = res_data.get("orders", [])
                    if not orders:
                        return {"success": False, "error": "Order not found"}
                    
                    order_res = orders[0]
                    courier = order_res.get("courier", {})
                    
                    return {
                        "success": True,
                        "status": order_res.get("status_description") or order_res.get("status"),
                        "delivery_id": str(order_res.get("order_id")),
                        "tracking_url": order_res.get("tracking_url"),
                        "rider_name": courier.get("name"),
                        "rider_phone": courier.get("phone"),
                        "raw_response": order_res
                    }
                else:
                    error_msg = res_data.get("errors", ["Unknown error"])[0]
                    return {"success": False, "error": error_msg}
            except Exception as e:
                return {"success": False, "error": str(e)}

borzo_service = BorzoService()

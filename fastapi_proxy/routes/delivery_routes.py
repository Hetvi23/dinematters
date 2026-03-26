from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import logging
import sys
import os

# Handle imports - work as both module and script
_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_current_dir)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)

from clients.erpnext_client import get_erpnext_client
from utils.auth import get_current_user, TokenData
from services.borzo_service import borzo_service
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

class AssignDeliveryRequest(BaseModel):
    order_id: str
    delivery_mode: str  # 'auto' or 'manual'
    partner_name: Optional[str] = None
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    eta: Optional[str] = None

class CancelDeliveryRequest(BaseModel):
    order_id: str
    delivery_id: str

@router.post("/assign")
async def assign_delivery(
    request: AssignDeliveryRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Assign delivery (Auto via Borzo or Manual)
    """
    client = get_erpnext_client()
    
    try:
        # Fetch order from ERPNext to get details
        # Using the helper method get_resource or call_method correctly
        order_res = await client.call_method(
            "frappe.client.get",
            params={
                "doctype": "Order",
                "name": request.order_id
            },
            http_method="GET"
        )
        
        if not order_res or not order_res.get("message"):
            raise HTTPException(status_code=404, detail="Order not found")
        
        order = order_res["message"]
        
        if request.delivery_mode == "manual":
            # Manual assignment - just update original order
            update_data = {
                "delivery_partner": "manual",
                "delivery_mode": "manual",
                "delivery_status": "assigned",
                "delivery_rider_name": request.rider_name,
                "delivery_rider_phone": request.rider_phone,
                "delivery_eta": request.eta
            }
            
            await client.call_method(
                "frappe.client.set_value",
                data={
                    "doctype": "Order",
                    "name": request.order_id,
                    "fieldname": update_data
                },
                http_method="POST"
            )
            return {"success": True, "message": "Manual delivery assigned"}
            
        else:
            # Borzo (Auto) assignment
            
            # Fetch restaurant details for pickup info
            restaurant_res = await client.call_method(
                "frappe.client.get",
                params={
                    "doctype": "Restaurant",
                    "name": order.get("restaurant")
                },
                http_method="GET"
            )
            restaurant = restaurant_res.get("message", {})
            
            pickup_address = restaurant.get("address")
            if not pickup_address:
                 pickup_address = f"{restaurant.get('restaurant_name')}, {restaurant.get('city', '')}"

            borzo_data = {
                "pickup_address": pickup_address,
                "pickup_phone": restaurant.get("phone"),
                "pickup_name": restaurant.get("restaurant_name"),
                "drop_address": order.get("delivery_address"),
                "drop_phone": order.get("customer_phone"),
                "drop_name": order.get("customer_name"),
                "drop_location_pin": order.get("delivery_location_pin"),
                "pickup_location_pin": restaurant.get("location_pin"),
                "order_items_summary": f"Order #{order.get('order_number')}",
                "cod_amount": order.get("total"),
                "is_cod": order.get("payment_method") == "cash"
            }
            
            # 2. Call Borzo Service
            res = await borzo_service.create_delivery(borzo_data)
            
            if res.get("success"):
                # 3. Update Order in ERPNext
                update_data = {
                    "delivery_partner": "borzo",
                    "delivery_mode": "auto",
                    "delivery_id": res.get("delivery_id"),
                    "delivery_status": res.get("status"),
                    "delivery_tracking_url": res.get("tracking_url")
                }
                
                await client.call_method(
                    "frappe.client.set_value",
                    data={
                        "doctype": "Order",
                        "name": request.order_id,
                        "fieldname": update_data
                    },
                    http_method="POST"
                )
                return {"success": True, "delivery_id": res.get("delivery_id")}
            else:
                return {"success": False, "error": res.get("error")}
                
    except Exception as e:
        logger.error(f"Error in assign_delivery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel")
async def cancel_delivery(
    request: CancelDeliveryRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Cancel delivery assignment
    """
    client = get_erpnext_client()
    
    try:
        order_res = await client.call_method(
            "frappe.client.get",
            params={
                "doctype": "Order",
                "name": request.order_id
            },
            http_method="GET"
        )
        order = order_res.get("message", {})
        
        if order.get("delivery_partner") == "borzo" and request.delivery_id:
             borzo_res = await borzo_service.cancel_delivery(request.delivery_id)
             
        # 2. Update Order in ERPNext
        update_data = {
            "delivery_id": None,
            "delivery_status": "cancelled",
            "delivery_rider_name": None,
            "delivery_rider_phone": None,
            "delivery_tracking_url": None
        }
        
        await client.call_method(
            "frappe.client.set_value",
            data={
                "doctype": "Order",
                "name": request.order_id,
                "fieldname": update_data
            },
            http_method="POST"
        )
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error in cancel_delivery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/borzo-webhook")
async def borzo_webhook(request: Request):
    """
    Handle Borzo status update webhooks
    """
    client = get_erpnext_client()
    
    try:
        payload = await request.json()
        logger.info(f"Received Borzo webhook: {payload}")
        
        order_data = payload.get("order", {})
        delivery_id = str(order_data.get("order_id"))
        new_status = order_data.get("status_description") or order_data.get("status")
        
        if not delivery_id:
            return {"status": "ignored", "reason": "missing delivery_id"}
            
        # 1. Find the order with this delivery_id in ERPNext
        filters = {"delivery_id": delivery_id}
        orders_res = await client.call_method(
            "frappe.client.get_list",
            params={
                "doctype": "Order",
                "filters": json.dumps(filters),
                "fields": ["name", "status"]
            },
            http_method="GET"
        )
        
        orders = orders_res.get("message", [])
        if not orders:
            logger.warning(f"No order found for delivery_id: {delivery_id}")
            return {"status": "not_found"}
            
        order_name = orders[0]["name"]
        
        # 2. Update delivery status
        update_data = {
            "delivery_status": new_status
        }
        
        courier = order_data.get("courier", {})
        if courier:
            update_data["delivery_rider_name"] = courier.get("name")
            update_data["delivery_rider_phone"] = courier.get("phone")
            
        if new_status == "delivered":
            update_data["status"] = "delivered"

        await client.call_method(
            "frappe.client.set_value",
            data={
                "doctype": "Order",
                "name": order_name,
                "fieldname": update_data
            },
            http_method="POST"
        )
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error in Borzo webhook: {str(e)}")
        return {"status": "error", "message": str(e)}

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

from services.porter_service import create_delivery, cancel_delivery, fetch_status
from clients.erpnext_client import get_erpnext_client
from utils.auth import get_current_user, TokenData

logger = logging.getLogger(__name__)
router = APIRouter()

class AssignDeliveryRequest(BaseModel):
    order_id: str
    
class CancelDeliveryRequest(BaseModel):
    delivery_id: str
    order_id: Optional[str] = None
    
@router.post("/assign")
async def assign_delivery(
    request: AssignDeliveryRequest,
    current_user: TokenData = Depends(get_current_user)
):
    client = get_erpnext_client()
    
    try:
        # Get order details from Frappe wrapping API
        order_resp = await client.call_method(
            "dinematters.dinematters.api.documents.get_doc",
            data={"doctype": "Order", "name": request.order_id},
            http_method="POST"
        )
        order_data = order_resp.get("message", {})
        if not order_data:
            raise HTTPException(status_code=404, detail="Order not found")
            
        # Try to extract the document dictionary if it's wrapped
        if isinstance(order_data, dict) and order_data.get("name") == request.order_id:
            pass # direct response
        elif "order_id" in order_data:
            pass
            
        delivery_result = await create_delivery(order_data)
        
        # We need to update existing Order with delivery parameters
        # Fast API proxy usually uses set_value for specific fields or update_doc
        update_resp = await client.call_method(
            "dinematters.dinematters.api.documents.update_doc",
            data={
                "doctype": "Order",
                "name": request.order_id,
                "doc": {
                    "delivery_partner": "porter",
                    "delivery_id": delivery_result.get("order_id"),
                    "delivery_status": delivery_result.get("status"),
                    "delivery_eta": delivery_result.get("estimated_delivery_time"),
                    "delivery_tracking_url": delivery_result.get("tracking_url")
                }
            },
            http_method="POST"
        )
        return {"success": True, "delivery": delivery_result}
        
    except Exception as e:
        logger.error(f"Error in assign_delivery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel")
async def handle_cancel_delivery(
    request: CancelDeliveryRequest,
    current_user: TokenData = Depends(get_current_user)
):
    try:
        result = await cancel_delivery(request.delivery_id)
        
        if request.order_id:
            client = get_erpnext_client()
            await client.call_method(
                "dinematters.dinematters.api.documents.update_doc",
                data={
                    "doctype": "Order",
                    "name": request.order_id,
                    "doc": {
                        "delivery_status": "cancelled"
                    }
                },
                http_method="POST"
            )
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Error in cancel_delivery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{delivery_id}")
async def get_delivery_status(
    delivery_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    try:
        result = await fetch_status(delivery_id)
        return {"success": True, "status": result}
    except Exception as e:
        logger.error(f"Error in fetch_status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhooks/porter")
async def porter_webhook(request: Request):
    """
    Webhook endpoint for Porter to send live status updates
    Note: Does not require frontend authentication
    """
    try:
        payload = await request.json()
        logger.info(f"Received Porter Webhook: {payload}")
        
        delivery_id = payload.get("order_id")
        new_status = payload.get("status")
        
        if delivery_id and new_status:
            client = get_erpnext_client()
            
            # Find the order associated with this delivery ID
            list_resp = await client.call_method(
                "dinematters.dinematters.api.documents.get_doc_list",
                data={
                    "doctype": "Order",
                    "filters": {"delivery_id": delivery_id},
                    "limit_page_length": 1
                },
                http_method="POST"
            )
            
            orders = list_resp.get("message", [])
            if orders:
                order_name = orders[0].get("name")
                update_data = {
                    "delivery_status": new_status
                }
                
                rider = payload.get("rider_details", {})
                if rider:
                    update_data["delivery_rider_name"] = rider.get("name")
                    update_data["delivery_rider_phone"] = rider.get("phone")
                
                await client.call_method(
                    "dinematters.dinematters.api.documents.update_doc",
                    data={
                        "doctype": "Order",
                        "name": order_name,
                        "doc": update_data
                    },
                    http_method="POST"
                )
                
        return {"success": True}
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging
import httpx
import sys
import os

_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_current_dir)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)

from utils.auth import get_current_user, TokenData
from services.borzo_service import borzo_service
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ── ERPNext REST helpers ──────────────────────────────────────────────────────

ERPNEXT_BASE = settings.erpnext_base_url.rstrip("/")
ERPNEXT_HEADERS = {
    "Authorization": f"token {settings.erpnext_api_key}:{settings.erpnext_api_secret}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


async def _erpnext_get(doctype: str, name: str) -> Dict[str, Any]:
    """GET /api/resource/{doctype}/{name}"""
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(f"{ERPNEXT_BASE}/api/resource/{doctype}/{name}", headers=ERPNEXT_HEADERS)
        r.raise_for_status()
        return r.json().get("data", {})


async def _erpnext_patch(doctype: str, name: str, fields: Dict[str, Any]) -> None:
    """PATCH /api/resource/{doctype}/{name}  – updates only supplied fields"""
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.patch(
            f"{ERPNEXT_BASE}/api/resource/{doctype}/{name}",
            headers=ERPNEXT_HEADERS,
            json=fields,
        )
        r.raise_for_status()


# ── Request models ─────────────────────────────────────────────────────────────

class AssignDeliveryRequest(BaseModel):
    order_id: str
    delivery_mode: str          # 'auto' or 'manual'
    partner_name: Optional[str] = None
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    eta: Optional[str] = None


class CancelDeliveryRequest(BaseModel):
    order_id: str
    delivery_id: str


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/assign")
async def assign_delivery(
    request: AssignDeliveryRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Assign delivery – Auto via Borzo or Manual rider"""
    try:
        order = await _erpnext_get("Order", request.order_id)

        # ── Manual assignment ──────────────────────────────────────────────────
        if request.delivery_mode == "manual":
            await _erpnext_patch("Order", request.order_id, {
                "delivery_partner": request.partner_name or "manual",
                "delivery_status": "assigned",
                "delivery_rider_name": request.rider_name,
                "delivery_rider_phone": request.rider_phone,
                "delivery_eta": request.eta,
            })
            return {"success": True, "message": "Manual delivery assigned"}

        # ── Borzo automatic assignment ─────────────────────────────────────────
        restaurant = await _erpnext_get("Restaurant", order.get("restaurant"))

        pickup_address = (
            restaurant.get("address")
            or f"{restaurant.get('restaurant_name', '')}, {restaurant.get('city', '')}"
        )
        pickup_phone  = restaurant.get("phone")

        if not pickup_phone:
            return {
                "success": False,
                "error": (
                    "Restaurant phone number is not configured. "
                    "Please update the restaurant profile with a contact phone number before assigning Borzo delivery."
                )
            }

        borzo_data = {
            "pickup_address":      pickup_address,
            "pickup_phone":        pickup_phone,
            "pickup_name":         restaurant.get("restaurant_name"),
            "pickup_location_pin": restaurant.get("location_pin"),
            "drop_address":        order.get("delivery_address"),
            "drop_phone":          order.get("customer_phone"),
            "drop_name":           order.get("customer_name"),
            "drop_location_pin":   order.get("delivery_location_pin"),
            "order_items_summary": f"Order #{order.get('order_number')}",
            "cod_amount":          order.get("total"),
            "is_cod":              order.get("payment_method") == "cash",
        }

        res = await borzo_service.create_delivery(borzo_data)

        if res.get("success"):
            await _erpnext_patch("Order", request.order_id, {
                "delivery_partner":     "borzo",
                "delivery_id":          res.get("delivery_id"),
                "delivery_status":      res.get("status"),
                "delivery_tracking_url": res.get("tracking_url"),
            })
            return {
                "success":      True,
                "delivery_id":  res.get("delivery_id"),
                "tracking_url": res.get("tracking_url"),
                "status":       res.get("status"),
            }

        return {"success": False, "error": res.get("error")}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"assign_delivery error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
async def cancel_delivery(
    request: CancelDeliveryRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Cancel an active delivery assignment"""
    try:
        order = await _erpnext_get("Order", request.order_id)

        if order.get("delivery_partner") == "borzo" and request.delivery_id:
            await borzo_service.cancel_delivery(request.delivery_id)

        await _erpnext_patch("Order", request.order_id, {
            "delivery_id":          None,
            "delivery_status":      "cancelled",
            "delivery_rider_name":  None,
            "delivery_rider_phone": None,
            "delivery_tracking_url": None,
        })
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"cancel_delivery error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/borzo-webhook")
async def borzo_webhook(request: Request):
    """Receive Borzo status-update webhooks and sync to ERPNext"""
    # Verify callback token if configured
    expected_token = settings.borzo_webhook_token
    if expected_token:
        received_token = request.headers.get("X-DV-Auth-Token", "")
        if received_token != expected_token:
            logger.warning(f"Borzo webhook: invalid token received")
            raise HTTPException(status_code=401, detail="Invalid webhook token")

    try:
        payload = await request.json()
        logger.info(f"Borzo webhook received: {payload}")

        order_data = payload.get("order", {})
        delivery_id = str(order_data.get("order_id", ""))
        new_status  = order_data.get("status_description") or order_data.get("status")

        if not delivery_id:
            return {"status": "ignored", "reason": "missing delivery_id"}

        # Find order by delivery_id via list resource
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(
                f"{ERPNEXT_BASE}/api/resource/Order",
                headers=ERPNEXT_HEADERS,
                params={
                    "filters": f'[["delivery_id","=","{delivery_id}"]]',
                    "fields": '["name","status"]',
                    "limit": "1",
                },
            )
            r.raise_for_status()
            orders = r.json().get("data", [])

        if not orders:
            logger.warning(f"No order for delivery_id {delivery_id}")
            return {"status": "not_found"}

        order_name = orders[0]["name"]
        update = {"delivery_status": new_status}

        courier = order_data.get("courier") or {}
        if courier.get("name"):
            update["delivery_rider_name"]  = courier["name"]
        if courier.get("phone"):
            update["delivery_rider_phone"] = courier["phone"]

        if new_status in ("delivered", "Delivered"):
            update["status"] = "delivered"

        await _erpnext_patch("Order", order_name, update)
        return {"status": "success"}

    except Exception as e:
        logger.error(f"Borzo webhook error: {e}")
        return {"status": "error", "message": str(e)}

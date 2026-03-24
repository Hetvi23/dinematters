import logging
import httpx
import os
import uuid
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Base Porter API configuration
# Should be loaded from environment variables in a real deployment
PORTER_API_KEY = os.getenv("PORTER_API_KEY", "dummy_porter_key")
PORTER_API_URL = os.getenv("PORTER_API_URL", "https://papi.porter.in/v1") 

async def create_delivery(order_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a delivery request via Porter API.
    Expected order_data struct contains pickup, drop, and order summary.
    """
    # Prepare payload per standard delivery API structures
    payload = {
        "request_id": str(uuid.uuid4()),
        "delivery_instructions": {
            "instructions_list": [
                {"type": "text", "description": order_data.get("delivery_instructions", "")}
            ]
        },
        "pickup_details": {
            "address": {
                "apartment_address": order_data.get("restaurant_address", "Restaurant Address"),
                "street_address": order_data.get("restaurant_address", "Restaurant Street"),
                "city": order_data.get("restaurant_city", "City"),
                "state": order_data.get("restaurant_state", "State"),
                "pincode": order_data.get("restaurant_zip", "000000"),
                "lat": order_data.get("restaurant_lat", 0.0),
                "lng": order_data.get("restaurant_lng", 0.0)
            },
            "contact_details": {
                "name": order_data.get("restaurant_name", "Restaurant Name"),
                "phone_number": order_data.get("restaurant_phone", "0000000000")
            }
        },
        "drop_details": {
            "address": {
                "apartment_address": order_data.get("delivery_address", "Drop Address"),
                "street_address": order_data.get("delivery_landmark", ""),
                "city": order_data.get("delivery_city", ""),
                "state": order_data.get("delivery_state", ""),
                "pincode": order_data.get("delivery_zip_code", ""),
                "lat": 0.0,
                "lng": 0.0
            },
            "contact_details": {
                "name": order_data.get("customer_name", "Customer"),
                "phone_number": str(order_data.get("customer_phone", "0000000000")).replace('+91', '')
            }
        }
    }

    # Use httpx to make the API request. 
    # For now, we mock the response to avoid hitting physical live endpoints with dummy keys.
    # In production, this would be:
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(
    #         f"{PORTER_API_URL}/orders/create",
    #         json=payload,
    #         headers={"x-api-key": PORTER_API_KEY, "Content-Type": "application/json"}
    #     )
    #     response.raise_for_status()
    #     return response.json()

    logger.info(f"Mocking Porter API create delivery for order: {order_data.get('order_id')}")
    # Mock Response
    return {
        "order_id": f"PRT-{str(uuid.uuid4())[:8].upper()}",
        "estimated_pickup_time": "15 mins",
        "estimated_delivery_time": "45 mins",
        "delivery_fee": 50,
        "status": "driver_assigned",
        "tracking_url": f"https://track.porter.in/{str(uuid.uuid4())[:8]}"
    }

async def cancel_delivery(delivery_id: str) -> Dict[str, Any]:
    """
    Cancel an active delivery request via Porter API.
    """
    logger.info(f"Mocking Porter API cancel delivery for delivery_id: {delivery_id}")
    return {
        "status": "cancelled",
        "message": f"Successfully cancelled delivery {delivery_id}"
    }

async def fetch_status(delivery_id: str) -> Dict[str, Any]:
    """
    Fetch the live status of the delivery.
    """
    logger.info(f"Mocking Porter API fetch status for delivery_id: {delivery_id}")
    return {
        "status": "in_transit",
        "rider_details": {
            "name": "Rider Name",
            "phone": "9876543210"
        },
        "eta": "15 mins"
    }


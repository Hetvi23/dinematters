import frappe
import json
from frappe import _
from frappe.utils import get_datetime, now_datetime
from dinematters.dinematters.pos.base import get_pos_provider

@frappe.whitelist()
def sync_menu(restaurant_id):
    """
    Manual trigger to sync menu from POS
    """
    restaurant = frappe.get_doc("Restaurant", restaurant_id)
    
    # 10/10 Tier Check: POS is a DIAMOND feature
    if restaurant.plan_type != "DIAMOND":
        frappe.throw(_("POS Integration is a premium feature available only on the DIAMOND plan."), frappe.PermissionError)
        
    provider = get_pos_provider(restaurant)
    
    if not provider:
        frappe.throw(_("POS integration is not enabled or configured for this restaurant."))
    
    # Enqueue as background job
    frappe.enqueue(
        "dinematters.dinematters.api.pos._sync_menu_job",
        restaurant_id=restaurant_id,
        now=frappe.flags.in_test
    )
    
    return {"status": "success", "message": "Menu sync task enqueued."}

def _sync_menu_job(restaurant_id):
    restaurant = frappe.get_doc("Restaurant", restaurant_id)
    provider = get_pos_provider(restaurant)
    if provider:
        # Provider sync_menu will update pos_sync_status internally for detailed logging
        provider.sync_menu()

@frappe.whitelist(allow_guest=True)
def petpooja_callback():
    """
    Endpoint for Petpooja to push status updates
    """
    if frappe.request.method != "POST":
        return {"status": "error", "message": "Method not allowed"}

    try:
        data = json.loads(frappe.request.data)
        # Petpooja context usually includes some restaurant identifier or the clientorderID
        # Let's assume the clientorderID is used to find the restaurant
        client_order_id = data.get("clientorderID")
        if not client_order_id:
            return {"status": "error", "message": "Missing clientorderID"}
        
        restaurant_id = frappe.db.get_value("Order", client_order_id, "restaurant")
        if not restaurant_id:
            return {"status": "error", "message": "Order not found"}
        
        restaurant = frappe.get_doc("Restaurant", restaurant_id)
        provider = get_pos_provider(restaurant)
        
        if provider:
            provider.handle_callback(data)
            return {"status": "success"}
        
        return {"status": "error", "message": "POS not enabled"}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Petpooja Callback Error")
        return {"status": "error", "message": str(e)}

@frappe.whitelist(allow_guest=True)
def petpooja_menu_push():
    """
    Endpoint for Petpooja to push their menu update
    """
    try:
        data = json.loads(frappe.request.data)
        
        # Log basic stats about the push
        stats = {
            "categories": len(data.get("categories", [])),
            "items": len(data.get("items", [])),
            "parentcategories": len(data.get("parentcategories", [])),
            "taxes": len(data.get("taxes", [])),
        }
        
        frappe.log_error(json.dumps(stats), "Petpooja Menu Push Stats")
        frappe.log_error(json.dumps(data), "Petpooja Menu Push Data")
        
        # TODO: Implement full mapping of categories and products
        return {"status": "success", "message": "Menu push received and logged"}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Petpooja Menu Push Error")
        return {"status": "error", "message": str(e)}
@frappe.whitelist(allow_guest=True)
def urbanpiper_callback():
    """
    Real-time status updates from UrbanPiper Atlas
    """
    try:
        data = json.loads(frappe.request.data)
        # UrbanPiper pushes order status updates with store_id and order_id
        order_info = data.get("order", {})
        store_id = order_info.get("details", {}).get("store_id")
        
        if not store_id:
            return {"status": "error", "message": "Missing store_id"}
            
        restaurant_name = frappe.db.get_value("Restaurant", {"pos_merchant_id": store_id}, "name")
        if not restaurant_name:
            return {"status": "error", "message": "Restaurant not found for Store ID"}
            
        restaurant = frappe.get_doc("Restaurant", restaurant_name)
        provider = get_pos_provider(restaurant)
        
        if provider and hasattr(provider, 'handle_callback'):
            provider.handle_callback(data)
            return {"status": "success"}
            
        return {"status": "error", "message": "UrbanPiper provider not active"}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "UrbanPiper Webhook Error")
        return {"status": "error", "message": str(e)}

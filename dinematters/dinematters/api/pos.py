import frappe
import json
from dinematters.dinematters.pos.base import get_pos_provider

@frappe.whitelist()
def sync_menu(restaurant_id):
    """
    Manual trigger to sync menu from POS
    """
    restaurant = frappe.get_doc("Restaurant", restaurant_id)
    provider = get_pos_provider(restaurant)
    
    if not provider:
        frappe.throw("POS integration is not enabled for this restaurant.")
    
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
        result = provider.sync_menu()
        restaurant.pos_sync_status = result.get("message", "Syncing...")
        restaurant.pos_last_sync_at = frappe.utils.now_datetime()
        restaurant.save(ignore_permissions=True)

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

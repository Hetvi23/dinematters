import frappe
from frappe.permissions import add_permission

def run():
    frappe.connect()
    
    # ---------------------------------------------------------
    # DineMatters Supervisor Permissions (FULL ACCESS)
    # ---------------------------------------------------------
    supervisor_role = "DineMatters Supervisor"
    
    # List of all restaurant-related doctypes for Supervisor
    supervisor_doctypes = [
        "Restaurant", "Restaurant Config", "Restaurant User", "Restaurant Table",
        "Restaurant Loyalty Config", "Restaurant Loyalty Entry",
        "Menu Product", "Menu Category", "Menu Product Addon", "Customization Option", "Customization Question",
        "Order", "Order Item", "Table Booking", "Banquet Booking", "Restaurant Table", 
        "Cart Entry", "Coupon", "Coupon Usage", "Offer", "Auto Offer", "Combo Offer", "Promo",
        "Game", "Event", "Home Feature", "Media Asset", "Media Upload Session", "Media Variant", "Product Media",
        "Coin Transaction", "Monthly Billing Ledger", "Monthly Revenue Ledger", 
        "Plan Change Log", "Referral Link", "Referral Visit", "OTP Verification Log",
        "AI Credit Transaction", "Customer", "Marketing Campaign", "Marketing Trigger",
        "Marketing Segment", "Marketing Event", "Analytics Event", "WhatsApp Lead Unlock"
    ]
    
    for dt in supervisor_doctypes:
        if not frappe.db.table_exists(dt):
            continue
            
        print(f"Setting permissions for {supervisor_role} on {dt}")
        # Add basic permission if not exists
        if not frappe.db.exists("Custom DocPerm", {"parent": dt, "role": supervisor_role}):
            add_permission(dt, supervisor_role, 0)
        
        # Grant full CRUD
        frappe.db.set_value("Custom DocPerm", {"parent": dt, "role": supervisor_role}, {
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "export": 1,
            "print": 1,
            "email": 1,
            "report": 1,
            "share": 1
        })

    # ---------------------------------------------------------
    # Restaurant Admin Permissions (OPERATIONAL CRUD)
    # ---------------------------------------------------------
    admin_role = "Restaurant Admin"
    
    # Operational DocTypes where Admin needs DELETE
    operational_doctypes = [
        "Menu Product", "Menu Category", "Menu Product Addon", "Customization Option", "Customization Question",
        "Restaurant User", "Restaurant Table", "Coupon", "Offer", "Event", "Game",
        "Table Booking", "Banquet Booking", "Home Feature", "Marketing Campaign", 
        "Marketing Trigger", "Marketing Segment", "Media Asset", "Media Upload Session"
    ]
    
    for dt in operational_doctypes:
        if not frappe.db.table_exists(dt):
            continue
            
        print(f"Setting permissions for {admin_role} on {dt}")
        if not frappe.db.exists("Custom DocPerm", {"parent": dt, "role": admin_role}):
            add_permission(dt, admin_role, 0)
            
        # Grant full CRUD
        frappe.db.set_value("Custom DocPerm", {"parent": dt, "role": admin_role}, {
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "export": 1,
            "print": 1,
            "email": 1,
            "report": 1,
            "share": 1
        })

    # Restricted DocTypes for Admin (No Delete)
    restricted_doctypes = [
        "Restaurant", "Restaurant Config", "Restaurant Loyalty Config", 
        "Customer", "Order", "Order Item", "Cart Entry"
    ]
    
    for dt in restricted_doctypes:
        if not frappe.db.table_exists(dt):
            continue
            
        print(f"Setting restricted permissions for {admin_role} on {dt}")
        if not frappe.db.exists("Custom DocPerm", {"parent": dt, "role": admin_role}):
            add_permission(dt, admin_role, 0)
            
        # Grant Read/Write/Create but NO Delete
        frappe.db.set_value("Custom DocPerm", {"parent": dt, "role": admin_role}, {
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 0
        })

    # Read-only DocTypes for Admin
    readonly_doctypes = [
        "Coin Transaction", "Monthly Billing Ledger", "Monthly Revenue Ledger", 
        "Plan Change Log", "Marketing Event", "Analytics Event", "Restaurant Loyalty Entry"
    ]
    
    for dt in readonly_doctypes:
        if not frappe.db.table_exists(dt):
            continue
            
        print(f"Setting read-only permissions for {admin_role} on {dt}")
        if not frappe.db.exists("Custom DocPerm", {"parent": dt, "role": admin_role}):
            add_permission(dt, admin_role, 0)
            
        # Grant Read only
        frappe.db.set_value("Custom DocPerm", {"parent": dt, "role": admin_role}, {
            "read": 1,
            "write": 0,
            "create": 0,
            "delete": 0
        })

    frappe.db.commit()
    # Clear cache for all modified doctypes
    all_modified = set(supervisor_doctypes + operational_doctypes + restricted_doctypes + readonly_doctypes)
    for dt in all_modified:
        if frappe.db.table_exists(dt):
            frappe.clear_cache(doctype=dt)
            
    print("All permissions updated successfully")

if __name__ == "__main__":
    run()

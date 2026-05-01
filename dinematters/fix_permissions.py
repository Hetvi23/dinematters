import frappe
from frappe.permissions import add_permission

def run():
    frappe.connect()
    doctype = "Menu Category"
    role = "DineMatters Supervisor"
    
    # Check if permission already exists
    if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role}):
        print(f"Adding delete permission for {role} on {doctype}")
        add_permission(doctype, role, 0)
        # Update delete permission
        frappe.db.set_value("Custom DocPerm", {"parent": doctype, "role": role}, "delete", 1)
    else:
        print(f"Permission already exists for {role} on {doctype}, ensuring delete=1")
        frappe.db.set_value("Custom DocPerm", {"parent": doctype, "role": role}, "delete", 1)

    # Do the same for Menu Product
    doctype = "Menu Product"
    if not frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role}):
        print(f"Adding delete permission for {role} on {doctype}")
        add_permission(doctype, role, 0)
        frappe.db.set_value("Custom DocPerm", {"parent": doctype, "role": role}, "delete", 1)
    else:
        print(f"Permission already exists for {role} on {doctype}, ensuring delete=1")
        frappe.db.set_value("Custom DocPerm", {"parent": doctype, "role": role}, "delete", 1)

    frappe.db.commit()
    frappe.clear_cache(doctype="Menu Category")
    frappe.clear_cache(doctype="Menu Product")
    print("Permissions updated successfully")

if __name__ == "__main__":
    run()

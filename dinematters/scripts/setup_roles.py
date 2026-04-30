import frappe

def setup():
    """
    Automated script to setup the DineMatters Supervisor role.
    Run via: bench execute dinematters.scripts.setup_roles.setup
    """
    role_name = "DineMatters Supervisor"
    
    # 1. Create the Role
    if not frappe.db.exists("Role", role_name):
        role = frappe.new_doc("Role")
        role.role_name = role_name
        role.desk_access = 1 # We give them Desk access as requested
        role.insert(ignore_permissions=True)
        frappe.db.commit()
        print(f"Created Role: {role_name}")
    else:
        print(f"Role {role_name} already exists.")
        
    print(f"\n✅ Setup Complete.")
    print(f"You can now assign the '{role_name}' role to your employees via the Frappe Desk.")

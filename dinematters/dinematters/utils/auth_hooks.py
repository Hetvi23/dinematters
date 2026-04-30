import frappe

def restrict_merchant_desk_access():
    """
    Prevent Restaurant Admin and Restaurant Staff roles from accessing the Frappe Desk (/app).
    They should only use the custom React dashboard at /dinematters.
    """
    if not frappe.request:
        return
    
    path = frappe.request.path
    
    # Only intercept if they are trying to access the Desk (/app)
    # We allow /dinematters, /api, and standard login paths
    if not path.startswith("/app"):
        return
    
    # Get current user roles
    user_roles = frappe.get_roles()
    
    # Define roles that are BANNED from the Desk
    merchant_roles = ["Restaurant Admin", "Restaurant Staff"]
    
    # Check if user has any merchant roles
    is_merchant = any(role in merchant_roles for role in user_roles)
    
    # System Managers and Administrators should ALWAYS have access for support
    is_admin = any(role in ["Administrator", "System Manager"] for role in user_roles)
    
    if is_merchant and not is_admin:
        # User is a merchant trying to enter the Desk. 
        # Redirect them to the custom dashboard.
        frappe.local.flags.redirect_location = "/dinematters"
        raise frappe.Redirect

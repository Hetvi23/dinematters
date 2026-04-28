import frappe

@frappe.whitelist()
def setup_hostinger_email():

    """
    Provision Hostinger SMTP credentials programmatically.
    Extracts credentials from Dinematters Settings securely.
    """
    email_account_name = "Contact DineMatters"
    
    # Fetch or seed credentials from Dinematters Settings safely
    settings = frappe.get_single("Dinematters Settings")
    
    email = settings.hostinger_email
    if not email:
        email = "contact@dinematters.com"
        settings.db_set("hostinger_email", email)
        
    # Safely read password, catching decryption errors from bad site restores
    password = None
    from frappe.utils.password import remove_encrypted_password
    try:
        password = settings.get_password("hostinger_password", raise_exception=False)
    except Exception:
        remove_encrypted_password("Dinematters Settings", "Dinematters Settings", "hostinger_password")
        
    if not password:
        password = "Dinematters@2025"
        from frappe.utils.password import set_encrypted_password
        set_encrypted_password("Dinematters Settings", "Dinematters Settings", password, "hostinger_password")

    # Remove corrupt outgoing Email Account credentials to bypass ORM save blocks
    try:
        remove_encrypted_password("Email Account", email_account_name)
    except Exception:
        pass


    # Update Email Domain to prevent bad Titan defaults from overriding Hostinger
    if frappe.db.exists("Email Domain", "dinematters.com"):
        frappe.db.set_value("Email Domain", "dinematters.com", {
            "smtp_server": "smtp.hostinger.com",
            "use_tls": 1,
            "use_ssl_for_outgoing": 0,
            "smtp_port": 587
        })
        frappe.db.commit()


    # Fetch or create target record
    if not frappe.db.exists("Email Account", email_account_name):
        doc = frappe.new_doc("Email Account")
        doc.email_account_name = email_account_name
    else:
        doc = frappe.get_doc("Email Account", email_account_name)
        
    # Map essential Hostinger parameters
    doc.email_id = email
    doc.smtp_server = "smtp.hostinger.com"
    doc.use_tls = 1
    doc.use_ssl_for_outgoing = 0
    doc.smtp_port = 587
    doc.enable_outgoing = 1
    doc.default_outgoing = 1

    doc.password = password
    doc.save(ignore_permissions=True)

    frappe.db.commit()
    print(f"Successfully configured Hostinger SMTP for {email} via DB Bypass!")

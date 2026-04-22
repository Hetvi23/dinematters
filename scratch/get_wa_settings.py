import os
import sys
# Path to frappe-bench/sites
os.chdir("/home/frappe/frappe-bench/sites")
sys.path.insert(0, "/home/frappe/frappe-bench/apps/frappe")
sys.path.insert(0, "/home/frappe/frappe-bench/apps/dinematters")

import frappe
frappe.init(site="dine_matters")
frappe.connect()
settings = frappe.get_single("Dinematters Settings")
print("TOKEN:", settings.get_password("whatsapp_cloud_api_token"))
print("PHONE_ID:", settings.whatsapp_cloud_api_phone_id)
print("BUSINESS_ID:", settings.whatsapp_cloud_api_business_id)

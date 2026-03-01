#!/usr/bin/env python3
"""Check customer data and test get_customer_by_phone. Run: bench --site dine_matters execute dinematters.scripts.check_customer.run_check"""

def run_check():
	import frappe
	customers = frappe.db.sql("SELECT name, phone, customer_name FROM tabCustomer LIMIT 10", as_dict=True)
	orders = frappe.db.sql("SELECT platform_customer, order_number FROM tabOrder WHERE restaurant='unvind' LIMIT 5", as_dict=True)
	from dinematters.dinematters.api.customers import get_customer_by_phone
	result = get_customer_by_phone("9876501001", "unvind")
	return {"customers": customers, "orders_at_unvind": orders, "api_result": result}

import frappe

frappe.init(site="dine_matters")
frappe.connect()

print("Restaurants:")
for r in frappe.get_all("Restaurant", fields=["name", "restaurant_name"]):
    print(f"- {r.name}: {r.restaurant_name}")

print("\nProducts for flapjack-waffle-and-more:")
products = frappe.get_all("Menu Product", filters={"restaurant": "flapjack-waffle-and-more"}, fields=["name", "product_name", "product_id"])
for p in products:
    print(f"- {p.name}: {p.product_name} (ID: {p.product_id})")

frappe.destroy()

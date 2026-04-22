import frappe
from dinematters.dinematters.utils.customer_helpers import normalize_phone

def merge_customers():
    frappe.connect("backend.dinematters.com")
    
    print("Gathering orders to extract phone numbers...")
    # 1. Get all orders with a valid phone
    orders = frappe.db.sql("""
        SELECT name, customer, customer_phone, customer_name
        FROM tabOrder
        WHERE customer_phone IS NOT NULL AND customer_phone != ''
    """, as_dict=True)
    
    # Group customers by normalized phone
    phone_to_customers = {}
    for o in orders:
        norm = normalize_phone(o.customer_phone)
        if not norm or len(norm) != 10:
            continue
            
        if norm not in phone_to_customers:
            phone_to_customers[norm] = {"all_customers": set()}
            
        if o.customer:
            phone_to_customers[norm]["all_customers"].add(o.customer)
            
    print(f"Found {len(phone_to_customers)} unique valid phone numbers from orders.")
    
    # Process each phone
    for phone, data in phone_to_customers.items():
        customers = list(data["all_customers"])
        if not customers:
            continue
            
        # Get customer details to find the oldest one (primary)
        customer_docs = frappe.db.sql(f"""
            SELECT name, creation, customer_name, email, phone
            FROM tabCustomer
            WHERE name IN %s
            ORDER BY creation ASC
        """, (customers,), as_dict=True)
        
        if not customer_docs:
            continue
            
        primary = customer_docs[0]
        primary_name = primary.name
        others = [c.name for c in customer_docs[1:]]
        
        if others:
            print(f"\n[MERGE] Phone {phone}: Merging {others} into primary {primary_name}")
            for other in others:
                try:
                    frappe.rename_doc("Customer", other, primary_name, merge=True, force=True, ignore_permissions=True)
                except Exception as e:
                    print(f"  -> Failed to merge {other} into {primary_name}: {e}")
        
        # Ensure primary has the correct phone
        try:
            current_phone = frappe.db.get_value("Customer", primary_name, "phone")
            if current_phone != phone:
                frappe.db.set_value("Customer", primary_name, "phone", phone)
                # print(f"  -> Updated phone for {primary_name} to {phone}")
        except Exception as e:
            print(f"  -> Error setting phone {phone} for {primary_name}: {e}")

    frappe.db.commit()
    print("\nCustomer merging complete.")
    
    print("Ensuring any orphaned customers without phones are kept as is (no merge possible).")
    
    print("Applying Unique Constraint to Customer.phone field...")
    try:
        frappe.db.set_value("Custom Field", "Customer-phone", "unique", 1)
        frappe.db.commit()
        print("Successfully enabled unique constraint on phone.")
    except Exception as e:
        print(f"Failed to enable unique constraint. You might need to manually check for any remaining duplicates. Error: {e}")
    
    print("All done!")

if __name__ == "__main__":
    merge_customers()

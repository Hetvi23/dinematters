
import frappe

def populate_referral_codes():
    # Fetch all restaurants that don't have a referral code
    restaurants = frappe.get_all("Restaurant", filters={"referral_code": ["is", "not set"]})
    
    count = 0
    for r in restaurants:
        doc = frappe.get_doc("Restaurant", r.name)
        # The validate method or the generation logic in the controller will handle it
        # But let's be explicit
        if not doc.referral_code:
            # We already have the generate_referral_code logic in the python class
            # Calling save() will trigger validate() which generates the code
            doc.save()
            frappe.db.commit()
            count += 1
            print(f"Generated referral code {doc.referral_code} for {doc.restaurant_name}")
            
    print(f"\nPopulated {count} restaurants with referral codes.")

if __name__ == "__main__":
    populate_referral_codes()

import frappe

def migrate_tiers():
    print("Starting Tier Migration...")
    
    # Mapping
    mapping = {
        "LITE": "SILVER",
        "PRO": "GOLD",
        "LUX": "DIAMOND"
    }
    
    # 1. Update Restaurant doctype
    restaurants = frappe.get_all("Restaurant", fields=["name", "plan_type", "deferred_plan_type"])
    
    updated_count = 0
    for res in restaurants:
        changed = False
        new_plan = mapping.get(res.plan_type)
        new_deferred = mapping.get(res.deferred_plan_type) if res.deferred_plan_type else None
        
        update_dict = {}
        if new_plan:
            update_dict["plan_type"] = new_plan
            changed = True
        
        if new_deferred:
            update_dict["deferred_plan_type"] = new_deferred
            changed = True
            
        if changed:
            frappe.db.set_value("Restaurant", res.name, update_dict, update_modified=False)
            updated_count += 1
            print(f"Updated {res.name}: {res.plan_type} -> {new_plan}")

    frappe.db.commit()
    print(f"Migration complete. Total restaurants updated: {updated_count}")

if __name__ == "__main__":
    migrate_tiers()

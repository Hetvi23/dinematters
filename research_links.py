
import frappe
import json

def get_restaurant_links():
    # 1. Direct Links in DocFields
    links = frappe.get_all('DocField', filters={'fieldtype': 'Link', 'options': 'Restaurant'}, pluck='parent')
    
    # 2. Custom Fields
    custom_links = frappe.get_all('Custom Field', filters={'fieldtype': 'Link', 'options': 'Restaurant'}, pluck='dt')
    
    # 3. User Permissions (special handling)
    # They link via 'allow'="Restaurant" and 'for_value'="[restaurant_name]"
    
    all_links = sorted(list(set(links + custom_links)))
    
    # Filter out child tables if we want to delete parents
    parents = []
    for dt in all_links:
        is_submittable = frappe.get_meta(dt).is_submittable
        is_child_table = frappe.get_meta(dt).istable
        parents.append({
            "doctype": dt,
            "is_child": is_child_table,
            "is_submittable": is_submittable
        })
    
    return parents

if __name__ == "__main__":
    try:
        data = get_restaurant_links()
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Error: {str(e)}")

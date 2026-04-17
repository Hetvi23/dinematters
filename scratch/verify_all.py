import sys
import os

# Set up paths for Frappe
sys.path.append("/home/frappe/frappe-bench/apps/frappe")
sys.path.append("/home/frappe/frappe-bench/apps/dinematters")

# Mock Frappe environment
import frappe
frappe.init(site="dine_matters")
frappe.connect()

from dinematters.dinematters.utils.geoutils import calculate_distance, estimate_road_distance
from dinematters.dinematters.utils.pricing import calculate_cart_totals

def test_everything():
    print("--- 1. Testing Formula ---")
    d = calculate_distance(28.6304, 77.2177, 28.4951, 77.0894)
    print(f"CP to Cyber City: Straight {d:.2f}km, Road {estimate_road_distance(d):.2f}km")
    
    print("\n--- 2. Testing Pricing Integration ---")
    restaurant = frappe.get_all("Restaurant", fields=["name", "latitude", "longitude", "max_delivery_distance"], limit=1)[0]
    print(f"Restaurant: {restaurant.name} @ ({restaurant.latitude}, {restaurant.longitude}) Max: {restaurant.max_delivery_distance}km")
    
    items = [{"product": "test", "quantity": 1, "rate": 100, "amount": 100}]
    
    # Within range
    res1 = calculate_cart_totals(
        restaurant=restaurant.name,
        items=items,
        delivery_type="Delivery",
        latitude=float(restaurant.latitude) + 0.005,
        longitude=float(restaurant.longitude)
    )
    print(f"Near: Serviceable={res1[serviceable]}, Distance={res1[distance]:.2f}km, Fee={res1[delivery_fee]}")
    
    # Out of range
    res2 = calculate_cart_totals(
        restaurant=restaurant.name,
        items=items,
        delivery_type="Delivery",
        latitude=float(restaurant.latitude) + 1.0,
        longitude=float(restaurant.longitude)
    )
    print(f"Far: Serviceable={res2[serviceable]}, Distance={res2[distance]:.2f}km, Error={res2.get(distanceError)}")

if __name__ == "__main__":
    test_everything()

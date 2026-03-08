#!/usr/bin/env python3
"""
E2E Testing Script for Table Booking System
Tests the complete flow from configuration to booking creation
"""

import frappe
from frappe.utils import now_datetime, today, add_days
import json

def setup_test_environment():
    """Setup test data for E2E testing"""
    print("\n" + "="*80)
    print("STEP 1: Setting up test environment")
    print("="*80)
    
    # Get first restaurant
    restaurants = frappe.get_all("Restaurant", fields=["name", "restaurant_name"], limit=1)
    if not restaurants:
        print("❌ No restaurants found! Please create a restaurant first.")
        return None
    
    restaurant = restaurants[0]
    print(f"✅ Using restaurant: {restaurant.name} ({restaurant.restaurant_name})")
    
    # Check Restaurant Config
    config_name = f"{restaurant.name}-config"
    if not frappe.db.exists("Restaurant Config", config_name):
        print(f"⚠️  Restaurant Config not found. Creating: {config_name}")
        config = frappe.get_doc({
            "doctype": "Restaurant Config",
            "name": config_name,
            "restaurant": restaurant.name,
            "enable_table_booking": 1,
            "enable_banquet_booking": 0,
            "verify_my_user": 0
        })
        config.insert(ignore_permissions=True)
        frappe.db.commit()
    else:
        config = frappe.get_doc("Restaurant Config", config_name)
        config.enable_table_booking = 1
        config.save(ignore_permissions=True)
        frappe.db.commit()
    
    print(f"✅ Restaurant Config updated:")
    print(f"   - Table Booking: {'Enabled' if config.enable_table_booking else 'Disabled'}")
    print(f"   - OTP Verification: {'Enabled' if config.verify_my_user else 'Disabled'}")
    
    return restaurant.name

def create_test_tables(restaurant_id):
    """Create sample restaurant tables"""
    print("\n" + "="*80)
    print("STEP 2: Creating test tables")
    print("="*80)
    
    tables_config = [
        {"table_number": "T1", "capacity": 2, "location": "Indoor"},
        {"table_number": "T2", "capacity": 4, "location": "Indoor"},
        {"table_number": "T3", "capacity": 4, "location": "Outdoor"},
        {"table_number": "T4", "capacity": 6, "location": "Indoor"},
        {"table_number": "T5", "capacity": 8, "location": "Private Room"},
    ]
    
    created_tables = []
    for table_config in tables_config:
        # Check if table already exists
        existing = frappe.db.exists("Restaurant Table", {
            "restaurant": restaurant_id,
            "table_number": table_config["table_number"]
        })
        
        if existing:
            print(f"⚠️  Table {table_config['table_number']} already exists, skipping...")
            created_tables.append(existing)
            continue
        
        try:
            table = frappe.get_doc({
                "doctype": "Restaurant Table",
                "restaurant": restaurant_id,
                "table_number": table_config["table_number"],
                "capacity": table_config["capacity"],
                "status": "available",
                "location": table_config["location"],
                "priority": 0
            })
            table.insert(ignore_permissions=True)
            created_tables.append(table.name)
            print(f"✅ Created table: {table_config['table_number']} (Capacity: {table_config['capacity']}, Location: {table_config['location']})")
        except Exception as e:
            print(f"❌ Error creating table {table_config['table_number']}: {str(e)}")
    
    frappe.db.commit()
    print(f"\n✅ Total tables available: {len(created_tables)}")
    return created_tables

def test_available_time_slots_api(restaurant_id):
    """Test the get available time slots API"""
    print("\n" + "="*80)
    print("STEP 3: Testing Available Time Slots API")
    print("="*80)
    
    test_date = add_days(today(), 1)  # Tomorrow
    test_diners = 4
    
    print(f"📅 Test Date: {test_date}")
    print(f"👥 Number of Diners: {test_diners}")
    
    try:
        from dinematters.dinematters.api.bookings import get_available_time_slots
        
        result = get_available_time_slots(
            restaurant_id=restaurant_id,
            date=test_date,
            number_of_diners=test_diners
        )
        
        print(f"\n✅ API Response:")
        print(f"   - Success: {result.get('success')}")
        print(f"   - Available Slots: {len(result.get('data', {}).get('availableSlots', []))}")
        print(f"   - Unavailable Slots: {len(result.get('data', {}).get('unavailableSlots', []))}")
        
        if result.get('data', {}).get('availableSlots'):
            print(f"\n   First 5 available slots:")
            for slot in result['data']['availableSlots'][:5]:
                print(f"      - {slot}")
        
        return result
    except Exception as e:
        print(f"❌ Error testing time slots API: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_create_booking_api(restaurant_id):
    """Test the create table booking API"""
    print("\n" + "="*80)
    print("STEP 4: Testing Create Table Booking API")
    print("="*80)
    
    test_date = add_days(today(), 1)
    test_time_slot = "7:00 PM"
    test_diners = 4
    
    booking_data = {
        "restaurant_id": restaurant_id,
        "number_of_diners": test_diners,
        "date": str(test_date),
        "time_slot": test_time_slot,
        "customer_info": {
            "fullName": "Test Customer",
            "phone": "+919876543210",
            "notes": "E2E Test Booking - Window seat preferred"
        }
    }
    
    print(f"📋 Booking Details:")
    print(f"   - Date: {test_date}")
    print(f"   - Time: {test_time_slot}")
    print(f"   - Diners: {test_diners}")
    print(f"   - Customer: {booking_data['customer_info']['fullName']}")
    print(f"   - Phone: {booking_data['customer_info']['phone']}")
    
    try:
        from dinematters.dinematters.api.bookings import create_table_booking
        
        result = create_table_booking(**booking_data)
        
        print(f"\n✅ Booking Created Successfully!")
        print(f"   - Success: {result.get('success')}")
        print(f"   - Booking Number: {result.get('data', {}).get('bookingNumber')}")
        print(f"   - Status: {result.get('data', {}).get('status')}")
        print(f"   - Booking ID: {result.get('data', {}).get('id')}")
        
        return result.get('data', {}).get('id')
    except Exception as e:
        print(f"❌ Error creating booking: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_admin_apis(restaurant_id, booking_id):
    """Test admin booking management APIs"""
    print("\n" + "="*80)
    print("STEP 5: Testing Admin Booking Management APIs")
    print("="*80)
    
    if not booking_id:
        print("⚠️  No booking ID available, skipping admin API tests")
        return
    
    # Test 1: Get admin bookings
    print("\n📊 Test 1: Get Admin Bookings")
    try:
        from dinematters.dinematters.api.bookings import get_admin_bookings
        
        result = get_admin_bookings(
            restaurant_id=restaurant_id,
            date_from=str(add_days(today(), 1)),
            date_to=str(add_days(today(), 1)),
            limit=10
        )
        
        print(f"✅ Retrieved {len(result.get('data', {}).get('bookings', []))} bookings")
        if result.get('data', {}).get('bookings'):
            booking = result['data']['bookings'][0]
            print(f"   First booking:")
            print(f"      - Number: {booking.get('bookingNumber')}")
            print(f"      - Status: {booking.get('status')}")
            print(f"      - Diners: {booking.get('numberOfDiners')}")
    except Exception as e:
        print(f"❌ Error getting admin bookings: {str(e)}")
    
    # Test 2: Get restaurant tables
    print("\n🪑 Test 2: Get Restaurant Tables")
    try:
        from dinematters.dinematters.api.bookings import get_restaurant_tables
        
        result = get_restaurant_tables(restaurant_id=restaurant_id)
        
        print(f"✅ Retrieved {len(result.get('data', {}).get('tables', []))} tables")
        for table in result.get('data', {}).get('tables', [])[:3]:
            print(f"   - Table {table.get('tableNumber')}: Capacity {table.get('capacity')}, Status: {table.get('status')}")
    except Exception as e:
        print(f"❌ Error getting tables: {str(e)}")
    
    # Test 3: Confirm booking
    print("\n✅ Test 3: Confirm Booking")
    try:
        from dinematters.dinematters.api.bookings import confirm_booking
        
        # Get a table to assign
        tables_result = get_restaurant_tables(restaurant_id=restaurant_id)
        tables = tables_result.get('data', {}).get('tables', [])
        
        if tables:
            # Find a suitable table (capacity >= 4)
            suitable_table = next((t for t in tables if t.get('capacity', 0) >= 4), tables[0])
            
            result = confirm_booking(
                restaurant_id=restaurant_id,
                booking_id=booking_id,
                assigned_table=suitable_table.get('id')
            )
            
            print(f"✅ Booking confirmed!")
            print(f"   - Status: {result.get('data', {}).get('booking', {}).get('status')}")
            print(f"   - Assigned Table: {result.get('data', {}).get('booking', {}).get('assignedTable')}")
        else:
            print("⚠️  No tables available for assignment")
    except Exception as e:
        print(f"❌ Error confirming booking: {str(e)}")
        import traceback
        traceback.print_exc()

def verify_database_data(restaurant_id, booking_id):
    """Verify data in database"""
    print("\n" + "="*80)
    print("STEP 6: Verifying Database Data")
    print("="*80)
    
    # Check tables
    print("\n🪑 Restaurant Tables:")
    tables = frappe.get_all(
        "Restaurant Table",
        filters={"restaurant": restaurant_id},
        fields=["name", "table_number", "capacity", "status", "location"],
        order_by="table_number"
    )
    print(f"   Total tables: {len(tables)}")
    for table in tables:
        print(f"   - {table.table_number}: Capacity {table.capacity}, Status: {table.status}, Location: {table.location}")
    
    # Check bookings
    print("\n📅 Table Bookings:")
    bookings = frappe.get_all(
        "Table Booking",
        filters={"restaurant": restaurant_id},
        fields=["name", "booking_number", "status", "date", "time_slot", "number_of_diners", "assigned_table"],
        order_by="creation desc",
        limit=5
    )
    print(f"   Total recent bookings: {len(bookings)}")
    for booking in bookings:
        print(f"   - {booking.booking_number}: {booking.status}, {booking.date} {booking.time_slot}, {booking.number_of_diners} diners")
        if booking.assigned_table:
            print(f"     Assigned to: {booking.assigned_table}")
    
    # Check specific booking if provided
    if booking_id:
        print(f"\n🔍 Test Booking Details (ID: {booking_id}):")
        try:
            booking = frappe.get_doc("Table Booking", booking_id)
            print(f"   - Booking Number: {booking.booking_number}")
            print(f"   - Status: {booking.status}")
            print(f"   - Customer: {booking.customer_name}")
            print(f"   - Phone: {booking.customer_phone}")
            print(f"   - Date: {booking.date}")
            print(f"   - Time: {booking.time_slot}")
            print(f"   - Diners: {booking.number_of_diners}")
            print(f"   - Assigned Table: {booking.assigned_table or 'Not assigned'}")
            print(f"   - Notes: {booking.notes or 'None'}")
            if booking.confirmed_at:
                print(f"   - Confirmed At: {booking.confirmed_at}")
                print(f"   - Confirmed By: {booking.confirmed_by}")
        except Exception as e:
            print(f"   ❌ Error fetching booking: {str(e)}")

def run_e2e_tests():
    """Run all E2E tests"""
    print("\n" + "="*80)
    print("🚀 STARTING E2E TESTS FOR TABLE BOOKING SYSTEM")
    print("="*80)
    
    try:
        # Step 1: Setup
        restaurant_id = setup_test_environment()
        if not restaurant_id:
            return
        
        # Step 2: Create tables
        tables = create_test_tables(restaurant_id)
        
        # Step 3: Test time slots API
        time_slots_result = test_available_time_slots_api(restaurant_id)
        
        # Step 4: Test create booking API
        booking_id = test_create_booking_api(restaurant_id)
        
        # Step 5: Test admin APIs
        test_admin_apis(restaurant_id, booking_id)
        
        # Step 6: Verify database
        verify_database_data(restaurant_id, booking_id)
        
        print("\n" + "="*80)
        print("✅ E2E TESTS COMPLETED SUCCESSFULLY!")
        print("="*80)
        print(f"\n📊 Summary:")
        print(f"   - Restaurant: {restaurant_id}")
        print(f"   - Tables Created: {len(tables)}")
        print(f"   - Test Booking ID: {booking_id}")
        print(f"\n🌐 Next Steps:")
        print(f"   1. Visit: http://localhost:8000/app/restaurant-table")
        print(f"   2. Visit: http://localhost:8000/app/table-booking")
        print(f"   3. Test frontend: https://demo.dinematters.com/{restaurant_id}/book-table")
        print(f"   4. Admin dashboard: /dinematters/bookings")
        
    except Exception as e:
        print(f"\n❌ E2E Tests failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_e2e_tests()

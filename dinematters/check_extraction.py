"""
Check the status of menu extraction document
"""

import frappe
import json

def check_document():
    """Check MIE-0001 document status"""
    
    doc = frappe.get_doc('Menu Image Extractor', 'MIE-0001')
    
    print("\n" + "="*70)
    print("MENU IMAGE EXTRACTOR - DOCUMENT STATUS (MIE-0001)")
    print("="*70)
    
    print(f"\n📊 Basic Info:")
    print(f"  Document Name: {doc.name}")
    print(f"  Restaurant Name: {doc.restaurant_name or 'Not set'}")
    print(f"  Extraction Status: {doc.extraction_status}")
    print(f"  Images Uploaded: {len(doc.menu_images) if doc.menu_images else 0}")
    
    if doc.menu_images:
        print(f"\n🖼️  Uploaded Images:")
        for idx, img in enumerate(doc.menu_images, 1):
            print(f"  {idx}. {img.menu_image}")
    
    print(f"\n📈 Statistics:")
    print(f"  Items Created: {doc.items_created or 0}")
    print(f"  Categories Created: {doc.categories_created or 0}")
    print(f"  Processing Time: {doc.processing_time or 'N/A'}")
    print(f"  Extraction Date: {doc.extraction_date or 'N/A'}")
    
    if doc.extraction_log:
        print(f"\n📝 Extraction Log:")
        print("  " + doc.extraction_log.replace("\n", "\n  ")[:500])
        if len(doc.extraction_log) > 500:
            print("  ... (truncated)")
    else:
        print(f"\n📝 Extraction Log: Empty (extraction may not have run)")
    
    if doc.raw_response:
        print(f"\n🔍 Raw API Response:")
        print(f"  Length: {len(doc.raw_response)} characters")
        try:
            response_data = json.loads(doc.raw_response)
            print(f"  Success: {response_data.get('success', 'N/A')}")
            print(f"  Message: {response_data.get('message', 'N/A')}")
            
            data = response_data.get('data', {})
            if data:
                print(f"\n  Extracted Data Summary:")
                print(f"    Categories: {len(data.get('categories', []))}")
                print(f"    Dishes: {len(data.get('dishes', []))}")
                
                # Show first few categories
                categories = data.get('categories', [])
                if categories:
                    print(f"\n  Sample Categories:")
                    for cat in categories[:5]:
                        print(f"    - {cat.get('name')} (ID: {cat.get('id')})")
                
                # Show first few dishes
                dishes = data.get('dishes', [])
                if dishes:
                    print(f"\n  Sample Dishes:")
                    for dish in dishes[:10]:
                        price = dish.get('price', 0)
                        print(f"    - {dish.get('name')} - ₹{price} ({dish.get('category', 'N/A')})")
        except json.JSONDecodeError:
            print(f"  First 500 chars: {doc.raw_response[:500]}")
    else:
        print(f"\n🔍 Raw API Response: Empty (extraction may not have run)")
    
    print("\n" + "="*70)
    
    # Check if extraction was actually attempted
    if doc.extraction_status == "Draft" and not doc.extraction_log:
        print("\n⚠️  WARNING: It appears extraction was not run yet!")
        print("   - Status is still 'Draft'")
        print("   - No extraction log found")
        print("   - No API response stored")
        print("\n   Did the 'Extract Menu Data' button work?")
        print("   Check browser console for JavaScript errors.")
    
    elif doc.extraction_status == "Processing":
        print("\n⏳ Extraction is currently in progress...")
        print("   Please wait for it to complete.")
    
    elif doc.extraction_status == "Failed":
        print("\n❌ Extraction FAILED!")
        print("   Check the extraction log above for error details.")
    
    elif doc.extraction_status == "Completed":
        print("\n✅ Extraction completed successfully!")
        print(f"   Created {doc.items_created} items and {doc.categories_created} categories")
    
    print("\n")


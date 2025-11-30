# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
Test script for all API endpoints
Run with: bench --site [site-name] execute dinematters.dinematters.api.test_apis.run_all_tests
"""

import frappe
import json
from frappe.utils import cint


def run_all_tests():
	"""Run all API tests"""
	print("=" * 80)
	print("🧪 Testing ONO Menu System APIs")
	print("=" * 80)
	
	results = {
		"passed": 0,
		"failed": 0,
		"errors": []
	}
	
	# Test Categories API
	print("\n📁 Testing Categories API...")
	test_categories(results)
	
	# Test Products API
	print("\n🍕 Testing Products API...")
	test_products(results)
	
	# Test Cart API
	print("\n🛒 Testing Cart API...")
	test_cart(results)
	
	# Test Orders API
	print("\n📦 Testing Orders API...")
	test_orders(results)
	
	# Print summary
	print("\n" + "=" * 80)
	print("📊 Test Summary")
	print("=" * 80)
	print(f"✅ Passed: {results['passed']}")
	print(f"❌ Failed: {results['failed']}")
	
	if results['errors']:
		print("\n❌ Errors:")
		for error in results['errors']:
			print(f"   - {error}")
	
	print("=" * 80)
	
	return results


def test_categories(results):
	"""Test Categories API"""
	try:
		from dinematters.dinematters.api.categories import get_categories
		
		response = get_categories()
		
		# Check response structure
		assert response.get("success") == True, "Response should have success=true"
		assert "data" in response, "Response should have data field"
		assert "categories" in response["data"], "Response should have categories array"
		
		categories = response["data"]["categories"]
		assert isinstance(categories, list), "Categories should be a list"
		
		if categories:
			category = categories[0]
			required_fields = ["id", "name", "displayName", "description", "isSpecial", "productCount"]
			for field in required_fields:
				assert field in category, f"Category should have {field} field"
		
		print(f"   ✅ get_categories: PASSED ({len(categories)} categories found)")
		results["passed"] += 1
		
	except Exception as e:
		print(f"   ❌ get_categories: FAILED - {str(e)}")
		results["failed"] += 1
		results["errors"].append(f"get_categories: {str(e)}")


def test_products(results):
	"""Test Products API"""
	try:
		from dinematters.dinematters.api.products import get_products, get_product
		
		# Test get_products
		response = get_products(limit=5)
		
		assert response.get("success") == True, "Response should have success=true"
		assert "data" in response, "Response should have data field"
		assert "products" in response["data"], "Response should have products array"
		assert "pagination" in response["data"], "Response should have pagination"
		
		products = response["data"]["products"]
		assert isinstance(products, list), "Products should be a list"
		
		if products:
			product = products[0]
			required_fields = ["id", "name", "price", "category", "isVegetarian", "calories"]
			for field in required_fields:
				assert field in product, f"Product should have {field} field"
		
		print(f"   ✅ get_products: PASSED ({len(products)} products found)")
		results["passed"] += 1
		
		# Test get_product (single product)
		if products:
			product_id = products[0]["id"]
			response = get_product(product_id)
			
			assert response.get("success") == True, "Response should have success=true"
			assert "data" in response, "Response should have data field"
			assert "product" in response["data"], "Response should have product object"
			
			product = response["data"]["product"]
			assert product["id"] == product_id, "Product ID should match"
			
			print(f"   ✅ get_product: PASSED (product: {product_id})")
			results["passed"] += 1
		else:
			print(f"   ⚠️  get_product: SKIPPED (no products available)")
		
		# Test filters
		response = get_products(category="Hot Coffee", limit=10)
		assert response.get("success") == True, "Filtered response should succeed"
		print(f"   ✅ get_products with filters: PASSED")
		results["passed"] += 1
		
	except Exception as e:
		print(f"   ❌ Products API: FAILED - {str(e)}")
		results["failed"] += 1
		results["errors"].append(f"Products API: {str(e)}")


def test_cart(results):
	"""Test Cart API"""
	try:
		from dinematters.dinematters.api.cart import (
			add_to_cart, get_cart, update_cart_item, 
			remove_cart_item, clear_cart
		)
		
		# Get a product to add to cart
		from dinematters.dinematters.api.products import get_products
		products_response = get_products(limit=1)
		if not products_response.get("success") or not products_response["data"]["products"]:
			print(f"   ⚠️  Cart API: SKIPPED (no products available)")
			return
		
		product_id = products_response["data"]["products"][0]["id"]
		session_id = "test-session-123"
		
		# Test add_to_cart
		response = add_to_cart(
			dish_id=product_id,
			quantity=1,
			customizations=None,
			session_id=session_id
		)
		
		assert response.get("success") == True, "add_to_cart should succeed"
		assert "data" in response, "Response should have data field"
		assert "cartItem" in response["data"], "Response should have cartItem"
		assert "cart" in response["data"], "Response should have cart summary"
		
		cart_item = response["data"]["cartItem"]
		assert "entryId" in cart_item, "Cart item should have entryId"
		assert cart_item["dishId"] == product_id, "Cart item should have correct dishId"
		
		entry_id = cart_item["entryId"]
		print(f"   ✅ add_to_cart: PASSED (entry: {entry_id})")
		results["passed"] += 1
		
		# Test get_cart
		response = get_cart(session_id=session_id)
		assert response.get("success") == True, "get_cart should succeed"
		assert "data" in response, "Response should have data field"
		assert "items" in response["data"], "Response should have items array"
		assert "summary" in response["data"], "Response should have summary"
		
		summary = response["data"]["summary"]
		required_summary_fields = ["subtotal", "discount", "tax", "deliveryFee", "total"]
		for field in required_summary_fields:
			assert field in summary, f"Summary should have {field} field"
		
		print(f"   ✅ get_cart: PASSED ({len(response['data']['items'])} items)")
		results["passed"] += 1
		
		# Test update_cart_item
		response = update_cart_item(entry_id=entry_id, quantity=2)
		assert response.get("success") == True, "update_cart_item should succeed"
		print(f"   ✅ update_cart_item: PASSED")
		results["passed"] += 1
		
		# Test remove_cart_item (add item again first since update might have changed it)
		# Get current cart to find entry_id
		cart_response = get_cart(session_id=session_id)
		if cart_response.get("success") and cart_response["data"]["items"]:
			entry_id_to_remove = cart_response["data"]["items"][0]["entryId"]
			response = remove_cart_item(entry_id=entry_id_to_remove)
			assert response.get("success") == True, "remove_cart_item should succeed"
			print(f"   ✅ remove_cart_item: PASSED")
			results["passed"] += 1
		else:
			# If no items, add one first
			add_response = add_to_cart(dish_id=product_id, quantity=1, session_id=session_id)
			if add_response.get("success"):
				entry_id_to_remove = add_response["data"]["cartItem"]["entryId"]
				response = remove_cart_item(entry_id=entry_id_to_remove)
				assert response.get("success") == True, "remove_cart_item should succeed"
				print(f"   ✅ remove_cart_item: PASSED")
				results["passed"] += 1
		
		# Test clear_cart (after adding item again)
		add_to_cart(dish_id=product_id, quantity=1, session_id=session_id)
		response = clear_cart(session_id=session_id)
		assert response.get("success") == True, "clear_cart should succeed"
		print(f"   ✅ clear_cart: PASSED")
		results["passed"] += 1
		
	except Exception as e:
		print(f"   ❌ Cart API: FAILED - {str(e)}")
		results["failed"] += 1
		results["errors"].append(f"Cart API: {str(e)}")
		import traceback
		traceback.print_exc()


def test_orders(results):
	"""Test Orders API"""
	try:
		from dinematters.dinematters.api.orders import (
			create_order, get_orders, get_order, update_order_status
		)
		
		# Get products for order
		from dinematters.dinematters.api.products import get_products
		products_response = get_products(limit=2)
		if not products_response.get("success") or len(products_response["data"]["products"]) < 1:
			print(f"   ⚠️  Orders API: SKIPPED (no products available)")
			return
		
		product_id = products_response["data"]["products"][0]["id"]
		session_id = "test-session-456"
		
		# Test create_order
		items = [{
			"dishId": product_id,
			"quantity": 1,
			"customizations": {}
		}]
		
		customer_info = {
			"name": "Test User",
			"email": "test@example.com",
			"phone": "+1234567890"
		}
		
		response = create_order(
			items=json.dumps(items),
			cooking_requests=json.dumps([]),
			customer_info=json.dumps(customer_info),
			delivery_info=json.dumps({}),
			session_id=session_id
		)
		
		assert response.get("success") == True, "create_order should succeed"
		assert "data" in response, "Response should have data field"
		assert "order" in response["data"], "Response should have order object"
		
		order = response["data"]["order"]
		required_fields = ["id", "orderNumber", "items", "subtotal", "total", "status"]
		for field in required_fields:
			assert field in order, f"Order should have {field} field"
		
		order_id = order["id"]
		print(f"   ✅ create_order: PASSED (order: {order_id})")
		results["passed"] += 1
		
		# Test get_order
		response = get_order(order_id=order_id)
		assert response.get("success") == True, "get_order should succeed"
		assert "data" in response, "Response should have data field"
		assert "order" in response["data"], "Response should have order object"
		assert response["data"]["order"]["id"] == order_id, "Order ID should match"
		
		print(f"   ✅ get_order: PASSED")
		results["passed"] += 1
		
		# Test get_orders
		response = get_orders(status="pending", limit=10)
		assert response.get("success") == True, "get_orders should succeed"
		assert "data" in response, "Response should have data field"
		assert "orders" in response["data"], "Response should have orders array"
		assert "pagination" in response["data"], "Response should have pagination"
		
		print(f"   ✅ get_orders: PASSED ({len(response['data']['orders'])} orders)")
		results["passed"] += 1
		
		# Test update_order_status
		response = update_order_status(order_id=order_id, status="confirmed")
		assert response.get("success") == True, "update_order_status should succeed"
		print(f"   ✅ update_order_status: PASSED")
		results["passed"] += 1
		
	except Exception as e:
		print(f"   ❌ Orders API: FAILED - {str(e)}")
		results["failed"] += 1
		results["errors"].append(f"Orders API: {str(e)}")
		import traceback
		traceback.print_exc()


@frappe.whitelist()
def run_tests():
	"""Whitelisted function to run tests"""
	return run_all_tests()


if __name__ == "__main__":
	run_all_tests()


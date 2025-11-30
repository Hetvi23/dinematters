# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
Verify API responses match BACKEND_API_DOCUMENTATION.md format exactly
"""

import frappe
import json
from dinematters.dinematters.api.products import get_products, get_product
from dinematters.dinematters.api.categories import get_categories
from dinematters.dinematters.api.cart import add_to_cart, get_cart
from dinematters.dinematters.api.orders import create_order, get_orders, get_order


def verify_all_formats():
	"""Verify all API formats match documentation"""
	
	print("=" * 80)
	print("🔍 Verifying API Response Formats")
	print("=" * 80)
	
	issues = []
	
	# Test 1: GET /products format
	print("\n1. Testing GET /products format...")
	try:
		response = get_products(limit=1)
		if not response.get("success"):
			issues.append("GET /products: Response not successful")
		else:
			data = response.get("data", {})
			if "products" not in data:
				issues.append("GET /products: Missing 'products' array")
			if "pagination" not in data:
				issues.append("GET /products: Missing 'pagination' object")
			else:
				pagination = data["pagination"]
				required_pagination = ["page", "limit", "total", "totalPages"]
				for field in required_pagination:
					if field not in pagination:
						issues.append(f"GET /products: Pagination missing '{field}'")
			
			if data.get("products"):
				product = data["products"][0]
				required_fields = ["id", "name", "price", "category", "isVegetarian", "calories", "servingSize"]
				for field in required_fields:
					if field not in product:
						issues.append(f"GET /products: Product missing '{field}' field")
				
				# Check camelCase naming
				if "originalPrice" not in product and "original_price" in product:
					issues.append("GET /products: Should use camelCase 'originalPrice' not 'original_price'")
				if "estimatedTime" not in product and "estimated_time" in product:
					issues.append("GET /products: Should use camelCase 'estimatedTime' not 'estimated_time'")
				if "customizationQuestions" not in product and "customization_questions" in product:
					issues.append("GET /products: Should use camelCase 'customizationQuestions' not 'customization_questions'")
		
		if not issues:
			print("   ✅ GET /products format matches documentation")
	except Exception as e:
		issues.append(f"GET /products: Error - {str(e)}")
	
	# Test 2: GET /categories format
	print("\n2. Testing GET /categories format...")
	try:
		response = get_categories()
		if not response.get("success"):
			issues.append("GET /categories: Response not successful")
		else:
			data = response.get("data", {})
			if "categories" not in data:
				issues.append("GET /categories: Missing 'categories' array")
			else:
				if data["categories"]:
					category = data["categories"][0]
					required_fields = ["id", "name", "displayName", "description", "isSpecial", "productCount"]
					for field in required_fields:
						if field not in category:
							issues.append(f"GET /categories: Category missing '{field}' field")
		
		if not issues:
			print("   ✅ GET /categories format matches documentation")
	except Exception as e:
		issues.append(f"GET /categories: Error - {str(e)}")
	
	# Test 3: GET /products/:productId format
	print("\n3. Testing GET /products/:productId format...")
	try:
		products_resp = get_products(limit=1)
		if products_resp.get("success") and products_resp["data"]["products"]:
			product_id = products_resp["data"]["products"][0]["id"]
			response = get_product(product_id)
			if not response.get("success"):
				issues.append("GET /products/:productId: Response not successful")
			else:
				data = response.get("data", {})
				if "product" not in data:
					issues.append("GET /products/:productId: Missing 'product' object")
		
		if not issues:
			print("   ✅ GET /products/:productId format matches documentation")
	except Exception as e:
		issues.append(f"GET /products/:productId: Error - {str(e)}")
	
	# Test 4: Customization Questions format
	print("\n4. Testing Customization Questions format...")
	try:
		response = get_product("hot-coffee-espresso")
		if response.get("success"):
			product = response["data"]["product"]
			if "customizationQuestions" in product:
				questions = product["customizationQuestions"]
				if questions:
					q = questions[0]
					required_q_fields = ["id", "title", "type", "required"]
					for field in required_q_fields:
						if field not in q:
							issues.append(f"Customization Question missing '{field}' field")
					
					if "options" in q and q["options"]:
						opt = q["options"][0]
						required_opt_fields = ["id", "label", "price"]
						for field in required_opt_fields:
							if field not in opt:
								issues.append(f"Customization Option missing '{field}' field")
		
		if not issues:
			print("   ✅ Customization Questions format matches documentation")
	except Exception as e:
		issues.append(f"Customization Questions: Error - {str(e)}")
	
	# Print summary
	print("\n" + "=" * 80)
	if issues:
		print("❌ Format Issues Found:")
		for issue in issues:
			print(f"   - {issue}")
		print(f"\nTotal Issues: {len(issues)}")
	else:
		print("✅ All API formats match BACKEND_API_DOCUMENTATION.md!")
	print("=" * 80)
	
	return issues


if __name__ == "__main__":
	verify_all_formats()


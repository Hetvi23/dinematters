# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
Script to create demo data for ONO Menu System
Run with: bench --site [site-name] console
Then: exec(open('apps/dinematters/dinematters/dinematters/setup_demo_data.py').read())
Or: bench --site [site-name] execute dinematters.dinematters.setup_demo_data.create_demo_data
"""

import frappe


def create_demo_data():
	"""Create demo categories and products"""
	
	print("🚀 Creating demo data for ONO Menu System...")
	
	# Create Categories
	categories = create_categories()
	
	# Create Products
	products = create_products(categories)
	
	# Add missing options to existing products
	add_missing_options()
	
	print(f"\n✅ Demo data created successfully!")
	print(f"   - {len(categories)} Categories")
	print(f"   - {len(products)} Products")
	
	return {"categories": categories, "products": products}


def create_categories():
	"""Create demo categories"""
	
	categories_data = [
		{
			"category_id": "hot-coffee",
			"category_name": "Hot Coffee",
			"display_name": "Hot Coffee",
			"description": "Espresso-based coffee drinks",
			"is_special": False,
			"display_order": 1
		},
		{
			"category_id": "cold-coffee",
			"category_name": "Cold Coffee",
			"display_name": "Cold Coffee",
			"description": "Iced and cold coffee beverages",
			"is_special": False,
			"display_order": 2
		},
		{
			"category_id": "bowls",
			"category_name": "Bowls",
			"display_name": "Bowls",
			"description": "Healthy and delicious bowl meals",
			"is_special": False,
			"display_order": 3
		},
		{
			"category_id": "desserts",
			"category_name": "Desserts",
			"display_name": "Desserts",
			"description": "Sweet treats and desserts",
			"is_special": False,
			"display_order": 4
		},
		{
			"category_id": "sandwiches",
			"category_name": "Sandwiches",
			"display_name": "Sandwiches",
			"description": "Fresh sandwiches and wraps",
			"is_special": False,
			"display_order": 5
		}
	]
	
	created_categories = []
	
	for cat_data in categories_data:
		if not frappe.db.exists("Menu Category", cat_data["category_id"]):
			try:
				category = frappe.get_doc({
					"doctype": "Menu Category",
					**cat_data
				})
				category.insert(ignore_permissions=True)
				created_categories.append(category.name)
				print(f"✅ Created category: {cat_data['category_name']}")
			except Exception as e:
				print(f"❌ Error creating category {cat_data['category_name']}: {str(e)}")
		else:
			print(f"⏭️  Category already exists: {cat_data['category_name']}")
			created_categories.append(cat_data["category_id"])
	
	return created_categories


def create_products(categories):
	"""Create demo products"""
	
	products_data = [
		# Hot Coffee
		{
			"product_id": "hot-coffee-espresso",
			"product_name": "Espresso",
			"category": "hot-coffee",
			"category_name": "Hot Coffee",
			"price": 220,
			"original_price": 250,
			"description": "Single origin espresso with balanced sweetness, fruitiness and boldness",
			"calories": 5,
			"is_vegetarian": True,
			"estimated_time": 5,
			"serving_size": "1",
			"main_category": "beverages",
			"is_active": True,
			"display_order": 1
		},
		{
			"product_id": "hot-coffee-cappuccino",
			"product_name": "Cappuccino",
			"category": "hot-coffee",
			"category_name": "Hot Coffee",
			"price": 280,
			"description": "Espresso with steamed milk and foam",
			"calories": 120,
			"is_vegetarian": True,
			"estimated_time": 6,
			"serving_size": "1",
			"main_category": "beverages",
			"is_active": True,
			"display_order": 2
		},
		{
			"product_id": "hot-coffee-latte",
			"product_name": "Latte",
			"category": "hot-coffee",
			"category_name": "Hot Coffee",
			"price": 300,
			"description": "Smooth espresso with steamed milk",
			"calories": 150,
			"is_vegetarian": True,
			"estimated_time": 7,
			"serving_size": "1",
			"main_category": "beverages",
			"is_active": True,
			"display_order": 3
		},
		{
			"product_id": "hot-coffee-americano",
			"product_name": "Americano",
			"category": "hot-coffee",
			"category_name": "Hot Coffee",
			"price": 240,
			"description": "Espresso with hot water",
			"calories": 10,
			"is_vegetarian": True,
			"estimated_time": 5,
			"serving_size": "1",
			"main_category": "beverages",
			"is_active": True,
			"display_order": 4
		},
		# Cold Coffee
		{
			"product_id": "cold-coffee-iced-latte",
			"product_name": "Iced Latte",
			"category": "cold-coffee",
			"category_name": "Cold Coffee",
			"price": 320,
			"description": "Espresso with cold milk and ice",
			"calories": 140,
			"is_vegetarian": True,
			"estimated_time": 5,
			"serving_size": "1",
			"main_category": "beverages",
			"is_active": True,
			"display_order": 1
		},
		{
			"product_id": "cold-coffee-frappuccino",
			"product_name": "Frappuccino",
			"category": "cold-coffee",
			"category_name": "Cold Coffee",
			"price": 350,
			"description": "Blended coffee drink with ice",
			"calories": 250,
			"is_vegetarian": True,
			"estimated_time": 8,
			"serving_size": "1",
			"main_category": "beverages",
			"is_active": True,
			"display_order": 2
		},
		# Bowls
		{
			"product_id": "bowls-avocado-berry-salad",
			"product_name": "Avocado Berry Salad Bowl",
			"category": "bowls",
			"category_name": "Bowls",
			"price": 450,
			"description": "Fresh avocado, mixed berries, greens, and quinoa",
			"calories": 380,
			"is_vegetarian": True,
			"estimated_time": 12,
			"serving_size": "1",
			"main_category": "food",
			"is_active": True,
			"display_order": 1
		},
		{
			"product_id": "bowls-acai-bowl",
			"product_name": "Acai Bowl",
			"category": "bowls",
			"category_name": "Bowls",
			"price": 420,
			"description": "Acai berries, granola, banana, and honey",
			"calories": 350,
			"is_vegetarian": True,
			"estimated_time": 10,
			"serving_size": "1",
			"main_category": "food",
			"is_active": True,
			"display_order": 2
		},
		# Desserts
		{
			"product_id": "desserts-chocolate-cake",
			"product_name": "Chocolate Cake",
			"category": "desserts",
			"category_name": "Desserts",
			"price": 280,
			"original_price": 320,
			"description": "Rich chocolate cake with chocolate frosting",
			"calories": 450,
			"is_vegetarian": True,
			"estimated_time": 5,
			"serving_size": "1",
			"main_category": "desserts",
			"is_active": True,
			"display_order": 1
		},
		{
			"product_id": "desserts-cheesecake",
			"product_name": "New York Cheesecake",
			"category": "desserts",
			"category_name": "Desserts",
			"price": 320,
			"description": "Creamy New York style cheesecake",
			"calories": 520,
			"is_vegetarian": True,
			"estimated_time": 5,
			"serving_size": "1",
			"main_category": "desserts",
			"is_active": True,
			"display_order": 2
		},
		# Sandwiches
		{
			"product_id": "sandwiches-club-sandwich",
			"product_name": "Club Sandwich",
			"category": "sandwiches",
			"category_name": "Sandwiches",
			"price": 380,
			"description": "Triple decker with chicken, bacon, lettuce, and tomato",
			"calories": 650,
			"is_vegetarian": False,
			"estimated_time": 10,
			"serving_size": "1",
			"main_category": "food",
			"is_active": True,
			"display_order": 1
		},
		{
			"product_id": "sandwiches-veg-wrap",
			"product_name": "Vegetable Wrap",
			"category": "sandwiches",
			"category_name": "Sandwiches",
			"price": 320,
			"description": "Fresh vegetables wrapped in tortilla",
			"calories": 280,
			"is_vegetarian": True,
			"estimated_time": 8,
			"serving_size": "1",
			"main_category": "food",
			"is_active": True,
			"display_order": 2
		}
	]
	
	created_products = []
	
	for prod_data in products_data:
		if not frappe.db.exists("Menu Product", prod_data["product_id"]):
			try:
				# Create product
				product = frappe.get_doc({
					"doctype": "Menu Product",
					**prod_data
				})
				
				product.insert(ignore_permissions=True)
				created_products.append(product.name)
				print(f"✅ Created product: {prod_data['product_name']}")
			except Exception as e:
				print(f"❌ Error creating product {prod_data['product_name']}: {str(e)}")
				frappe.log_error(f"Error creating product {prod_data['product_name']}", str(e))
		else:
			print(f"⏭️  Product already exists: {prod_data['product_name']}")
			created_products.append(prod_data["product_id"])
	
	return created_products


@frappe.whitelist()
def add_missing_options():
	"""
	Add missing options to existing customization questions
	This function properly handles nested child tables by saving in steps
	"""
	
	print("\n🔧 Adding missing options to existing products...")
	
	# Products that need options added
	products_to_update = {
		"hot-coffee-espresso": {
			"add-ons": [
				{"option_id": "extra-shot", "label": "Extra Espresso Shot", "price": 60, "is_vegetarian": True, "display_order": 1},
				{"option_id": "sugar", "label": "Sugar", "price": 0, "is_vegetarian": True, "display_order": 2}
			]
		},
		"hot-coffee-cappuccino": {
			"milk": [
				{"option_id": "whole-milk", "label": "Whole Milk", "price": 0, "is_default": True, "is_vegetarian": True, "display_order": 1},
				{"option_id": "almond-milk", "label": "Almond Milk", "price": 30, "is_default": False, "is_vegetarian": True, "display_order": 2},
				{"option_id": "oat-milk", "label": "Oat Milk", "price": 30, "is_default": False, "is_vegetarian": True, "display_order": 3}
			]
		},
		"bowls-avocado-berry-salad": {
			"dressing": [
				{"option_id": "balsamic", "label": "Balsamic Vinaigrette", "price": 0, "is_default": True, "is_vegetarian": True, "display_order": 1},
				{"option_id": "ranch", "label": "Ranch", "price": 0, "is_default": False, "is_vegetarian": True, "display_order": 2}
			],
			"protein": [
				{"option_id": "chicken", "label": "Grilled Chicken", "price": 80, "is_default": False, "is_vegetarian": False, "display_order": 1},
				{"option_id": "tofu", "label": "Tofu", "price": 60, "is_default": False, "is_vegetarian": True, "display_order": 2}
			]
		}
	}
	
	updated_count = 0
	
	for product_id, questions_data in products_to_update.items():
		if not frappe.db.exists("Menu Product", product_id):
			print(f"⏭️  Product {product_id} not found, skipping...")
			continue
		
		try:
			product = frappe.get_doc("Menu Product", product_id)
			product.reload()
			
			# Find questions and add options
			for question in product.customization_questions:
				question_id = question.question_id
				if question_id in questions_data:
					# Check if options already exist
					existing_options = frappe.get_all(
						"Customization Option",
						filters={
							"parent": question.name,
							"parenttype": "Customization Question",
							"parentfield": "options"
						}
					)
					
					if len(existing_options) == 0:
						# Add options using direct database insert for nested child tables
						# This is more reliable for nested structures
						for idx, opt_data in enumerate(questions_data[question_id], start=1):
							option_doc = frappe.get_doc({
								"doctype": "Customization Option",
								"parent": question.name,
								"parenttype": "Customization Question",
								"parentfield": "options",
								"idx": idx,
								**opt_data
							})
							option_doc.insert(ignore_permissions=True)
						
						updated_count += 1
						print(f"✅ Added {len(questions_data[question_id])} options to {product_id} -> {question_id}")
					else:
						print(f"⏭️  Options already exist for {product_id} -> {question_id}")
				
		except Exception as e:
			print(f"❌ Error updating {product_id}: {str(e)}")
			frappe.log_error(f"Error updating product {product_id}", str(e))
			import traceback
			traceback.print_exc()
	
	if updated_count > 0:
		print(f"\n✅ Added options to {updated_count} questions")
	else:
		print("\n⏭️  All options already exist")


# Whitelisted function for bench execute
@frappe.whitelist()
def create_demo_data_api():
	"""API endpoint to create demo data"""
	return create_demo_data()


# For direct execution
if __name__ == "__main__":
	create_demo_data()

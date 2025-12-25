# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

"""
Script to create demo data for ONO Menu System
Run with: bench --site [site-name] console
Then: exec(open('apps/dinematters/dinematters/dinematters/setup_demo_data.py').read())
Or: bench --site [site-name] execute dinematters.dinematters.setup_demo_data.create_demo_data
"""

import frappe
from frappe.utils import now_datetime, add_days


def create_demo_data():
	"""
	Create a realistic demo dataset for Dinematters.

	This will create:
	- 1 demo Restaurant with QR tables
	- Menu Categories & Products linked to that Restaurant
	- Offers & Coupons
	- A few demo Orders with Order Items
	- Table Bookings and a Banquet Booking
	"""

	print("🚀 Creating demo data for Dinematters...")

	restaurant = create_restaurant()
	categories = create_categories(restaurant)
	products = create_products(restaurant, categories)
	offers = create_offers(restaurant)
	coupons = create_coupons(restaurant)
	orders = create_orders(restaurant, products)
	table_bookings, banquet_bookings = create_bookings(restaurant)

	# Add missing options to existing products
	add_missing_options()

	print(f"\n✅ Demo data created successfully!")
	print(f"   - Restaurant: {restaurant}")
	print(f"   - {len(categories)} Categories")
	print(f"   - {len(products)} Products")
	print(f"   - {len(offers)} Offers")
	print(f"   - {len(coupons)} Coupons")
	print(f"   - {len(orders)} Orders")
	print(f"   - {len(table_bookings)} Table Bookings")
	print(f"   - {len(banquet_bookings)} Banquet Bookings")

	return {
		"restaurant": restaurant,
		"categories": categories,
		"products": products,
		"offers": offers,
		"coupons": coupons,
		"orders": orders,
		"table_bookings": table_bookings,
		"banquet_bookings": banquet_bookings,
	}


def create_restaurant():
	"""Create a single demo restaurant if it doesn't exist yet."""

	restaurant_name = "ONO Coffee & Kitchen - Downtown"

	existing = frappe.db.get_value(
		"Restaurant",
		{"restaurant_name": restaurant_name},
		"name",
	)
	if existing:
		print(f"⏭️  Restaurant already exists: {existing}")
		return existing

	doc = frappe.get_doc(
		{
			"doctype": "Restaurant",
			"restaurant_name": restaurant_name,
			"owner_name": "Alex Martin",
			"owner_email": "owner@ono-demo.test",
			"owner_phone": "+1 555 0199 001",
			"address": "221B Market Street, Downtown",
			"city": "Metropolis",
			"state": "CA",
			"zip_code": "94105",
			"country": "United States",
			"tax_rate": 8.5,
			"default_delivery_fee": 3.5,
			"currency": "USD",
			"tables": 12,
			"description": "A modern specialty coffee shop with bowls, sandwiches and desserts.",
		}
	)
	doc.insert(ignore_permissions=True)
	print(f"✅ Created Restaurant: {doc.name}")
	return doc.name


def create_categories(restaurant):
	"""Create demo categories linked to a restaurant."""

	categories_data = [
		{
			"category_id": "hot-coffee",
			"category_name": "Hot Coffee",
			"display_name": "Hot Coffee",
			"description": "Espresso-based coffee drinks",
			"is_special": False,
			"display_order": 1,
		},
		{
			"category_id": "cold-coffee",
			"category_name": "Cold Coffee",
			"display_name": "Cold Coffee",
			"description": "Iced and cold coffee beverages",
			"is_special": False,
			"display_order": 2,
		},
		{
			"category_id": "bowls",
			"category_name": "Bowls",
			"display_name": "Bowls",
			"description": "Healthy and delicious bowl meals",
			"is_special": False,
			"display_order": 3,
		},
		{
			"category_id": "desserts",
			"category_name": "Desserts",
			"display_name": "Desserts",
			"description": "Sweet treats and desserts",
			"is_special": False,
			"display_order": 4,
		},
		{
			"category_id": "sandwiches",
			"category_name": "Sandwiches",
			"display_name": "Sandwiches",
			"description": "Fresh sandwiches and wraps",
			"is_special": False,
			"display_order": 5,
		},
	]

	created_categories = []

	for cat_data in categories_data:
		# Attach restaurant
		cat_data_with_restaurant = {
			"restaurant": restaurant,
			**cat_data,
		}

		if not frappe.db.exists("Menu Category", cat_data["category_id"]):
			try:
				category = frappe.get_doc(
					{
						"doctype": "Menu Category",
						**cat_data_with_restaurant,
					}
				)
				category.insert(ignore_permissions=True)
				created_categories.append(category.name)
				print(f"✅ Created category: {cat_data['category_name']}")
			except Exception as e:
				print(f"❌ Error creating category {cat_data['category_name']}: {str(e)}")
		else:
			print(f"⏭️  Category already exists: {cat_data['category_name']}")
			created_categories.append(cat_data["category_id"])

	return created_categories


def create_products(restaurant, categories):
	"""Create demo products linked to a restaurant and categories."""

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
		},
	]

	created_products = []

	for prod_data in products_data:
		prod_data_with_restaurant = {
			"restaurant": restaurant,
			**prod_data,
		}

		if not frappe.db.exists("Menu Product", prod_data["product_id"]):
			try:
				# Create product
				product = frappe.get_doc(
					{
						"doctype": "Menu Product",
						**prod_data_with_restaurant,
					}
				)

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


def create_offers(restaurant):
	"""Create a few homepage offers for the restaurant."""

	today = now_datetime().date()
	offers_data = [
		{
			"title": "Happy Hour Coffee",
			"description": "Flat ₹50 off on all hot coffees from 4–7 PM.",
			"discount": "₹50 OFF",
			"category": "Hot Coffee",
			"featured": 1,
			"display_order": 1,
		},
		{
			"title": "Dessert Combo",
			"description": "Any dessert + any coffee at a special combo price.",
			"discount": "SAVE 20%",
			"category": "Desserts",
			"featured": 1,
			"display_order": 2,
		},
	]

	created = []
	for data in offers_data:
		doc = frappe.get_doc(
			{
				"doctype": "Offer",
				"restaurant": restaurant,
				"image_src": "/assets/dinematters/demo/offer-placeholder.jpg",
				"valid_from": today,
				"valid_to": add_days(today, 30),
				**data,
			}
		)
		doc.insert(ignore_permissions=True)
		created.append(doc.name)
		print(f"✅ Created offer: {doc.title}")

	return created


def create_coupons(restaurant):
	"""Create a few demo coupons."""

	today = now_datetime().date()
	coupons_data = [
		{
			"code": "WELCOME50",
			"discount_type": "flat",
			"discount_value": 50,
			"min_order_amount": 300,
			"description": "₹50 off on your first order",
			"category": "Welcome",
			"valid_from": today,
			"valid_until": add_days(today, 60),
			"max_uses": 100,
			"max_uses_per_user": 1,
		},
		{
			"code": "COFFEE10",
			"discount_type": "percent",
			"discount_value": 10,
			"min_order_amount": 250,
			"description": "10% off on any coffee order",
			"category": "Coffee",
			"valid_from": today,
			"valid_until": add_days(today, 30),
			"max_uses": 500,
			"max_uses_per_user": 5,
		},
	]

	created = []
	for data in coupons_data:
		if frappe.db.exists("Coupon", {"code": data["code"]}):
			print(f"⏭️  Coupon already exists: {data['code']}")
			created.append(data["code"])
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Coupon",
				"restaurant": restaurant,
				"is_active": 1,
				**data,
			}
		)
		doc.insert(ignore_permissions=True)
		created.append(doc.name)
		print(f"✅ Created coupon: {data['code']}")

	return created


def create_orders(restaurant, products):
	"""Create a few realistic orders with order items."""

	# Use up to first 8 products for demo orders
	product_names = products[:8] if len(products) >= 8 else products

	if not product_names:
		print("⚠️ No products found to create orders.")
		return []

	def get_product_doc(product_name):
		return frappe.get_doc("Menu Product", product_name)

	orders_created = []
	tax_rate = frappe.db.get_value("Restaurant", restaurant, "tax_rate") or 0
	delivery_fee = frappe.db.get_value("Restaurant", restaurant, "default_delivery_fee") or 0

	# Order 1: Dine-in table order (delivered)
	order_1_items = []
	for p in product_names[:2]:
		prod = get_product_doc(p)
		order_1_items.append(
			{
				"doctype": "Order Item",
				"product": prod.name,
				"quantity": 2 if "cappuccino" in prod.product_id else 1,
				"unit_price": prod.price,
				"original_price": prod.original_price or prod.price,
				"total_price": (2 if "cappuccino" in prod.product_id else 1) * float(prod.price),
			}
		)

	subtotal_1 = sum(item["total_price"] for item in order_1_items)
	tax_1 = round(subtotal_1 * float(tax_rate) / 100.0, 2)
	total_1 = subtotal_1 + tax_1

	if not frappe.db.exists("Order", {"order_id": "ONO-ORDER-1001"}):
	order_1 = frappe.get_doc(
		{
			"doctype": "Order",
			"restaurant": restaurant,
			"order_id": "ONO-ORDER-1001",
			"order_number": "1001",
			"customer_name": "Priya Sharma",
			"customer_email": "priya.sharma@example.com",
			"customer_phone": "+91 98765 00123",
			"table_number": 3,
			"order_items": order_1_items,
			"subtotal": subtotal_1,
			"discount": 0,
			"tax": tax_1,
			"delivery_fee": 0,
			"total": total_1,
			"status": "delivered",
			"payment_method": "card",
			"payment_status": "completed",
		}
	)
	order_1.insert(ignore_permissions=True)
	orders_created.append(order_1.name)
		print(f"✅ Created order: {order_1.order_number} (table {order_1.table_number}, delivered)")
	else:
		print(f"⏭️  Order ONO-ORDER-1001 already exists")
		orders_created.append("ONO-ORDER-1001")

	# Order 2: Delivery order using coupon (delivered)
	order_2_items = []
	for p in product_names[2:4]:
		prod = get_product_doc(p)
		order_2_items.append(
			{
				"doctype": "Order Item",
				"product": prod.name,
				"quantity": 1,
				"unit_price": prod.price,
				"original_price": prod.original_price or prod.price,
				"total_price": float(prod.price),
			}
		)

	subtotal_2 = sum(item["total_price"] for item in order_2_items)
	discount_2 = 50  # e.g. WELCOME50 applied
	tax_base_2 = subtotal_2 - discount_2
	tax_2 = round(tax_base_2 * float(tax_rate) / 100.0, 2)
	total_2 = tax_base_2 + tax_2 + float(delivery_fee)

	if not frappe.db.exists("Order", {"order_id": "ONO-ORDER-1002"}):
	order_2 = frappe.get_doc(
		{
			"doctype": "Order",
			"restaurant": restaurant,
			"order_id": "ONO-ORDER-1002",
			"order_number": "1002",
			"customer_name": "Rahul Verma",
			"customer_email": "rahul.verma@example.com",
			"customer_phone": "+91 98765 00456",
			"delivery_address": "Sunrise Apartments, Tower B, Flat 1402",
			"delivery_city": "Metropolis",
			"delivery_state": "CA",
			"delivery_zip_code": "94107",
			"delivery_instructions": "Call on arrival, main gate under renovation.",
			"order_items": order_2_items,
			"subtotal": subtotal_2,
			"discount": discount_2,
			"tax": tax_2,
				"delivery_fee": delivery_fee,
			"total": total_2,
			"status": "delivered",
			"payment_method": "online",
			"payment_status": "completed",
		}
	)
	order_2.insert(ignore_permissions=True)
	orders_created.append(order_2.name)
		print(f"✅ Created order: {order_2.order_number} (delivery, delivered)")
	else:
		print(f"⏭️  Order ONO-ORDER-1002 already exists")
		orders_created.append("ONO-ORDER-1002")

	# Order 3: Pending order (table)
	if len(product_names) >= 6:
		order_3_items = []
		for p in product_names[4:6]:
			prod = get_product_doc(p)
			order_3_items.append(
				{
					"doctype": "Order Item",
					"product": prod.name,
					"quantity": 1,
					"unit_price": prod.price,
					"original_price": prod.original_price or prod.price,
					"total_price": float(prod.price),
				}
			)

		subtotal_3 = sum(item["total_price"] for item in order_3_items)
		tax_3 = round(subtotal_3 * float(tax_rate) / 100.0, 2)
		total_3 = subtotal_3 + tax_3

		if not frappe.db.exists("Order", {"order_id": "ONO-ORDER-1003"}):
			order_3 = frappe.get_doc(
				{
					"doctype": "Order",
					"restaurant": restaurant,
					"order_id": "ONO-ORDER-1003",
					"order_number": "1003",
					"customer_name": "Sarah Johnson",
					"customer_email": "sarah.j@example.com",
					"customer_phone": "+91 98765 00567",
					"table_number": 5,
					"order_items": order_3_items,
					"subtotal": subtotal_3,
					"discount": 0,
					"tax": tax_3,
					"delivery_fee": 0,
					"total": total_3,
					"status": "pending",
					"payment_method": "card",
					"payment_status": "pending",
				}
			)
			order_3.insert(ignore_permissions=True)
			orders_created.append(order_3.name)
			print(f"✅ Created order: {order_3.order_number} (table {order_3.table_number}, pending)")

	# Order 4: Confirmed order (preparing)
	if len(product_names) >= 8:
		order_4_items = []
		for p in product_names[6:8]:
			prod = get_product_doc(p)
			order_4_items.append(
				{
					"doctype": "Order Item",
					"product": prod.name,
					"quantity": 2,
					"unit_price": prod.price,
					"original_price": prod.original_price or prod.price,
					"total_price": 2 * float(prod.price),
				}
			)

		subtotal_4 = sum(item["total_price"] for item in order_4_items)
		tax_4 = round(subtotal_4 * float(tax_rate) / 100.0, 2)
		total_4 = subtotal_4 + tax_4

		if not frappe.db.exists("Order", {"order_id": "ONO-ORDER-1004"}):
			order_4 = frappe.get_doc(
				{
					"doctype": "Order",
					"restaurant": restaurant,
					"order_id": "ONO-ORDER-1004",
					"order_number": "1004",
					"customer_name": "Michael Chen",
					"customer_email": "michael.chen@example.com",
					"customer_phone": "+91 98765 00678",
					"table_number": 7,
					"order_items": order_4_items,
					"subtotal": subtotal_4,
					"discount": 0,
					"tax": tax_4,
					"delivery_fee": 0,
					"total": total_4,
					"status": "preparing",
					"payment_method": "card",
					"payment_status": "completed",
				}
			)
			order_4.insert(ignore_permissions=True)
			orders_created.append(order_4.name)
			print(f"✅ Created order: {order_4.order_number} (table {order_4.table_number}, preparing)")

	# Order 5: Ready order (delivery)
	if len(product_names) >= 4:
		order_5_items = []
		prod = get_product_doc(product_names[0])
		order_5_items.append(
			{
				"doctype": "Order Item",
				"product": prod.name,
				"quantity": 3,
				"unit_price": prod.price,
				"original_price": prod.original_price or prod.price,
				"total_price": 3 * float(prod.price),
			}
		)

		subtotal_5 = sum(item["total_price"] for item in order_5_items)
		tax_5 = round(subtotal_5 * float(tax_rate) / 100.0, 2)
		total_5 = subtotal_5 + tax_5 + float(delivery_fee)

		if not frappe.db.exists("Order", {"order_id": "ONO-ORDER-1005"}):
			order_5 = frappe.get_doc(
				{
					"doctype": "Order",
					"restaurant": restaurant,
					"order_id": "ONO-ORDER-1005",
					"order_number": "1005",
					"customer_name": "Emma Wilson",
					"customer_email": "emma.wilson@example.com",
					"customer_phone": "+91 98765 00789",
					"delivery_address": "Green Valley Apartments, Block C, Flat 502",
					"delivery_city": "Metropolis",
					"delivery_state": "CA",
					"delivery_zip_code": "94108",
					"delivery_instructions": "Leave at door, no contact delivery.",
					"order_items": order_5_items,
					"subtotal": subtotal_5,
					"discount": 0,
					"tax": tax_5,
					"delivery_fee": delivery_fee,
					"total": total_5,
					"status": "ready",
					"payment_method": "online",
					"payment_status": "completed",
				}
			)
			order_5.insert(ignore_permissions=True)
			orders_created.append(order_5.name)
			print(f"✅ Created order: {order_5.order_number} (delivery, ready)")

	# Order 6: Confirmed order (table)
	if len(product_names) >= 3:
		order_6_items = []
		prod = get_product_doc(product_names[1])
		order_6_items.append(
			{
				"doctype": "Order Item",
				"product": prod.name,
				"quantity": 1,
				"unit_price": prod.price,
				"original_price": prod.original_price or prod.price,
				"total_price": float(prod.price),
			}
		)

		subtotal_6 = sum(item["total_price"] for item in order_6_items)
		tax_6 = round(subtotal_6 * float(tax_rate) / 100.0, 2)
		total_6 = subtotal_6 + tax_6

		if not frappe.db.exists("Order", {"order_id": "ONO-ORDER-1006"}):
			order_6 = frappe.get_doc(
				{
					"doctype": "Order",
					"restaurant": restaurant,
					"order_id": "ONO-ORDER-1006",
					"order_number": "1006",
					"customer_name": "David Brown",
					"customer_email": "david.brown@example.com",
					"customer_phone": "+91 98765 00890",
					"table_number": 2,
					"order_items": order_6_items,
					"subtotal": subtotal_6,
					"discount": 0,
					"tax": tax_6,
					"delivery_fee": 0,
					"total": total_6,
					"status": "confirmed",
					"payment_method": "card",
					"payment_status": "completed",
				}
			)
			order_6.insert(ignore_permissions=True)
			orders_created.append(order_6.name)
			print(f"✅ Created order: {order_6.order_number} (table {order_6.table_number}, confirmed)")

	return orders_created


def create_bookings(restaurant):
	"""Create table and banquet bookings for the restaurant."""

	today = now_datetime().date()

	# Table bookings
	table_data = [
		{
			"booking_number": "TB-1001",
			"number_of_diners": 2,
			"date": add_days(today, 1),
			"time_slot": "19:30–21:00",
			"status": "confirmed",
			"customer_name": "Ananya Singh",
			"customer_phone": "+91 98765 00321",
			"customer_email": "ananya.singh@example.com",
			"notes": "Window-side table, anniversary.",
		},
		{
			"booking_number": "TB-1002",
			"number_of_diners": 4,
			"date": add_days(today, 2),
			"time_slot": "13:00–14:30",
			"status": "pending",
			"customer_name": "Rohan Mehta",
			"customer_phone": "+91 98765 00789",
			"customer_email": "rohan.mehta@example.com",
			"notes": "Vegetarian options preferred.",
		},
	]

	table_bookings = []
	for data in table_data:
		if frappe.db.exists("Table Booking", {"booking_number": data["booking_number"]}):
			print(f"⏭️  Table Booking already exists: {data['booking_number']}")
			table_bookings.append(data["booking_number"])
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Table Booking",
				"restaurant": restaurant,
				**data,
			}
		)
		doc.insert(ignore_permissions=True)
		table_bookings.append(doc.name)
		print(f"✅ Created table booking: {data['booking_number']}")

	# Banquet booking
	banquet_data = {
		"booking_number": "BB-2001",
		"number_of_guests": 80,
		"event_type": "Corporate",
		"date": add_days(today, 14),
		"time_slot": "19:00–23:00",
		"status": "confirmed",
		"customer_name": "Acme Corp HR",
		"customer_phone": "+1 555 0133 777",
		"customer_email": "events@acmecorp.test",
		"notes": "Year-end celebration, buffet with live salad & dessert stations.",
	}

	banquet_bookings = []
	if frappe.db.exists("Banquet Booking", {"booking_number": banquet_data["booking_number"]}):
		print(f"⏭️  Banquet Booking already exists: {banquet_data['booking_number']}")
		banquet_bookings.append(banquet_data["booking_number"])
	else:
		doc = frappe.get_doc(
			{
				"doctype": "Banquet Booking",
				"restaurant": restaurant,
				**banquet_data,
			}
		)
		doc.insert(ignore_permissions=True)
		banquet_bookings.append(doc.name)
		print(f"✅ Created banquet booking: {banquet_data['booking_number']}")

	return table_bookings, banquet_bookings


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

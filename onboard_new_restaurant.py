# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
Script to onboard a new restaurant client
Usage: bench --site <site> execute dinematters.onboard_new_restaurant.onboard_restaurant
"""

import frappe
from frappe import _


def onboard_restaurant(
	restaurant_id,
	restaurant_name,
	owner_email,
	owner_name=None,
	owner_phone=None,
	address=None,
	city=None,
	state=None,
	zip_code=None,
	country=None,
	currency="USD",
	tax_rate=0,
	default_delivery_fee=0,
	timezone=None,
	description=None,
	logo=None,
	company=None
):
	"""
	Complete onboarding flow for a new restaurant client
	
	Steps:
	1. Create Restaurant doctype
	2. Create/assign owner user (if email provided)
	3. Create Restaurant Config
	4. Create default Home Features
	5. Create default Legacy Content structure
	6. Return restaurant details
	"""
	
	frappe.only_for("System Manager")
	
	# Step 1: Create Restaurant
	print(f"\n{'='*60}")
	print(f"Step 1: Creating Restaurant: {restaurant_name}")
	print(f"{'='*60}")
	
	# Check if restaurant already exists
	if frappe.db.exists("Restaurant", {"restaurant_id": restaurant_id}):
		restaurant_name_db = frappe.db.get_value("Restaurant", {"restaurant_id": restaurant_id}, "name")
		print(f"⚠️  Restaurant already exists: {restaurant_name_db}")
		restaurant = restaurant_name_db
	else:
		restaurant_doc = frappe.get_doc({
			"doctype": "Restaurant",
			"restaurant_id": restaurant_id,
			"restaurant_name": restaurant_name,
			"owner_email": owner_email,
			"owner_name": owner_name,
			"owner_phone": owner_phone,
			"address": address,
			"city": city,
			"state": state,
			"zip_code": zip_code,
			"country": country,
			"currency": currency or "USD",
			"tax_rate": tax_rate or 0,
			"default_delivery_fee": default_delivery_fee or 0,
			"timezone": timezone,
			"description": description,
			"logo": logo,
			"company": company,
			"is_active": 1
		})
		restaurant_doc.insert(ignore_permissions=True)
		restaurant = restaurant_doc.name
		print(f"✅ Restaurant created: {restaurant}")
	
	# Step 2: Assign Owner (auto-handled by Restaurant.after_insert hook)
	print(f"\n{'='*60}")
	print(f"Step 2: Assigning Owner")
	print(f"{'='*60}")
	
	if owner_email:
		user = frappe.db.get_value("User", {"email": owner_email}, "name")
		if user:
			# Check if Restaurant User exists
			if frappe.db.exists("Restaurant User", {"user": user, "restaurant": restaurant}):
				print(f"✅ Owner already assigned: {owner_email}")
			else:
				print(f"✅ Owner will be auto-assigned via hook: {owner_email}")
		else:
			print(f"⚠️  User with email {owner_email} not found. Please create user first.")
			print(f"   User can be assigned later via Restaurant User doctype.")
	
	# Step 3: Create Restaurant Config
	print(f"\n{'='*60}")
	print(f"Step 3: Creating Restaurant Config")
	print(f"{'='*60}")
	
	if frappe.db.exists("Restaurant Config", {"restaurant": restaurant}):
		print(f"✅ Restaurant Config already exists")
	else:
		config_doc = frappe.get_doc({
			"doctype": "Restaurant Config",
			"restaurant": restaurant,
			"restaurant_name": restaurant_name,
			"currency": currency or "USD",
			"primary_color": "#DB782F",
			"default_theme": "light",
			"enable_table_booking": 1,
			"enable_banquet_booking": 1,
			"enable_events": 1,
			"enable_offers": 1,
			"enable_coupons": 1
		})
		config_doc.insert(ignore_permissions=True)
		print(f"✅ Restaurant Config created")
	
	# Step 4: Create default Home Features
	print(f"\n{'='*60}")
	print(f"Step 4: Creating Home Features")
	print(f"{'='*60}")
	
	existing_features = frappe.get_all("Home Feature", filters={"restaurant": restaurant}, pluck="name")
	if existing_features:
		print(f"✅ Home Features already exist ({len(existing_features)} features)")
	else:
		default_features = [
			{
				"feature_id": "menu",
				"title": "Explore our Menu",
				"subtitle": "Food, Taste, Love",
				"image_src": "/files/explore.svg",
				"image_alt": "Explore our Menu",
				"route": "/main-menu",
				"size": "large",
				"is_mandatory": 1,
				"display_order": 1
			},
			{
				"feature_id": "book-table",
				"title": "Book your Tables",
				"subtitle": "& banquets",
				"image_src": "/files/book-table.svg",
				"image_alt": "Book your Tables",
				"route": "/book-table",
				"size": "small",
				"is_mandatory": 1,
				"display_order": 2
			},
			{
				"feature_id": "legacy",
				"title": "The Place",
				"subtitle": "& it's legacy",
				"image_src": "/files/legacy.svg",
				"image_alt": "The Place",
				"route": "/legacy",
				"size": "small",
				"is_mandatory": 1,
				"display_order": 3
			},
			{
				"feature_id": "offers-events",
				"title": "Offers & Events",
				"subtitle": "Treasure mine.",
				"image_src": "/files/events-offers.svg",
				"image_alt": "Offers & Events",
				"route": "/events",
				"size": "small",
				"is_mandatory": 0,
				"display_order": 4
			},
			{
				"feature_id": "dine-play",
				"title": "Dine & Play",
				"subtitle": "Enjoy your bites",
				"image_src": "/files/experience-lounge.svg",
				"image_alt": "Dine & Play",
				"route": "/experience-lounge-splash",
				"size": "small",
				"is_mandatory": 0,
				"display_order": 5
			}
		]
		
		for feat_data in default_features:
			feat_doc = frappe.get_doc({
				"doctype": "Home Feature",
				"restaurant": restaurant,
				"is_enabled": 1,
				**feat_data
			})
			feat_doc.insert(ignore_permissions=True)
		
		print(f"✅ Created {len(default_features)} default Home Features")
	
	# Step 5: Create default Legacy Content structure
	print(f"\n{'='*60}")
	print(f"Step 5: Creating Legacy Content")
	print(f"{'='*60}")
	
	if frappe.db.exists("Legacy Content", {"restaurant": restaurant}):
		print(f"✅ Legacy Content already exists")
	else:
		legacy_doc = frappe.get_doc({
			"doctype": "Legacy Content",
			"restaurant": restaurant,
			"hero_media_type": "video",
			"hero_title": f"Discover the Culinary Heritage of {restaurant_name}",
			"footer_title": "Ready for Your Next Culinary Adventure?",
			"footer_description": "Start exploring our menu today and discover the hidden gems of our culinary legacy with just a few clicks.",
			"footer_cta_text": "Explore Our Menu",
			"footer_cta_route": "/main-menu"
		})
		legacy_doc.insert(ignore_permissions=True)
		print(f"✅ Legacy Content created with default structure")
	
	# Step 6: Summary
	print(f"\n{'='*60}")
	print(f"✅ ONBOARDING COMPLETE")
	print(f"{'='*60}")
	print(f"\nRestaurant Details:")
	print(f"  - Restaurant ID: {restaurant_id}")
	print(f"  - Restaurant Name: {restaurant_name}")
	print(f"  - Database Name: {restaurant}")
	print(f"  - Owner Email: {owner_email}")
	print(f"\nNext Steps:")
	print(f"  1. Create User account for {owner_email} (if not exists)")
	print(f"  2. Add Menu Categories and Products")
	print(f"  3. Customize Restaurant Config (branding, colors, settings)")
	print(f"  4. Add Offers, Events, Games as needed")
	print(f"  5. Customize Legacy Content")
	print(f"  6. Test APIs with restaurant_id: {restaurant_id}")
	
	return {
		"restaurant_id": restaurant_id,
		"restaurant_name": restaurant_name,
		"restaurant": restaurant,
		"owner_email": owner_email
	}


# CLI command
def onboard_restaurant_cli():
	"""CLI wrapper for onboarding"""
	import click
	
	@click.command()
	@click.option('--restaurant-id', required=True, help='Unique restaurant identifier')
	@click.option('--restaurant-name', required=True, help='Restaurant display name')
	@click.option('--owner-email', required=True, help='Owner email address')
	@click.option('--owner-name', help='Owner full name')
	@click.option('--owner-phone', help='Owner phone number')
	@click.option('--currency', default='USD', help='Currency code')
	@click.option('--address', help='Restaurant address')
	@click.option('--city', help='City')
	@click.option('--state', help='State')
	@click.option('--country', help='Country')
	def onboard(restaurant_id, restaurant_name, owner_email, owner_name, owner_phone, currency, address, city, state, country):
		"""Onboard a new restaurant client"""
		result = onboard_restaurant(
			restaurant_id=restaurant_id,
			restaurant_name=restaurant_name,
			owner_email=owner_email,
			owner_name=owner_name,
			owner_phone=owner_phone,
			currency=currency,
			address=address,
			city=city,
			state=state,
			country=country
		)
		click.echo(f"\n✅ Restaurant onboarded: {result['restaurant']}")
	
	return onboard

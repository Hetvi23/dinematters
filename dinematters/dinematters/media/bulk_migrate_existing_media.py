#!/usr/bin/env python3
"""
Bulk Migration Script for Existing Media Files to R2 CDN

This script migrates all existing /files/ media to R2 without requiring manual re-upload.
It processes all restaurants and their media assets in one go.

Usage:
    # Dry run (preview only, no changes)
    bench --site [site-name] execute dinematters.dinematters.media.bulk_migrate_existing_media.migrate_all_media --kwargs "{'dry_run': True}"
    
    # Full migration
    bench --site [site-name] execute dinematters.dinematters.media.bulk_migrate_existing_media.migrate_all_media --kwargs "{'dry_run': False}"
"""

import frappe
import os
import uuid
from pathlib import Path
import mimetypes
from dinematters.dinematters.media.storage import upload_object, generate_object_key, get_cdn_url
from dinematters.dinematters.media.config import get_media_config


def migrate_all_media(dry_run=True, overwrite_fields=False):
	"""Migrate all existing media files to R2 for all restaurants"""
	
	print("\n" + "="*80)
	print(f"🚀 BULK MEDIA MIGRATION TO R2 CDN")
	print(f"Mode: {'DRY RUN (Preview Only)' if dry_run else 'FULL MIGRATION'}")
	print(f"Overwrite Fields: {'YES' if overwrite_fields else 'NO'}")
	print("="*80 + "\n")
	
	# Get all active restaurants
	restaurants = frappe.get_all("Restaurant", filters={"is_active": 1}, pluck="name")
	
	print(f"📊 Found {len(restaurants)} active restaurants\n")
	
	total_files = 0
	total_migrated = 0
	total_skipped = 0
	total_errors = 0
	
	for restaurant in restaurants:
		print(f"\n{'─'*80}")
		print(f"🏪 Processing Restaurant: {restaurant}")
		print(f"{'─'*80}\n")
		
		stats = migrate_restaurant_media(restaurant, dry_run, overwrite_fields=overwrite_fields)
		total_files += stats["total"]
		total_migrated += stats["migrated"]
		total_skipped += stats["skipped"]
		total_errors += stats["errors"]
	
	# Final summary
	print("\n" + "="*80)
	print("📈 MIGRATION SUMMARY")
	print("="*80)
	print(f"Total Files Found:     {total_files}")
	print(f"Successfully Migrated: {total_migrated}")
	print(f"Skipped (Already R2):  {total_skipped}")
	print(f"Errors:                {total_errors}")
	print("="*80 + "\n")
	
	if dry_run:
		print("⚠️  This was a DRY RUN - no changes were made")
		print("Run with dry_run=False to perform actual migration\n")
	else:
		print("✅ Migration complete!\n")
	
	return {
		"total": total_files,
		"migrated": total_migrated,
		"skipped": total_skipped,
		"errors": total_errors
	}


def migrate_restaurant_media(restaurant, dry_run=True, overwrite_fields=False):
	"""Migrate all media for a single restaurant"""
	
	stats = {"total": 0, "migrated": 0, "skipped": 0, "errors": 0}
	
	# Define all DocTypes and their media fields
	migration_map = [
		# Home Features
		{
			"doctype": "Home Feature",
			"filters": {"restaurant": restaurant},
			"fields": [{"field": "image_src", "role": "home_feature_image"}]
		},
		# Restaurant Config
		{
			"doctype": "Restaurant Config",
			"filters": {"restaurant": restaurant},
			"fields": [
				{"field": "logo", "role": "restaurant_config_logo"},
				{"field": "hero_video", "role": "restaurant_config_hero_video"},
				{"field": "apple_touch_icon", "role": "apple_touch_icon"}
			]
		},
		# Events
		{
			"doctype": "Event",
			"filters": {"restaurant": restaurant},
			"fields": [{"field": "image_src", "role": "event_image"}]
		},
		# Offers
		{
			"doctype": "Offer",
			"filters": {"restaurant": restaurant},
			"fields": [{"field": "image_src", "role": "offer_image"}]
		},
		# Menu Categories
		{
			"doctype": "Menu Category",
			"filters": {"restaurant": restaurant},
			"fields": [{"field": "category_image", "role": "category_image"}]
		},
		# Legacy Content
		{
			"doctype": "Legacy Content",
			"filters": {"restaurant": restaurant},
			"fields": [
				{"field": "hero_media_src", "role": "legacy_hero_media"},
				{"field": "hero_fallback_image", "role": "legacy_hero_fallback"},
				{"field": "footer_media_src", "role": "legacy_footer_media"}
			]
		}
	]
	
	# Process each DocType
	for mapping in migration_map:
		doctype = mapping["doctype"]
		filters = mapping["filters"]
		fields = mapping["fields"]
		
		# Get all documents
		docs = frappe.get_all(doctype, filters=filters, fields=["name"])
		
		if not docs:
			continue
		
		print(f"  📁 {doctype}: {len(docs)} documents")
		
		for doc in docs:
			doc_name = doc["name"]
			doc_obj = frappe.get_doc(doctype, doc_name)
			
			# Process each media field
			for field_config in fields:
				field_name = field_config["field"]
				media_role = field_config["role"]
				
				file_url = doc_obj.get(field_name)
				
				if not file_url or not file_url.startswith("/files/"):
					continue
				
				stats["total"] += 1
				
				# Check if already migrated
				existing_asset = frappe.db.exists("Media Asset", {
					"owner_doctype": doctype,
					"owner_name": doc_name,
					"media_role": media_role,
					"status": "ready"
				})
				
				if existing_asset:
					stats["skipped"] += 1
					print(f"    ⏭️  Skipped: {doctype}/{doc_name}/{field_name} (already migrated)")
					continue
				
				# Migrate file
				try:
					result = migrate_single_file(
						restaurant=restaurant,
						owner_doctype=doctype,
						owner_name=doc_name,
						media_role=media_role,
						file_url=file_url,
						dry_run=dry_run,
						overwrite_fields=overwrite_fields,
						overwrite_doctype=doctype,
						overwrite_name=doc_name,
						overwrite_field=field_name,
						overwrite_expected_value=file_url,
					)
					
					if result:
						stats["migrated"] += 1
						print(f"    ✅ Migrated: {doctype}/{doc_name}/{field_name} → {result['cdn_url'][:60]}...")
					else:
						stats["errors"] += 1
						print(f"    ❌ Failed: {doctype}/{doc_name}/{field_name}")
				
				except Exception as e:
					stats["errors"] += 1
					print(f"    ❌ Error: {doctype}/{doc_name}/{field_name} - {str(e)}")
					frappe.log_error(f"Migration error: {str(e)}", f"Bulk Migration Error - {doctype}")
	
	# Process Product Media (child table)
	product_stats = migrate_product_media(restaurant, dry_run, overwrite_fields=overwrite_fields)
	stats["total"] += product_stats["total"]
	stats["migrated"] += product_stats["migrated"]
	stats["skipped"] += product_stats["skipped"]
	stats["errors"] += product_stats["errors"]
	
	# Process Legacy child tables
	legacy_stats = migrate_legacy_child_tables(restaurant, dry_run, overwrite_fields=overwrite_fields)
	stats["total"] += legacy_stats["total"]
	stats["migrated"] += legacy_stats["migrated"]
	stats["skipped"] += legacy_stats["skipped"]
	stats["errors"] += legacy_stats["errors"]
	
	print(f"\n  📊 Restaurant Summary: {stats['migrated']} migrated, {stats['skipped']} skipped, {stats['errors']} errors\n")
	
	return stats


def migrate_product_media(restaurant, dry_run=True, overwrite_fields=False):
	"""Migrate product media (child table)"""
	
	stats = {"total": 0, "migrated": 0, "skipped": 0, "errors": 0}
	
	# Get all products for this restaurant
	products = frappe.get_all("Menu Product", filters={"restaurant": restaurant}, fields=["name"])
	
	if not products:
		return stats
	
	print(f"  📁 Product Media: {len(products)} products")
	
	for product in products:
		product_doc = frappe.get_doc("Menu Product", product["name"])
		
		if not product_doc.product_media:
			continue
		
		for media_item in product_doc.product_media:
			file_url = media_item.media_url
			
			if not file_url or not file_url.startswith("/files/"):
				continue
			
			stats["total"] += 1
			
			# Check if already migrated
			existing_asset = frappe.db.exists("Media Asset", {
				"owner_doctype": "Product Media",
				"owner_name": media_item.name,
				"status": "ready"
			})
			
			if existing_asset:
				stats["skipped"] += 1
				continue
			
			# Determine media role
			media_type = media_item.media_type or "image"
			media_role = f"product_{media_type}"
			
			try:
				result = migrate_single_file(
					restaurant=restaurant,
					owner_doctype="Product Media",
					owner_name=media_item.name,
					media_role=media_role,
					file_url=file_url,
					dry_run=dry_run,
					overwrite_fields=overwrite_fields,
					overwrite_doctype="Product Media",
					overwrite_name=media_item.name,
					overwrite_field="media_url",
					overwrite_expected_value=file_url,
				)
				
				if result:
					stats["migrated"] += 1
					print(f"    ✅ Product Media: {product['name']}/{media_item.name}")
				else:
					stats["errors"] += 1
			
			except Exception as e:
				stats["errors"] += 1
				frappe.log_error(f"Product media migration error: {str(e)}", "Bulk Migration Error")
	
	return stats


def migrate_legacy_child_tables(restaurant, dry_run=True, overwrite_fields=False):
	"""Migrate legacy child table media"""
	
	stats = {"total": 0, "migrated": 0, "skipped": 0, "errors": 0}
	
	# Get legacy content for this restaurant
	legacy_docs = frappe.get_all("Legacy Content", filters={"restaurant": restaurant}, fields=["name"])
	
	if not legacy_docs:
		return stats
	
	print(f"  📁 Legacy Content: {len(legacy_docs)} documents")
	
	for legacy in legacy_docs:
		legacy_doc = frappe.get_doc("Legacy Content", legacy["name"])
		
		# Process members
		if hasattr(legacy_doc, 'members') and legacy_doc.members:
			for member in legacy_doc.members:
				if member.image and member.image.startswith("/files/"):
					stats["total"] += 1
					try:
						result = migrate_single_file(
							restaurant=restaurant,
							owner_doctype="Legacy Member",
							owner_name=member.name,
							media_role="legacy_member_image",
							file_url=member.image,
							dry_run=dry_run,
							overwrite_fields=overwrite_fields,
							overwrite_doctype="Legacy Member",
							overwrite_name=member.name,
							overwrite_field="image",
							overwrite_expected_value=member.image,
						)
						if result:
							stats["migrated"] += 1
						else:
							stats["errors"] += 1
					except:
						stats["errors"] += 1
		
		# Process gallery images
		if hasattr(legacy_doc, 'gallery_featured_images') and legacy_doc.gallery_featured_images:
			for img in legacy_doc.gallery_featured_images:
				if img.image and img.image.startswith("/files/"):
					stats["total"] += 1
					try:
						result = migrate_single_file(
							restaurant=restaurant,
							owner_doctype="Legacy Gallery Image",
							owner_name=img.name,
							media_role="legacy_gallery_image",
							file_url=img.image,
							dry_run=dry_run,
							overwrite_fields=overwrite_fields,
							overwrite_doctype="Legacy Gallery Image",
							overwrite_name=img.name,
							overwrite_field="image",
							overwrite_expected_value=img.image,
						)
						if result:
							stats["migrated"] += 1
						else:
							stats["errors"] += 1
					except:
						stats["errors"] += 1
		
		# Process testimonials (Legacy Testimonial is a child table on Legacy Content)
		if hasattr(legacy_doc, 'testimonials') and legacy_doc.testimonials:
			for test_row in legacy_doc.testimonials:
				# Avatar
				if test_row.avatar and test_row.avatar.startswith("/files/"):
					stats["total"] += 1
					try:
						result = migrate_single_file(
							restaurant=restaurant,
							owner_doctype="Legacy Testimonial",
							owner_name=test_row.name,
							media_role="legacy_testimonial_avatar",
							file_url=test_row.avatar,
							dry_run=dry_run,
							overwrite_fields=overwrite_fields,
							overwrite_doctype="Legacy Testimonial",
							overwrite_name=test_row.name,
							overwrite_field="avatar",
							overwrite_expected_value=test_row.avatar,
						)
						if result:
							stats["migrated"] += 1
						else:
							stats["errors"] += 1
					except:
						stats["errors"] += 1
				
				# Dish images (Legacy Testimonial Image is a child table on Legacy Testimonial)
				if hasattr(test_row, 'dish_images') and test_row.dish_images:
					for dish_img in test_row.dish_images:
						if dish_img.image and dish_img.image.startswith("/files/"):
							stats["total"] += 1
							try:
								result = migrate_single_file(
									restaurant=restaurant,
									owner_doctype="Legacy Testimonial Image",
									owner_name=dish_img.name,
									media_role="legacy_testimonial_dish_image",
									file_url=dish_img.image,
									dry_run=dry_run,
									overwrite_fields=overwrite_fields,
									overwrite_doctype="Legacy Testimonial Image",
									overwrite_name=dish_img.name,
									overwrite_field="image",
									overwrite_expected_value=dish_img.image,
								)
								if result:
									stats["migrated"] += 1
								else:
									stats["errors"] += 1
							except:
								stats["errors"] += 1
	
	return stats


def _overwrite_owner_field(doctype, name, field, value, expected_value=None):
	"""Overwrite a field using SQL (avoids timestamp conflicts). If expected_value is provided, only overwrite if current value matches it."""
	if expected_value is not None:
		current = frappe.db.get_value(doctype, name, field)
		if current != expected_value:
			return False

	frappe.db.sql(
		"""
		UPDATE `tab{doctype}`
		SET `{field}` = %s, `modified` = NOW()
		WHERE `name` = %s
		""".format(doctype=doctype, field=field),
		(value, name),
	)
	return True


def migrate_single_file(
	restaurant,
	owner_doctype,
	owner_name,
	media_role,
	file_url,
	dry_run=True,
	overwrite_fields=False,
	overwrite_doctype=None,
	overwrite_name=None,
	overwrite_field=None,
	overwrite_expected_value=None,
):
	"""Migrate a single file to R2"""
	
	if dry_run:
		return {
			"cdn_url": f"[DRY RUN] Would migrate: {file_url}",
			"would_overwrite": bool(overwrite_fields and overwrite_doctype and overwrite_name and overwrite_field),
		}
	
	try:
		# Get file path
		site_path = frappe.get_site_path()
		file_path = os.path.join(site_path, "public", file_url.lstrip("/"))
		
		if not os.path.exists(file_path):
			print(f"      ⚠️  File not found: {file_path}")
			return None
		
		# Get file info
		filename = os.path.basename(file_path)
		file_size = os.path.getsize(file_path)
		content_type, _ = mimetypes.guess_type(filename)
		
		if not content_type:
			content_type = "application/octet-stream"
		
		# Generate media_id and object key
		media_id = str(uuid.uuid4())
		object_key = generate_object_key(restaurant, owner_doctype, media_id, filename)
		
		# Upload to R2
		with open(file_path, 'rb') as f:
			file_data = f.read()
		
		upload_object(object_key, file_data, content_type)
		
		# Get CDN URL
		cdn_url = get_cdn_url(object_key)
		
		# Determine media kind
		media_kind = "image" if content_type.startswith("image/") else "video" if content_type.startswith("video/") else "file"
		
		# Create Media Asset
		media_asset = frappe.get_doc({
			"doctype": "Media Asset",
			"media_id": media_id,
			"restaurant": restaurant,
			"owner_doctype": owner_doctype,
			"owner_name": owner_name,
			"media_role": media_role,
			"source_filename": filename,
			"source_extension": Path(filename).suffix.lstrip("."),
			"source_mime_type": content_type,
			"source_size_bytes": file_size,
			"media_kind": media_kind,
			"storage_provider": "cloudflare_r2",
			"raw_object_key": object_key,
			"primary_object_key": object_key,
			"primary_url": cdn_url,
			"status": "uploaded",
			"is_active": 1
		})
		
		media_asset.insert(ignore_permissions=True)
		
		# Optionally overwrite the original field with CDN URL (only after upload + Media Asset insert)
		overwritten = False
		if overwrite_fields and overwrite_doctype and overwrite_name and overwrite_field:
			overwritten = _overwrite_owner_field(
				overwrite_doctype,
				overwrite_name,
				overwrite_field,
				cdn_url,
				expected_value=overwrite_expected_value,
			)
		
		frappe.db.commit()
		
		# Enqueue processing for images/videos
		if media_kind in ["image", "video"]:
			frappe.enqueue(
				"dinematters.dinematters.media.jobs.process_media_asset",
				media_asset_name=media_asset.name,
				queue="default",
				timeout=600,
				is_async=True,
				now=False
			)
		
		return {
			"cdn_url": cdn_url,
			"media_asset": media_asset.name,
			"overwritten": overwritten,
		}
	
	except Exception as e:
		frappe.log_error(f"File migration error: {str(e)}", f"Migrate {file_url}")
		return None

"""
Migration Script: Convert Existing /files/ URLs to R2 Media Assets

This script migrates existing Frappe file attachments to R2 and creates Media Assets.
Run this after deploying the R2 integration to convert legacy data.

Usage:
    bench --site [site-name] execute dinematters.dinematters.media.migrate_to_r2.migrate_all
    
Or migrate specific DocTypes:
    bench --site [site-name] execute dinematters.dinematters.media.migrate_to_r2.migrate_doctype --kwargs "{'doctype': 'Event'}"
"""

import frappe
from frappe.utils import get_files_path
import os
import mimetypes
from dinematters.dinematters.media.api import request_upload_session, confirm_upload
from dinematters.dinematters.media.storage import upload_object


def migrate_all(dry_run=False):
	"""Migrate all supported DocTypes to R2"""
	doctypes_to_migrate = [
		{
			'doctype': 'Event',
			'fields': [{'field': 'image_src', 'role': 'event_image'}]
		},
		{
			'doctype': 'Offer',
			'fields': [{'field': 'image_src', 'role': 'offer_image'}]
		},
		{
			'doctype': 'Home Feature',
			'fields': [{'field': 'image_src', 'role': 'home_feature_image'}]
		},
		{
			'doctype': 'Restaurant Config',
			'fields': [
				{'field': 'logo', 'role': 'restaurant_config_logo'},
				{'field': 'hero_video', 'role': 'restaurant_config_hero_video'},
				{'field': 'apple_touch_icon', 'role': 'apple_touch_icon'}
			]
		},
		{
			'doctype': 'Legacy Content',
			'fields': [
				{'field': 'hero_media_src', 'role': 'legacy_hero_media'},
				{'field': 'hero_fallback_image', 'role': 'legacy_hero_fallback'},
				{'field': 'footer_media_src', 'role': 'legacy_footer_media'}
			]
		},
		{
			'doctype': 'Legacy Member',
			'fields': [{'field': 'image', 'role': 'legacy_member_image'}]
		},
		{
			'doctype': 'Legacy Testimonial',
			'fields': [{'field': 'avatar', 'role': 'legacy_testimonial_avatar'}]
		},
		{
			'doctype': 'Legacy Gallery Image',
			'fields': [{'field': 'image', 'role': 'legacy_gallery_image'}]
		},
		{
			'doctype': 'Legacy Testimonial Image',
			'fields': [{'field': 'image', 'role': 'legacy_testimonial_dish_image'}]
		},
		{
			'doctype': 'Menu Category',
			'fields': [{'field': 'category_image', 'role': 'category_image'}]
		}
	]
	
	total_migrated = 0
	total_errors = 0
	
	for config in doctypes_to_migrate:
		print(f"\n{'='*60}")
		print(f"Migrating {config['doctype']}...")
		print(f"{'='*60}")
		
		migrated, errors = migrate_doctype(
			config['doctype'],
			config['fields'],
			dry_run=dry_run
		)
		
		total_migrated += migrated
		total_errors += errors
	
	print(f"\n{'='*60}")
	print(f"MIGRATION SUMMARY")
	print(f"{'='*60}")
	print(f"Total migrated: {total_migrated}")
	print(f"Total errors: {total_errors}")
	print(f"Dry run: {dry_run}")
	
	return {
		'migrated': total_migrated,
		'errors': total_errors
	}


def migrate_doctype(doctype, fields, dry_run=False):
	"""
	Migrate a specific DocType's media fields to R2
	
	Args:
		doctype: DocType name
		fields: List of dicts with 'field' and 'role' keys
		dry_run: If True, don't actually migrate, just report
	"""
	migrated_count = 0
	error_count = 0
	
	# Get all documents with /files/ URLs
	for field_config in fields:
		field = field_config['field']
		media_role = field_config['role']
		
		print(f"\nProcessing {doctype}.{field} (role: {media_role})...")
		
		# Find docs with /files/ URLs in this field
		docs = frappe.get_all(
			doctype,
			filters={
				field: ['like', '/files/%']
			},
			fields=['name', field]
		)
		
		print(f"Found {len(docs)} documents with /files/ URLs")
		
		for doc_data in docs:
			doc_name = doc_data['name']
			file_url = doc_data[field]
			
			if not file_url or not file_url.startswith('/files/'):
				continue
			
			try:
				if dry_run:
					print(f"  [DRY RUN] Would migrate: {doc_name} - {file_url}")
					migrated_count += 1
				else:
					# Perform actual migration
					success = migrate_file_to_r2(
						doctype,
						doc_name,
						field,
						file_url,
						media_role
					)
					
					if success:
						print(f"  ✓ Migrated: {doc_name}")
						migrated_count += 1
					else:
						print(f"  ✗ Failed: {doc_name}")
						error_count += 1
						
			except Exception as e:
				print(f"  ✗ Error migrating {doc_name}: {str(e)}")
				error_count += 1
				frappe.log_error(
					f"Migration error for {doctype} {doc_name}: {str(e)}",
					"R2 Migration Error"
				)
	
	return migrated_count, error_count


def migrate_file_to_r2(owner_doctype, owner_name, field_name, file_url, media_role):
	"""
	Migrate a single file from Frappe storage to R2
	
	Returns:
		bool: True if successful, False otherwise
	"""
	try:
		# Get file path
		file_path = get_files_path(file_url.replace('/files/', ''), is_private=0)
		
		if not os.path.exists(file_path):
			# Try private files
			file_path = get_files_path(file_url.replace('/files/', ''), is_private=1)
		
		if not os.path.exists(file_path):
			print(f"    File not found: {file_path}")
			return False
		
		# Get file info
		filename = os.path.basename(file_path)
		file_size = os.path.getsize(file_path)
		content_type, _ = mimetypes.guess_type(filename)
		content_type = content_type or 'application/octet-stream'
		
		# Read file content
		with open(file_path, 'rb') as f:
			file_content = f.read()
		
		# Upload to R2 using the same flow as new uploads
		from dinematters.dinematters.media.storage import generate_object_key, upload_object
		
		# Get restaurant
		from dinematters.dinematters.media.api import get_restaurant_from_owner
		restaurant = get_restaurant_from_owner(owner_doctype, owner_name)
		
		# Generate media_id
		import uuid
		media_id = str(uuid.uuid4())
		
		# Generate R2 object key
		object_key = generate_object_key(restaurant, owner_doctype, media_id, filename)
		
		# Upload to R2
		r2_url = upload_object(object_key, file_content, content_type)
		
		# Create Media Asset
		media_asset = frappe.get_doc({
			'doctype': 'Media Asset',
			'media_id': media_id,
			'restaurant': restaurant,
			'owner_doctype': owner_doctype,
			'owner_name': owner_name,
			'media_role': media_role,
			'filename': filename,
			'media_kind': 'image' if content_type.startswith('image/') else 'video',
			'mime_type': content_type,
			'size_bytes': file_size,
			'r2_object_key': object_key,
			'raw_url': r2_url,
			'primary_url': r2_url,
			'status': 'uploaded'
		})
		media_asset.insert(ignore_permissions=True)
		
		# Enqueue processing
		frappe.enqueue(
			'dinematters.dinematters.media.jobs.process_media_asset',
			media_asset_name=media_asset.name,
			queue='default',
			timeout=600
		)
		
		# Update the owner document field with media_asset link
		frappe.db.set_value(owner_doctype, owner_name, f'{field_name}_media_asset', media_asset.name)
		frappe.db.commit()
		
		return True
		
	except Exception as e:
		frappe.log_error(
			f"Failed to migrate {owner_doctype} {owner_name} field {field_name}: {str(e)}",
			"R2 Migration Error"
		)
		return False


def rollback_migration(doctype, field_name):
	"""
	Rollback migration for a specific DocType field
	This will delete Media Assets and restore /files/ URLs
	"""
	print(f"Rolling back {doctype}.{field_name}...")
	
	# This is a safety feature - requires manual confirmation
	confirm = input("Are you sure you want to rollback? This will delete Media Assets. Type 'yes' to confirm: ")
	
	if confirm.lower() != 'yes':
		print("Rollback cancelled")
		return
	
	# Get all Media Assets for this DocType
	media_assets = frappe.get_all(
		'Media Asset',
		filters={'owner_doctype': doctype},
		fields=['name', 'owner_name']
	)
	
	for asset in media_assets:
		try:
			# Delete the Media Asset
			frappe.delete_doc('Media Asset', asset['name'], force=1)
			print(f"  Deleted Media Asset: {asset['name']}")
		except Exception as e:
			print(f"  Error deleting {asset['name']}: {str(e)}")
	
	frappe.db.commit()
	print(f"Rollback complete for {doctype}")

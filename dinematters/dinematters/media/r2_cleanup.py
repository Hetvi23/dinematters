import frappe
from frappe.utils import now_datetime, add_to_date
from botocore.exceptions import ClientError
from .storage import get_r2_client, get_r2_config, delete_object, get_cdn_url
import re

def run_r2_cleanup():
	"""
	Scheduled maintenance task to prune unreferenced media from Cloudflare R2.
	Applies strict 30-day grace periods for isolated buffers.
	"""
	try:
		client = get_r2_client()
		config = get_r2_config()
		bucket_name = config.get("bucket_name")
		
		if not bucket_name:
			frappe.log_error("R2 cleanup aborted: Bucket name undefined.", "R2 Maintenance")
			return
		
		# 1. Build aggressive safety lookup cache from active schema bindings
		registered_keys = set()
		
		# Collect primary keys
		assets = frappe.db.get_all("Media Asset", fields=["raw_object_key", "poster_url", "primary_url"])
		for asset in assets:
			if asset.raw_object_key:
				registered_keys.add(asset.raw_object_key)
				
		# Collect variants
		variants = frappe.db.get_all("Media Variant", fields=["object_key"])
		for var in variants:
			if var.object_key:
				registered_keys.add(var.object_key)
				
		# Collect standalone integrations safely across all media-bearing schemas
		active_urls = set()
		
		# 1. Product Media
		for row in frappe.db.get_all("Product Media", fields=["media_url"]):
			if row.media_url:
				active_urls.add(row.media_url)
				
		# 2. Menu Category
		for row in frappe.db.get_all("Menu Category", fields=["category_image"]):
			if row.category_image:
				active_urls.add(row.category_image)
				
		# 3. Restaurant Config
		for row in frappe.db.get_all("Restaurant Config", fields=["logo", "hero_video", "apple_touch_icon", "menu_theme_background_active", "menu_theme_background_preview"]):
			for field in ["logo", "hero_video", "apple_touch_icon", "menu_theme_background_active", "menu_theme_background_preview"]:
				if row.get(field):
					active_urls.add(row.get(field))
					
		# 4. Game, Offer, Home Feature, Event (using image_src)
		for doctype in ["Game", "Offer", "Home Feature", "Event"]:
			try:
				for row in frappe.db.get_all(doctype, fields=["image_src"]):
					if row.image_src:
						active_urls.add(row.image_src)
			except Exception:
				pass

				
		# 2. Paginate completely through Cloudflare R2 contents
		deleted_count = 0
		continuation_token = None
		grace_date = add_to_date(now_datetime(), days=-30, as_datetime=True)
		
		while True:
			list_args = {"Bucket": bucket_name, "MaxKeys": 1000}
			if continuation_token:
				list_args["ContinuationToken"] = continuation_token
				
			response = client.list_objects_v2(**list_args)
			objects = response.get("Contents", [])
			
			for obj in objects:
				key = obj.get("Key")
				modified_at = obj.get("LastModified")
				
				# Ignore recent modifications
				if modified_at and modified_at.replace(tzinfo=None) > grace_date:
					continue
					
				if key in registered_keys:
					continue
					
				# Secondary URL Check for standalone integrations
				cdn_url = get_cdn_url(key)
				
				if cdn_url in active_urls:
					continue
					
				# 3. Purge safely
				delete_object(key)
				deleted_count += 1
				
			if not response.get("IsTruncated"):
				break
			continuation_token = response.get("NextContinuationToken")
			
		frappe.logger().info(f"R2 maintenance complete. Safely cleared {deleted_count} unreferenced object nodes.")
		
	except Exception as e:
		frappe.log_error(f"Unexpected execution crash inside R2 Cleanup protocol: {str(e)}", "R2 Maintenance Failure")

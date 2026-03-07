# Copyright (c) 2026, Hetvi Patel and contributors
# For license information, please see license.txt

"""
Media upload and management APIs
"""

import frappe
from frappe import _
from .config import get_allowed_mime_types, get_max_upload_size
from .storage import generate_object_key, generate_signed_upload_url, verify_object_exists
import os


@frappe.whitelist()
def request_upload_session(owner_doctype, owner_name, media_role, filename, content_type, size_bytes):
	"""
	Request upload session for direct R2 upload
	
	Args:
		owner_doctype: DocType that will own this media (e.g., "Menu Product")
		owner_name: Name of the owner document
		media_role: Role of the media (e.g., "product_image")
		filename: Original filename
		content_type: MIME type
		size_bytes: File size in bytes
	
	Returns:
		dict with upload_id, object_key, upload_url, headers, expires_in
	"""
	# Validate authentication
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)
	
	# Validate owner document exists
	if not frappe.db.exists(owner_doctype, owner_name):
		frappe.throw(_(f"{owner_doctype} {owner_name} does not exist"))
	
	# Get restaurant from owner document
	restaurant = get_restaurant_from_owner(owner_doctype, owner_name)
	
	# Validate user has access to restaurant
	validate_restaurant_access(restaurant)
	
	# Validate media role for doctype
	validate_media_role_for_doctype(owner_doctype, media_role)
	
	# Determine media kind from content type
	media_kind = get_media_kind_from_mime(content_type)
	
	# Validate content type
	validate_content_type(content_type, media_kind)
	
	# Validate file size
	validate_file_size(size_bytes, media_kind)
	
	# Generate media_id
	import uuid
	media_id = f"med_{uuid.uuid4().hex[:12]}"
	
	# Sanitize filename
	safe_filename = sanitize_filename(filename)
	
	# Generate object key
	object_key = generate_object_key(
		restaurant_id=restaurant,
		owner_doctype=owner_doctype,
		owner_name=owner_name,
		media_role=media_role,
		media_id=media_id,
		filename=safe_filename
	)
	
	# Generate signed upload URL
	upload_data = generate_signed_upload_url(object_key, content_type)
	
	# Create upload session record (optional - for tracking)
	upload_session = frappe.get_doc({
		"doctype": "Media Upload Session",
		"upload_id": media_id,
		"restaurant": restaurant,
		"owner_doctype": owner_doctype,
		"owner_name": owner_name,
		"media_role": media_role,
		"media_kind": media_kind,
		"object_key": object_key,
		"filename": safe_filename,
		"content_type": content_type,
		"size_bytes": size_bytes,
		"status": "pending"
	})
	
	try:
		upload_session.insert(ignore_permissions=True)
	except Exception as e:
		# Upload session is optional, log but don't fail
		frappe.log_error(f"Failed to create upload session: {str(e)}", "Upload Session Creation")
	
	return {
		"upload_id": media_id,
		"object_key": object_key,
		"upload_url": upload_data["upload_url"],
		"headers": upload_data["headers"],
		"expires_in": upload_data["expires_in"]
	}


@frappe.whitelist()
def confirm_upload(upload_id, owner_doctype, owner_name, media_role, alt_text=None, caption=None, display_order=0):
	"""
	Confirm upload and create Media Asset
	
	This endpoint is idempotent - calling it multiple times with same upload_id
	will not create duplicate media assets.
	
	Args:
		upload_id: Upload ID from request_upload_session
		owner_doctype: Owner DocType
		owner_name: Owner document name
		media_role: Media role
		alt_text: Optional alt text
		caption: Optional caption
		display_order: Display order
	
	Returns:
		dict with media_id, status, primary_url
	"""
	# Validate authentication
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)
	
	# Check if media asset already exists for this upload_id (idempotency)
	existing_asset = frappe.db.get_value("Media Asset", {"media_id": upload_id}, "name")
	
	if existing_asset:
		# Return existing asset
		asset_doc = frappe.get_doc("Media Asset", existing_asset)
		return {
			"media_id": asset_doc.media_id,
			"status": asset_doc.status,
			"primary_url": asset_doc.primary_url,
			"message": "Media asset already exists"
		}
	
	# Get upload session
	upload_session = frappe.db.get_value(
		"Media Upload Session",
		{"upload_id": upload_id},
		["object_key", "restaurant", "media_kind", "filename", "content_type", "size_bytes"],
		as_dict=True
	)
	
	if not upload_session:
		frappe.throw(_("Upload session not found"))
	
	# Verify object exists in R2
	verification = verify_object_exists(upload_session.object_key)
	
	if not verification.get("exists"):
		frappe.throw(_("File not found in storage. Please retry upload."))
	
	# Get restaurant from owner
	restaurant = get_restaurant_from_owner(owner_doctype, owner_name)
	
	# Validate restaurant access
	validate_restaurant_access(restaurant)
	
	# Get file extension
	file_extension = os.path.splitext(upload_session.filename)[1].lstrip('.')
	
	# Create Media Asset
	media_asset = frappe.get_doc({
		"doctype": "Media Asset",
		"media_id": upload_id,
		"restaurant": restaurant,
		"owner_doctype": owner_doctype,
		"owner_name": owner_name,
		"media_role": media_role,
		"media_kind": upload_session.media_kind,
		"source_filename": upload_session.filename,
		"source_extension": file_extension,
		"source_mime_type": upload_session.content_type,
		"source_size_bytes": verification.get("size") or upload_session.size_bytes,
		"storage_provider": "cloudflare_r2",
		"raw_object_key": upload_session.object_key,
		"status": "uploaded",
		"alt_text": alt_text,
		"caption": caption,
		"display_order": display_order or 0,
		"is_active": 1
	})
	
	media_asset.insert(ignore_permissions=True)
	frappe.db.commit()
	
	# Update upload session status
	frappe.db.set_value("Media Upload Session", {"upload_id": upload_id}, "status", "confirmed")
	frappe.db.commit()
	
	# Enqueue processing job
	frappe.enqueue(
		"dinematters.dinematters.media.jobs.process_media_asset",
		media_asset_name=media_asset.name,
		queue="default",
		timeout=600,
		is_async=True,
		now=False
	)
	
	return {
		"media_id": media_asset.media_id,
		"status": media_asset.status,
		"primary_url": media_asset.primary_url,
		"message": "Upload confirmed, processing started"
	}


@frappe.whitelist()
def get_media_asset(media_id):
	"""Get media asset by media_id"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)
	
	asset = frappe.db.get_value(
		"Media Asset",
		{"media_id": media_id, "is_deleted": 0},
		["name", "media_id", "status", "primary_url", "poster_url", "width", "height", 
		 "duration_seconds", "alt_text", "caption", "display_order", "media_kind"],
		as_dict=True
	)
	
	if not asset:
		frappe.throw(_("Media asset not found"))
	
	# Get variants
	variants = frappe.get_all(
		"Media Variant",
		filters={"parent": asset.name},
		fields=["variant_name", "file_url", "width", "height", "size_bytes", "format", "is_primary"]
	)
	
	asset["variants"] = variants
	
	return asset


@frappe.whitelist()
def delete_media_asset(media_id):
	"""Soft delete media asset"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)
	
	asset_name = frappe.db.get_value("Media Asset", {"media_id": media_id}, "name")
	
	if not asset_name:
		frappe.throw(_("Media asset not found"))
	
	asset_doc = frappe.get_doc("Media Asset", asset_name)
	
	# Validate restaurant access
	validate_restaurant_access(asset_doc.restaurant)
	
	# Soft delete
	asset_doc.soft_delete()
	
	# Enqueue cleanup job
	frappe.enqueue(
		"dinematters.dinematters.media.jobs.cleanup_deleted_media",
		media_asset_name=asset_name,
		queue="long",
		timeout=300
	)
	
	return {"message": "Media asset deleted"}


# Helper functions

def get_restaurant_from_owner(owner_doctype, owner_name):
	"""Get restaurant from owner document"""
	if owner_doctype == "Menu Product":
		return frappe.db.get_value("Menu Product", owner_name, "restaurant")
	elif owner_doctype == "Menu Category":
		return frappe.db.get_value("Menu Category", owner_name, "restaurant")
	elif owner_doctype == "Home Feature":
		return frappe.db.get_value("Home Feature", owner_name, "restaurant")
	elif owner_doctype == "Restaurant":
		return owner_name
	elif owner_doctype == "Restaurant Config":
		return frappe.db.get_value("Restaurant Config", owner_name, "restaurant")
	elif owner_doctype == "Event":
		return frappe.db.get_value("Event", owner_name, "restaurant")
	elif owner_doctype == "Offer":
		return frappe.db.get_value("Offer", owner_name, "restaurant")
	elif owner_doctype == "Legacy Content":
		return frappe.db.get_value("Legacy Content", owner_name, "restaurant")
	elif owner_doctype == "Legacy Member":
		# Legacy Member is a child table, get restaurant from parent
		parent = frappe.db.get_value("Legacy Member", owner_name, "parent")
		if parent:
			return frappe.db.get_value("Legacy Content", parent, "restaurant")
	elif owner_doctype == "Legacy Testimonial":
		# Legacy Testimonial is a child table, get restaurant from parent
		parent = frappe.db.get_value("Legacy Testimonial", owner_name, "parent")
		if parent:
			return frappe.db.get_value("Legacy Content", parent, "restaurant")
	elif owner_doctype == "Legacy Gallery Image":
		# Legacy Gallery Image is a child table, get restaurant from parent
		parent = frappe.db.get_value("Legacy Gallery Image", owner_name, "parent")
		if parent:
			return frappe.db.get_value("Legacy Content", parent, "restaurant")
	elif owner_doctype == "Legacy Testimonial Image":
		# Legacy Testimonial Image is a child table, get restaurant from parent
		parent = frappe.db.get_value("Legacy Testimonial Image", owner_name, "parent")
		if parent:
			parent_testimonial = frappe.db.get_value("Legacy Testimonial", parent, "parent")
			if parent_testimonial:
				return frappe.db.get_value("Legacy Content", parent_testimonial, "restaurant")
	else:
		frappe.throw(_(f"Unsupported owner doctype: {owner_doctype}"))


def validate_restaurant_access(restaurant):
	"""Validate that current user has access to restaurant"""
	# System Manager has access to all
	if "System Manager" in frappe.get_roles():
		return True
	
	# Check if user is restaurant manager or has restaurant user role
	user_restaurants = frappe.get_all(
		"Restaurant User",
		filters={"user": frappe.session.user},
		fields=["restaurant"]
	)
	
	user_restaurant_list = [r.restaurant for r in user_restaurants]
	
	if restaurant not in user_restaurant_list:
		frappe.throw(_("You do not have access to this restaurant"), frappe.PermissionError)
	
	return True


def validate_media_role_for_doctype(owner_doctype, media_role):
	"""Validate media role is allowed for owner doctype"""
	allowed_roles = {
		"Menu Product": ["product_image", "product_video", "product_video_poster"],
		"Menu Category": ["category_image"],
		"Home Feature": ["home_feature_image"],
		"Restaurant": ["restaurant_logo", "restaurant_hero_video", "restaurant_banner", "restaurant_gallery_image"],
		"Restaurant Config": ["restaurant_config_logo", "restaurant_config_hero_video", "apple_touch_icon"],
		"Event": ["event_image"],
		"Offer": ["offer_image"],
		"Legacy Content": ["legacy_hero_media", "legacy_hero_fallback", "legacy_footer_media"],
		"Legacy Member": ["legacy_member_image"],
		"Legacy Testimonial": ["legacy_testimonial_avatar", "legacy_testimonial_dish_image"],
		"Legacy Gallery Image": ["legacy_gallery_image"],
		"Legacy Testimonial Image": ["legacy_testimonial_dish_image"]
	}
	
	if owner_doctype not in allowed_roles:
		frappe.throw(_(f"Media upload not supported for {owner_doctype}"))
	
	if media_role not in allowed_roles[owner_doctype]:
		frappe.throw(
			_(f"Media role '{media_role}' not allowed for {owner_doctype}. Allowed: {', '.join(allowed_roles[owner_doctype])}")
		)


def get_media_kind_from_mime(content_type):
	"""Determine media kind from MIME type"""
	if content_type.startswith("image/"):
		return "image"
	elif content_type.startswith("video/"):
		return "video"
	else:
		frappe.throw(_(f"Unsupported content type: {content_type}"))


def validate_content_type(content_type, media_kind):
	"""Validate content type matches media kind"""
	# Accept all image/* and video/* types
	if media_kind == 'image' and not content_type.startswith('image/'):
		frappe.throw(
			_(f"Content type '{content_type}' is not an image type. Expected image/*")
		)
	
	if media_kind == 'video' and not content_type.startswith('video/'):
		frappe.throw(
			_(f"Content type '{content_type}' is not a video type. Expected video/*")
		)


def validate_file_size(size_bytes, media_kind):
	"""Validate file size is within limits"""
	max_sizes = get_max_upload_size()
	max_size = max_sizes.get(media_kind, 5 * 1024 * 1024)
	
	if size_bytes > max_size:
		max_mb = max_size / (1024 * 1024)
		frappe.throw(_(f"File size exceeds maximum allowed size of {max_mb}MB"))


def sanitize_filename(filename):
	"""Sanitize filename for safe storage"""
	import re
	# Remove path components
	filename = os.path.basename(filename)
	# Replace spaces and special chars
	filename = re.sub(r'[^\w\s.-]', '', filename)
	filename = re.sub(r'[-\s]+', '-', filename)
	return filename.lower()

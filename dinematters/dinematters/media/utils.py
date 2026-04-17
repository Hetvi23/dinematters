"""
Centralized Media Asset Utilities
Provides helper functions for fetching and formatting Media Asset data across all APIs
"""

import frappe
from frappe.utils import get_url


def normalize_variant_name(variant_name):
	"""Map legacy short variant names to canonical API keys."""
	variant_map = {
		"thumb": "thumbnail",
		"sm": "small",
		"md": "medium",
		"lg": "large",
	}
	return variant_map.get(variant_name, variant_name)


def get_media_asset_data(owner_doctype, owner_name, media_role, fallback_url=None):
	"""
	Centralized function to get Media Asset data for any DocType field
	
	Args:
		owner_doctype: Owner DocType (e.g., "Event", "Offer")
		owner_name: Owner document name
		media_role: Media role (e.g., "event_image", "offer_image")
		fallback_url: Fallback URL if no Media Asset exists (legacy /files/ path)
	
	Returns:
		dict: {
			"url": CDN URL or fallback (primary/medium variant),
			"blur_placeholder": Base64 blur placeholder (if image),
			"media_id": Media Asset name,
			"variants": {
				"thumbnail": {"url": str, "width": int, "height": int},
				"small": {...},
				"medium": {...},
				"large": {...}
			},
			"srcset": "url1 width1w, url2 width2w, ..." (for responsive images)
		}
	"""
	if not owner_name:
		return {
			"url": fallback_url or "",
			"blur_placeholder": None,
			"media_id": None,
			"variants": {},
			"srcset": None
		}
	
	# Try to get Media Asset (accept both 'uploaded' and 'ready' so a freshly-uploaded
	# asset is surfaced immediately while the processing job is still running)
	media_asset = frappe.db.get_value(
		"Media Asset",
		{
			"owner_doctype": owner_doctype,
			"owner_name": owner_name,
			"media_role": media_role,
			"status": ["in", ["uploaded", "ready"]]
		},
		["name", "primary_url", "blur_placeholder", "media_kind"],
		as_dict=True
	)
	
	if media_asset and media_asset.get("primary_url"):
		result = {
			"url": media_asset["primary_url"],
			"blur_placeholder": media_asset.get("blur_placeholder"),
			"media_id": media_asset["name"],
			"variants": {},
			"srcset": None
		}
		
		# Get variants if image
		if media_asset.get("media_kind") == "image":
			variants = frappe.get_all(
				"Media Variant",
				filters={"parent": media_asset["name"]},
				fields=["variant_name", "file_url as url", "width", "height"],
				order_by="width asc"
			)
			
			# Format variants as dictionary for easy frontend access
			variants_dict = {}
			srcset_parts = []
			
			for v in variants:
				variant_name = v.get("variant_name", "")
				canonical_name = normalize_variant_name(variant_name)
				variant_payload = {
					"url": v["url"],
					"width": v.get("width"),
					"height": v.get("height")
				}
				variants_dict[canonical_name] = variant_payload
				if variant_name and variant_name != canonical_name:
					variants_dict[variant_name] = variant_payload
				
				# Build srcset string for responsive images
				if v.get("width"):
					srcset_parts.append(f"{v['url']} {v['width']}w")
			
			result["variants"] = variants_dict
			
			# Set srcset for responsive images
			if srcset_parts:
				result["srcset"] = ", ".join(srcset_parts)
		
		return result
	
	# Fallback to legacy URL
	url = fallback_url or ""
	
	return {
		"url": url,
		"blur_placeholder": None,
		"media_id": None,
		"variants": {},
		"srcset": None
	}


def format_media_field(data_dict, field_name, owner_doctype, owner_name, media_role, output_key=None):
	"""
	Helper to format a media field in API response data with CDN URLs, blur placeholders, and responsive variants
	
	Args:
		data_dict: Dictionary to update (API response data)
		field_name: Source field name in data (e.g., "image_src")
		owner_doctype: Owner DocType
		owner_name: Owner document name
		media_role: Media role
		output_key: Output key in response (defaults to camelCase of field_name)
	
	Example:
		format_media_field(event_data, "image_src", "Event", event_name, "event_image")
		# Adds: 
		#   event_data["imageSrc"] - Primary CDN URL
		#   event_data["imageSrcBlurPlaceholder"] - Base64 blur placeholder
		#   event_data["imageSrcVariants"] - Dict of variant sizes
		#   event_data["imageSrcSrcset"] - Srcset string for <img srcset>
	"""
	if output_key is None:
		# Convert snake_case to camelCase
		parts = field_name.split('_')
		output_key = parts[0] + ''.join(word.capitalize() for word in parts[1:])
	
	fallback_url = data_dict.get(field_name, "")
	media_data = get_media_asset_data(owner_doctype, owner_name, media_role, fallback_url)
	
	# Primary URL
	data_dict[output_key] = media_data["url"]
	
	# Blur placeholder for progressive loading
	if media_data.get("blur_placeholder"):
		data_dict[f"{output_key}BlurPlaceholder"] = media_data["blur_placeholder"]
	
	# Media Asset ID
	if media_data.get("media_id"):
		data_dict["mediaId"] = media_data["media_id"]
	
	# Variants dictionary for manual selection
	if media_data.get("variants"):
		data_dict[f"{output_key}Variants"] = media_data["variants"]
	
	# Srcset for responsive images
	if media_data.get("srcset"):
		data_dict[f"{output_key}Srcset"] = media_data["srcset"]


def get_media_assets_batch(owner_doctype, owner_names, media_roles):
	"""
	Batch fetch Media Assets and their Variants for multiple owners/roles.
	Reduces DB roundtrips significantly for lists.
	
	Args:
		owner_doctype: str
		owner_names: list of str
		media_roles: list of str
		
	Returns:
		dict: Mapping of (owner_name, media_role) -> media_data_dict
	"""
	if not owner_names or not media_roles:
		return {}
	
	# 1. Fetch all matching Media Assets in one query
	# Accept both 'uploaded' (processing in queue) and 'ready' so freshly-uploaded
	# assets are returned immediately rather than waiting for the worker to finish.
	assets = frappe.get_all(
		"Media Asset",
		filters={
			"owner_doctype": owner_doctype,
			"owner_name": ["in", owner_names],
			"media_role": ["in", media_roles],
			"status": ["in", ["uploaded", "ready"]]
		},
		fields=["name", "owner_name", "media_role", "primary_url", "blur_placeholder", "media_kind"]
	)
	
	if not assets:
		return {}
	
	asset_names = [a["name"] for a in assets]
	
	# 2. Fetch all Variants for these assets in one query
	variants = frappe.get_all(
		"Media Variant",
		filters={"parent": ["in", asset_names]},
		fields=["parent", "variant_name", "file_url as url", "width", "height"],
		order_by="width asc"
	)
	
	# Group variants by asset name
	variants_by_asset = {}
	for v in variants:
		parent = v.pop("parent")
		if parent not in variants_by_asset:
			variants_by_asset[parent] = []
		variants_by_asset[parent].append(v)
	
	# 3. Process and format results
	results = {}
	for asset in assets:
		asset_name = asset["name"]
		key = (asset["owner_name"], asset["media_role"])
		
		media_data = {
			"url": asset["primary_url"],
			"blur_placeholder": asset.get("blur_placeholder"),
			"media_id": asset["name"],
			"variants": {},
			"srcset": None
		}
		
		# Process variants if image
		if asset.get("media_kind") == "image" and asset_name in variants_by_asset:
			asset_variants = variants_by_asset[asset_name]
			variants_dict = {}
			srcset_parts = []
			
			for v in asset_variants:
				v_name = v.get("variant_name", "")
				canonical_name = normalize_variant_name(v_name)
				variant_payload = {
					"url": v["url"],
					"width": v.get("width"),
					"height": v.get("height")
				}
				variants_dict[canonical_name] = variant_payload
				if v_name and v_name != canonical_name:
					variants_dict[v_name] = variant_payload
				
				if v.get("width"):
					srcset_parts.append(f"{v['url']} {v['width']}w")
			
			media_data["variants"] = variants_dict
			if srcset_parts:
				media_data["srcset"] = ", ".join(srcset_parts)
		
		results[key] = media_data
		
	return results

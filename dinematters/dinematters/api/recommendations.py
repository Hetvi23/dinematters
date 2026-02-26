import json
from typing import Dict, List

import frappe
import requests
from frappe import _
from frappe.utils import get_url

from dinematters.dinematters.utils.api_helpers import validate_restaurant_for_api


RECOMMENDATIONS_API_URL = "https://api.dinematters.com/menu-extraction/api/v1/recommendations/generate"
MAX_RECOMMENDATIONS_PER_PRODUCT = 8


def _get_restaurant_doc(restaurant_id: str):
	"""Validate and load Restaurant doc."""
	restaurant_name = validate_restaurant_for_api(restaurant_id)
	return frappe.get_doc("Restaurant", restaurant_name)


def _build_payload(restaurant_doc) -> Dict:
	"""Build payload for external recommendations API from Menu Product and Menu Category data."""
	products = frappe.get_all(
		"Menu Product",
		fields=[
			"product_id",
			"product_name",
			"category_name",
			"main_category",
			"price",
			"description",
			"is_vegetarian",
			"name",
		],
		filters={"restaurant": restaurant_doc.name, "is_active": 1},
	)

	if not products:
		frappe.throw(_("No active menu products found for this restaurant. Please create products first."))

	categories = frappe.get_all(
		"Menu Category",
		fields=["category_id", "category_name"],
		filters={"restaurant": restaurant_doc.name},
	)

	dishes: List[Dict] = []
	for product in products:
		dishes.append(
			{
				"id": product.product_id,
				"name": product.product_name,
				"category": product.category_name or "",
				"mainCategory": product.main_category or "food",
				"price": float(product.price or 0),
				"description": product.description or "",
				"isVegetarian": bool(product.is_vegetarian),
			}
		)

	categories_data: List[Dict] = []
	for cat in categories:
		categories_data.append(
			{
				"id": cat.category_id or (cat.category_name or "").lower().replace(" ", "-"),
				"name": cat.category_name,
			}
		)

	restaurant_name = restaurant_doc.restaurant_name or restaurant_doc.name

	return {
		"dishes": dishes,
		"categories": categories_data,
		"restaurant_name": restaurant_name,
		"min_recommendations": MAX_RECOMMENDATIONS_PER_PRODUCT,
		"save_to_disk": False,
	}, products


def _call_recommendations_api(payload: Dict) -> Dict:
	"""Call external recommendations API and return parsed JSON."""
	response = requests.post(
		RECOMMENDATIONS_API_URL,
		json=payload,
		headers={"Content-Type": "application/json"},
		timeout=600,
	)
	response.raise_for_status()
	data = response.json()

	if not data.get("success"):
		frappe.throw(_("Recommendations API failed: {0}").format(data.get("message", "Unknown error")))

	return data


def _store_recommendations(restaurant_doc, products: List[Dict], api_result: Dict) -> Dict:
	"""Persist recommendations into Menu Recommendation doctype and Menu Product.recommendations JSON."""
	recommendations_data = api_result.get("data", {}).get("recommendations", []) or []

	# Map product_id to Menu Product name and basic info
	product_map = {p.product_id: p for p in products}

	# Clear any existing recommendations for this restaurant (should be empty for first run)
	frappe.db.delete("Menu Recommendation", {"restaurant": restaurant_doc.name})

	updated_products = 0
	total_relations = 0

	for rec_item in recommendations_data:
		product_id = rec_item.get("id")
		if not product_id or product_id not in product_map:
			continue

		product_row = product_map[product_id]
		product_doc = frappe.get_doc("Menu Product", product_row.name)

		recs = rec_item.get("recommendations") or []
		if not isinstance(recs, list) or not recs:
			continue

		# Trim to max N recommendations
		recs = recs[:MAX_RECOMMENDATIONS_PER_PRODUCT]

		formatted_recs: List[Dict] = []

		for rank, rec in enumerate(recs, start=1):
			rec_id = rec.get("id")
			if not rec_id:
				continue

			rec_doc_name = frappe.db.get_value(
				"Menu Product",
				{"product_id": rec_id, "restaurant": restaurant_doc.name},
				"name",
			)

			reason = rec.get("reason", "")
			score = rec.get("score", 0)

			# Create normalized Menu Recommendation row
			menu_rec = frappe.get_doc(
				{
					"doctype": "Menu Recommendation",
					"restaurant": restaurant_doc.name,
					"source_product": product_doc.name,
					"source_product_id": product_doc.product_id,
					"source_product_name": product_doc.product_name,
					"recommended_product": rec_doc_name,
					"recommended_product_id": rec_id,
					"recommended_product_name": rec.get("name"),
					"rank": rank,
					"score": score,
					"category": rec.get("category", ""),
					"main_category": rec.get("mainCategory", ""),
					"is_vegetarian": bool(rec.get("isVegetarian", False)),
					"price": rec.get("price", 0),
					"reason": reason,
				}
			)
			menu_rec.insert(ignore_permissions=True)
			total_relations += 1

			formatted_recs.append(
				{
					"id": rec_id,
					"name": rec.get("name"),
					"category": rec.get("category", ""),
					"mainCategory": rec.get("mainCategory", ""),
					"isVegetarian": bool(rec.get("isVegetarian", False)),
					"price": rec.get("price", 0),
					"reason": reason,
					"score": score,
				}
			)

		if not formatted_recs:
			continue

		# Persist on product for fast API access
		product_doc.recommendations = json.dumps(formatted_recs)
		product_doc.save(ignore_permissions=True)
		updated_products += 1

	frappe.db.commit()

	return {
		"products_updated": updated_products,
		"total_relations": total_relations,
		"products_with_no_recommendations": len(products) - updated_products,
	}


@frappe.whitelist()
def run_recommendation_engine(restaurant_id: str):
	"""
	Run the AI recommendation engine once per restaurant.

	- Validates restaurant access.
	- Ensures recommendations are only generated once (recommendation_run = 0 -> 1).
	- Calls external recommendations API with all active products and categories.
	- Stores normalized rows in Menu Recommendation and JSON on Menu Product.
	"""
	if not restaurant_id:
		frappe.throw(_("restaurant_id is required"))

	restaurant_doc = _get_restaurant_doc(restaurant_id)

	# Enforce one-time execution
	if getattr(restaurant_doc, "recommendation_run", 0) and int(restaurant_doc.recommendation_run) >= 1:
		frappe.throw(
			_("Recommendations have already been generated for this restaurant and cannot be run again."),
			title=_("Recommendations Already Generated"),
		)

	payload, products = _build_payload(restaurant_doc)
	api_result = _call_recommendations_api(payload)
	stats = _store_recommendations(restaurant_doc, products, api_result)

	# Mark as executed exactly once
	restaurant_doc.db_set("recommendation_run", 1, update_modified=True)

	return {
		"success": True,
		"message": _("Successfully generated recommendations for {0} products.").format(
			stats["products_updated"]
		),
		"stats": stats,
	}


@frappe.whitelist()
def get_recommendations_tree(restaurant_id: str):
	"""
	Return tree-friendly structure for Recommendations Engine page.

	Response:
	{
	  "success": true,
	  "data": {
	    "recommendation_run": 0|1,
	    "products": [
	      {
	        "id": "...",
	        "name": "...",
	        "category": "...",
	        "mainCategory": "...",
	        "recommendations": [ { ... up to 8 ... } ]
	      }
	    ]
	  }
	}
	"""
	if not restaurant_id:
		frappe.throw(_("restaurant_id is required"))

	restaurant_doc = _get_restaurant_doc(restaurant_id)

	products = frappe.get_all(
		"Menu Product",
		fields=[
			"product_id",
			"product_name",
			"category_name",
			"main_category",
			"recommendations",
			"name",
		],
		filters={"restaurant": restaurant_doc.name, "is_active": 1},
		order_by="display_order, product_name",
	)

	# Build image map for all products in a single query
	product_names = [p.name for p in products]
	image_by_parent: Dict[str, str] = {}

	if product_names:
		media_rows = frappe.get_all(
			"Product Media",
			fields=["parent", "media_url"],
			filters={
				"parent": ["in", product_names],
				"parenttype": "Menu Product",
				"parentfield": "product_media",
			},
			order_by="parent, idx asc",
		)

		for row in media_rows:
			parent = row.parent
			if parent in image_by_parent:
				continue  # keep first image only
			media_url = row.media_url
			if media_url and isinstance(media_url, str):
				if media_url.startswith("/files/"):
					media_url = get_url(media_url)
				image_by_parent[parent] = media_url

	# Map product_id -> image url for lookup by recommendation items
	image_by_product_id: Dict[str, str] = {}
	for p in products:
		image = image_by_parent.get(p.name)
		if image:
			image_by_product_id[p.product_id] = image

	tree: List[Dict] = []

	for p in products:
		recs_raw = p.recommendations
		recs: List[Dict] = []
		if recs_raw:
			try:
				parsed = json.loads(recs_raw) if isinstance(recs_raw, str) else recs_raw
				if isinstance(parsed, list):
					recs = parsed[:MAX_RECOMMENDATIONS_PER_PRODUCT]
			except Exception:
				# Ignore malformed JSON and continue
				recs = []

		# Attach images to recommendation children where available
		for rec in recs:
			rec_id = rec.get("id")
			if rec_id and rec_id in image_by_product_id:
				rec["image"] = image_by_product_id[rec_id]

		root_image = image_by_product_id.get(p.product_id)

		tree.append(
			{
				"id": p.product_id,
				"name": p.product_name,
				"category": p.category_name,
				"mainCategory": p.main_category,
				"image": root_image,
				"recommendations": recs,
			}
		)

	return {
		"success": True,
		"data": {
			"recommendation_run": int(getattr(restaurant_doc, "recommendation_run", 0) or 0),
			"products": tree,
		},
	}


@frappe.whitelist()
def update_product_recommendations(restaurant_id: str, source_product_id: str, recommendation_ids=None):
	"""
	Manually update recommendations for a single product.

	- Validates restaurant and product ownership.
	- Ensures max 8 unique recommendations.
	- Updates Menu Recommendation rows and Menu Product.recommendations JSON.
	"""
	if not restaurant_id:
		frappe.throw(_("restaurant_id is required"))
	if not source_product_id:
		frappe.throw(_("source_product_id is required"))

	restaurant_doc = _get_restaurant_doc(restaurant_id)

	# Parse incoming list (may arrive as JSON string)
	if recommendation_ids is None:
		raw_list = []
	else:
		raw_list = frappe.parse_json(recommendation_ids)

	if not isinstance(raw_list, list):
		frappe.throw(_("recommendation_ids must be a list of product IDs."))

	# De-duplicate while preserving order and drop falsy values
	seen = set()
	clean_ids: List[str] = []
	for pid in raw_list:
		if not pid or not isinstance(pid, str):
			continue
		if pid in seen:
			continue
		seen.add(pid)
		clean_ids.append(pid)

	if len(clean_ids) > MAX_RECOMMENDATIONS_PER_PRODUCT:
		frappe.throw(
			_("You can only keep up to {0} recommendations per product.").format(
				MAX_RECOMMENDATIONS_PER_PRODUCT
			)
		)

	# Load source product
	source_rows = frappe.get_all(
		"Menu Product",
		fields=[
			"name",
			"product_id",
			"product_name",
			"category_name",
			"main_category",
			"price",
			"description",
			"is_vegetarian",
		],
		filters={"restaurant": restaurant_doc.name, "product_id": source_product_id, "is_active": 1},
		limit=1,
	)
	if not source_rows:
		frappe.throw(
			_("Source product {0} not found for this restaurant.").format(source_product_id)
		)

	source_row = source_rows[0]

	# Load target products (may be empty)
	target_rows = []
	if clean_ids:
		target_rows = frappe.get_all(
			"Menu Product",
			fields=[
				"name",
				"product_id",
				"product_name",
				"category_name",
				"main_category",
				"price",
				"description",
				"is_vegetarian",
			],
			filters={
				"restaurant": restaurant_doc.name,
				"product_id": ["in", clean_ids],
				"is_active": 1,
			},
		)

	target_by_id = {row.product_id: row for row in target_rows}

	# Prepare normalized and JSON structures
	formatted_recs: List[Dict] = []

	# Clear existing Menu Recommendation rows for this pair
	frappe.db.delete(
		"Menu Recommendation",
		{"restaurant": restaurant_doc.name, "source_product_id": source_product_id},
	)

	rank = 0
	for pid in clean_ids:
		target = target_by_id.get(pid)
		if not target:
			continue

		rank += 1
		reason = _("Manually selected recommendation")
		score = 0

		menu_rec = frappe.get_doc(
			{
				"doctype": "Menu Recommendation",
				"restaurant": restaurant_doc.name,
				"source_product": source_row.name,
				"source_product_id": source_row.product_id,
				"source_product_name": source_row.product_name,
				"recommended_product": target.name,
				"recommended_product_id": target.product_id,
				"recommended_product_name": target.product_name,
				"rank": rank,
				"score": score,
				"category": target.category_name,
				"main_category": target.main_category,
				"is_vegetarian": bool(target.is_vegetarian),
				"price": target.price,
				"reason": reason,
			}
		)
		menu_rec.insert(ignore_permissions=True)

		formatted_recs.append(
			{
				"id": target.product_id,
				"name": target.product_name,
				"category": target.category_name or "",
				"mainCategory": target.main_category or "",
				"isVegetarian": bool(target.is_vegetarian),
				"price": float(target.price or 0),
				"reason": reason,
				"score": score,
			}
		)

	# Update JSON on source product
	source_doc = frappe.get_doc("Menu Product", source_row.name)
	source_doc.recommendations = json.dumps(formatted_recs)
	source_doc.save(ignore_permissions=True)

	frappe.db.commit()

	return {
		"success": True,
		"message": _("Recommendations updated for product {0}.").format(source_product_id),
		"count": len(formatted_recs),
	}



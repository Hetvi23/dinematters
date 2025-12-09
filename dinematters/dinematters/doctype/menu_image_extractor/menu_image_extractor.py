# Copyright (c) 2025, Hetvi Patel and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils.file_manager import get_file_path
import requests
import json
import time
from datetime import datetime
import os


class MenuImageExtractor(Document):
	pass


@frappe.whitelist()
def extract_menu_data(docname):
	"""
	Extract menu data from uploaded images using the external API
	"""
	try:
		doc = frappe.get_doc("Menu Image Extractor", docname)
		
		# Validate images
		if not doc.menu_images:
			frappe.throw(_("Please upload at least one menu image"))
		
		if len(doc.menu_images) > 20:
			frappe.throw(_("Maximum 20 images allowed. Currently {0} images uploaded.").format(len(doc.menu_images)))
		
		# Update status
		doc.extraction_status = "Processing"
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		
		start_time = time.time()
		
		# Prepare files for API request
		files = []
		form_data = {}
		
		# Add restaurant name if provided
		if doc.restaurant_name:
			form_data['restaurant_name'] = doc.restaurant_name
		
		form_data['save_to_disk'] = 'false'
		
		# Get image files from Frappe
		image_files = []
		file_handles = []  # Track file handles for cleanup
		
		for idx, img_row in enumerate(doc.menu_images):
			if img_row.menu_image:
				# Get file path using Frappe's utility
				file_url = img_row.menu_image
				
				try:
					# Use Frappe's get_file_path utility which handles both public and private files
					file_path = get_file_path(file_url)
					
					if not file_path or not os.path.exists(file_path):
						# Fallback: try manual path construction
						if file_url.startswith('/'):
							file_url = file_url[1:]
						
						# Try public files
						file_path = frappe.get_site_path('public', 'files', file_url)
						if not os.path.exists(file_path):
							# Try private files
							file_path = frappe.get_site_path('private', 'files', file_url)
						
						if not os.path.exists(file_path):
							# Try direct public path
							file_path = frappe.get_site_path('public', file_url)
					
					if not file_path or not os.path.exists(file_path):
						frappe.throw(_("Image file not found: {0}").format(img_row.menu_image))
					
					# Open file and track handle
					file_handle = open(file_path, 'rb')
					file_handles.append(file_handle)
					
					# Get filename from path
					filename = os.path.basename(file_path)
					
					# Determine content type from file extension
					file_ext = os.path.splitext(filename)[1].lower()
					content_type_map = {
						'.jpg': 'image/jpeg',
						'.jpeg': 'image/jpeg',
						'.png': 'image/png',
						'.webp': 'image/webp',
						'.gif': 'image/gif'
					}
					content_type = content_type_map.get(file_ext, 'image/jpeg')
					
					# Try different formats - the API might expect 'images[]' for multiple files
					# Format: (field_name, (filename, file_handle, content_type))
					image_files.append(('images', (filename, file_handle, content_type)))
					
				except Exception as e:
					frappe.log_error(
						f"Error getting file path for {img_row.menu_image}: {str(e)}\n{frappe.get_traceback()}",
						"Menu Extraction - File Path Error"
					)
					frappe.throw(_("Error accessing image file {0}: {1}").format(
						img_row.menu_image, str(e)
					))
		
		if not image_files:
			frappe.throw(_("No valid image files found"))
		
		# Call the extraction API
		api_url = "https://dinematters-backend.onrender.com/menu-extraction/api/v1/extraction/extract"
		
		# Headers to prevent 417 Expectation Failed error
		# Disable Expect: 100-continue header for file uploads
		headers = {
			'Expect': ''  # Empty string disables the Expect header
		}
		
		try:
			# Log request details for debugging
			frappe.log_error(
				f"API Request Details:\n"
				f"URL: {api_url}\n"
				f"Files count: {len(image_files)}\n"
				f"Form data: {form_data}\n"
				f"Headers: {headers}",
				"Menu Extraction - Request Debug"
			)
			
			response = requests.post(
				api_url,
				files=image_files,
				data=form_data,
				headers=headers,
				timeout=300  # 5 minutes timeout
			)
			
			# Close all file handles
			for file_handle in file_handles:
				try:
					file_handle.close()
				except:
					pass
			
			# Log response for debugging before raising
			if not response.ok:
				frappe.log_error(
					f"API Error Response:\n"
					f"Status Code: {response.status_code}\n"
					f"Response Headers: {dict(response.headers)}\n"
					f"Response Text: {response.text[:1000]}",  # First 1000 chars
					"Menu Extraction - API Error Response"
				)
			
			response.raise_for_status()
			result = response.json()
			
		except requests.exceptions.HTTPError as e:
			# Close file handles on error
			for file_handle in file_handles:
				try:
					file_handle.close()
				except:
					pass
			
			# Get response details for better error messages
			status_code = None
			response_text = ""
			
			if hasattr(e, 'response') and e.response:
				status_code = e.response.status_code
				try:
					response_text = e.response.text[:500]  # First 500 chars
				except:
					response_text = "Unable to read response"
			
			# Log detailed error
			frappe.log_error(
				f"API HTTP Error:\n"
				f"Status Code: {status_code}\n"
				f"Error: {str(e)}\n"
				f"Response: {response_text}",
				"Menu Extraction - HTTP Error"
			)
			
			# Provide more specific error messages
			if status_code == 400:
				error_msg = _(
					"Bad Request (400): The API rejected the request format. "
					"Please check that the images are valid and properly formatted. "
					"Response: {0}"
				).format(response_text[:200])
			elif status_code == 502:
				error_msg = _(
					"API Service Unavailable (502 Bad Gateway). "
					"The external menu extraction service is currently down or unreachable. "
					"Please try again later or contact the service administrator."
				)
			elif status_code == 417:
				error_msg = _(
					"Expectation Failed (417). "
					"The server could not meet the requirements of the request. "
					"Please check the file format and try again."
				)
			elif status_code == 503:
				error_msg = _(
					"Service Unavailable (503). "
					"The external service is temporarily unavailable. "
					"Please try again later."
				)
			elif status_code == 504:
				error_msg = _(
					"Gateway Timeout (504). "
					"The request took too long to process. "
					"Please try with fewer images or try again later."
				)
			else:
				error_msg = _("API Request Failed: {0}").format(str(e))
				if response_text:
					error_msg += f"\n\nAPI Response: {response_text[:200]}"
			
			frappe.throw(error_msg, title=_("Extraction API Error"))
			
		except requests.exceptions.Timeout as e:
			# Close file handles on timeout
			for file_handle in file_handles:
				try:
					file_handle.close()
				except:
					pass
			frappe.throw(
				_("Request Timeout: The API request took longer than 5 minutes to complete. "
				  "Please try with fewer images or check your network connection."),
				title=_("Request Timeout")
			)
			
		except requests.exceptions.ConnectionError as e:
			# Close file handles on connection error
			for file_handle in file_handles:
				try:
					file_handle.close()
				except:
					pass
			frappe.throw(
				_("Connection Error: Unable to connect to the extraction API. "
				  "Please check your internet connection and ensure the service is available."),
				title=_("Connection Error")
			)
			
		except requests.exceptions.RequestException as e:
			# Close file handles on any other request error
			for file_handle in file_handles:
				try:
					file_handle.close()
				except:
					pass
			frappe.throw(
				_("API Request Failed: {0}").format(str(e)),
				title=_("Request Error")
			)
		
		# Calculate processing time
		processing_time = time.time() - start_time
		
		# Process the response
		if result.get('success'):
			# Log extracted data to console
			data = result.get('data', {})
			
			# Safely get categories and dishes, ensuring they are lists
			categories = data.get('categories', [])
			dishes = data.get('dishes', [])
			
			# Ensure categories and dishes are lists (not dicts or other types)
			if not isinstance(categories, list):
				categories = list(categories.values()) if isinstance(categories, dict) else []
			if not isinstance(dishes, list):
				dishes = list(dishes.values()) if isinstance(dishes, dict) else []
			
			# Safely slice the lists
			categories_preview = categories[:3] if len(categories) > 0 else []
			dishes_preview = dishes[:5] if len(dishes) > 0 else []
			
			frappe.log_error(
				f"Extracted Data Summary:\n" +
				f"Categories: {len(categories)}\n" +
				f"Dishes: {len(dishes)}\n" +
				f"First 3 categories: {json.dumps(categories_preview, indent=2)}\n" +
				f"First 5 dishes: {json.dumps(dishes_preview, indent=2)}",
				"Menu Extraction - Data Preview"
			)
			
			stats = process_extracted_data(result.get('data', {}), doc)
			
			# Update document
			doc.extraction_status = "Completed"
			doc.extraction_log = "Extraction completed successfully!\n\n" + \
				f"Categories created: {stats['categories_created']}\n" + \
				f"Items created: {stats['items_created']}\n" + \
				f"Items updated: {stats['items_updated']}\n" + \
				f"Items skipped: {stats['items_skipped']}"
			doc.items_created = stats['items_created']
			doc.categories_created = stats['categories_created']
			doc.extraction_date = datetime.now()
			doc.processing_time = f"{processing_time:.2f} seconds"
			doc.raw_response = json.dumps(result, indent=2)
			doc.save(ignore_permissions=True)
			frappe.db.commit()
			
			# Print to console for debugging
			print("\n" + "="*70)
			print("EXTRACTION RESULTS")
			print("="*70)
			print(f"Categories extracted: {len(categories)}")
			print(f"Dishes extracted: {len(dishes)}")
			print(f"Categories created: {stats['categories_created']}")
			print(f"Items created: {stats['items_created']}")
			print(f"Items updated: {stats['items_updated']}")
			print("="*70)
			
			# Safely get sample data
			sample_categories = []
			sample_dishes = []
			
			if isinstance(categories, list) and len(categories) > 0:
				sample_categories = [c.get('name', '') if isinstance(c, dict) else str(c) for c in categories[:5]]
			if isinstance(dishes, list) and len(dishes) > 0:
				sample_dishes = [d.get('name', '') if isinstance(d, dict) else str(d) for d in dishes[:10]]
			
			return {
				'success': True,
				'message': f"Successfully extracted and created {stats['items_created']} items and {stats['categories_created']} categories",
				'stats': stats,
				'extracted_data_preview': {
					'categories_count': len(categories),
					'dishes_count': len(dishes),
					'sample_categories': sample_categories,
					'sample_dishes': sample_dishes
				}
			}
		else:
			# Extraction failed
			doc.extraction_status = "Failed"
			doc.extraction_log = f"Extraction failed: {result.get('message', 'Unknown error')}"
			doc.extraction_date = datetime.now()
			doc.processing_time = f"{processing_time:.2f} seconds"
			doc.raw_response = json.dumps(result, indent=2)
			doc.save(ignore_permissions=True)
			frappe.db.commit()
			
			frappe.throw(_("Extraction failed: {0}").format(result.get('message', 'Unknown error')))
	
	except frappe.exceptions.ValidationError:
		# Re-raise ValidationError (from frappe.throw) without modification
		# This preserves the specific error messages we set above
		raise
		
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Menu Extraction Error")
		
		# Update status to failed
		try:
			doc = frappe.get_doc("Menu Image Extractor", docname)
			doc.extraction_status = "Failed"
			doc.extraction_log = f"Unexpected Error: {str(e)}\n\n{frappe.get_traceback()}"
			doc.extraction_date = datetime.now()
			doc.save(ignore_permissions=True)
			frappe.db.commit()
		except:
			pass
		
		frappe.throw(
			_("Extraction failed due to an unexpected error: {0}").format(str(e)),
			title=_("Extraction Error")
		)


def process_extracted_data(data, extractor_doc):
	"""
	Process extracted data and create Menu Categories and Menu Products
	"""
	stats = {
		'categories_created': 0,
		'items_created': 0,
		'items_updated': 0,
		'items_skipped': 0
	}
	
	# Extract data sections
	categories_data = data.get('categories', [])
	dishes_data = data.get('dishes', [])
	restaurant_brand = data.get('restaurantBrand', {})
	
	# Ensure categories_data and dishes_data are lists
	if not isinstance(categories_data, list):
		if isinstance(categories_data, dict):
			categories_data = list(categories_data.values())
		else:
			categories_data = []
	
	if not isinstance(dishes_data, list):
		if isinstance(dishes_data, dict):
			dishes_data = list(dishes_data.values())
		else:
			dishes_data = []
	
	# Create or update categories
	category_map = {}  # Map category names to category IDs
	
	for cat_data in categories_data:
		# Ensure cat_data is a dict
		if not isinstance(cat_data, dict):
			continue
		category_id = cat_data.get('id')
		category_name = cat_data.get('name')
		
		if not category_id or not category_name:
			continue
		
		# Check if category exists
		if frappe.db.exists("Menu Category", category_id):
			# Update existing category
			cat_doc = frappe.get_doc("Menu Category", category_id)
		else:
			# Create new category
			cat_doc = frappe.new_doc("Menu Category")
			cat_doc.category_id = category_id
			stats['categories_created'] += 1
		
		cat_doc.category_name = category_name
		cat_doc.display_name = cat_data.get('displayName', category_name)
		cat_doc.description = cat_data.get('description', '')
		cat_doc.is_special = 1 if cat_data.get('isSpecial') else 0
		
		cat_doc.save(ignore_permissions=True)
		category_map[category_name] = category_id
	
	# Create or update dishes/products
	for dish_data in dishes_data:
		# Ensure dish_data is a dict
		if not isinstance(dish_data, dict):
			stats['items_skipped'] += 1
			continue
		
		product_id = dish_data.get('id')
		product_name = dish_data.get('name')
		
		if not product_id or not product_name:
			stats['items_skipped'] += 1
			continue
		
		# Check if product exists
		if frappe.db.exists("Menu Product", product_id):
			# Update existing product
			product_doc = frappe.get_doc("Menu Product", product_id)
			stats['items_updated'] += 1
		else:
			# Create new product
			product_doc = frappe.new_doc("Menu Product")
			product_doc.product_id = product_id
			stats['items_created'] += 1
		
		# Set basic fields
		product_doc.product_name = product_name
		product_doc.price = dish_data.get('price', 0)
		product_doc.description = dish_data.get('description', '')
		product_doc.is_vegetarian = 1 if dish_data.get('isVegetarian') else 0
		product_doc.has_no_media = 1 if dish_data.get('hasNoMedia') else 0
		
		# Set category
		category_name = dish_data.get('category')
		if category_name and category_name in category_map:
			product_doc.category = category_map[category_name]
			product_doc.category_name = category_name
		
		# Set main category
		main_category = dish_data.get('mainCategory')
		if main_category:
			product_doc.main_category = main_category
		
		# Set calories if present
		if dish_data.get('calories'):
			product_doc.calories = dish_data.get('calories')
		
		# Handle customizations if present
		if dish_data.get('customizations'):
			# Clear existing customizations
			product_doc.customization_questions = []
			
			for custom_data in dish_data.get('customizations', []):
				custom_row = product_doc.append('customization_questions', {})
				custom_row.question_id = custom_data.get('id', '')
				custom_row.question = custom_data.get('question', '')
				custom_row.is_required = 1 if custom_data.get('isRequired') else 0
				custom_row.selection_type = custom_data.get('selectionType', 'single')
				
				# Handle options
				if custom_data.get('options'):
					# Store options as JSON or in child table if you have one
					pass
		
		try:
			product_doc.save(ignore_permissions=True)
		except Exception as e:
			frappe.log_error(f"Error saving product {product_id}: {str(e)}", "Menu Product Save Error")
			stats['items_skipped'] += 1
			stats['items_created'] -= 1 if not frappe.db.exists("Menu Product", product_id) else 0
			stats['items_updated'] -= 1 if frappe.db.exists("Menu Product", product_id) else 0
	
	frappe.db.commit()
	
	return stats


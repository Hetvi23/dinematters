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
import re


class MenuImageExtractor(Document):
	pass


def generate_product_id_from_name(product_name):
	"""Generate a slug-like product_id from product_name"""
	if not product_name:
		return None
	
	# Convert to lowercase
	product_id = product_name.lower()
	
	# Replace spaces and special characters with hyphens
	product_id = re.sub(r'[^\w\s-]', '', product_id)  # Remove special chars
	product_id = re.sub(r'[-\s]+', '-', product_id)  # Replace spaces and multiple hyphens with single hyphen
	product_id = product_id.strip('-')  # Remove leading/trailing hyphens
	
	# Limit length to 140 characters (Frappe name field limit)
	if len(product_id) > 140:
		product_id = product_id[:140].rstrip('-')
	
	# Ensure uniqueness by checking if it exists
	base_id = product_id
	counter = 1
	while frappe.db.exists("Menu Product", product_id):
		product_id = f"{base_id}-{counter}"
		counter += 1
		# Prevent infinite loop
		if counter > 1000:
			# Use timestamp as fallback
			import time
			product_id = f"{base_id}-{int(time.time())}"
			break
	
	return product_id


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
			
			# Store extracted data in child tables instead of creating immediately
			store_extracted_data(result.get('data', {}), doc)
			
			# Update document status to Pending Approval
			doc.extraction_status = "Pending Approval"
			doc.approval_status = "Pending"
			doc.extraction_log = f"Extraction completed successfully!\n\n" + \
				f"Categories extracted: {len(categories)}\n" + \
				f"Dishes extracted: {len(dishes)}\n\n" + \
				"Please review the extracted data below and click 'Approve and Create Menu Items' to add them to the database."
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
			print("Data stored in child tables for review.")
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
				'message': f"Successfully extracted {len(dishes)} dishes and {len(categories)} categories. Please review and approve to add them to the database.",
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


def store_extracted_data(data, extractor_doc):
	"""
	Store extracted data in both HTML report format and editable child tables
	"""
	# Extract data sections
	categories_data = data.get('categories', [])
	dishes_data = data.get('dishes', [])
	
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
	
	# Clear existing child table data
	extractor_doc.extracted_dishes = []
	
	# Populate editable child tables for dishes
	for dish_data in dishes_data:
		if not isinstance(dish_data, dict):
			continue
		
		dish_name = dish_data.get('name')
		
		if not dish_name:
			continue
		
		# Generate dish_id from dish_name
		dish_id = generate_product_id_from_name(dish_name)
		
		# Store media and customizations as JSON strings
		media_json = json.dumps(dish_data.get('media', [])) if dish_data.get('media') else None
		customizations_json = json.dumps(dish_data.get('customizationQuestions', [])) if dish_data.get('customizationQuestions') else None
		
		extractor_doc.append('extracted_dishes', {
			'dish_id': dish_id,
			'dish_name': dish_name,
			'price': dish_data.get('price', 0),
			'original_price': dish_data.get('originalPrice'),
			'category': dish_data.get('category', ''),
			'description': dish_data.get('description', ''),
			'calories': dish_data.get('calories'),
			'is_vegetarian': 1 if dish_data.get('isVegetarian') else 0,
			'estimated_time': dish_data.get('estimatedTime'),
			'serving_size': dish_data.get('servingSize'),
			'has_no_media': 1 if dish_data.get('hasNoMedia') else 0,
			'main_category': dish_data.get('mainCategory', ''),
			'media_json': media_json,
			'customizations_json': customizations_json
		})
	
	# Also store raw data in raw_response for backup
	if not extractor_doc.raw_response:
		extractor_doc.raw_response = json.dumps({'data': data}, indent=2)


def generate_extraction_report_html(categories_data, dishes_data):
	"""
	Generate an Excel-like HTML report of extracted data
	"""
	html = """
	<style>
		.extraction-report {
			font-family: 'Segoe UI', Arial, sans-serif;
			width: 100%;
			margin: 20px 0;
			background-color: #ffffff;
		}
		.report-section {
			margin-bottom: 40px;
		}
		.report-title {
			font-size: 16px;
			font-weight: bold;
			margin-bottom: 15px;
			color: #1a1a1a;
			padding: 12px 15px;
			background: linear-gradient(to right, #4472C4, #5B9BD5);
			color: white;
			border-radius: 4px 4px 0 0;
		}
		.data-table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 0;
			background-color: white;
			border: 2px solid #4472C4;
			font-size: 13px;
		}
		.data-table th {
			background: linear-gradient(to bottom, #4472C4, #5B9BD5);
			color: white;
			padding: 12px 10px;
			text-align: left;
			font-weight: bold;
			border: 1px solid #2E5C8A;
			white-space: nowrap;
			position: sticky;
			top: 0;
			z-index: 10;
		}
		.data-table td {
			padding: 10px;
			border: 1px solid #D0D0D0;
			background-color: white;
			vertical-align: top;
		}
		.data-table tr:nth-child(even) td {
			background-color: #F2F2F2;
		}
		.data-table tr:nth-child(odd) td {
			background-color: #FFFFFF;
		}
		.data-table tr:hover td {
			background-color: #D9E1F2;
		}
		.data-table tbody tr {
			border-bottom: 1px solid #D0D0D0;
		}
		.text-center {
			text-align: center;
		}
		.text-right {
			text-align: right;
		}
		.badge {
			display: inline-block;
			padding: 4px 10px;
			border-radius: 3px;
			font-size: 11px;
			font-weight: bold;
			text-transform: uppercase;
		}
		.badge-yes {
			background-color: #70AD47;
			color: white;
		}
		.badge-no {
			background-color: #C00000;
			color: white;
		}
		.summary-box {
			background: linear-gradient(to right, #E7F3FF, #D0E8FF);
			padding: 18px 20px;
			border-radius: 6px;
			margin-bottom: 25px;
			border: 2px solid #4472C4;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		.summary-box strong {
			color: #1a1a1a;
			font-size: 14px;
		}
		.summary-box br {
			line-height: 1.8;
		}
		.table-container {
			overflow-x: auto;
			border: 2px solid #4472C4;
			border-radius: 0 0 4px 4px;
		}
	</style>
	<div class="extraction-report">
	"""
	
	# Summary section
	html += f"""
		<div class="summary-box">
			<strong>Extraction Summary:</strong><br>
			• Categories Found: <strong>{len(categories_data)}</strong><br>
			• Dishes Found: <strong>{len(dishes_data)}</strong>
		</div>
	"""
	
	# Categories table
	if categories_data:
		html += """
		<div class="report-section">
			<div class="report-title">📁 Extracted Categories</div>
			<div class="table-container">
			<table class="data-table">
				<thead>
					<tr>
						<th style="width: 50px;">#</th>
						<th style="min-width: 120px;">Category ID</th>
						<th style="min-width: 150px;">Category Name</th>
						<th style="min-width: 150px;">Display Name</th>
						<th style="min-width: 200px;">Description</th>
						<th style="width: 100px;" class="text-center">Is Special</th>
						<th style="min-width: 150px;">Image</th>
					</tr>
				</thead>
				<tbody>
		"""
		
		for idx, cat_data in enumerate(categories_data, 1):
			if not isinstance(cat_data, dict):
				continue
			
			category_id = cat_data.get('id', '')
			category_name = cat_data.get('name', '')
			display_name = cat_data.get('displayName', category_name)
			cat_description = cat_data.get('description') or ''
			description = cat_description[:100] + ('...' if len(cat_description) > 100 else '')
			is_special = 'Yes' if cat_data.get('isSpecial') else 'No'
			image = cat_data.get('image', '')
			
			html += f"""
					<tr>
						<td class="text-center">{idx}</td>
						<td>{category_id}</td>
						<td><strong>{category_name}</strong></td>
						<td>{display_name}</td>
						<td>{description}</td>
						<td class="text-center"><span class="badge {'badge-yes' if cat_data.get('isSpecial') else 'badge-no'}">{is_special}</span></td>
						<td>{image[:50] + ('...' if len(image) > 50 else '') if image else '-'}</td>
					</tr>
			"""
		
		html += """
				</tbody>
			</table>
			</div>
		</div>
		"""
	
	# Dishes table
	if dishes_data:
		html += """
		<div class="report-section">
			<div class="report-title">🍽️ Extracted Dishes</div>
			<div class="table-container">
			<table class="data-table">
				<thead>
					<tr>
						<th style="width: 50px;">#</th>
						<th style="min-width: 180px;">Dish Name</th>
						<th style="min-width: 120px;">Category</th>
						<th style="width: 80px;" class="text-right">Price</th>
						<th style="width: 100px;" class="text-right">Original Price</th>
						<th style="width: 80px;" class="text-center">Calories</th>
						<th style="width: 90px;" class="text-center">Vegetarian</th>
						<th style="width: 100px;" class="text-center">Est. Time</th>
						<th style="width: 100px;" class="text-center">Serving Size</th>
						<th style="min-width: 200px;">Description</th>
						<th style="width: 90px;" class="text-center">Media</th>
						<th style="width: 110px;" class="text-center">Customizations</th>
					</tr>
				</thead>
				<tbody>
		"""
		
		for idx, dish_data in enumerate(dishes_data, 1):
			if not isinstance(dish_data, dict):
				continue
			
			dish_name = dish_data.get('name', '')
			category = dish_data.get('category', '')
			price = dish_data.get('price', 0)
			original_price = dish_data.get('originalPrice', '')
			calories = dish_data.get('calories', '')
			is_vegetarian = 'Yes' if dish_data.get('isVegetarian') else 'No'
			estimated_time = dish_data.get('estimatedTime', '')
			serving_size = dish_data.get('servingSize', '')
			dish_description = dish_data.get('description') or ''
			description = dish_description[:80] + ('...' if len(dish_description) > 80 else '')
			
			# Safely get media and customizations, handling None values
			media = dish_data.get('media')
			media_count = len(media) if media is not None else 0
			
			customizations = dish_data.get('customizationQuestions')
			customizations_count = len(customizations) if customizations is not None else 0
			
			html += f"""
					<tr>
						<td class="text-center">{idx}</td>
						<td><strong>{dish_name}</strong></td>
						<td>{category}</td>
						<td class="text-right">{price if price else '-'}</td>
						<td class="text-right">{original_price if original_price else '-'}</td>
						<td class="text-center">{calories if calories else '-'}</td>
						<td class="text-center"><span class="badge {'badge-yes' if dish_data.get('isVegetarian') else 'badge-no'}">{is_vegetarian}</span></td>
						<td class="text-center">{estimated_time if estimated_time else '-'}</td>
						<td class="text-center">{serving_size if serving_size else '-'}</td>
						<td>{description}</td>
						<td class="text-center">{media_count}</td>
						<td class="text-center">{customizations_count}</td>
					</tr>
			"""
		
		html += """
				</tbody>
			</table>
			</div>
		</div>
		"""
	
	html += """
	</div>
	"""
	
	return html


def process_extracted_data(data, extractor_doc):
	"""
	Process extracted data and create Menu Categories and Menu Products
	This is called after approval
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
		
		product_name = dish_data.get('name')
		
		if not product_name:
			stats['items_skipped'] += 1
			continue
		
		# Generate product_id from product_name
		product_id = generate_product_id_from_name(product_name)
		
		# Check if product exists (by product_id or product_name)
		existing_product = None
		if frappe.db.exists("Menu Product", product_id):
			existing_product = frappe.get_doc("Menu Product", product_id)
		else:
			# Also check by product_name in case product_id changed
			existing_by_name = frappe.db.get_value("Menu Product", {"product_name": product_name}, "name")
			if existing_by_name:
				existing_product = frappe.get_doc("Menu Product", existing_by_name)
				product_id = existing_product.name  # Use existing product_id
		
		if existing_product:
			# Update existing product
			product_doc = existing_product
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
		
		# Set estimated time and serving size
		if dish_data.get('estimatedTime'):
			product_doc.estimated_time = dish_data.get('estimatedTime')
		if dish_data.get('servingSize'):
			product_doc.serving_size = dish_data.get('servingSize')
		
		# Handle media if present
		if dish_data.get('media'):
			# Clear existing media
			product_doc.product_media = []
			
			for idx, media_url in enumerate(dish_data.get('media', [])):
				if not media_url:
					continue
				
				# Determine media type from URL
				media_type = 'video' if any(ext in media_url.lower() for ext in ['.mp4', '.mov', '.avi', '.webm']) else 'image'
				
				media_row = product_doc.append('product_media', {})
				media_row.media_url = media_url
				media_row.media_type = media_type
				media_row.display_order = idx + 1
		
		# Handle customizations if present
		if dish_data.get('customizationQuestions'):
			# Clear existing customizations
			product_doc.customization_questions = []
			
			for custom_data in dish_data.get('customizationQuestions', []):
				if not isinstance(custom_data, dict):
					continue
				
				custom_row = product_doc.append('customization_questions', {})
				custom_row.question_id = custom_data.get('id', '')
				custom_row.title = custom_data.get('title', '')
				custom_row.subtitle = custom_data.get('subtitle', '')
				custom_row.question_type = custom_data.get('type', 'single')
				custom_row.is_required = 1 if custom_data.get('required') else 0
				custom_row.display_order = custom_data.get('displayOrder', 0)
				
				# Handle options
				if custom_data.get('options'):
					for option_data in custom_data.get('options', []):
						if not isinstance(option_data, dict):
							continue
						
						option_row = custom_row.append('options', {})
						option_row.option_id = option_data.get('id', '')
						option_row.label = option_data.get('label', '')
						option_row.price = option_data.get('price', 0)
						option_row.is_default = 1 if option_data.get('isDefault') else 0
						option_row.is_vegetarian = 1 if option_data.get('isVegetarian') else 0
						option_row.display_order = option_data.get('displayOrder', 0)
		
		try:
			product_doc.save(ignore_permissions=True)
		except Exception as e:
			frappe.log_error(f"Error saving product {product_id} (name: {product_name}): {str(e)}", "Menu Product Save Error")
			stats['items_skipped'] += 1
			if not existing_product:
				stats['items_created'] -= 1
			else:
				stats['items_updated'] -= 1
	
	frappe.db.commit()
	
	return stats


@frappe.whitelist()
def approve_extracted_data(docname):
	"""
	Approve extracted data and create Menu Categories and Menu Products
	"""
	try:
		doc = frappe.get_doc("Menu Image Extractor", docname)
		
		# Check if document is in pending approval status
		if doc.extraction_status != "Pending Approval":
			frappe.throw(_("Only documents with 'Pending Approval' status can be approved."))
		
		# Get data from editable child tables (user may have edited the data)
		# Convert child table data back to the format expected by process_extracted_data
		data = {
			'categories': [],
			'dishes': []
		}
		
		# Check if child tables have data
		if not doc.extracted_dishes:
			# Fallback to raw_response if child tables are empty
			if not doc.raw_response:
				frappe.throw(_("No extracted data found. Please extract menu data first."))
			
			try:
				raw_data = json.loads(doc.raw_response)
				if isinstance(raw_data, dict):
					if 'data' in raw_data:
						data = raw_data['data']
					elif 'success' in raw_data and isinstance(raw_data.get('data'), dict):
						data = raw_data['data']
					else:
						data = raw_data.get('data', raw_data)
				else:
					frappe.throw(_("Invalid data format. Please re-extract the menu data."))
			except json.JSONDecodeError:
				frappe.throw(_("Invalid data format. Please re-extract the menu data."))
		else:
			# Get categories from raw_response (categories are auto-created from dishes)
			if doc.raw_response:
				try:
					raw_data = json.loads(doc.raw_response)
					if isinstance(raw_data, dict):
						if 'data' in raw_data:
							raw_data_obj = raw_data['data']
						elif 'success' in raw_data and isinstance(raw_data.get('data'), dict):
							raw_data_obj = raw_data['data']
						else:
							raw_data_obj = raw_data.get('data', raw_data)
						
						# Get categories from raw data
						categories_data = raw_data_obj.get('categories', [])
						if not isinstance(categories_data, list):
							if isinstance(categories_data, dict):
								categories_data = list(categories_data.values())
							else:
								categories_data = []
						
						for cat_data in categories_data:
							if isinstance(cat_data, dict):
								data['categories'].append(cat_data)
				except:
					pass
			
			# Convert extracted dishes from child table
			for dish_row in doc.extracted_dishes:
				dish_data = {
					'id': dish_row.dish_id,
					'name': dish_row.dish_name,
					'price': dish_row.price or 0,
					'originalPrice': dish_row.original_price,
					'category': dish_row.category or '',
					'description': dish_row.description or '',
					'calories': dish_row.calories,
					'isVegetarian': bool(dish_row.is_vegetarian),
					'estimatedTime': dish_row.estimated_time,
					'servingSize': dish_row.serving_size,
					'hasNoMedia': bool(dish_row.has_no_media),
					'mainCategory': dish_row.main_category or ''
				}
				
				# Parse media JSON if exists
				if dish_row.media_json:
					try:
						dish_data['media'] = json.loads(dish_row.media_json)
					except:
						dish_data['media'] = []
				
				# Parse customizations JSON if exists
				if dish_row.customizations_json:
					try:
						dish_data['customizationQuestions'] = json.loads(dish_row.customizations_json)
					except:
						dish_data['customizationQuestions'] = []
				
				data['dishes'].append(dish_data)
		
		if not data or (not data.get('categories') and not data.get('dishes')):
			frappe.throw(_("No data found to approve. Please extract menu data first."))
		
		# Process the data and create categories/products
		stats = process_extracted_data(data, doc)
		
		# Update document status
		doc.extraction_status = "Completed"
		doc.approval_status = "Approved"
		doc.extraction_log = f"Data approved and created successfully!\n\n" + \
			f"Categories created: {stats['categories_created']}\n" + \
			f"Items created: {stats['items_created']}\n" + \
			f"Items updated: {stats['items_updated']}\n" + \
			f"Items skipped: {stats['items_skipped']}"
		doc.items_created = stats['items_created']
		doc.categories_created = stats['categories_created']
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		
		return {
			'success': True,
			'message': f"Successfully approved and created {stats['items_created']} items and {stats['categories_created']} categories",
			'stats': stats
		}
		
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Menu Approval Error")
		frappe.throw(_("Approval failed: {0}").format(str(e)))


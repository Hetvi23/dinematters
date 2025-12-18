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
	def validate(self):
		"""Auto-fill restaurant_name from restaurant field if not provided"""
		if self.restaurant and not self.restaurant_name:
			# Get restaurant name from the selected restaurant
			restaurant_name = frappe.db.get_value("Restaurant", self.restaurant, "restaurant_name")
			if restaurant_name:
				self.restaurant_name = restaurant_name


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


def generate_category_id_from_name(category_name):
	"""Generate a slug-like category_id from category_name"""
	if not category_name:
		return None
	
	# Convert to lowercase
	category_id = category_name.lower()
	
	# Replace spaces and special characters with hyphens
	category_id = re.sub(r'[^\w\s-]', '', category_id)  # Remove special chars
	category_id = re.sub(r'[-\s]+', '-', category_id)  # Replace spaces and multiple hyphens with single hyphen
	category_id = category_id.strip('-')  # Remove leading/trailing hyphens
	
	# Limit length to 140 characters (Frappe name field limit)
	if len(category_id) > 140:
		category_id = category_id[:140].rstrip('-')
	
	return category_id


@frappe.whitelist()
def extract_menu_data(docname):
	"""
	Extract menu data from uploaded images using the external API
	This function immediately enqueues batch processing jobs - no timeouts, no waiting
	Returns instantly after queuing all batches
	"""
	try:
		# Get document for validation
		doc = frappe.get_doc("Menu Image Extractor", docname)
		
		# Validate images
		if not doc.menu_images:
			frappe.throw(_("Please upload at least one menu image"))
		
		if len(doc.menu_images) > 20:
			frappe.throw(_("Maximum 20 images allowed. Currently {0} images uploaded.").format(len(doc.menu_images)))
		
		# Check if extraction is already in progress
		if doc.extraction_status == "Processing":
			frappe.throw(_("Extraction is already in progress. Please wait for it to complete."))
		
		# Reset extraction data if re-extracting (status is Completed or Failed)
		if doc.extraction_status in ["Completed", "Failed"]:
			# Clear previous extraction data
			# For child tables, we need to reload the doc and clear the child table
			doc.reload()
			doc.extracted_dishes = []
			doc.extraction_log = ''
			doc.categories_created = 0
			doc.items_created = 0
			doc.items_updated = 0
			doc.items_skipped = 0
			doc.extraction_date = None
			doc.processing_time = None
			doc.approval_status = 'Pending'
			doc.save(ignore_permissions=True)
			frappe.db.commit()
		
		# Update status to Processing (minimal save)
		doc.db_set('extraction_status', 'Processing', update_modified=False)
		doc.db_set('extraction_log', _("Extraction started. Processing images in batches..."), update_modified=False)
		frappe.db.commit()
		
		# Split images into batches (5 images per batch for optimal processing)
		batch_size = 5
		image_batches = []
		for i in range(0, len(doc.menu_images), batch_size):
			batch = doc.menu_images[i:i + batch_size]
			image_batches.append([img.menu_image for img in batch])
		
		# Store batch information
		doc.db_set('total_batches', len(image_batches), update_modified=False)
		doc.db_set('completed_batches', 0, update_modified=False)
		frappe.db.commit()
		
		# Enqueue each batch as a separate job - no timeout, process in parallel
		for batch_idx, image_batch in enumerate(image_batches):
			frappe.enqueue(
				"dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor._extract_batch_internal",
				docname=docname,
				batch_images=image_batch,
				batch_number=batch_idx + 1,
				total_batches=len(image_batches),
				queue="long",
				timeout=7200,  # 2 hours per batch (very generous)
				job_id=f"menu_extraction_{docname}_batch_{batch_idx + 1}",
				is_async=True,
				now=False  # Don't wait - queue immediately
			)
		
		# Return immediately - all batches are queued
		return {
			'success': True,
			'message': _("Extraction started in the background. Processing {0} images in {1} batch(es). Please wait for it to complete.").format(
				len(doc.menu_images), len(image_batches)
			),
			'status': 'queued',
			'total_images': len(doc.menu_images),
			'total_batches': len(image_batches)
		}
		
	except frappe.exceptions.ValidationError:
		raise
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Menu Extraction - Enqueue Error")
		frappe.throw(_("Error starting extraction: {0}").format(str(e)))


def _extract_batch_internal(docname, batch_images, batch_number, total_batches):
	"""
	Process a single batch of images
	This runs as a background job - no timeouts, processes in parallel with other batches
	"""
	try:
		# Log that batch processing started
		frappe.log_error(
			f"Batch {batch_number}/{total_batches} started processing\n"
			f"Document: {docname}\n"
			f"Images in batch: {len(batch_images)}",
			"Menu Extraction - Batch Start"
		)
		
		doc = frappe.get_doc("Menu Image Extractor", docname)
		
		# Check if document still exists and is in Processing status
		if doc.extraction_status != "Processing":
			frappe.log_error(
				f"Batch {batch_number} skipped: Document status is {doc.extraction_status}, not Processing",
				"Menu Extraction - Batch Skip"
			)
			return
		
		start_time = time.time()
		
		# Prepare form data
		form_data = {}
		restaurant_name_for_api = doc.restaurant_name
		if not restaurant_name_for_api and doc.restaurant:
			restaurant_name_for_api = frappe.db.get_value("Restaurant", doc.restaurant, "restaurant_name")
		
		if restaurant_name_for_api:
			form_data['restaurant_name'] = restaurant_name_for_api
		
		form_data['save_to_disk'] = 'false'
		
		# Get image files for this batch
		image_files = []
		file_handles = []
		
		for image_url in batch_images:
			try:
				file_path = get_file_path(image_url)
				if not file_path or not os.path.exists(file_path):
					if image_url.startswith('/'):
						image_url = image_url[1:]
					file_path = frappe.get_site_path('public', 'files', image_url)
					if not os.path.exists(file_path):
						file_path = frappe.get_site_path('private', 'files', image_url)
					if not os.path.exists(file_path):
						file_path = frappe.get_site_path('public', image_url)
				
				if not file_path or not os.path.exists(file_path):
					frappe.log_error(f"Image file not found: {image_url}", "Menu Extraction - Batch File Error")
					continue
				
				file_handle = open(file_path, 'rb')
				file_handles.append(file_handle)
				filename = os.path.basename(file_path)
				file_ext = os.path.splitext(filename)[1].lower()
				content_type_map = {
					'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
					'.webp': 'image/webp', '.gif': 'image/gif'
				}
				content_type = content_type_map.get(file_ext, 'image/jpeg')
				image_files.append(('images', (filename, file_handle, content_type)))
			except Exception as e:
				frappe.log_error(f"Error processing image {image_url}: {str(e)}", "Menu Extraction - Batch Image Error")
				continue
		
		if not image_files:
			frappe.log_error(f"Batch {batch_number}: No valid image files found", "Menu Extraction - Batch Empty")
			# Update batch completion
			_update_batch_completion(docname, batch_number, total_batches, None, None)
			return
		
		# Call the extraction API
		api_url = "https://api.dinematters.com/menu-extraction/api/v1/extraction/extract"
		headers = {'Expect': ''}
		
		# Log API call details for debugging
		frappe.log_error(
			f"Batch {batch_number}: Calling API\n"
			f"URL: {api_url}\n"
			f"Images count: {len(image_files)}\n"
			f"Form data: {form_data}\n"
			f"Image URLs: {batch_images[:3]}...",  # First 3 URLs
			"Menu Extraction - API Call Start"
		)
		
		try:
			response = requests.post(
				api_url,
				files=image_files,
				data=form_data,
				headers=headers,
				timeout=7200  # 2 hours per batch
			)
			
			# Close file handles
			for file_handle in file_handles:
				try:
					file_handle.close()
				except:
					pass
			
			# Log response status
			frappe.log_error(
				f"Batch {batch_number}: API Response\n"
				f"Status Code: {response.status_code}\n"
				f"Response Headers: {dict(response.headers)}\n"
				f"Response Preview: {response.text[:500]}",
				"Menu Extraction - API Response"
			)
			
			response.raise_for_status()
			result = response.json()
			
			# Log successful result
			frappe.log_error(
				f"Batch {batch_number}: API Success\n"
				f"Success: {result.get('success')}\n"
				f"Categories: {len(result.get('data', {}).get('categories', []))}\n"
				f"Dishes: {len(result.get('data', {}).get('dishes', []))}",
				"Menu Extraction - API Success"
			)
			
			processing_time = time.time() - start_time
			
			# Process batch result
			if result.get('success'):
				data = result.get('data', {})
				# Store batch results temporarily
				_store_batch_results(docname, batch_number, data, processing_time)
			else:
				frappe.log_error(
					f"Batch {batch_number} API returned success=False: {result.get('message', 'Unknown error')}",
					"Menu Extraction - Batch API Error"
				)
				_update_batch_completion(docname, batch_number, total_batches, None, None)
		
		except Exception as e:
			# Close file handles on error
			for file_handle in file_handles:
				try:
					file_handle.close()
				except:
					pass
			
			frappe.log_error(
				f"Batch {batch_number} error: {str(e)}\n{frappe.get_traceback()}",
				"Menu Extraction - Batch Error"
			)
			_update_batch_completion(docname, batch_number, total_batches, None, None)
	
	except Exception as e:
		frappe.log_error(
			f"Batch {batch_number} fatal error: {str(e)}\n{frappe.get_traceback()}",
			"Menu Extraction - Batch Fatal Error"
		)
		_update_batch_completion(docname, batch_number, total_batches, None, None)


def _store_batch_results(docname, batch_number, data, processing_time):
	"""Store results from a single batch and check if all batches are complete"""
	try:
		doc = frappe.get_doc("Menu Image Extractor", docname)
		
		# Get existing batch results or initialize
		batch_results = json.loads(doc.get('batch_results') or '{}')
		batch_results[str(batch_number)] = {
			'data': data,
			'processing_time': processing_time,
			'completed_at': datetime.now().isoformat()
		}
		
		# Store batch results
		doc.db_set('batch_results', json.dumps(batch_results), update_modified=False)
		
		# Update completed batches count
		completed = doc.get('completed_batches') or 0
		doc.db_set('completed_batches', completed + 1, update_modified=False)
		
		total_batches = doc.get('total_batches') or 1
		
		# Check if all batches are complete
		if completed + 1 >= total_batches:
			# All batches complete - aggregate and process
			_aggregate_and_process_batches(docname)
		else:
			# Update progress log
			doc.db_set('extraction_log', 
				_("Processing batches... {0}/{1} completed").format(completed + 1, total_batches),
				update_modified=False)
		
		frappe.db.commit()
	
	except Exception as e:
		frappe.log_error(
			f"Error storing batch {batch_number} results: {str(e)}\n{frappe.get_traceback()}",
			"Menu Extraction - Store Batch Error"
		)


def _update_batch_completion(docname, batch_number, total_batches, data, processing_time):
	"""Update batch completion status"""
	try:
		doc = frappe.get_doc("Menu Image Extractor", docname)
		completed = doc.get('completed_batches') or 0
		doc.db_set('completed_batches', completed + 1, update_modified=False)
		
		if completed + 1 >= total_batches:
			# All batches complete (even if some failed)
			_aggregate_and_process_batches(docname)
		else:
			doc.db_set('extraction_log',
				_("Processing batches... {0}/{1} completed").format(completed + 1, total_batches),
				update_modified=False)
		
		frappe.db.commit()
	except Exception as e:
		frappe.log_error(f"Error updating batch completion: {str(e)}", "Menu Extraction - Batch Update Error")


def _aggregate_and_process_batches(docname):
	"""Aggregate results from all batches and process them"""
	try:
		doc = frappe.get_doc("Menu Image Extractor", docname)
		
		# Get all batch results
		batch_results = json.loads(doc.get('batch_results') or '{}')
		
		# Aggregate categories and dishes from all batches
		all_categories = {}
		all_dishes = []
		
		for batch_num, batch_data in batch_results.items():
			data = batch_data.get('data', {})
			categories = data.get('categories', [])
			dishes = data.get('dishes', [])
			
			# Handle categories - can be list or dict
			if isinstance(categories, dict):
				categories = list(categories.values())
			elif not isinstance(categories, list):
				categories = []
			
			# Aggregate categories (deduplicate by id)
			for cat in categories:
				if isinstance(cat, dict) and cat.get('id'):
					all_categories[cat['id']] = cat
			
			# Handle dishes - can be list or dict
			if isinstance(dishes, dict):
				dishes = list(dishes.values())
			elif not isinstance(dishes, list):
				dishes = []
			
			# Aggregate dishes
			all_dishes.extend(dishes)
		
		# Create aggregated data structure
		aggregated_data = {
			'categories': list(all_categories.values()),
			'dishes': all_dishes,
			'restaurantBrand': {}  # Can be merged if needed
		}
		
		# Store aggregated data
		store_extracted_data(aggregated_data, doc)
		
		# Update status
		doc.extraction_status = "Pending Approval"
		doc.approval_status = "Pending"
		doc.extraction_log = f"Extraction completed successfully!\n\n" + \
			f"Categories extracted: {len(all_categories)}\n" + \
			f"Dishes extracted: {len(all_dishes)}\n\n" + \
			"Please review the extracted data below and click 'Approve and Create Menu Items' to add them to the database."
		doc.extraction_date = datetime.now()
		
		# Calculate total processing time
		total_time = sum(b.get('processing_time', 0) for b in batch_results.values())
		doc.processing_time = f"{total_time:.2f} seconds"
		
		# Store raw response
		doc.raw_response = json.dumps({'data': aggregated_data}, indent=2)
		
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		
	except Exception as e:
		frappe.log_error(
			f"Error aggregating batches: {str(e)}\n{frappe.get_traceback()}",
			"Menu Extraction - Aggregate Error"
		)
		doc = frappe.get_doc("Menu Image Extractor", docname)
		doc.extraction_status = "Failed"
		doc.extraction_log = f"Error aggregating batch results: {str(e)}"
		doc.save(ignore_permissions=True)
		frappe.db.commit()


def _extract_menu_data_internal(docname):
	"""
	Internal function that performs the actual menu extraction
	This runs as a background job to avoid web server timeouts
	"""
	try:
		doc = frappe.get_doc("Menu Image Extractor", docname)
		
		start_time = time.time()
		
		# Prepare files for API request
		files = []
		form_data = {}
		
		# Add restaurant name for API (use restaurant field if restaurant_name not provided)
		restaurant_name_for_api = doc.restaurant_name
		if not restaurant_name_for_api and doc.restaurant:
			# Get restaurant name from the selected restaurant
			restaurant_name_for_api = frappe.db.get_value("Restaurant", doc.restaurant, "restaurant_name")
		
		if restaurant_name_for_api:
			form_data['restaurant_name'] = restaurant_name_for_api
		
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
		api_url = "https://api.dinematters.com/menu-extraction/api/v1/extraction/extract"
		
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
				timeout=3600  # 1 hour timeout (matches API server configuration)
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
				_("Request Timeout: The API request took longer than 1 hour to complete. "
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
		
		# Update status to failed in background job
		try:
			doc = frappe.get_doc("Menu Image Extractor", docname)
			doc.extraction_status = "Failed"
			doc.extraction_log = f"Extraction failed: {str(e)}\n\n{frappe.get_traceback()}"
			doc.extraction_date = datetime.now()
			doc.save(ignore_permissions=True)
			frappe.db.commit()
		except:
			pass  # If we can't update, at least log the error
		
		# Re-raise to mark job as failed
		raise


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
	
	# Get restaurant from extractor document
	restaurant = None
	
	# First, try to use the restaurant Link field (preferred)
	if extractor_doc.restaurant:
		restaurant = extractor_doc.restaurant
		# Validate restaurant exists
		if not frappe.db.exists("Restaurant", restaurant):
			frappe.throw(
				_("Selected restaurant '{0}' does not exist. Please select a valid restaurant.").format(restaurant),
				title=_("Invalid Restaurant")
			)
	
	# Fallback: Try to find restaurant by restaurant_name (for backward compatibility)
	if not restaurant and extractor_doc.restaurant_name:
		# Try to find restaurant by restaurant_name or restaurant_id
		restaurant = frappe.db.get_value("Restaurant", {"restaurant_name": extractor_doc.restaurant_name}, "name")
		if not restaurant:
			# Try by restaurant_id (slug format)
			restaurant_id = extractor_doc.restaurant_name.lower().strip().replace(" ", "-")
			restaurant = frappe.db.get_value("Restaurant", {"restaurant_id": restaurant_id}, "name")
	
	if not restaurant:
		frappe.throw(
			_("Restaurant is required. Please select a restaurant from the Restaurant field."),
			title=_("Restaurant Required")
		)
	
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
	
	# If no categories in API response, extract unique categories from dishes
	if not categories_data and dishes_data:
		unique_categories = {}
		for dish in dishes_data:
			if isinstance(dish, dict):
				category_name = dish.get('category') or dish.get('mainCategory')
				if category_name and category_name not in unique_categories:
					# Create a category entry from dish data
					category_id = generate_category_id_from_name(category_name)
					unique_categories[category_name] = {
						'id': category_id,
						'name': category_name,
						'displayName': category_name,
						'description': '',
						'isSpecial': False
					}
		
		if unique_categories:
			categories_data = list(unique_categories.values())
			frappe.log_error(
				f"Categories extracted from dishes: {len(categories_data)} categories found",
				"Menu Category Auto-Extraction"
			)
	
	# Ensure categories_data is always a list (safety check)
	if not isinstance(categories_data, list):
		categories_data = []
	
	# Create or update categories
	category_map = {}  # Map category names to category IDs
	
	for cat_data in categories_data:
		try:
			# Ensure cat_data is a dict
			if not isinstance(cat_data, dict):
				continue
			category_id = cat_data.get('id')
			category_name = cat_data.get('name')
			
			if not category_id or not category_name:
				frappe.log_error(
					f"Skipping category: missing id or name. id={category_id}, name={category_name}",
					"Menu Category Creation Skip"
				)
				continue
			
			# Check if category exists for THIS restaurant (by category_id AND restaurant)
			existing_category = None
			if frappe.db.exists("Menu Category", category_id):
				existing_category = frappe.get_doc("Menu Category", category_id)
				# Verify restaurant matches - if not, treat as new category
				if existing_category.restaurant != restaurant:
					existing_category = None  # Different restaurant, create new category
			else:
				# Also check by category_name AND restaurant in case category_id changed
				existing_by_name = frappe.db.get_value(
					"Menu Category", 
					{"category_name": category_name, "restaurant": restaurant}, 
					"name"
				)
				if existing_by_name:
					existing_category = frappe.get_doc("Menu Category", existing_by_name)
					category_id = existing_category.name  # Use existing category_id
			
			if existing_category and existing_category.restaurant == restaurant:
				# Update existing category (only if restaurant matches)
				cat_doc = existing_category
				cat_doc.display_name = cat_data.get('displayName', category_name)
				cat_doc.description = cat_data.get('description', '')
				cat_doc.is_special = 1 if cat_data.get('isSpecial') else 0
				
				cat_doc.save(ignore_permissions=True)
				stats['categories_created'] += 1  # Track as created for stats (could add categories_updated if needed)
				category_map[category_name] = category_id
			else:
				# Create new category (either doesn't exist or belongs to different restaurant)
				try:
					cat_doc = frappe.new_doc("Menu Category")
					cat_doc.category_id = category_id
					cat_doc.restaurant = restaurant
					cat_doc.category_name = category_name
					cat_doc.display_name = cat_data.get('displayName', category_name)
					cat_doc.description = cat_data.get('description', '')
					cat_doc.is_special = 1 if cat_data.get('isSpecial') else 0
					
					cat_doc.save(ignore_permissions=True)
					stats['categories_created'] += 1
					category_map[category_name] = category_id
				except frappe.exceptions.UniqueValidationError:
					# Race condition: category was created by another process
					# Just use the existing one
					category_map[category_name] = category_id
					frappe.log_error(
						f"Category {category_id} was created by another process. Using existing category.",
						"Menu Category - Race Condition"
					)
			
		except Exception as e:
			error_msg = f"Error creating/updating category {category_id or 'unknown'}: {str(e)[:140]}"
			frappe.log_error(error_msg, "Menu Category Creation Error")
			# Continue with next category instead of failing completely
			continue
	
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
		
		# Check if product exists for THIS restaurant (by product_id AND restaurant)
		existing_product = None
		if frappe.db.exists("Menu Product", product_id):
			existing_product = frappe.get_doc("Menu Product", product_id)
			# Verify restaurant matches - if not, treat as new product
			if existing_product.restaurant != restaurant:
				existing_product = None  # Different restaurant, create new product
		else:
			# Also check by product_name AND restaurant in case product_id changed
			existing_by_name = frappe.db.get_value(
				"Menu Product", 
				{"product_name": product_name, "restaurant": restaurant}, 
				"name"
			)
			if existing_by_name:
				existing_product = frappe.get_doc("Menu Product", existing_by_name)
				product_id = existing_product.name  # Use existing product_id
		
		if existing_product and existing_product.restaurant == restaurant:
			# Update existing product (only if restaurant matches)
			product_doc = existing_product
			stats['items_updated'] += 1
		else:
			# Create new product (either doesn't exist or belongs to different restaurant)
			product_doc = frappe.new_doc("Menu Product")
			product_doc.product_id = product_id
			stats['items_created'] += 1
		
		# Set restaurant (mandatory field)
		product_doc.restaurant = restaurant
		
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
		media_list = dish_data.get('media', [])
		if media_list and isinstance(media_list, list) and len(media_list) > 0:
			# Clear existing media
			product_doc.product_media = []
			
			media_added = 0
			for idx, media_item in enumerate(media_list):
				# Handle both string URLs and object formats
				media_url = None
				if isinstance(media_item, str):
					media_url = media_item
				elif isinstance(media_item, dict):
					media_url = media_item.get('url') or media_item.get('media_url') or media_item.get('src')
				
				if not media_url:
					continue
				
				# Determine media type from URL
				media_type = 'video' if any(ext in media_url.lower() for ext in ['.mp4', '.mov', '.avi', '.webm']) else 'image'
				
				media_row = product_doc.append('product_media', {})
				media_row.media_url = media_url
				media_row.media_type = media_type
				media_row.display_order = idx + 1
				media_added += 1
			
			if media_added == 0:
				frappe.log_error(
					f"No valid media URLs found for product {product_doc.product_name} (dish_id: {dish_data.get('id')}). Media list: {json.dumps(media_list[:3])}",
					"Menu Product - Media Processing Warning"
				)
		
		# Handle customizations if present
		if dish_data.get('customizationQuestions'):
			# Clear existing customizations
			product_doc.customization_questions = []
			
			for custom_data in dish_data.get('customizationQuestions', []):
				if not isinstance(custom_data, dict):
					continue
				
				# Get options list
				options_list = custom_data.get('options')
				
				# Ensure options_list is a list
				if not isinstance(options_list, list):
					options_list = []
				
				# Skip questions without options (options field is required in Customization Question)
				if not options_list or len(options_list) == 0:
					continue
				
				# Filter out invalid option entries (must have 'label' field)
				valid_options = [opt for opt in options_list if isinstance(opt, dict) and opt.get('label')]
				
				# Skip if no valid options after filtering (options field is required)
				if not valid_options or len(valid_options) == 0:
					frappe.log_error(
						f"Skipping customization question '{custom_data.get('title', 'unknown')}' - no valid options found",
						"Menu Product - Skip Customization Question"
					)
					continue
				
				# Create customization question row
				custom_row = product_doc.append('customization_questions', {})
				custom_row.question_id = custom_data.get('id', '')
				custom_row.title = custom_data.get('title', '')
				custom_row.subtitle = custom_data.get('subtitle', '')
				custom_row.question_type = custom_data.get('type', 'single')
				custom_row.is_required = 1 if custom_data.get('required') else 0
				custom_row.display_order = custom_data.get('displayOrder', 0)
				
				# Append options - this is required, so we must have at least one
				options_appended = 0
				for option_data in valid_options:
					# Double-check that label exists before appending
					if not option_data.get('label'):
						continue
					
					option_row = custom_row.append('options', {})
					option_row.option_id = option_data.get('id', '')
					option_row.label = option_data.get('label', '')
					option_row.price = option_data.get('price', 0)
					option_row.is_default = 1 if option_data.get('isDefault') else 0
					option_row.is_vegetarian = 1 if option_data.get('isVegetarian') else 0
					option_row.display_order = option_data.get('displayOrder', 0)
					options_appended += 1
				
				# Safety check: if no options were actually appended, remove the question
				# This prevents "Data missing in table: Options" error
				if options_appended == 0:
					# Remove the last appended row (the one without options)
					product_doc.customization_questions.pop()
					frappe.log_error(
						f"Removed customization question '{custom_data.get('title', 'unknown')}' - no options could be appended",
						"Menu Product - Remove Empty Customization Question"
					)
		
		try:
			product_doc.save(ignore_permissions=True)
		except Exception as e:
			# Truncate error message to avoid CharacterLengthExceededError (max 140 chars)
			error_msg = str(e)
			# Create a concise error message
			if len(error_msg) > 100:
				error_msg = error_msg[:100] + "..."
			
			# Truncate product name if too long
			display_name = product_name[:30] + "..." if len(product_name) > 30 else product_name
			log_message = f"Error saving {display_name}: {error_msg}"
			
			# Ensure log message doesn't exceed 140 characters
			if len(log_message) > 140:
				log_message = log_message[:137] + "..."
			
			frappe.log_error(log_message, "Menu Product Save Error")
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
					
					# Ensure media is included in dishes from raw_response
					if data.get('dishes'):
						dishes_list = data['dishes']
						if not isinstance(dishes_list, list):
							dishes_list = list(dishes_list.values()) if isinstance(dishes_list, dict) else []
						
						for dish in dishes_list:
							if isinstance(dish, dict) and not dish.get('media'):
								# Try to ensure media array exists (even if empty)
								dish['media'] = dish.get('media', [])
				else:
					frappe.throw(_("Invalid data format. Please re-extract the menu data."))
			except json.JSONDecodeError:
				frappe.throw(_("Invalid data format. Please re-extract the menu data."))
		else:
			# Get categories from raw_response (categories come from API response)
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
					
					# Log if no categories found
					if not data.get('categories'):
						frappe.log_error(
							f"No categories found in raw_response for {docname}. Raw data keys: {list(raw_data_obj.keys()) if isinstance(raw_data_obj, dict) else 'N/A'}",
							"Menu Category Extraction Warning"
						)
				except Exception as e:
					error_msg = f"Error parsing categories from raw_response for {docname}: {str(e)[:140]}"
					frappe.log_error(error_msg, "Menu Category Parsing Error")
					# Don't silently fail - log the error so we can debug
			
			# Get raw dishes data for media fallback
			raw_dishes_map = {}
			if doc.raw_response:
				try:
					raw_data = json.loads(doc.raw_response)
					if isinstance(raw_data, dict):
						raw_data_obj = raw_data.get('data', raw_data)
						if isinstance(raw_data_obj, dict) and 'dishes' in raw_data_obj:
							raw_dishes = raw_data_obj['dishes']
							if isinstance(raw_dishes, list):
								for raw_dish in raw_dishes:
									if isinstance(raw_dish, dict) and raw_dish.get('id'):
										raw_dishes_map[raw_dish['id']] = raw_dish
							elif isinstance(raw_dishes, dict):
								raw_dishes_map = raw_dishes
				except Exception as e:
					frappe.log_error(f"Error parsing raw_response for media fallback: {str(e)}", "Menu Approval - Media Fallback Error")
			
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
				else:
					# Fallback: Try to get media from raw_response
					raw_dish = raw_dishes_map.get(dish_row.dish_id) or raw_dishes_map.get(dish_row.dish_name)
					if raw_dish and isinstance(raw_dish, dict):
						dish_data['media'] = raw_dish.get('media', [])
				
				# Parse customizations JSON if exists
				if dish_row.customizations_json:
					try:
						dish_data['customizationQuestions'] = json.loads(dish_row.customizations_json)
					except:
						dish_data['customizationQuestions'] = []
				else:
					# Fallback: Try to get customizations from raw_response
					raw_dish = raw_dishes_map.get(dish_row.dish_id) or raw_dishes_map.get(dish_row.dish_name)
					if raw_dish and isinstance(raw_dish, dict):
						dish_data['customizationQuestions'] = raw_dish.get('customizationQuestions', [])
				
				data['dishes'].append(dish_data)
		
		# If no categories found in raw_response, extract from dishes
		if not data.get('categories') and data.get('dishes'):
			unique_categories = {}
			for dish in data['dishes']:
				if isinstance(dish, dict):
					category_name = dish.get('category') or dish.get('mainCategory')
					if category_name and category_name not in unique_categories:
						# Create a category entry from dish data
						category_id = generate_category_id_from_name(category_name)
						unique_categories[category_name] = {
							'id': category_id,
							'name': category_name,
							'displayName': category_name,
							'description': '',
							'isSpecial': False
						}
			
			if unique_categories:
				data['categories'] = list(unique_categories.values())
				frappe.log_error(
					f"Categories auto-extracted from dishes for {docname}: {len(data['categories'])} categories found",
					"Menu Category Auto-Extraction from Dishes"
				)
		
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


# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

"""
API endpoints for document creation/update with better error handling
"""

import frappe
from frappe import _
import json


@frappe.whitelist()
def create_document(doctype, doc_data):
	"""
	Create a document with proper error handling
	"""
	try:
		# Parse doc_data if it's a string
		if isinstance(doc_data, str):
			doc_data = json.loads(doc_data)
		
		# Ensure doctype is set
		doc_data['doctype'] = doctype
		
		# Create document
		doc = frappe.get_doc(doc_data)
		doc.insert()
		
		# Return the created document
		return {
			'success': True,
			'message': doc.as_dict(),
			'name': doc.name
		}
	except frappe.ValidationError as e:
		frappe.log_error(f"Validation error creating {doctype}: {str(e)}")
		return {
			'success': False,
			'error': {
				'type': 'ValidationError',
				'message': str(e)
			}
		}
	except frappe.PermissionError as e:
		frappe.log_error(f"Permission error creating {doctype}: {str(e)}")
		return {
			'success': False,
			'error': {
				'type': 'PermissionError',
				'message': 'You do not have permission to create this document'
			}
		}
	except Exception as e:
		frappe.log_error(f"Error creating {doctype}: {str(e)}")
		return {
			'success': False,
			'error': {
				'type': 'Error',
				'message': str(e)
			}
		}


@frappe.whitelist()
def update_document(doctype, name, doc_data):
	"""
	Update a document with proper error handling
	"""
	try:
		# Parse doc_data if it's a string
		if isinstance(doc_data, str):
			doc_data = json.loads(doc_data)
		
		# Get existing document
		doc = frappe.get_doc(doctype, name)
		
		# Get table fields from meta
		table_fields = [f.fieldname for f in doc.meta.get_table_fields()]
		
		# Update fields
		for key, value in doc_data.items():
			if key not in ['doctype', 'name']:
				# Handle child tables
				if key in table_fields:
					# Clear existing child table
					doc.set(key, [])
					# Add new rows if value is a list
					if isinstance(value, list):
						for row_data in value:
							if isinstance(row_data, dict):
								# Ensure doctype is set for child table rows
								row_data['doctype'] = doc.meta.get_field(key).options
								doc.append(key, row_data)
					elif value is None or (isinstance(value, list) and len(value) == 0):
						# Already cleared above
						pass
				else:
					# Regular field
					doc.set(key, value)
		
		doc.save()
		
		return {
			'success': True,
			'message': doc.as_dict(),
			'name': doc.name
		}
	except frappe.ValidationError as e:
		frappe.log_error(f"Validation error updating {doctype} {name}: {str(e)}")
		return {
			'success': False,
			'error': {
				'type': 'ValidationError',
				'message': str(e)
			}
		}
	except frappe.PermissionError as e:
		frappe.log_error(f"Permission error updating {doctype} {name}: {str(e)}")
		return {
			'success': False,
			'error': {
				'type': 'PermissionError',
				'message': 'You do not have permission to update this document'
			}
		}
	except Exception as e:
		frappe.log_error(f"Error updating {doctype} {name}: {str(e)}")
		return {
			'success': False,
			'error': {
				'type': 'Error',
				'message': str(e)
			}
		}


@frappe.whitelist()
def get_doc_list(doctype, filters=None, fields=None, limit_page_length=20, order_by=None):
	"""
	Wrapper for frappe.client.get_list
	Maintains EXACT same API contract as frappe.client.get_list
	"""
	try:
		# Parse filters and fields if they're JSON strings
		if isinstance(filters, str):
			try:
				filters = json.loads(filters)
			except:
				pass
		
		if isinstance(fields, str):
			try:
				fields = json.loads(fields)
			except:
				pass
		
		# Convert limit_page_length to int if needed
		if limit_page_length:
			try:
				limit_page_length = int(limit_page_length)
			except:
				limit_page_length = 20
		
		# Build kwargs for get_list
		kwargs = {
			'doctype': doctype
		}
		
		if filters:
			kwargs['filters'] = filters
		
		if fields:
			kwargs['fields'] = fields
		else:
			kwargs['fields'] = ['name']
		
		if limit_page_length:
			kwargs['limit_page_length'] = limit_page_length
		
		if order_by:
			kwargs['order_by'] = order_by
		
		# Call frappe.get_list (same as frappe.client.get_list internally uses)
		result = frappe.get_list(**kwargs)
		
		# Return in exact same format as frappe.client.get_list
		return result
		
	except frappe.PermissionError as e:
		frappe.log_error(f"Permission error in get_doc_list: {str(e)}")
		frappe.throw(_("You do not have permission to access this document type"))
	except Exception as e:
		frappe.log_error(f"Error in get_doc_list: {str(e)}")
		frappe.throw(_("Failed to fetch documents: {0}").format(str(e)))


@frappe.whitelist()
def get_doc(doctype, name):
	"""
	Wrapper for frappe.client.get
	Maintains EXACT same API contract as frappe.client.get
	"""
	try:
		# Check if document exists
		if not frappe.db.exists(doctype, name):
			frappe.throw(_("{0} {1} not found").format(doctype, name))
		
		# Get document (with permission checks)
		doc = frappe.get_doc(doctype, name)
		
		# Return as dict (exact same format as frappe.client.get)
		return doc.as_dict()
		
	except frappe.PermissionError as e:
		frappe.log_error(f"Permission error in get_doc: {str(e)}")
		frappe.throw(_("You do not have permission to access this document"))
	except Exception as e:
		frappe.log_error(f"Error in get_doc: {str(e)}")
		frappe.throw(_("Failed to fetch document: {0}").format(str(e)))


@frappe.whitelist()
def insert_doc(doc):
	"""
	Wrapper for frappe.client.insert
	Maintains EXACT same API contract as frappe.client.insert
	"""
	try:
		# Parse doc if it's a string
		if isinstance(doc, str):
			doc = json.loads(doc)
		
		# Ensure doctype is present
		if 'doctype' not in doc:
			frappe.throw(_("doctype is required"))
		
		# Create document
		new_doc = frappe.get_doc(doc)
		new_doc.insert()
		
		# Return as dict (exact same format as frappe.client.insert)
		return new_doc.as_dict()
		
	except frappe.ValidationError as e:
		frappe.log_error(f"Validation error in insert_doc: {str(e)}")
		frappe.throw(str(e))
	except frappe.PermissionError as e:
		frappe.log_error(f"Permission error in insert_doc: {str(e)}")
		frappe.throw(_("You do not have permission to create this document"))
	except Exception as e:
		frappe.log_error(f"Error in insert_doc: {str(e)}")
		frappe.throw(_("Failed to create document: {0}").format(str(e)))


@frappe.whitelist()
def delete_doc(doctype, name):
	"""
	Wrapper for frappe.client.delete
	Maintains EXACT same API contract as frappe.client.delete
	"""
	try:
		# Check if document exists
		if not frappe.db.exists(doctype, name):
			frappe.throw(_("{0} {1} not found").format(doctype, name))
		
		# Delete document (with permission checks)
		frappe.delete_doc(doctype, name)
		
		# Return success message (exact same format as frappe.client.delete)
		return {
			'message': _('Deleted')
		}
		
	except frappe.PermissionError as e:
		frappe.log_error(f"Permission error in delete_doc: {str(e)}")
		frappe.throw(_("You do not have permission to delete this document"))
	except frappe.LinkExistsError as e:
		frappe.log_error(f"Link exists error in delete_doc: {str(e)}")
		frappe.throw(_("Cannot delete {0} {1} because it is linked with other documents").format(doctype, name))
	except Exception as e:
		frappe.log_error(f"Error in delete_doc: {str(e)}")
		frappe.throw(_("Failed to delete document: {0}").format(str(e)))



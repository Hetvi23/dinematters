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
		
		# Update fields
		for key, value in doc_data.items():
			if key not in ['doctype', 'name']:
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




# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Event(Document):
	"""
	Custom Event doctype for Dinematters.
	This class handles the case where Frappe/ERPNext integrations try to access
	fields that don't exist in this custom Event doctype.
	"""
	
	@property
	def sync_with_google_calendar(self):
		"""Return False since this custom Event doesn't support Google Calendar sync."""
		return False
	
	@property
	def pulled_from_google_calendar(self):
		"""Return False since this custom Event doesn't support Google Calendar sync."""
		return False
	
	@property
	def google_calendar(self):
		"""Return None since this custom Event doesn't support Google Calendar sync."""
		return None
	
	@property
	def event_participants(self):
		"""Return empty list since this custom Event doesn't have event participants."""
		return []



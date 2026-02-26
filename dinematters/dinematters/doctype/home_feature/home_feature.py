# Copyright (c) 2025, Dinematters and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


ALLOWED_FEATURE_IDS = {"menu", "book-table", "legacy", "offers-events", "dine-play"}


class HomeFeature(Document):
	def validate(self):
		"""Business rules for Home Feature

		- Mandatory features cannot be disabled
		- One row per (restaurant, feature_id)
		- Feature IDs are restricted to the known set for new records
		"""

		# Ensure mandatory features cannot be disabled
		if self.is_mandatory and not self.is_enabled:
			frappe.throw(_("Mandatory features cannot be disabled"))

		# Restrict feature_id choices for new records so we don't create
		# arbitrary extra feature types beyond the core five.
		if self.is_new() and self.feature_id not in ALLOWED_FEATURE_IDS:
			frappe.throw(
				_("Invalid Feature ID: {0}. Allowed values: {1}").format(
					self.feature_id, ", ".join(sorted(ALLOWED_FEATURE_IDS))
				)
			)

		# Enforce uniqueness: only one document per restaurant + feature_id
		if self.restaurant and self.feature_id:
			existing = frappe.db.exists(
				"Home Feature",
				{
					"restaurant": self.restaurant,
					"feature_id": self.feature_id,
					"name": ["!=", self.name],
				},
			)
			if existing:
				frappe.throw(
					_(
						"Home Feature {0} is already configured for restaurant {1}. "
						"Edit the existing record instead of creating a duplicate."
					).format(self.feature_id, self.restaurant)
				)


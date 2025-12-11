# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
import re


class MenuProduct(Document):
	def before_insert(self):
		"""Generate product_id from product_name and set as document name"""
		if self.product_name:
			# Generate product_id from product_name
			product_id = self.generate_product_id_from_name(self.product_name)
			self.product_id = product_id
			# Set document name to product_id (for autoname)
			self.name = product_id
	
	def before_save(self):
		"""Update product_id from product_name if name changed"""
		if self.product_name and (not self.product_id or self.has_value_changed('product_name')):
			# Generate new product_id
			new_product_id = self.generate_product_id_from_name(self.product_name)
			
			# Check if new product_id already exists for a different product
			if frappe.db.exists("Menu Product", new_product_id) and self.name != new_product_id:
				# Generate unique product_id by appending number
				base_id = new_product_id
				counter = 1
				while frappe.db.exists("Menu Product", f"{base_id}-{counter}"):
					counter += 1
				new_product_id = f"{base_id}-{counter}"
			
			self.product_id = new_product_id
			# Update document name if it changed
			if self.name != new_product_id:
				self.name = new_product_id
	
	def generate_product_id_from_name(self, product_name):
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
		
		return product_id
	
	def validate(self):
		"""Validate Product Media constraints"""
		# Ensure product_id is set
		if not self.product_id and self.product_name:
			self.product_id = self.generate_product_id_from_name(self.product_name)
		
		self.validate_product_media()
	
	def validate_product_media(self):
		"""Validate Product Media:
		- Maximum 3 media items per product
		- Maximum 1 video per product
		- File type must match media_type
		"""
		if not self.product_media:
			return
		
		media_count = len(self.product_media)
		video_count = 0
		
		# Define valid file extensions
		image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
		video_extensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv']
		
		# Validate each media item
		for idx, media_item in enumerate(self.product_media, start=1):
			# Count videos
			if media_item.media_type == 'video':
				video_count += 1
			
			# Validate file type matches media_type
			if media_item.media_url and media_item.media_type:
				# Get file extension
				file_url = media_item.media_url
				file_extension = ''
				
				# Extract extension from file path
				if '.' in file_url:
					file_extension = file_url.split('.')[-1].lower()
				
				# Validate image files
				if media_item.media_type == 'image':
					if file_extension and file_extension not in image_extensions:
						frappe.throw(
							_('Row {0}: Image media type requires an image file (jpg, png, gif, etc.). File "{1}" is not a valid image file.').format(
								idx, file_url
							),
							title=_('Invalid File Type')
						)
				
				# Validate video files
				elif media_item.media_type == 'video':
					if file_extension and file_extension not in video_extensions:
						frappe.throw(
							_('Row {0}: Video media type requires a video file (mp4, webm, mov, etc.). File "{1}" is not a valid video file.').format(
								idx, file_url
							),
							title=_('Invalid File Type')
						)
		
		# Validate maximum 3 media items
		if media_count > 3:
			frappe.throw(
				_('Maximum 3 media items allowed per product. Currently {0} items found.').format(media_count),
				title=_('Maximum Media Items Exceeded')
			)
		
		# Validate maximum 1 video
		if video_count > 1:
			frappe.throw(
				_('Maximum 1 video allowed per product. Currently {0} videos found.').format(video_count),
				title=_('Maximum Videos Exceeded')
			)




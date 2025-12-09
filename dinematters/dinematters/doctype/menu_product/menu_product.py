# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class MenuProduct(Document):
	def validate(self):
		"""Validate Product Media constraints"""
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




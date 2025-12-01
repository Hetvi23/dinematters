# Copyright (c) 2024, Hetvi Patel and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class MenuProduct(Document):
	def validate(self):
		"""Validate Product Media constraints"""
		self.validate_product_media()
	
	def after_insert(self):
		"""Make all product media files public by default after insert"""
		self.make_product_media_public()
	
	def on_update(self):
		"""Make all product media files public by default after update"""
		self.make_product_media_public()
	
	def make_product_media_public(self):
		"""Make all files in product_media public"""
		if not self.product_media:
			return
		
		for media_item in self.product_media:
			if media_item.media_url:
				# Get the file document
				file_url = media_item.media_url
				
				# Find the file document - try multiple ways
				file_doc = None
				
				# Method 1: Find by attached_to info (for child table, field might be product_media)
				file_doc = frappe.db.get_value(
					"File",
					{
						"file_url": file_url,
						"attached_to_doctype": self.doctype,
						"attached_to_name": self.name
					},
					"name"
				)
				
				# Method 2: Find by file_url only (might be attached to parent)
				if not file_doc:
					file_doc = frappe.db.get_value(
						"File",
						{"file_url": file_url},
						"name"
					)
				
				if file_doc:
					try:
						file_doc_obj = frappe.get_doc("File", file_doc)
						# Make file public if it's private
						if file_doc_obj.is_private:
							file_doc_obj.is_private = 0
							file_doc_obj.save(ignore_permissions=True)
							frappe.db.commit()
					except Exception as e:
						# Log error but don't fail the document save
						frappe.log_error(f"Error making file public: {str(e)}", "Product Media Public File Error")
	
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


def make_file_public_if_product_media(doc, method):
	"""
	Hook function to make files public when attached to Menu Product's product_media
	This is called when a File document is inserted
	"""
	try:
		# Check if file is attached to Menu Product
		if doc.attached_to_doctype == "Menu Product" and doc.attached_to_name:
			# Check if this file is in the product_media child table
			product = frappe.get_doc("Menu Product", doc.attached_to_name)
			
			if product.product_media:
				for media_item in product.product_media:
					if media_item.media_url == doc.file_url:
						# This file is part of product_media, make it public
						if doc.is_private:
							doc.is_private = 0
							doc.save(ignore_permissions=True)
							frappe.db.commit()
						break
	except Exception as e:
		# Log error but don't fail the file save
		frappe.log_error(f"Error making product media file public: {str(e)}", "Product Media Public File Hook Error")




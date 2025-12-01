// Client script for Menu Product DocType
// Validates Product Media:
// - Maximum 3 media items per product
// - Maximum 1 video per product
// - File type must match media_type (image files for image, video files for video)

frappe.ui.form.on('Menu Product', {
	product_media_add: function(frm) {
		validate_product_media(frm);
	},
	
	'product_media': {
		media_type: function(frm, cdt, cdn) {
			// Validate when media type changes
			validate_media_file_type(frm, cdt, cdn);
			validate_product_media(frm);
		},
		media_url: function(frm, cdt, cdn) {
			// Validate when file is uploaded
			validate_media_file_type(frm, cdt, cdn);
		}
	},
	
	refresh: function(frm) {
		// Validate media on refresh
		validate_product_media(frm);
	},
	
	validate: function(frm) {
		// Final validation before save
		validate_product_media(frm);
	}
});

function validate_product_media(frm) {
	if (!frm.doc.product_media) return;
	
	let media_count = frm.doc.product_media.length;
	let video_count = 0;
	
	// Count videos
	frm.doc.product_media.forEach(function(row) {
		if (row.media_type === 'video') {
			video_count++;
		}
	});
	
	// Check maximum 3 media items
	if (media_count > 3) {
		frappe.msgprint({
			title: __('Maximum Media Items Exceeded'),
			message: __('Maximum 3 media items allowed per product. Please remove excess items.'),
			indicator: 'red'
		});
		frappe.validated = false;
		return false;
	}
	
	// Check maximum 1 video
	if (video_count > 1) {
		frappe.msgprint({
			title: __('Maximum Videos Exceeded'),
			message: __('Maximum 1 video allowed per product. Please remove excess videos.'),
			indicator: 'red'
		});
		frappe.validated = false;
		return false;
	}
	
	return true;
}

function validate_media_file_type(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	if (!row.media_url || !row.media_type) return;
	
	// Get file extension
	let file_url = row.media_url;
	let file_extension = '';
	
	if (file_url) {
		// Extract extension from file path
		let parts = file_url.split('.');
		if (parts.length > 1) {
			file_extension = parts[parts.length - 1].toLowerCase();
		}
	}
	
	// Define valid extensions
	let image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
	let video_extensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
	
	// Validate file type matches media_type
	if (row.media_type === 'image') {
		if (file_extension && !image_extensions.includes(file_extension)) {
			frappe.msgprint({
				title: __('Invalid File Type'),
				message: __('Image media type requires an image file (jpg, png, gif, etc.). Please upload an image file or change media type to video.'),
				indicator: 'red'
			});
			// Clear the file if type doesn't match
			row.media_url = '';
			frm.refresh_field('product_media');
			frappe.validated = false;
			return false;
		}
	} else if (row.media_type === 'video') {
		if (file_extension && !video_extensions.includes(file_extension)) {
			frappe.msgprint({
				title: __('Invalid File Type'),
				message: __('Video media type requires a video file (mp4, webm, mov, etc.). Please upload a video file or change media type to image.'),
				indicator: 'red'
			});
			// Clear the file if type doesn't match
			row.media_url = '';
			frm.refresh_field('product_media');
			frappe.validated = false;
			return false;
		}
	}
	
	return true;
}




// Client script for Menu Product DocType
// Limits product media to maximum 3 items

frappe.ui.form.on('Menu Product', {
	product_media_add: function(frm) {
		// Check if media count exceeds 3
		if (frm.doc.product_media && frm.doc.product_media.length > 3) {
			frappe.msgprint({
				title: __('Maximum Media Items'),
				message: __('Maximum 3 media items allowed per product. Please remove an existing item first.'),
				indicator: 'orange'
			});
			// Remove the last added item
			frm.doc.product_media.pop();
			frm.refresh_field('product_media');
		}
	},
	
	refresh: function(frm) {
		// Validate media count on refresh
		if (frm.doc.product_media && frm.doc.product_media.length > 3) {
			frappe.msgprint({
				title: __('Too Many Media Items'),
				message: __('This product has more than 3 media items. Please remove excess items.'),
				indicator: 'orange'
			});
		}
	}
});




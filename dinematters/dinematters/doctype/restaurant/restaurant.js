// Copyright (c) 2025, Dinematters and contributors
// For license information, please see license.txt

frappe.ui.form.on('Restaurant', {
	refresh: function(frm) {
		// Add button to view/download QR codes PDF
		if (frm.doc.tables && frm.doc.tables > 0) {
			// Check if QR codes PDF exists
			frappe.call({
				method: 'dinematters.dinematters.doctype.restaurant.restaurant.get_qr_codes_pdf_url',
				args: {
					restaurant: frm.doc.name
				},
				callback: function(r) {
					if (r.message) {
						// Show button to view/download QR codes
						frm.add_custom_button(__('View QR Codes'), function() {
							window.open(r.message, '_blank');
						}, __('Actions'));
						
						// Also add a download button
						frm.add_custom_button(__('Download QR Codes PDF'), function() {
							const link = document.createElement('a');
							link.href = r.message;
							link.download = `${frm.doc.restaurant_id}_table_qr_codes.pdf`;
							document.body.appendChild(link);
							link.click();
							document.body.removeChild(link);
						}, __('Actions'));
					} else {
						// Show button to generate QR codes
						frm.add_custom_button(__('Generate QR Codes'), function() {
							frappe.confirm(
								__('Generate QR codes PDF for {0} tables?', [frm.doc.tables]),
								function() {
									// Yes
									frappe.call({
										method: 'dinematters.dinematters.doctype.restaurant.restaurant.generate_qr_codes_pdf',
										args: {
											restaurant: frm.doc.name
										},
										freeze: true,
										freeze_message: __('Generating QR codes PDF...'),
										callback: function(r) {
											if (r.message) {
												frappe.show_alert({
													message: __('QR codes PDF generated successfully'),
													indicator: 'green'
												}, 5);
												frm.reload_doc();
											}
										}
									});
								},
								function() {
									// No
								}
							);
						}, __('Actions'));
					}
				}
			});
		}
	}
});


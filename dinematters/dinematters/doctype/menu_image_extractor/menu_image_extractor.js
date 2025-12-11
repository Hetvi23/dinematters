// Copyright (c) 2025, Hetvi Patel and contributors
// For license information, please see license.txt

console.log('🎉 Menu Image Extractor JS loaded - v1.1');

frappe.ui.form.on('Menu Image Extractor', {
	refresh: function(frm) {
		console.log('📄 Menu Image Extractor form refreshed:', frm.doc.name);
		// Add custom button for extraction
		if (frm.doc.menu_images && frm.doc.menu_images.length > 0) {
			// Add extract button in the form
			if (frm.doc.extraction_status != 'Processing') {
				frm.add_custom_button(__('Extract Menu Data'), function() {
					console.log('🔘 Extract Menu Data button clicked!');
					extract_menu_data(frm);
				}).addClass('btn-primary');
			}
		}
		
		// Show status indicator
		if (frm.doc.extraction_status) {
			update_status_indicator(frm);
		}
		
		// Add button to view created items
		if (frm.doc.extraction_status == 'Completed' && frm.doc.items_created > 0) {
			frm.add_custom_button(__('View Created Products'), function() {
				frappe.set_route('List', 'Menu Product', {
					'creation': ['>=', frappe.datetime.add_days(frm.doc.extraction_date, -1)]
				});
			});
		}
		
		// Add button to view created categories
		if (frm.doc.extraction_status == 'Completed' && frm.doc.categories_created > 0) {
			frm.add_custom_button(__('View Created Categories'), function() {
				frappe.set_route('List', 'Menu Category');
			});
		}
		
		// Add approve button when status is Pending Approval
		if (frm.doc.extraction_status == 'Pending Approval') {
			frm.add_custom_button(__('Approve and Create Menu Items'), function() {
				approve_extracted_data(frm);
			}).addClass('btn-primary');
		}
	},
	
	extract_button: function(frm) {
		extract_menu_data(frm);
	},
	
	approve_button: function(frm) {
		approve_extracted_data(frm);
	},
	
	menu_images_add: function(frm) {
		// Validate image count
		if (frm.doc.menu_images && frm.doc.menu_images.length > 20) {
			frappe.msgprint({
				title: __('Maximum Images Exceeded'),
				message: __('Maximum 20 images allowed. Please remove excess images.'),
				indicator: 'red'
			});
		}
	}
});

function extract_menu_data(frm) {
	console.log('🔍 extract_menu_data function called');
	console.log('  Document:', frm.doc.name);
	console.log('  Images count:', frm.doc.menu_images ? frm.doc.menu_images.length : 0);
	
	// Validate images
	if (!frm.doc.menu_images || frm.doc.menu_images.length == 0) {
		console.log('❌ Validation failed: No images');
		frappe.msgprint({
			title: __('No Images'),
			message: __('Please upload at least one menu image before extraction.'),
			indicator: 'red'
		});
		return;
	}
	
	if (frm.doc.menu_images.length > 20) {
		console.log('❌ Validation failed: Too many images');
		frappe.msgprint({
			title: __('Too Many Images'),
			message: __('Maximum 20 images allowed. Currently {0} images uploaded.', [frm.doc.menu_images.length]),
			indicator: 'red'
		});
		return;
	}
	
	console.log('✅ Validation passed, showing confirmation dialog');
	
	// Confirm extraction
	frappe.confirm(
		__('This will extract menu data from {0} image(s) and create/update categories and products. Continue?', 
		   [frm.doc.menu_images.length]),
		function() {
			console.log('✅ User clicked YES on confirmation dialog');
			
			// Function to proceed with extraction
			const proceed_with_extraction = () => {
				console.log('✅ Proceeding with extraction');
				// Show progress dialog
				frappe.show_progress(__('Extracting Menu Data'), 0, 100, 
					__('Processing images... This may take a few minutes.'));
				
				// Call the extraction method
				console.log('🚀 Starting menu extraction for document:', frm.doc.name);
				console.log('📸 Images to extract:', frm.doc.menu_images.length);
				console.log('📞 Calling server method: dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.extract_menu_data');
				
				frappe.call({
					method: 'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.extract_menu_data',
					args: {
						docname: frm.doc.name
					},
					freeze: true,
					freeze_message: __('Extracting menu data from images...'),
					callback: function(r) {
						console.log('📥 Extraction API Response:', r);
						frappe.hide_progress();
						
						if (r.message && r.message.success) {
							console.log('✅ Extraction successful!');
							console.log('📊 Stats:', r.message.stats);
							
							// Log extracted data preview
							if (r.message.extracted_data_preview) {
								console.log('\n📋 Extracted Data Preview:');
								console.log('  Categories found:', r.message.extracted_data_preview.categories_count);
								console.log('  Dishes found:', r.message.extracted_data_preview.dishes_count);
								console.log('\n  Sample Categories:', r.message.extracted_data_preview.sample_categories);
								console.log('\n  Sample Dishes:', r.message.extracted_data_preview.sample_dishes);
							}
							
							frappe.show_alert({
								message: __(r.message.message),
								indicator: 'green'
							}, 10);
							
							// Show message about review
							frappe.msgprint({
								title: __('Extraction Completed'),
								message: __('Extraction completed successfully!<br><br>Please review the extracted data below and click "Approve and Create Menu Items" to add them to the database.'),
								indicator: 'green'
							});
							
							// Reload the form to show the HTML report
							frm.reload_doc();
							
							// Force refresh of the HTML field after a short delay
							setTimeout(function() {
								if (frm.doc.extracted_data_report) {
									frm.refresh_field('extracted_data_report');
								}
							}, 500);
						} else {
							console.error('❌ Extraction failed - no success in response');
							console.log('Response message:', r.message);
						}
					},
					error: function(r) {
						console.error('❌ Extraction API call failed:', r);
						frappe.hide_progress();
						frappe.msgprint({
							title: __('Extraction Failed'),
							message: __('An error occurred during extraction. Please check the extraction log for details.'),
							indicator: 'red'
						});
						frm.reload_doc();
					}
				});
			};
			
			// Check if document has unsaved changes
			if (frm.doc.__unsaved || frm.is_dirty()) {
				console.log('💾 Document has changes, saving first...');
				frm.save().then(() => {
					console.log('✅ Document saved successfully');
					proceed_with_extraction();
				}).catch(err => {
					console.error('❌ Document save failed:', err);
					frappe.msgprint({
						title: __('Save Failed'),
						message: __('Could not save document. Please try again.'),
						indicator: 'red'
					});
				});
			} else {
				console.log('ℹ️  Document already saved, proceeding directly');
				proceed_with_extraction();
			}
		},
		function() {
			console.log('❌ User clicked NO/Cancel on confirmation dialog');
		}
	);
}

function approve_extracted_data(frm) {
	console.log('🔍 approve_extracted_data function called');
	console.log('  Document:', frm.doc.name);
	
	// Validate that there's data to approve
	if (!frm.doc.extracted_categories || frm.doc.extracted_categories.length == 0) {
		if (!frm.doc.extracted_dishes || frm.doc.extracted_dishes.length == 0) {
			frappe.msgprint({
				title: __('No Data to Approve'),
				message: __('No extracted data found. Please extract menu data first.'),
				indicator: 'red'
			});
			return;
		}
	}
	
	// Count items
	const dishes_count = frm.doc.extracted_dishes ? frm.doc.extracted_dishes.length : 0;
	
	// Confirm approval
	frappe.confirm(
		__('This will create/update {0} dishes in the database. Continue?', 
		   [dishes_count]),
		function() {
			console.log('✅ User confirmed approval');
			
			// Call the approval method
			frappe.call({
				method: 'dinematters.dinematters.doctype.menu_image_extractor.menu_image_extractor.approve_extracted_data',
				args: {
					docname: frm.doc.name
				},
				freeze: true,
				freeze_message: __('Approving and creating menu items...'),
				callback: function(r) {
					console.log('📥 Approval API Response:', r);
					
					if (r.message && r.message.success) {
						console.log('✅ Approval successful!');
						console.log('📊 Stats:', r.message.stats);
						
						// Reload the form first to get updated data
						frm.reload_doc();
						
						// Show alert (non-blocking)
						frappe.show_alert({
							message: __(r.message.message),
							indicator: 'green'
						}, 5);
						
						// Show detailed stats in a non-blocking way after a short delay
						if (r.message.stats) {
							setTimeout(function() {
								frappe.msgprint({
									title: __('Approval Completed'),
									message: __('Categories created: {0}<br>Items created: {1}<br>Items updated: {2}<br>Items skipped: {3}', 
										[r.message.stats.categories_created, 
										 r.message.stats.items_created,
										 r.message.stats.items_updated,
										 r.message.stats.items_skipped]),
									indicator: 'green'
								});
							}, 500);
						}
					} else {
						console.error('❌ Approval failed');
						frappe.msgprint({
							title: __('Approval Failed'),
							message: __('An error occurred during approval. Please check the extraction log for details.'),
							indicator: 'red'
						});
						frm.reload_doc();
					}
				},
				error: function(r) {
					console.error('❌ Approval API call failed:', r);
					frappe.msgprint({
						title: __('Approval Failed'),
						message: __('An error occurred during approval. Please check the extraction log for details.'),
						indicator: 'red'
					});
					frm.reload_doc();
				}
			});
		},
		function() {
			console.log('❌ User cancelled approval');
		}
	);
}

function update_status_indicator(frm) {
	let status = frm.doc.extraction_status;
	let color = 'blue';
	
	if (status == 'Completed') {
		color = 'green';
	} else if (status == 'Failed') {
		color = 'red';
	} else if (status == 'Processing') {
		color = 'orange';
	} else if (status == 'Pending Approval') {
		color = 'yellow';
	}
	
	frm.dashboard.add_indicator(__('Status: {0}', [status]), color);
}


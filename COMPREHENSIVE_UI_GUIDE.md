# Dinematters Comprehensive UI - Complete Guide

## Overview

A comprehensive, permission-aware UI for Dinematters that includes:
- **All Modules**: Restaurant, Config, Products, Categories, Orders, Bookings, Events, Games, Offers, Coupons, and more
- **Step-by-Step Wizard**: Guided setup workflow for restaurant creation
- **Progress Tracking**: Visual progress bars for all operations
- **Permission-Based Access**: Strict permission enforcement for all CRUD operations
- **Dynamic Forms**: Automatically generated forms based on doctype metadata
- **URL-Based Navigation**: Clean, shareable URLs for all pages

## Features

### 1. **Dynamic Form Builder**
- Automatically reads all fields from doctype metadata
- Supports all field types: Data, Text, Link, Select, Check, Currency, Date, Datetime, etc.
- Respects field properties: required, read-only, hidden, depends_on
- Permission-aware: Only shows create/edit buttons if user has permissions

### 2. **Setup Wizard**
- Guided workflow for restaurant setup
- Step-by-step progression with visual stepper
- Progress bar showing completion percentage
- Auto-advances after completing each step
- Can navigate back to completed steps

### 3. **Permission System**
- All operations check permissions before allowing actions
- Create/Read/Update/Delete permissions enforced
- Restaurant-based filtering automatically applied
- Users only see modules they have access to

### 4. **Comprehensive Module Access**
- **Restaurant Setup**: Restaurant, Restaurant Config, Restaurant User
- **Menu Management**: Menu Product, Menu Category, Product Media, Customization Question, Customization Option
- **Orders**: Order, Order Item, Cart Entry
- **Bookings**: Table Booking, Banquet Booking
- **Marketing**: Offer, Coupon, Event, Game, Home Feature
- **Legacy**: All legacy content modules
- **Tools**: Menu Image Extractor, Extracted Category, Extracted Dish

### 5. **Progress Tracking**
- Visual progress bars for save operations
- Step completion tracking in wizard
- Real-time progress updates

## Navigation Structure

```
/dinematters/
├── /dashboard          - Overview with stats
├── /setup              - Setup wizard
├── /modules            - Browse all available modules
├── /:doctype           - List view for any doctype
├── /:doctype/:docname  - Detail/edit view for any document
├── /orders             - Orders (legacy route)
├── /products           - Products (legacy route)
└── /categories         - Categories (legacy route)
```

## Usage

### Accessing Modules

1. **Via Navigation**: Click "All Modules" in the header
2. **Direct URL**: Navigate to `/dinematters/Restaurant` or any doctype name
3. **Setup Wizard**: Click "Setup Wizard" for guided restaurant setup

### Creating Records

1. Navigate to any module (e.g., `/dinematters/Menu Product`)
2. Click "Create New" button (only visible if you have create permission)
3. Fill in the form (all fields are dynamically loaded)
4. Click "Save" - progress bar will show save progress
5. Record is created and you're redirected to the list

### Editing Records

1. Navigate to a module list
2. Click the edit icon (eye icon) on any record
3. Or click directly on a record name
4. Click "Edit" button (only visible if you have write permission)
5. Make changes and save

### Viewing Records

- All records are automatically filtered by your restaurant permissions
- You only see records from restaurants you have access to
- Read-only users see view-only forms

## Permission Enforcement

### How It Works

1. **API Level**: Backend API checks permissions using `frappe.has_permission()`
2. **UI Level**: Frontend checks permissions before showing actions
3. **Data Level**: Queries are automatically filtered by `permission_query_conditions`

### Permission Types

- **Read**: Can view records
- **Write**: Can edit records
- **Create**: Can create new records
- **Delete**: Can delete records
- **Submit**: Can submit submittable documents
- **Cancel**: Can cancel submitted documents

## API Endpoints

### Get DocType Metadata
```
GET /api/method/dinematters.dinematters.api.ui.get_doctype_meta
Params: { doctype: "Menu Product" }
Returns: Field definitions, permissions, metadata
```

### Get User Permissions
```
GET /api/method/dinematters.dinematters.api.ui.get_user_permissions
Params: { doctype: "Menu Product" }
Returns: Permission flags for current user
```

### Get All DocTypes
```
GET /api/method/dinematters.dinematters.api.ui.get_all_doctypes
Returns: All dinematters doctypes grouped by category
```

### Get Setup Wizard Steps
```
GET /api/method/dinematters.dinematters.api.ui.get_setup_wizard_steps
Returns: Steps for restaurant setup wizard
```

## Components

### DynamicForm
- Automatically generates forms from doctype metadata
- Handles all field types
- Shows/hides fields based on permissions
- Progress tracking for save operations

### SetupWizard
- Multi-step wizard with progress tracking
- Visual stepper component
- Auto-advance on completion
- Can navigate between completed steps

### ModuleList
- Generic list view for any doctype
- Permission-aware create/edit/delete buttons
- Filters automatically applied

### ModuleDetail
- Generic detail/edit view
- Permission-aware edit/delete buttons
- Uses DynamicForm for editing

## Setup Wizard Steps

1. **Create Restaurant** - Basic restaurant information
2. **Restaurant Configuration** - Settings, tax, delivery fees
3. **Menu Categories** - Create menu categories
4. **Menu Products** - Add products to menu
5. **Add Staff** - Assign users to restaurant

## Best Practices

1. **Always check permissions** before showing action buttons
2. **Use the setup wizard** for new restaurant setup
3. **Navigate via URLs** for direct access to specific records
4. **Progress bars** show during all save operations
5. **Permissions are enforced** at API, UI, and data levels

## Troubleshooting

### Can't see a module
- Check if you have read permission for that doctype
- Verify restaurant permissions are set correctly

### Can't create/edit
- Check your role permissions in Frappe
- Verify restaurant user assignment

### Form fields not loading
- Check browser console for errors
- Verify API endpoint is accessible
- Check doctype name is correct

## Future Enhancements

- Bulk operations (create/edit multiple records)
- Advanced filtering and search
- Export/import functionality
- Real-time updates via websockets
- Custom field validation
- Workflow state management
- Document versioning













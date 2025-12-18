# Role Permissions Setup Guide

## Overview

All permissions in Dinematters are managed through **Role Permissions** in Frappe's Role Permission Manager. The system uses a role-based approach where:

1. **Role Permissions** control what actions users can perform (Read, Write, Create, Delete)
2. **Permission Query Conditions** filter which restaurants' data users can see
3. **Restaurant User** records determine which restaurants a user has access to

## How It Works

### 1. Role-Based Access Control

Users are assigned roles (e.g., "Restaurant Admin", "Restaurant Staff") through the `Restaurant User` doctype. These roles determine what actions they can perform on different doctypes.

### 2. Data Filtering

The `permission_query_conditions` in `hooks.py` automatically filter queries based on `Restaurant User` records:
- Users can only see data from restaurants they are assigned to
- This filtering happens at the database query level
- No User Permissions are required for filtering

### 3. Restaurant Assignment

When a `Restaurant User` record is created:
- The user is automatically assigned the specified role
- The role is added to the user's roles list
- The user can now access data from that restaurant (based on role permissions)

## Required Role Permissions

All doctypes should have role permissions configured in the Role Permission Manager. Here's the recommended setup:

### Restaurant Admin Role

**Full access** to all restaurant-related doctypes:
- Restaurant (Read, Write, Create)
- Restaurant Config (Read, Write, Create)
- Restaurant User (Read, Write, Create)
- Menu Product (Read, Write, Create, Delete)
- Menu Category (Read, Write, Create, Delete)
- Order (Read, Write, Create, Delete)
- Cart Entry (Read, Write, Create, Delete)
- All other restaurant-based doctypes (Read, Write, Create, Delete)

### Restaurant Staff Role

**Limited access** for day-to-day operations:
- Restaurant (Read only)
- Restaurant Config (Read only)
- Menu Product (Read, Write)
- Menu Category (Read, Write)
- Order (Read, Write, Create)
- Cart Entry (Read, Write, Create)
- Other doctypes as needed (typically Read, Write)

## Setting Up Role Permissions

1. Go to **Role Permission Manager** in Frappe
2. Select the role (e.g., "Restaurant Admin" or "Restaurant Staff")
3. For each doctype, set the appropriate permissions:
   - **Read**: Can view records
   - **Write**: Can edit records
   - **Create**: Can create new records
   - **Delete**: Can delete records
   - **Submit/Cancel/Amend**: As needed for workflow doctypes
   - **Print/Email/Export/Report**: As needed

## Important Notes

1. **No User Permissions Required**: The system does NOT use User Permissions for data filtering. All filtering is done through `Restaurant User` records and `permission_query_conditions`.

2. **Administrator Bypass**: The Administrator user bypasses all permission checks and can see all data.

3. **Permission Query Conditions**: These are automatically applied to filter queries. You don't need to configure them manually - they're defined in `hooks.py`.

4. **Restaurant User Records**: These records link users to restaurants and assign roles. They are the source of truth for restaurant access.

## Example Setup

### Creating a Restaurant Staff User

1. Create a User in Frappe
2. Create a `Restaurant User` record:
   - User: [The user you created]
   - Restaurant: [The restaurant they should access]
   - Role: "Restaurant Staff"
   - Is Default: 1 (if this is their primary restaurant)
   - Is Active: 1
3. The system will:
   - Add "Restaurant Staff" role to the user
   - Allow the user to see only data from the assigned restaurant
   - Apply role permissions for what actions they can perform

## Troubleshooting

### User can't see any data
- Check if `Restaurant User` record exists and is active
- Verify role permissions are set up in Role Permission Manager
- Check if the user has the correct role assigned

### User can see all restaurants
- Verify `permission_query_conditions` are working (check `hooks.py`)
- Ensure the user is not Administrator
- Check if `get_user_restaurant_ids` is returning correct restaurant IDs

### User can't perform actions (create/edit/delete)
- Check Role Permissions in Role Permission Manager
- Verify the user has the correct role assigned
- Check if the role has the required permissions for that doctype


# Menu Image Extractor - Console Debugging Guide

## How to View Extracted Data in Browser Console

### Step 1: Open Browser Console

**Chrome/Edge/Brave:**
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
- Press `Cmd+Option+I` (Mac)
- Or right-click → "Inspect" → Click "Console" tab

**Firefox:**
- Press `F12` or `Ctrl+Shift+K`

### Step 2: Clear Console (Optional)
- Click the 🚫 icon or press `Ctrl+L` to clear old messages

### Step 3: Run Extraction
1. Go to your Menu Image Extractor document
2. Make sure images are uploaded
3. Click **"Extract Menu Data"** button
4. Watch the console for real-time logs

## What You'll See in Console

### Before Extraction Starts:
```javascript
🚀 Starting menu extraction for document: MIE-0001
📸 Images to extract: 1
```

### During API Call:
```javascript
📥 Extraction API Response: {message: {…}, …}
```

### On Success:
```javascript
✅ Extraction successful!
📊 Stats: {categories_created: 18, items_created: 125, items_updated: 0, items_skipped: 2}

📋 Extracted Data Preview:
  Categories found: 18
  Dishes found: 127
  
  Sample Categories: ['Hot Coffee', 'Iced Coffee', 'Chocolate', 'Matcha', 'Teas']
  
  Sample Dishes: ['Espresso', 'Piccolo', 'Americano', 'Cortado', 'Flat White', ...]
```

### On Error:
```javascript
❌ Extraction failed - no success in response
Response message: {...error details...}
```

## Viewing Full API Response

To see the complete extracted data:

1. In console, find the line that says:
   ```javascript
   📥 Extraction API Response: {message: {…}, …}
   ```

2. Click the **▶** arrow to expand it

3. Navigate through the object:
   ```
   ▼ message
     ▼ extracted_data_preview
       ► sample_categories: Array(5)
       ► sample_dishes: Array(10)
       categories_count: 18
       dishes_count: 127
     ▼ stats
       categories_created: 18
       items_created: 125
       items_updated: 0
       items_skipped: 2
   ```

## Viewing Raw API Response in Frappe

After extraction completes:

1. Scroll down in the document
2. Find the **"Raw API Response"** section (collapsible)
3. Click to expand
4. You'll see the complete JSON response including:
   - All categories with details
   - All dishes with prices, descriptions
   - Restaurant branding info
   - Filters

## Common Console Messages

### Success Messages:
- `🚀 Starting menu extraction` - Extraction initiated
- `✅ Extraction successful!` - Extraction completed
- `📊 Stats:` - Shows items/categories created

### Error Messages:
- `❌ Extraction API call failed` - Network or API error
- `❌ Extraction failed - no success in response` - API returned failure
- `Cannot read properties of undefined` - JavaScript error (report this!)

## Troubleshooting with Console

### Issue: Nothing appears in console
**Check:**
- Console is on the "Console" tab (not Elements, Network, etc.)
- You're on the correct site/tab
- Refresh the page and try again

### Issue: "socket.io" errors
**Ignore:** These are unrelated WebSocket warnings, they don't affect extraction

### Issue: Extraction starts but never completes
**Check:**
1. Look for red error messages in console
2. Check the Network tab for failed requests
3. API might be timing out (wait up to 5 minutes)

### Issue: "Method not found" error
**Solution:**
```bash
cd /home/frappe/frappe-bench
bench --site qonevo.local clear-cache
bench build --app dinematters
```

## Advanced: Checking Server Logs

If extraction fails, check server-side logs:

```bash
# View error logs
cd /home/frappe/frappe-bench
bench --site qonevo.local execute "
import frappe
logs = frappe.get_all('Error Log', 
    filters={'creation': ['>', frappe.utils.add_days(frappe.utils.now(), -1)]},
    fields=['name', 'error', 'creation'],
    order_by='creation desc',
    limit=5)
for log in logs:
    if 'Menu Extraction' in log.get('error', ''):
        print('\\nError:', log.name)
        print(log.error[:500])
"
```

## What to Look For

### Categories Preview:
Look for category names like:
- Hot Coffee, Iced Coffee, Slow Brews
- Chocolate, Matcha, Teas
- All Day Breakfast, Sandwiches
- Bowls, Wraps, etc.

### Dishes Preview:
Look for dish names like:
- Espresso, Americano, Latte
- Turkish Eggs, Benedict
- Burrito Bowl
etc.

### Prices:
Check if prices are reasonable (should match your menu)

### Counts:
- Categories: Typically 10-25 for a full menu
- Dishes: Typically 50-200 for a full menu

If counts are 0 or very low, the API may not have recognized the menu properly.

## Example Console Output (Full Success)

```javascript
🚀 Starting menu extraction for document: MIE-0001
📸 Images to extract: 5

[Waiting 2-5 minutes...]

📥 Extraction API Response: {
  message: {
    success: true,
    message: "Successfully extracted and created 125 items and 18 categories",
    stats: {
      categories_created: 18,
      items_created: 125,
      items_updated: 0,
      items_skipped: 2
    },
    extracted_data_preview: {
      categories_count: 18,
      dishes_count: 127,
      sample_categories: [
        "Hot Coffee",
        "Iced Coffee",
        "Chocolate",
        "Matcha",
        "Teas"
      ],
      sample_dishes: [
        "Espresso",
        "Piccolo",
        "Americano",
        "Cortado",
        "Flat White",
        "Cappuccino",
        "Latte",
        "Fat Coffee",
        "Mocha",
        "Espresso Chai Latte"
      ]
    }
  }
}

✅ Extraction successful!
📊 Stats: {categories_created: 18, items_created: 125, items_updated: 0, items_skipped: 2}

📋 Extracted Data Preview:
  Categories found: 18
  Dishes found: 127
  
  Sample Categories: ["Hot Coffee", "Iced Coffee", "Chocolate", "Matcha", "Teas"]
  
  Sample Dishes: ["Espresso", "Piccolo", "Americano", "Cortado", "Flat White", ...]
```

## Tips

1. **Keep console open** while extracting to see real-time progress
2. **Take screenshots** of console output if reporting issues
3. **Expand objects** (click ▶) to see full details
4. **Copy console output**: Right-click → "Save as..." to export logs
5. **Filter messages**: Use the filter box to search for specific text

## Next Steps After Viewing Console

1. ✅ Verify counts match expectations
2. ✅ Check sample items look correct
3. ✅ Navigate to Menu Product list to see created items
4. ✅ Navigate to Menu Category list to see categories
5. ✅ Review and edit any items as needed

---

**Now try again with console open and you'll see exactly what's being extracted!** 🎉


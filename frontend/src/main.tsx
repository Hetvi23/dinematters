import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function initApp() {
  // Ensure frappe object exists
  if (!window.frappe) {
    window.frappe = {} as any;
  }

  // Only sync if frappe.model exists (frappe-react-sdk handles model syncing)
  if (window.frappe.boot && window.frappe.boot.docs && window.frappe.model && typeof window.frappe.model.sync === 'function') {
    try {
      window.frappe.model.sync(window.frappe.boot.docs);
    } catch (e) {
      // Silently fail - frappe-react-sdk will handle model syncing
      console.debug('frappe.model.sync not available, using frappe-react-sdk');
    }
  }

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

if (import.meta.env.DEV) {
  fetch('/api/method/dinematters.www.dinematters.get_context_for_dev', {
    method: 'POST',
  })
    .then(response => response.json())
    .then((values) => {
      const v = JSON.parse(values.message)
      if (!window.frappe) window.frappe = {} as any;
      //@ts-expect-error - frappe will be available
      window.frappe.boot = v
      //@ts-expect-error - frappe will be available
      window.frappe._messages = window.frappe.boot["__messages"];
      initApp();
    })
    .catch((error) => {
      console.error('Failed to load boot data:', error);
      initApp();
    })
} else {
  // In production, boot data is injected via HTML
  // Wait for DOM and ensure frappe.boot is set from the inline script
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initApp, 50);
    });
  } else {
    setTimeout(initApp, 50);
  }
}


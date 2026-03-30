import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts a human-readable error message from a Frappe error response.
 * Frappe often returns errors in _server_messages, which is a stringified JSON array.
 */
export function getFrappeError(error: any, defaultMessage: string = 'An error occurred'): string {
  if (!error) return defaultMessage;

  // Handle string errors
  if (typeof error === 'string') return error;

  // 1. Try to extract from _server_messages (Frappe's standard way for thrown exceptions)
  const serverMessages = error?._server_messages || error?.response?.data?._server_messages;
  if (serverMessages) {
    try {
      // serverMessages is usually a JSON stringified array
      const messages = typeof serverMessages === 'string' ? JSON.parse(serverMessages) : serverMessages;
      if (Array.isArray(messages) && messages.length > 0) {
        // Each item in the array is usually a JSON stringified object
        const firstMessage = typeof messages[0] === 'string' ? JSON.parse(messages[0]) : messages[0];
        if (firstMessage?.message) {
          return firstMessage.message;
        }
      }
    } catch (e) {
      console.error('Failed to parse _server_messages:', e);
    }
  }

  // 2. Try 'message' field (Standard JS Error or some Frappe responses)
  if (error?.message) {
      // Sometimes 'message' is actually a stringified JSON if it came from a direct axios error
      if (typeof error.message === 'string' && (error.message.startsWith('{') || error.message.startsWith('['))) {
          try {
              const parsed = JSON.parse(error.message);
              if (parsed.message) return parsed.message;
          } catch (e) {}
      }
      return error.message;
  }

  // 3. Try 'exception' field
  if (error?.exception) return error.exception;

  // 4. Try Axios response data error fields
  const data = error?.response?.data;
  if (data) {
      if (typeof data === 'string') return data;
      if (data.message) return data.message;
      if (data.exc) {
          try {
              const exc = JSON.parse(data.exc);
              if (Array.isArray(exc) && exc.length > 0) return exc[0];
          } catch (e) {
              return 'Server Error';
          }
      }
  }

  return defaultMessage;
}













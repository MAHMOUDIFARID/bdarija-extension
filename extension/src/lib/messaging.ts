import { ExtensionMessage } from './types.js';

/**
 * Sends a message from popup or content script to the background script.
 */
export function sendToBackground<T = any, R = any>(message: ExtensionMessage<T>): Promise<R> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Sends a message from the background script to a specific tab's content script.
 */
export function sendToTab<T = any, R = any>(tabId: number, message: ExtensionMessage<T>): Promise<R> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(response);
      }
    });
  });
}

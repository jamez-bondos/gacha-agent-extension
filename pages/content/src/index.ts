/**
 * Content Script Main Entry Point
 * 
 * This is the refactored entry point for the GachaAgent content script.
 * Previously a single 1046-line file, it's now modularized for better maintainability.
 */

import 'webextension-polyfill';
import { initGachaAgent } from './initialization';

/**
 * Initialize the content script when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGachaAgent);
} else {
  initGachaAgent();
}

console.log('GachaAgent Content Script Loaded (Modularized Version).');

/**
 * Re-export key functions for backward compatibility
 */
export { toggleUI, applyModeChange } from './dom-operations';
export { executeTaskOnPage, currentExecutingTask } from './task-executor';
export { MessageBridge } from './message-bridge';
export { initGachaAgent, getMessageBridge } from './initialization';

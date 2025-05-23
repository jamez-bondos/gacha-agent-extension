/**
 * Constants used throughout the content script
 */

// UI Element IDs
export const GACHA_AGENT_SR_UI_ROOT_ID = 'gacha-agent-sr-ui-root';
export const GACHA_AGENT_SR_TRIGGER_BUTTON_ID = 'gacha-agent-sr-trigger-button';

// UI Constants
export const SIDEBAR_WIDTH = '400px';
export const EMBEDDED_BODY_CLASS = 'gacha-agent-sr-embedded-active';

// DOM Selectors
export const SR_PROMPT_TEXTAREA_SELECTOR = 'textarea[placeholder*="Describe your image"]';

// Reconnection Settings
export const MAX_RECONNECT_ATTEMPTS = 3;
export const HEARTBEAT_VISIBLE_INTERVAL = 30000; // 30 seconds when tab is visible
export const HEARTBEAT_HIDDEN_INTERVAL = 60000;  // 60 seconds when tab is hidden
export const CONNECTION_CHECK_TIMEOUT = 5000;    // 5 seconds timeout for ping

// DOM Operation Settings
export const DOM_RETRY_ATTEMPTS = 20;
export const DOM_RETRY_INTERVAL = 500; // milliseconds

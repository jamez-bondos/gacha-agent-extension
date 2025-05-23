/**
 * Initialization logic for content script
 */

import type { CSReadyPayload } from '@extension/shared/lib/types';
import { BackgroundUpdateFromContent } from '@extension/shared/lib/types';
import { MessageBridge } from './message-bridge';
import { injectFetchHook, initializeSidebarMode } from './utils';
import { injectGachaAgentUIStyles, injectGachaAgentUIHost } from './ui-styles';
import { setupTaskSubmissionListener, setupTaskStatusUpdateListener } from './event-listeners';
import { setSidebarMode } from './dom-operations';

/**
 * Global state for initialization
 */
let gachaAgentSRInitialized = false;
let messageBridge: MessageBridge | null = null;

/**
 * Main initialization function
 */
export async function initGachaAgent(): Promise<void> {
  if (gachaAgentSRInitialized) {
    // Re-initialization detected, rebuild MessageBridge
    if (messageBridge) {
      messageBridge.destroy();
    }
    messageBridge = new MessageBridge();
    console.log('[Initialization] Re-initialization detected, MessageBridge rebuilt');
    return;
  }
  
  gachaAgentSRInitialized = true;

  try {
    // Initialize sidebar mode from storage
    const mode = await initializeSidebarMode();
    setSidebarMode(mode);

    // Inject necessary scripts and styles
    injectFetchHook();
    injectGachaAgentUIStyles();
    injectGachaAgentUIHost();

    // Setup event listeners
    setupTaskSubmissionListener();
    setupTaskStatusUpdateListener();

    // Initialize MessageBridge
    messageBridge = new MessageBridge();
    console.log('[Initialization] MessageBridge initialized');

    // Notify background script that content script is ready
    const readyMessagePayload: CSReadyPayload = { soraPageUrl: window.location.href };
    chrome.runtime
      .sendMessage({
        type: BackgroundUpdateFromContent.BG_CS_READY,
        payload: readyMessagePayload,
      })
      .then(response => {
        console.log('[Initialization] BG_CS_READY message sent. Response:', response);
      })
      .catch(error => {
        console.error('[Initialization] Error sending BG_CS_READY message:', error);
      });

    console.log('[Initialization] GachaAgent initialization complete');
  } catch (error) {
    console.error('[Initialization] Error during GachaAgent initialization:', error);
  }
}

/**
 * Get MessageBridge instance
 */
export function getMessageBridge(): MessageBridge | null {
  return messageBridge;
}

/**
 * Check if already initialized
 */
export function isInitialized(): boolean {
  return gachaAgentSRInitialized;
}

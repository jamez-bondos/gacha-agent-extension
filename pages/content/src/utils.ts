/**
 * Utility functions for content script
 */

import type { TaskStatus } from '@extension/shared/lib/types';
import { appSettingsStorage } from '../../content-ui/src/lib/storage';

/**
 * Maps Sora platform status to internal task status
 */
export function mapSoraStatusToTaskStatus(soraStatus?: string): TaskStatus | null {
  if (!soraStatus) return null;
  const status = soraStatus.toLowerCase();
  if (status.includes('succeeded') || status.includes('completed')) return 'SUCCEEDED';
  if (status.includes('failed') || status.includes('error')) return 'FAILED';
  if (
    status.includes('processing') ||
    status.includes('generating') ||
    status.includes('pending_processing') ||
    status.includes('running')
  )
    return 'IN_PROGRESS';
  if (status.includes('pending_submission') || status.includes('queued')) return 'SUBMITTING_TO_PAGE';
  if (status.includes('pending')) return 'PENDING';
  return null;
}

/**
 * Initialize sidebar mode from storage
 */
export async function initializeSidebarMode(): Promise<'floating' | 'embedded'> {
  try {
    const mode = await appSettingsStorage.getSidebarMode();
    console.log(`[Utils] Initial sidebar mode loaded from storage: ${mode}`);
    return mode;
  } catch (error) {
    console.error('[Utils] Error loading initial sidebar mode:', error);
    return 'floating'; // Fallback
  }
}

/**
 * Inject fetch-hook.js into the main page context
 */
export function injectFetchHook(): void {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/fetch-hook.js');
    (document.head || document.documentElement).appendChild(script);
    console.log("[Utils] fetch-hook.js injected.");
    script.onload = () => script.remove();
  } catch (e) {
    console.error("[Utils] Error injecting fetch-hook.js:", e);
  }
}

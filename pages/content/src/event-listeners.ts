/**
 * Event listeners setup for content script
 */

import type { TaskSubmittedToSoraPayload, TaskStatusUpdatePayload } from '@extension/shared/lib/types';
import { BackgroundUpdateFromContent } from '@extension/shared/lib/types';
import { currentExecutingTask } from './task-executor';
import { mapSoraStatusToTaskStatus } from './utils';
import { toggleUI } from './dom-operations';

/**
 * Setup Sora task submission event listener
 */
export function setupTaskSubmissionListener(): void {
  document.addEventListener('soraTaskSubmittedToPlatform', (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && currentExecutingTask) {
      const { soraId, submittedAt } = customEvent.detail;
      console.log(
        `[EventListeners] Received soraTaskSubmittedToPlatform: soraId=${soraId}, for internalTaskId=${currentExecutingTask.id}`,
      );

      const payload: TaskSubmittedToSoraPayload = {
        internalTaskId: currentExecutingTask.id,
        soraId: soraId,
        submittedAt: submittedAt || Date.now(),
      };
      chrome.runtime
        .sendMessage({
          type: BackgroundUpdateFromContent.TASK_SUBMITTED_TO_SR,
          payload: payload,
        })
        .catch(e => console.error('[EventListeners] Error sending TASK_SUBMITTED_TO_SR:', e));

      // Update currentExecutingTask with soraId locally
      if (currentExecutingTask) {
        currentExecutingTask.soraId = soraId;
        currentExecutingTask.status = 'IN_PROGRESS';
        currentExecutingTask.updatedAt = Date.now();
      }
    } else {
      console.warn(
        '[EventListeners] soraTaskSubmittedToPlatform event received but no currentExecutingTask or no detail.',
        customEvent.detail,
      );
    }
  });
}

/**
 * Setup Sora task status update event listener
 */
export function setupTaskStatusUpdateListener(): void {
  document.addEventListener('soraTaskStatusUpdate', (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.tasks) {
      const taskUpdates = customEvent.detail.tasks as any[];
      console.log(`[EventListeners] Received soraTaskStatusUpdate, ${taskUpdates.length} tasks`);

      taskUpdates.forEach(update => {
        const soraPlatformId = update.id;
        if (!soraPlatformId) {
          console.warn('[EventListeners] Task update from hook missing soraId:', update);
          return;
        }

        const newStatusMapped = mapSoraStatusToTaskStatus(update.status);
        if (!newStatusMapped) {
          console.warn(`[EventListeners] Could not map Sora status: '${update.status}' for soraId ${soraPlatformId}`);
          return;
        }

        const payload: TaskStatusUpdatePayload = {
          soraId: soraPlatformId,
          status: newStatusMapped,
          progress: update.progress_pct,
          resultUrl:
            newStatusMapped === 'SUCCEEDED' && update.generations && update.generations[0] && update.generations[0].url
              ? update.generations[0].url
              : undefined,
          error:
            update.failure_reason ||
            (newStatusMapped === 'FAILED' && !update.failure_reason ? 'Unknown error from Sora' : undefined),
        };

        chrome.runtime
          .sendMessage({
            type: BackgroundUpdateFromContent.TASK_STATUS_UPDATE,
            payload: payload,
          })
          .catch(e =>
            console.error(`[EventListeners] Error sending TASK_STATUS_UPDATE for soraId ${soraPlatformId}:`, e),
          );
      });
    }
  });
}

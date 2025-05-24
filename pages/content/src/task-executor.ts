/**
 * Task execution logic for performing actions on Sora webpage
 */

import type { 
  ImageGenTask, 
  PageInteractionFailedPayload 
} from '@extension/shared/lib/types';
import { BackgroundUpdateFromContent } from '@extension/shared/lib/types';
import { DOMManipulator } from './dom-manipulator';

/**
 * Current task being executed (shared state)
 */
export let currentExecutingTask: ImageGenTask | null = null;

/**
 * Update the current executing task
 */
export function setCurrentExecutingTask(task: ImageGenTask | null): void {
  currentExecutingTask = task;
}

/**
 * Execute a task on the Sora webpage
 */
export async function executeTaskOnPage(task: ImageGenTask): Promise<void> {
  console.log("[TaskExecutor] Attempting to execute task on page:", task.id, task.prompt);
  
  setCurrentExecutingTask(task);
  
  try {
    // Dispatch custom event to set task details
    document.dispatchEvent(new CustomEvent('gachaAgentSRSetTaskDetails', {
      detail: { 
        ratio: task.aspectRatio,
        // quantity: task.imageQuantity 
      }
    }));
    console.log("[TaskExecutor] Dispatching gachaAgentSRSetTaskDetails event:", {
      ratio: task.aspectRatio,
      // quantity: task.imageQuantity
    });

    // Perform DOM manipulations
    if (!(await DOMManipulator.fillPrompt(task.prompt))) {
      throw new Error("Failed to fill prompt textarea.");
    }

    const sendButton = await DOMManipulator.clickSendButton();
    if (!sendButton) {
      throw new Error("Failed to find or click send button.");
    }
    
    console.log("[TaskExecutor] Task DOM actions completed for task:", task.id);
  } catch (error: any) {
    console.error("[TaskExecutor] Error executing task on page:", task.id, error.message);
    
    const failurePayload: PageInteractionFailedPayload = {
      internalTaskId: task.id,
      error: error.message || "Unknown error during page interaction.",
    };
    
    chrome.runtime.sendMessage({
      type: BackgroundUpdateFromContent.PAGE_INTERACTION_FAILED,
      payload: failurePayload
    }).catch(e => console.error("[TaskExecutor] Error sending PAGE_INTERACTION_FAILED:", e));
    
    setCurrentExecutingTask(null);
  }
}
/**
 * Clear task details in fetch hook (called when entire batch completes or stops)
 */
export function clearTaskDetails(): void {
  document.dispatchEvent(new CustomEvent('gachaAgentSRClearTaskDetails'));
  console.log("[TaskExecutor] Cleared task details - batch processing ended");
}

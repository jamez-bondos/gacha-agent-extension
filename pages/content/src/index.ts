import 'webextension-polyfill';

import {
  ContentScriptActionType,
  BackgroundUpdateFromContent,
  BackgroundToAppMessageType as UIMessageType,
} from '@extension/shared/lib/types';

import type {
  ImageGenTask,
  ExecuteTaskPayload,
  ContentScriptMessageFromBackground,
  TaskSubmittedToSoraPayload,
  TaskStatusUpdatePayload,
  PageInteractionFailedPayload,
  CSReadyPayload,
  BackgroundMessageToApp as UIMessage,
  AppState,
  ApplySidebarModePayload,
  TaskStatus,
} from '@extension/shared/lib/types';
import { appSettingsStorage } from '../../content-ui/src/lib/storage';


let currentExecutingTask: ImageGenTask | null = null;
let gachaAgentSRInitialized = false;
const GACHA_AGENT_SR_UI_ROOT_ID = 'gacha-agent-sr-ui-root';
const GACHA_AGENT_SR_TRIGGER_BUTTON_ID = 'gacha-agent-sr-trigger-button';

const SIDEBAR_WIDTH = '400px';
let sidebarMode: 'floating' | 'embedded' = 'floating'; // Will be updated from storage
const EMBEDDED_BODY_CLASS = 'gacha-agent-sr-embedded-active';

// --- DOM Element Getters/Creators ---
function getGachaAgentUIRootElement(): HTMLElement | null {
  return document.getElementById(GACHA_AGENT_SR_UI_ROOT_ID);
}

function createGachaAgentUIRoot(): HTMLElement {
  let uiRoot = getGachaAgentUIRootElement(); 
  if (!uiRoot) {
    uiRoot = document.createElement('div');
    uiRoot.id = GACHA_AGENT_SR_UI_ROOT_ID;
    document.body.appendChild(uiRoot);
  }
  return uiRoot;
}

function getGachaAgentTriggerButtonElement(): HTMLElement | null {
  return document.getElementById(GACHA_AGENT_SR_TRIGGER_BUTTON_ID);
}

function createGachaAgentTriggerButton(): HTMLElement {
  let triggerButton = getGachaAgentTriggerButtonElement(); 
  if (!triggerButton) {
    triggerButton = document.createElement('div');
    triggerButton.id = GACHA_AGENT_SR_TRIGGER_BUTTON_ID;

    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icon-128.png');
    iconImg.alt = 'GachaAgent';

    triggerButton.appendChild(iconImg);
    document.body.appendChild(triggerButton);
  }
  return triggerButton;
}

function setPageEmbeddedState(isEmbedded: boolean) {
  const bodyEl = document.body;
  if (isEmbedded) {
      if (!bodyEl.classList.contains(EMBEDDED_BODY_CLASS)) {
          bodyEl.classList.add(EMBEDDED_BODY_CLASS);
          console.log(`[Content Script] Added class "${EMBEDDED_BODY_CLASS}" to body.`);
      }
  } else {
      if (bodyEl.classList.contains(EMBEDDED_BODY_CLASS)) {
          bodyEl.classList.remove(EMBEDDED_BODY_CLASS);
          console.log(`[Content Script] Removed class "${EMBEDDED_BODY_CLASS}" from body.`);
      }
  }
}

function toggleUI() {
  const uiRoot = getGachaAgentUIRootElement();
  if (!uiRoot) {
    console.error("[Content Script toggleUI] UI Root not found. Cannot toggle UI.");
    return;
  }

  const triggerButton = getGachaAgentTriggerButtonElement();
  const isCurrentlyVisible = uiRoot.classList.contains('visible');

  console.log(`[Content Script toggleUI] Called. Current mode: ${sidebarMode}, UI is currently ${isCurrentlyVisible ? 'visible' : 'hidden'}. Action: ${isCurrentlyVisible ? 'HIDE' : 'SHOW'}`);

  if (isCurrentlyVisible) {
    // HIDE UI
    uiRoot.classList.remove('visible');
    if (triggerButton) triggerButton.classList.remove('ui-visible');

    if (sidebarMode === 'embedded') {
      setPageEmbeddedState(false); // 移除body class
    }
    console.log(`[Content Script toggleUI - HIDE] GachaAgent UI host hidden.`);
  } else {
    // SHOW UI
    uiRoot.classList.add('visible');
    if (triggerButton) triggerButton.classList.add('ui-visible');

    if (sidebarMode === 'embedded') {
      setPageEmbeddedState(true); // 添加body class
    }
    console.log(`[Content Script toggleUI - SHOW] GachaAgent UI host shown.`);
  }
}

function injectGachaAgentUIHost() {
  const uiHostElement = createGachaAgentUIRoot();
  const triggerButtonElement = createGachaAgentTriggerButton();

  if (triggerButtonElement && !triggerButtonElement.dataset.listenerAttached) {
    triggerButtonElement.addEventListener('click', () => {
      toggleUI();
    });
    triggerButtonElement.dataset.listenerAttached = 'true';
  }

  console.log('[Content Script] GachaAgent UI host and trigger button injected.');
}


function injectGachaAgentUIStyles() {
  const styleId = 'gacha-agent-sr-styles';
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    #${GACHA_AGENT_SR_TRIGGER_BUTTON_ID} {
      position: fixed;
      top: 150px;
      right: 0px;
      width: 40px;
      height: 40px;
      background-color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483646;
      border-radius: 8px 0 0 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      transition: all 0.2s ease-in-out;
      opacity: 1;
      border: 1px solid #e5e7eb;
      border-right: none;
    }

    #${GACHA_AGENT_SR_TRIGGER_BUTTON_ID}:hover {
      background-color: #3b82f6;
      transform: translateX(-2px);
      border-color: #3b82f6;
    }

    #${GACHA_AGENT_SR_TRIGGER_BUTTON_ID} img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }

    #${GACHA_AGENT_SR_TRIGGER_BUTTON_ID}.ui-visible {
      opacity: 0;
      pointer-events: none;
    }

    #${GACHA_AGENT_SR_UI_ROOT_ID} {
      position: fixed;
      top: 0px;
      right: 0px;
      width: ${SIDEBAR_WIDTH};
      height: 100vh;
      background-color: #f8f9fa; /* Light grey background, or transparent if content-ui handles it */
      z-index: 2147483647; /* Max z-index */
      box-shadow: -5px 0px 15px rgba(0,0,0,0.1);
      transform: translateX(100%); /* Initially hidden off-screen to the right */
      transition: transform 0.3s ease-in-out;
      overflow-y: auto;
      /* Add any other default styles for the root UI container if needed */
    }

    #${GACHA_AGENT_SR_UI_ROOT_ID}.visible {
      transform: translateX(0%); /* Slide in from the right */
    }

    /* === CSS RULES FOR EMBEDDED MODE === */
    .${EMBEDDED_BODY_CLASS} > main.max-h-screen > div.w-full > div.w-full,
    .${EMBEDDED_BODY_CLASS} > main.max-h-screen > div.w-full > div.w-full > div.w-full {
      width: calc(100% - 300px) !important;
    }

    .${EMBEDDED_BODY_CLASS} > main.max-h-screen > div.w-full > div.fixed,
    .${EMBEDDED_BODY_CLASS} > main.max-h-screen > div.w-full > div.fixed  > div.fixed {
      width: calc(100% - 400px) !important;
    }
  `;
  document.head.appendChild(style);
  console.log('[Content Script] GachaAgent UI styles injected.');
}

const SR_PROMPT_TEXTAREA_SELECTOR =
  'textarea[placeholder*="Describe your image"]';

const DOMManipulator = {
  async getElement(
    selector: string,
    retries = 20,
    intervalMs = 500,
    context: Document | Element = document,
  ): Promise<Element | null> {
    return new Promise(resolve => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const element = context.querySelector(selector);
        if (element) {
          clearInterval(interval);
          resolve(element);
        } else if (attempts >= retries) {
          clearInterval(interval);
          console.error(`[DOMManipulator] Element not found after ${retries} retries: ${selector}`);
          resolve(null);
        }
      }, intervalMs);
    });
  },
  async getAllElements(selector: string, context: Document | Element = document): Promise<Element[]> {
    return Array.from(context.querySelectorAll(selector));
  },
  async getPromptTextarea(): Promise<HTMLTextAreaElement | null> {
    return (await this.getElement(SR_PROMPT_TEXTAREA_SELECTOR)) as HTMLTextAreaElement | null;
  },
  async getSendButton(): Promise<HTMLButtonElement | null> {
    const allButtons = await this.getAllElements('button');
    for (const btn of allButtons) {
      if (btn.getAttribute('aria-label')?.match(/send|create|generate|submit/i)) return btn as HTMLButtonElement;
      const btnText = btn.textContent?.trim().toLowerCase();
      if (btnText?.match(/create|generate|send/i)) return btn as HTMLButtonElement;
      if (btn.querySelector('svg path[d*="M3.478"]')) return btn as HTMLButtonElement;
      const srOnlySpan = btn.querySelector('span.sr-only');
      if (srOnlySpan && srOnlySpan.textContent?.trim().toLowerCase() === 'create image')
        return btn as HTMLButtonElement;
    }
    console.error('[DOMManipulator] Send button (Create image) not found.');
    return null;
  },
  async fillPrompt(promptText: string): Promise<boolean> {
    const textarea = await this.getPromptTextarea();
    if (!textarea) return false;
    textarea.value = promptText;
    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    return true;
  },
  async clickSendButton(): Promise<HTMLButtonElement | null> {
    const button = await this.getSendButton();
    if (!button) return null;
    button.click();
    console.log('[DOMManipulator] Clicked send button.');
    return button;
  },
};

async function executeTaskOnPage(task: ImageGenTask) {
  console.log("[Content Script] Attempting to execute task on page:", task.id, task.prompt);
  try {
    document.dispatchEvent(new CustomEvent('gachaAgentSRSetTaskDetails', {
      detail: { 
        ratio: task.aspectRatio,
        // quantity: task.imageQuantity 
      }
    }));
    console.log("[Content Script] Dispatching gachaAgentSRSetTaskDetails event:", {
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
    
    console.log("[Content Script] Task DOM actions completed for task:", task.id);
  } catch (error: any) {
    console.error("[Content Script] Error executing task on page:", task.id, error.message);
    const failurePayload: PageInteractionFailedPayload = {
      internalTaskId: task.id,
      error: error.message || "Unknown error during page interaction.",
    };
    chrome.runtime.sendMessage({
      type: BackgroundUpdateFromContent.PAGE_INTERACTION_FAILED,
      payload: failurePayload
    }).catch(e => console.error("[Content Script] Error sending PAGE_INTERACTION_FAILED:", e));
    currentExecutingTask = null;
  }
}

// --- Inject fetch-hook.js into the main page context ---
function injectFetchHook() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/fetch-hook.js');
    (document.head || document.documentElement).appendChild(script);
    console.log("[Content Script] fetch-hook.js injected.");
    script.onload = () => script.remove();
  } catch (e) {
    console.error("[Content Script] Error injecting fetch-hook.js:", e);
  }
}


function mapSoraStatusToTaskStatus(soraStatus?: string): TaskStatus | null {
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


async function initializeSidebarMode() {
  try {
      const mode = await appSettingsStorage.getSidebarMode();
      sidebarMode = mode;
      console.log(`[Content Script initializeSidebarMode] Initial sidebar mode loaded from storage: ${sidebarMode}`);
  } catch (error) {
      console.error('[Content Script initializeSidebarMode] Error loading initial sidebar mode:', error);
      sidebarMode = 'floating'; // Fallback
  }
}

function applyModeChange(newMode: 'floating' | 'embedded') {
  const uiRoot = getGachaAgentUIRootElement();
  if (!uiRoot) {
      console.error("[Content Script applyModeChange] UI Root not found.");
      return;
  }

  const isCurrentlyVisible = uiRoot.classList.contains('visible');
  console.log(`[Content Script applyModeChange] Current actual mode: ${sidebarMode}, Requested new mode: ${newMode}, UI currently visible: ${isCurrentlyVisible}`);

  if (sidebarMode === newMode && isCurrentlyVisible) {
      console.log(`[Content Script applyModeChange] Mode (${newMode}) already active and visible. No change.`);
      return;
  }
   if (sidebarMode === newMode && !isCurrentlyVisible){
      sidebarMode = newMode; // Ensure mode variable is up-to-date
      console.log(`[Content Script applyModeChange] Mode (${newMode}) already set, UI hidden. Will apply on toggle.`);
      return;
  }


  if (isCurrentlyVisible) {
      console.log(`[Content Script applyModeChange] UI is visible. Changing from ${sidebarMode} to ${newMode}.`);
      sidebarMode = newMode;
      if (sidebarMode === 'embedded') {
        setPageEmbeddedState(true); // Add body class for new mode
      } else {
        setPageEmbeddedState(false); // Remove body class for old mode
      }
  } else {
      const oldMode = sidebarMode;
      sidebarMode = newMode;
      console.log(`[Content Script applyModeChange] UI is hidden. sidebarMode variable updated from ${oldMode} to: ${sidebarMode}`);
      if (oldMode === 'embedded' && newMode === 'floating') { // Ensure cleanup if switching from embedded to floating while hidden
          setPageEmbeddedState(false);
      }
  }
}


// --- Initialization ---
function initGachaAgent() {
  if (gachaAgentSRInitialized) return;
  gachaAgentSRInitialized = true;

  initializeSidebarMode().then(() => {
    injectFetchHook();
    injectGachaAgentUIStyles();
    injectGachaAgentUIHost();

    const readyMessagePayload: CSReadyPayload = { soraPageUrl: window.location.href };
    chrome.runtime
      .sendMessage({
        type: BackgroundUpdateFromContent.BG_CS_READY,
        payload: readyMessagePayload,
      })
      .then(response => {
        console.log('[Content Script] BG_CS_READY message sent. Response:', response);
      })
      .catch(error => {
        console.error('[Content Script] Error sending BG_CS_READY message:', error);
      });
  });

  // Listener for messages from background script
  chrome.runtime.onMessage.addListener(
    (message: ContentScriptMessageFromBackground | UIMessage, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return;
      if (message.type === ContentScriptActionType.EXECUTE_TASK) {
        const taskPayload = (
          message as Extract<ContentScriptMessageFromBackground, { type: ContentScriptActionType.EXECUTE_TASK }>
        ).payload;
        console.log('[Content Script] Received EXECUTE_TASK:', taskPayload.task.id);
        currentExecutingTask = taskPayload.task;
        executeTaskOnPage(taskPayload.task);
      } else if (message.type === ContentScriptActionType.APPLY_SIDEBAR_MODE) {
        const modePayload = (
          message as Extract<ContentScriptMessageFromBackground, { type: ContentScriptActionType.APPLY_SIDEBAR_MODE }>
        ).payload;
        console.log('[Content Script] Received APPLY_SIDEBAR_MODE:', modePayload.mode);
        applyModeChange(modePayload.mode);
        sendResponse({
            status: 'content_script_mode_change_processed',
            newModeApplied: sidebarMode
        });
        return true; // Crucial: Indicate that sendResponse will be called (it was, synchronously)
      } else if (message.type === UIMessageType.APP_STATE_UPDATE) {
        const specificMessage = message as Extract<UIMessage, { type: UIMessageType.APP_STATE_UPDATE }>;
        const appStatePayload = specificMessage.payload;
        console.log('[Content Script] Received APP_STATE_UPDATE from background. Status:', appStatePayload.appStatus);
      } else {
        console.warn('[Content Script] Unhandled message received:', message);
      }
      return false;
    },
  );

  // Listener for custom events from fetch-hook.js
  document.addEventListener('soraTaskSubmittedToPlatform', (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && currentExecutingTask) {
      const { soraId, submittedAt } = customEvent.detail;
      console.log(
        `[Content Script] Received soraTaskSubmittedToPlatform: soraId=${soraId}, for internalTaskId=${currentExecutingTask.id}`,
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
        .catch(e => console.error('[Content Script] Error sending TASK_SUBMITTED_TO_SR:', e));

      // Update currentExecutingTask with soraId locally
      currentExecutingTask.soraId = soraId;
      currentExecutingTask.status = 'IN_PROGRESS';
      currentExecutingTask.updatedAt = Date.now();
    } else {
      console.warn(
        '[Content Script] soraTaskSubmittedToPlatform event received but no currentExecutingTask or no detail.',
        customEvent.detail,
      );
    }
  });

  document.addEventListener('soraTaskStatusUpdate', (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.tasks) {
      const taskUpdates = customEvent.detail.tasks as any[]; // tasks from fetch-hook
      console.log(`[Content Script] Received soraTaskStatusUpdate, ${taskUpdates.length} tasks`);

      taskUpdates.forEach(update => {
        const soraPlatformId = update.id; // This is the soraId
        if (!soraPlatformId) {
          console.warn('[Content Script] Task update from hook missing soraId:', update);
          return;
        }

        const newStatusMapped = mapSoraStatusToTaskStatus(update.status);
        if (!newStatusMapped) {
          console.warn(`[Content Script] Could not map Sora status: '${update.status}' for soraId ${soraPlatformId}`);
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
            console.error(`[Content Script] Error sending TASK_STATUS_UPDATE for soraId ${soraPlatformId}:`, e),
          );
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGachaAgent);
} else {
  initGachaAgent();
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'GACHA_AGENT_SR_TOGGLE_UI') {
    toggleUI();
  }
});

console.log('GachaAgent Content Script Loaded.');
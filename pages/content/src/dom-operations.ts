/**
 * DOM operations and UI control functions
 */

import { 
  GACHA_AGENT_SR_UI_ROOT_ID,
  GACHA_AGENT_SR_TRIGGER_BUTTON_ID,
  SIDEBAR_WIDTH,
  EMBEDDED_BODY_CLASS 
} from './constants';

/**
 * Current sidebar mode (shared state)
 */
export let sidebarMode: 'floating' | 'embedded' = 'floating';

/**
 * Update the sidebar mode
 */
export function setSidebarMode(mode: 'floating' | 'embedded'): void {
  sidebarMode = mode;
}

/**
 * Get the main UI root element
 */
export function getGachaAgentUIRootElement(): HTMLElement | null {
  return document.getElementById(GACHA_AGENT_SR_UI_ROOT_ID);
}

/**
 * Create the main UI root element
 */
export function createGachaAgentUIRoot(): HTMLElement {
  let uiRoot = getGachaAgentUIRootElement(); 
  if (!uiRoot) {
    uiRoot = document.createElement('div');
    uiRoot.id = GACHA_AGENT_SR_UI_ROOT_ID;
    document.body.appendChild(uiRoot);
  }
  return uiRoot;
}

/**
 * Get the trigger button element
 */
export function getGachaAgentTriggerButtonElement(): HTMLElement | null {
  return document.getElementById(GACHA_AGENT_SR_TRIGGER_BUTTON_ID);
}

/**
 * Create the trigger button element
 */
export function createGachaAgentTriggerButton(): HTMLElement {
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

/**
 * Set the page embedded state
 */
export function setPageEmbeddedState(isEmbedded: boolean): void {
  const bodyEl = document.body;
  if (isEmbedded) {
      if (!bodyEl.classList.contains(EMBEDDED_BODY_CLASS)) {
          bodyEl.classList.add(EMBEDDED_BODY_CLASS);
          console.log(`[DOMOperations] Added class "${EMBEDDED_BODY_CLASS}" to body.`);
      }
  } else {
      if (bodyEl.classList.contains(EMBEDDED_BODY_CLASS)) {
          bodyEl.classList.remove(EMBEDDED_BODY_CLASS);
          console.log(`[DOMOperations] Removed class "${EMBEDDED_BODY_CLASS}" from body.`);
      }
  }
}

/**
 * Toggle UI visibility
 */
export function toggleUI(): void {
  const uiRoot = getGachaAgentUIRootElement();
  if (!uiRoot) {
    console.error("[DOMOperations toggleUI] UI Root not found. Cannot toggle UI.");
    return;
  }

  const triggerButton = getGachaAgentTriggerButtonElement();
  const isCurrentlyVisible = uiRoot.classList.contains('visible');

  console.log(`[DOMOperations toggleUI] Called. Current mode: ${sidebarMode}, UI is currently ${isCurrentlyVisible ? 'visible' : 'hidden'}. Action: ${isCurrentlyVisible ? 'HIDE' : 'SHOW'}`);

  if (isCurrentlyVisible) {
    // HIDE UI
    uiRoot.classList.remove('visible');
    if (triggerButton) triggerButton.classList.remove('ui-visible');

    if (sidebarMode === 'embedded') {
      setPageEmbeddedState(false); // Remove body class
    }
    console.log(`[DOMOperations toggleUI - HIDE] GachaAgent UI host hidden.`);
  } else {
    // SHOW UI
    uiRoot.classList.add('visible');
    if (triggerButton) triggerButton.classList.add('ui-visible');

    if (sidebarMode === 'embedded') {
      setPageEmbeddedState(true); // Add body class
    }
    console.log(`[DOMOperations toggleUI - SHOW] GachaAgent UI host shown.`);
  }
}

/**
 * Apply sidebar mode change
 */
export function applyModeChange(newMode: 'floating' | 'embedded'): void {
  const uiRoot = getGachaAgentUIRootElement();
  if (!uiRoot) {
      console.error("[DOMOperations applyModeChange] UI Root not found.");
      return;
  }

  const isCurrentlyVisible = uiRoot.classList.contains('visible');
  console.log(`[DOMOperations applyModeChange] Current actual mode: ${sidebarMode}, Requested new mode: ${newMode}, UI currently visible: ${isCurrentlyVisible}`);

  if (sidebarMode === newMode && isCurrentlyVisible) {
      console.log(`[DOMOperations applyModeChange] Mode (${newMode}) already active and visible. No change.`);
      return;
  }
   if (sidebarMode === newMode && !isCurrentlyVisible){
      setSidebarMode(newMode); // Ensure mode variable is up-to-date
      console.log(`[DOMOperations applyModeChange] Mode (${newMode}) already set, UI hidden. Will apply on toggle.`);
      return;
  }

  if (isCurrentlyVisible) {
      console.log(`[DOMOperations applyModeChange] UI is visible. Changing from ${sidebarMode} to ${newMode}.`);
      setSidebarMode(newMode);
      if (sidebarMode === 'embedded') {
        setPageEmbeddedState(true); // Add body class for new mode
      } else {
        setPageEmbeddedState(false); // Remove body class for old mode
      }
  } else {
      const oldMode = sidebarMode;
      setSidebarMode(newMode);
      console.log(`[DOMOperations applyModeChange] UI is hidden. sidebarMode variable updated from ${oldMode} to: ${sidebarMode}`);
      if (oldMode === 'embedded' && newMode === 'floating') { // Ensure cleanup if switching from embedded to floating while hidden
          setPageEmbeddedState(false);
      }
  }
}

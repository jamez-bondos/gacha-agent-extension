/**
 * UI styles injection functions
 */

import { 
  GACHA_AGENT_SR_UI_ROOT_ID,
  GACHA_AGENT_SR_TRIGGER_BUTTON_ID,
  SIDEBAR_WIDTH,
  EMBEDDED_BODY_CLASS 
} from './constants';
import { createGachaAgentUIRoot, createGachaAgentTriggerButton } from './dom-operations';
import { toggleUI } from './dom-operations';

/**
 * Inject GachaAgent UI styles into the page
 */
export function injectGachaAgentUIStyles(): void {
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
      width: 48px;
      height: 48px;
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
      width: 32px;
      height: 32px;
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
      background-color: #f8f9fa;
      z-index: 2147483647;
      box-shadow: -5px 0px 15px rgba(0,0,0,0.1);
      transform: translateX(100%);
      transition: transform 0.3s ease-in-out;
      overflow-y: auto;
    }

    #${GACHA_AGENT_SR_UI_ROOT_ID}.visible {
      transform: translateX(0%);
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
  console.log('[UIStyles] GachaAgent UI styles injected.');
}

/**
 * Inject GachaAgent UI host elements and setup event listeners
 */
export function injectGachaAgentUIHost(): void {
  const uiHostElement = createGachaAgentUIRoot();
  const triggerButtonElement = createGachaAgentTriggerButton();

  if (triggerButtonElement && !triggerButtonElement.dataset.listenerAttached) {
    triggerButtonElement.addEventListener('click', () => {
      toggleUI();
    });
    triggerButtonElement.dataset.listenerAttached = 'true';
  }

  console.log('[UIStyles] GachaAgent UI host and trigger button injected.');
}

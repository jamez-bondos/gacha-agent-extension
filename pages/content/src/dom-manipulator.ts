/**
 * DOM Manipulation utilities for interacting with Sora webpage elements
 */

import { 
  SR_PROMPT_TEXTAREA_SELECTOR, 
  DOM_RETRY_ATTEMPTS, 
  DOM_RETRY_INTERVAL 
} from './constants';

export const DOMManipulator = {
  async getElement(
    selector: string,
    retries = DOM_RETRY_ATTEMPTS,
    intervalMs = DOM_RETRY_INTERVAL,
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
      if (btn.getAttribute('aria-label')?.match(/send|create|generate|submit/i)) return btn as HTMLButtonElement;      const btnText = btn.textContent?.trim().toLowerCase();
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

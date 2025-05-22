import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app'; // Using './app' consistent with content-ui structure

// Import CSS as strings for shadow DOM injection
// Vite's `?inline` feature imports the file content as a string.
// index.css should contain @tailwind directives and the import for @extension/ui/lib/global.css
// app.css is for any additional app-specific styles.
import indexCssString from './index.css?inline';
import appCssString from './app.css?inline';
import tailwindcssOutput from '../dist/tailwind-output.css?inline';

const GACHA_AGENT_SR_UI_ROOT_ID = 'gacha-agent-sr-ui-root';

function initContentUIInShadowDOM(uiHostElement: HTMLElement) {
  console.log('[Content UI] Host element found. Attaching Shadow DOM and rendering React app.');

  // Ensure shadow DOM is only attached once
  if (uiHostElement.shadowRoot) {
    console.log('[Content UI] Shadow DOM already attached. Skipping re-attachment.');
    // Potentially, re-render or update app here if needed on HMR or subsequent calls,
    // but for now, just ensure the app container exists and render into it.
    const appContainerInShadow = uiHostElement.shadowRoot.getElementById('app-container-in-shadow');
    if (appContainerInShadow) {
      ReactDOM.createRoot(appContainerInShadow).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
      );
    } else {
      console.error('[Content UI] App container not found in existing Shadow DOM.');
    }
    return;
  }

  const shadowRoot = uiHostElement.attachShadow({ mode: 'open' });

  // Create a style element for each CSS source to ensure proper processing
  const tailwindStyleElement = document.createElement('style');
  tailwindStyleElement.textContent = tailwindcssOutput;
  shadowRoot.appendChild(tailwindStyleElement);

  const indexStyleElement = document.createElement('style');
  indexStyleElement.textContent = indexCssString;
  shadowRoot.appendChild(indexStyleElement);

  const appStyleElement = document.createElement('style');
  appStyleElement.textContent = appCssString;
  shadowRoot.appendChild(appStyleElement);

  // Try to use adoptedStyleSheets when available (better performance)
  try {
    if ('adoptedStyleSheets' in shadowRoot && window.CSSStyleSheet) {
      const styleSheet = new CSSStyleSheet();
      const allCss = tailwindcssOutput + indexCssString + appCssString;
      styleSheet.replaceSync(allCss);
      // @ts-ignore - Firefox may not support this yet
      shadowRoot.adoptedStyleSheets = [styleSheet];
    }
  } catch (e) {
    console.warn('[Content UI] adoptedStyleSheets not supported, falling back to style elements:', e);
  }

  const appContainerInShadow = document.createElement('div');
  // Giving an ID for potential styling of the container or easier selection if needed.
  appContainerInShadow.id = 'app-container-in-shadow';
  appContainerInShadow.className = 'w-full h-full'; // Add Tailwind classes for full width/height
  shadowRoot.appendChild(appContainerInShadow);

  ReactDOM.createRoot(appContainerInShadow).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

function attemptInit() {
  const uiHostElement = document.getElementById(GACHA_AGENT_SR_UI_ROOT_ID);

  if (uiHostElement) {
    initContentUIInShadowDOM(uiHostElement);
    return true; // Successfully initialized or already initialized
  }

  // Retry logic adapted from main.tsx
  console.warn(`[Content UI] Host element #${GACHA_AGENT_SR_UI_ROOT_ID} not found. Retrying...`);
  let attempts = 0;
  const maxAttempts = 15;
  const retryInterval = 500;

  const intervalId = setInterval(() => {
    attempts++;
    const host = document.getElementById(GACHA_AGENT_SR_UI_ROOT_ID);
    if (host) {
      initContentUIInShadowDOM(host);
      clearInterval(intervalId);
      console.log('[Content UI] Host element found on retry. React app rendered in Shadow DOM.');
    } else if (attempts >= maxAttempts) {
      clearInterval(intervalId);
      console.error(
        `[Content UI] Host element #${GACHA_AGENT_SR_UI_ROOT_ID} not found after ${maxAttempts} attempts. UI will not load into Shadow DOM.`,
      );
    }
  }, retryInterval);
  return false; // Host not found initially
}

// Entry point logic from main.tsx
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  attemptInit();
} else {
  document.addEventListener('DOMContentLoaded', attemptInit, { once: true });
}

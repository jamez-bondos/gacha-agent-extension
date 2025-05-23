import { handleUrlChange, updateCurrentUrl, getCurrentUrlState } from './url-monitor';

/**
 * Setup URL monitoring with various detection methods
 */
export function setupUrlMonitoring(): void {
  console.log('[MessageBridge] Setting up URL monitoring...');
  
  const { url } = getCurrentUrlState();
  console.log(`[URL Monitor] Initial setup for URL: ${url}`);
  
  // Monitor browser navigation (back/forward)
  window.addEventListener('popstate', () => {
    const currentState = getCurrentUrlState();
    const newUrl = window.location.href;
    if (newUrl !== currentState.url) {
      handleUrlChange(newUrl, currentState.url);
      updateCurrentUrl(newUrl);
    }
  });
  
  // Intercept pushState and replaceState for SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(() => {
      const currentState = getCurrentUrlState();
      const newUrl = window.location.href;
      if (newUrl !== currentState.url) {
        handleUrlChange(newUrl, currentState.url);
        updateCurrentUrl(newUrl);
      }
    }, 0);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(() => {
      const currentState = getCurrentUrlState();
      const newUrl = window.location.href;
      if (newUrl !== currentState.url) {
        handleUrlChange(newUrl, currentState.url);
        updateCurrentUrl(newUrl);
      }
    }, 0);
  };  
  // Use MutationObserver as backup detection for SPA route changes
  const observer = new MutationObserver(() => {
    const currentState = getCurrentUrlState();
    const newUrl = window.location.href;
    if (newUrl !== currentState.url) {
      handleUrlChange(newUrl, currentState.url);
      updateCurrentUrl(newUrl);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('[MessageBridge] URL monitoring setup complete');
}

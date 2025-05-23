// URL monitoring module - focused on UI control only

// --- URL Monitoring Constants ---
const TARGET_URL_PATTERNS = [
  /^https:\/\/sora\.chatgpt\.com\/library\/?$/,           // exactly /library
  /^https:\/\/sora\.chatgpt\.com\/library\/.*$/,          // /library/* 
  /^https:\/\/sora\.chatgpt\.com\/explore\/?$/,           // exactly /explore
  /^https:\/\/sora\.chatgpt\.com\/explore\/.*$/,          // /explore/*
];

// --- URL Monitoring State ---
let currentUrl = window.location.href;
let isInTargetPages = false;
let lastVisibilityStateInTargetPages: boolean | null = null; // 记录在目标页面时的显示状态

/**
 * Get UI visibility state helper
 */
function getUIVisibilityState(): boolean {
  const uiRoot = document.getElementById('gacha-agent-sr-ui-root');
  return uiRoot ? uiRoot.classList.contains('visible') : false;
}

/**
 * Set UI visibility state helper
 */
function setUIVisibilityState(visible: boolean): void {
  const uiRoot = document.getElementById('gacha-agent-sr-ui-root');
  const triggerButton = document.getElementById('gacha-agent-sr-trigger-button');
  
  if (uiRoot) {
    if (visible) {
      uiRoot.classList.add('visible');
      if (triggerButton) triggerButton.classList.add('ui-visible');
    } else {
      uiRoot.classList.remove('visible');
      if (triggerButton) triggerButton.classList.remove('ui-visible');
    }
  }
}

/**
 * Check if current URL matches target patterns
 */
export function isUrlInTargetPages(url: string): boolean {
  return TARGET_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Handle URL change events
 */
export function handleUrlChange(newUrl: string, previousUrl: string): void {
  const wasInTarget = isUrlInTargetPages(previousUrl);
  const nowInTarget = isUrlInTargetPages(newUrl);
  
  if (wasInTarget !== nowInTarget) {
    console.log(`[URL Monitor] Navigation state changed: ${nowInTarget ? 'ENTERED' : 'LEFT'} target pages`);
    console.log(`[URL Monitor] Previous: ${previousUrl}`);
    console.log(`[URL Monitor] Current: ${newUrl}`);
    
    // Handle UI visibility based on page navigation
    if (wasInTarget && !nowInTarget) {
      // 离开目标页面：保存当前显示状态，然后隐藏UI
      lastVisibilityStateInTargetPages = getUIVisibilityState();
      setUIVisibilityState(false);
      console.log(`[URL Monitor] Left target pages - UI hidden (saved state: ${lastVisibilityStateInTargetPages})`);
      
    } else if (!wasInTarget && nowInTarget) {
      // 进入目标页面：恢复之前保存的显示状态
      if (lastVisibilityStateInTargetPages !== null) {
        setUIVisibilityState(lastVisibilityStateInTargetPages);
        console.log(`[URL Monitor] Entered target pages - UI restored to: ${lastVisibilityStateInTargetPages}`);
      } else {
        // 首次进入目标页面，保持默认隐藏状态
        console.log(`[URL Monitor] Entered target pages - keeping default hidden state`);
      }
    }
    
    isInTargetPages = nowInTarget;
  }
}

/**
 * Get current URL monitoring state
 */
export function getCurrentUrlState(): { url: string; isInTargetPages: boolean } {
  return {
    url: currentUrl,
    isInTargetPages
  };
}

/**
 * Update current URL state
 */
export function updateCurrentUrl(url: string): void {
  currentUrl = url;
}

/**
 * Initialize URL monitoring
 */
export function initializeUrlMonitoring(): void {
  console.log('[URL Monitor] Initializing URL monitoring...');
  
  // Initialize current state
  currentUrl = window.location.href;
  isInTargetPages = isUrlInTargetPages(currentUrl);
  console.log(`[URL Monitor] Initial state: ${isInTargetPages ? 'IN' : 'NOT IN'} target pages (${currentUrl})`);
}

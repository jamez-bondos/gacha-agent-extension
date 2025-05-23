/**
 * MessageBridge class for unified communication management
 */

import type {
  ContentUIMessage,
  ContentScriptMessage,
  ContentScriptMessageFromBackground,
  BackgroundMessageToApp as UIMessage,
  SendToBackgroundPayload,
} from '@extension/shared/lib/types';
import {
  ContentScriptActionType,
  BackgroundToAppMessageType as UIMessageType,
  ContentUIToContentScriptMessageType,
  ContentScriptToContentUIMessageType,
  UiToBackgroundMessageType,
} from '@extension/shared/lib/types';
import { executeTaskOnPage } from './task-executor';
import { applyModeChange } from './dom-operations';
import { 
  MAX_RECONNECT_ATTEMPTS,
  HEARTBEAT_VISIBLE_INTERVAL,
  HEARTBEAT_HIDDEN_INTERVAL,
  CONNECTION_CHECK_TIMEOUT 
} from './constants';
import { initializeUrlMonitoring, setupUrlMonitoring } from './url-monitoring';

/**
 * MessageBridge Class for unified communication
 */
export class MessageBridge {
  private backgroundListener: ((message: any, sender: any, sendResponse: any) => void) | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  private lastSuccessfulHeartbeat = Date.now();
  private consecutiveFailures = 0;
  private isTabVisible = !document.hidden;
  private lastVisibilityChange = Date.now();
  private isReconnecting = false;

  constructor() {
    console.log('[MessageBridge] Initializing MessageBridge...');
    this.setupBackgroundListener();
    this.setupWindowListener();
    this.setupVisibilityHandler();
    this.setupPageEventListeners();
    
    // Initialize URL monitoring
    initializeUrlMonitoring();
    setupUrlMonitoring();
    
    this.startHeartbeat();
    console.log('[MessageBridge] MessageBridge initialization complete');
  }

  // 设置Background消息监听
  private setupBackgroundListener() {
    // 移除旧监听器
    if (this.backgroundListener) {
      chrome.runtime.onMessage.removeListener(this.backgroundListener);
    }

    this.backgroundListener = (message: ContentScriptMessageFromBackground | UIMessage, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return;

      console.log('[MessageBridge] Received from Background:', message.type);

      // 处理原有的Content Script消息
      if (message.type === ContentScriptActionType.EXECUTE_TASK) {
        const taskPayload = (message as Extract<ContentScriptMessageFromBackground, { type: ContentScriptActionType.EXECUTE_TASK }>).payload;
        console.log('[Content Script] Received EXECUTE_TASK:', taskPayload.task.id);
        executeTaskOnPage(taskPayload.task);
        return false;
      }

      // 转发给Content UI的消息
      if (message.type === UIMessageType.APP_STATE_UPDATE) {
        this.forwardToContentUI({
          type: ContentScriptToContentUIMessageType.FROM_BACKGROUND,
          payload: { message }
        });
        return false;
      }

      // 处理APPLY_SIDEBAR_MODE（从Background来的直接命令）
      if (message.type === ContentScriptActionType.APPLY_SIDEBAR_MODE) {
        const modePayload = (message as Extract<ContentScriptMessageFromBackground, { type: ContentScriptActionType.APPLY_SIDEBAR_MODE }>).payload;
        console.log('[Content Script] Received APPLY_SIDEBAR_MODE:', modePayload.mode);
        applyModeChange(modePayload.mode);
        sendResponse({
            status: 'content_script_mode_change_processed',
            newModeApplied: modePayload.mode
        });
        return true;
      }

      // 处理PING消息
      if (message.type === 'PING') {
        sendResponse({ status: 'pong' });
        return true;
      }

      return false;
    };

    chrome.runtime.onMessage.addListener(this.backgroundListener);
    console.log('[MessageBridge] Background listener setup complete');
  }

  // 设置窗口消息监听（来自Content UI）
  private setupWindowListener() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      const data = event.data as { type: string; payload?: any };

      // 处理新的Content UI消息
      if (data.type === ContentUIToContentScriptMessageType.TOGGLE_UI ||
          data.type === ContentUIToContentScriptMessageType.SET_SIDEBAR_MODE ||
          data.type === ContentUIToContentScriptMessageType.SEND_TO_BACKGROUND) {
        this.handleContentUIMessage(data as ContentUIMessage);
      }
    });

    console.log('[MessageBridge] Window listener setup complete');
  }

  // 处理来自Content UI的消息
  private async handleContentUIMessage(message: ContentUIMessage) {
    console.log('[MessageBridge] Received from Content UI:', message.type);

    switch (message.type) {
      case ContentUIToContentScriptMessageType.TOGGLE_UI:
        // 使用延迟导入避免循环依赖
        setTimeout(() => {
          import('./dom-operations').then(({ toggleUI }) => {
            toggleUI();
          });
        }, 0);
        break;

      case ContentUIToContentScriptMessageType.SET_SIDEBAR_MODE:
        const { mode } = message.payload;
        applyModeChange(mode);
        this.forwardToContentUI({
          type: ContentScriptToContentUIMessageType.SIDEBAR_MODE_APPLIED,
          payload: { mode }
        });
        break;

      case ContentUIToContentScriptMessageType.SEND_TO_BACKGROUND:
        await this.forwardToBackground(message.payload);
        break;
    }
  }

  // 转发消息给Background
  private async forwardToBackground(payload: SendToBackgroundPayload) {
    const { message, requestId } = payload;

    try {
      console.log('[MessageBridge] Forwarding to Background:', message.type);
      const response = await chrome.runtime.sendMessage(message);

      // 如果Background有直接响应，转发回Content UI
      if (response && requestId) {
        this.forwardToContentUI({
          type: ContentScriptToContentUIMessageType.FROM_BACKGROUND,
          payload: { 
            message: { type: 'BACKGROUND_RESPONSE', payload: response },
            requestId 
          }
        });
      }

      this.reconnectAttempts = 0; // 成功时重置重连计数
    } catch (error: any) {
      console.error('[MessageBridge] Error forwarding to Background:', error);
      
      // 尝试重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`[MessageBridge] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        setTimeout(() => {
          this.rebuildConnection();
          // 重试发送消息
          this.forwardToBackground(payload);
        }, 1000 * this.reconnectAttempts);
      } else {
        // 通知Content UI通信错误
        this.forwardToContentUI({
          type: ContentScriptToContentUIMessageType.COMMUNICATION_ERROR,
          payload: {
            error: error.message || 'Failed to communicate with background',
            originalMessage: message,
            requestId
          }
        });
      }
    }
  }

  // 转发消息给Content UI
  private forwardToContentUI(message: ContentScriptMessage) {
    window.postMessage({
      type: 'GACHA_AGENT_FROM_CONTENT_SCRIPT',
      payload: message
    }, '*');
  }

  // 设置可见性变化处理（Tab切换检测）
  private setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isTabVisible;
      this.isTabVisible = !document.hidden;
      this.lastVisibilityChange = Date.now();

      if (!wasVisible && this.isTabVisible) {
        console.log('[MessageBridge] Tab activated, checking connection');
        this.handleTabActivation();
      } else if (wasVisible && !this.isTabVisible) {
        console.log('[MessageBridge] Tab hidden, adjusting heartbeat');
        this.adjustHeartbeatForVisibility();
      }
    });
  }

  // 设置页面事件监听器
  private setupPageEventListeners() {
    window.addEventListener('beforeunload', () => {
      console.log('[MessageBridge] Page unloading, cleaning up');
      this.destroy();
    });

    window.addEventListener('online', () => {
      console.log('[MessageBridge] Network back online, checking connection');
      this.consecutiveFailures = 0;
      this.checkConnection();
    });
  }

  // 处理Tab激活
  private async handleTabActivation() {
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const isConnected = await this.checkConnection();
      
      if (!isConnected) {
        console.log('[MessageBridge] Connection lost, rebuilding');
        await this.rebuildConnection();
      } else {
        console.log('[MessageBridge] Connection intact, syncing state');
        await this.syncState();
      }
      
      this.adjustHeartbeatForVisibility();
    } catch (error) {
      console.error('[MessageBridge] Error during tab activation:', error);
      await this.rebuildConnection();
    }
  }

  // 根据可见性调整心跳频率
  private adjustHeartbeatForVisibility() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    const heartbeatInterval = this.isTabVisible ? HEARTBEAT_VISIBLE_INTERVAL : HEARTBEAT_HIDDEN_INTERVAL;
    this.heartbeatInterval = setInterval(async () => {
      await this.performHeartbeat();
    }, heartbeatInterval);
  }

  // 检查连接状态
  private async checkConnection(): Promise<boolean> {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection check timeout')), CONNECTION_CHECK_TIMEOUT);
      });
      
      const pingPromise = chrome.runtime.sendMessage({ type: 'PING' });
      await Promise.race([pingPromise, timeoutPromise]);
      
      this.lastSuccessfulHeartbeat = Date.now();
      this.consecutiveFailures = 0;
      console.log('[MessageBridge] Heartbeat successful');
      return true;
    } catch (error: any) {
      this.consecutiveFailures++;
      console.warn(`[MessageBridge] Heartbeat failed (attempt ${this.consecutiveFailures}):`, error.message);
      return false;
    }
  }

  // 心跳检测
  private startHeartbeat() {
    console.log('[MessageBridge] Starting heartbeat mechanism');
    this.adjustHeartbeatForVisibility();
  }

  // 执行心跳检测
  private async performHeartbeat(): Promise<void> {
    const isConnected = await this.checkConnection();
    
    if (!isConnected) {
      if (this.consecutiveFailures === 1 || this.consecutiveFailures >= 2) {
        console.warn('[MessageBridge] Triggering connection rebuild');
        await this.rebuildConnection();
      }
    } else {
      if (this.reconnectAttempts > 0) {
        console.log('[MessageBridge] Connection restored');
        this.reconnectAttempts = 0;
      }
    }
  }

  // 重建连接
  private async rebuildConnection() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    try {
      if (this.backgroundListener) {
        chrome.runtime.onMessage.removeListener(this.backgroundListener);
        this.backgroundListener = null;
      }
      
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      this.setupBackgroundListener();
      const isConnected = await this.checkConnection();
      
      if (isConnected) {
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
        await this.syncState();
      }
    } catch (error: any) {
      console.error('[MessageBridge] Error during connection rebuild:', error);
    } finally {
      this.isReconnecting = false;
    }
  }

  // 同步状态
  private async syncState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: UiToBackgroundMessageType.GET_APP_STATE
      });

      if (response) {
        this.forwardToContentUI({
          type: ContentScriptToContentUIMessageType.FROM_BACKGROUND,
          payload: {
            message: {
              type: UIMessageType.APP_STATE_UPDATE,
              payload: response
            }
          }
        });
      }
    } catch (error) {
      console.error('[MessageBridge] Error syncing state:', error);
    }
  }

  // 清理资源
  public destroy() {
    console.log('[MessageBridge] Destroying MessageBridge');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.backgroundListener) {
      chrome.runtime.onMessage.removeListener(this.backgroundListener);
      this.backgroundListener = null;
    }
    
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0;
    this.isReconnecting = false;
    this.lastSuccessfulHeartbeat = Date.now();
  }
}

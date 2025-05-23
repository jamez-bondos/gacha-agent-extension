import React, { useState, useEffect, useCallback } from 'react';
import './index.css'; // Global styles (includes Tailwind)
import './app.css'; // App-specific styles

import Header from './components/Header';
import ChatTaskMonitor from './components/ChatTaskMonitor';
import TaskForm from './components/TaskForm';
import SettingsModal from './components/SettingsModal';

import type { ImageGenTask, AppState as AppStateType, ChatAction, ContentScriptMessage } from '@extension/shared/lib/types'; // Renamed AppState to AppStateType to avoid conflict with component state
import { AppStatus, BackgroundToAppMessageType, UiToBackgroundMessageType, ChatActionType, ContentUIToContentScriptMessageType, ContentScriptToContentUIMessageType } from '@extension/shared/lib/types'; // For sending messages
import { appSettingsStorage } from './lib/storage';

const initialAppState: AppStateType = {
  appStatus: AppStatus.IDLE,
  tasks: [], 
  currentTask: null,
  action: null
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppStateType>(initialAppState);
  const [actionQueue, setActionQueue] = useState<ChatAction[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [taskProcessingDelay, setTaskProcessingDelay] = useState(2); // seconds, for settings
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);

  // --- Communication with Background Script ---
  const fetchAppState = useCallback(() => {
    // 通过Content Script获取状态
    console.log('[Content UI] Requesting app state via Content Script');
    window.postMessage({
      type: ContentUIToContentScriptMessageType.SEND_TO_BACKGROUND,
      payload: {
        message: { type: UiToBackgroundMessageType.GET_APP_STATE },
        requestId: `get_state_${Date.now()}`
      }
    }, '*');
  }, []);

  useEffect(() => {
    fetchAppState(); // Initial fetch

    const windowMessageListener = (event: MessageEvent) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'GACHA_AGENT_FROM_CONTENT_SCRIPT') {
        const message = event.data.payload as ContentScriptMessage;
        handleContentScriptMessage(message);
      }
    };

    const handleContentScriptMessage = (message: ContentScriptMessage) => {
      console.log('[Content UI] Received message from Content Script:', message.type);
      
      switch (message.type) {
        case ContentScriptToContentUIMessageType.FROM_BACKGROUND:
          const backgroundMessage = message.payload.message;
          if (backgroundMessage.type === BackgroundToAppMessageType.APP_STATE_UPDATE) {
            console.log('[Content UI] Received APP_STATE_UPDATE', backgroundMessage.payload);
            setAppState(backgroundMessage.payload);
            setConnectionStatus('connected'); // 成功接收状态更新
            setLastConnectionError(null);
            
            // 处理action队列
            if (backgroundMessage.payload.action && backgroundMessage.payload.action.type !== ChatActionType.NONE) {
              setActionQueue(prev => {
                if (backgroundMessage.payload.action.actionId && 
                    !prev.some(item => item.actionId === backgroundMessage.payload.action.actionId)) {
                  console.log('[Content UI] Adding action to queue:', backgroundMessage.payload.action);
                  return [...prev, backgroundMessage.payload.action];
                }
                return prev;
              });
            }
          } else if (backgroundMessage.type === 'BACKGROUND_RESPONSE') {
            // 处理Background的直接响应
            console.log('[Content UI] Received Background response:', backgroundMessage.payload);
            setConnectionStatus('connected'); // 成功接收响应
            setLastConnectionError(null);
            if (backgroundMessage.payload) {
              setAppState(backgroundMessage.payload);
            }
          } else if (backgroundMessage.type === 'CONNECTION_RESTORED') {
            // 处理连接恢复通知
            console.log('[Content UI] Connection restored, refreshing state');
            setConnectionStatus('connected');
            setLastConnectionError(null);
            // 重新获取最新状态
            fetchAppState();
          }
          break;

        case ContentScriptToContentUIMessageType.COMMUNICATION_ERROR:
          console.error('[Content UI] Communication error:', message.payload.error);
          setConnectionStatus('error');
          setLastConnectionError(message.payload.error);
          // 设置一个定时器尝试重连
          setTimeout(() => {
            if (connectionStatus === 'error') {
              setConnectionStatus('reconnecting');
              fetchAppState(); // 尝试重新获取状态
            }
          }, 5000);
          break;

        case ContentScriptToContentUIMessageType.SIDEBAR_MODE_APPLIED:
          console.log('[Content UI] Sidebar mode applied:', message.payload.mode);
          break;
      }
    };

    window.addEventListener('message', windowMessageListener);
    
    return () => {
      window.removeEventListener('message', windowMessageListener);
    };
  }, [fetchAppState]);

  // 处理完成一个 action 后的回调函数
  const handleActionProcessed = useCallback((actionId: string) => {
    setActionQueue(prev => prev.filter(item => item.actionId !== actionId));
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      // Load initial settings
      const settings = await appSettingsStorage.getSettings();
      setTaskProcessingDelay(settings.settings.general.delay);
      
      // 获取并同步侧边栏模式到Content Script
      const currentSidebarMode = settings.settings.ui?.sidebarMode || 'floating';
      console.log('[Content UI] Syncing initial sidebar mode to Content Script:', currentSidebarMode);
      
      // 通知Content Script当前保存的模式
      window.postMessage({
        type: ContentUIToContentScriptMessageType.SET_SIDEBAR_MODE, 
        payload: { mode: currentSidebarMode }
      }, '*');
      
      setIsInitialized(true);
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return null; // or a loading spinner
  }

  // --- Event Handlers ---
  const handleFormSubmit = (formData: {
    prompt: string;
    numTasks: number;
    imageQuantity: number;
    aspectRatio: string;
  }) => {
    console.log('[Content UI] handleFormSubmit called with:', formData);
    
    // 创建与抽卡次数相匹配的prompts数组
    const prompts = Array(formData.numTasks).fill(formData.prompt);
    
    // 通过Content Script发送
    window.postMessage({
      type: ContentUIToContentScriptMessageType.SEND_TO_BACKGROUND,
      payload: {
        message: {
          type: UiToBackgroundMessageType.START_TASKS,
          payload: { 
            prompts: prompts, 
            quantity: formData.imageQuantity, 
            aspectRatio: formData.aspectRatio 
          },
        }
      }
    }, '*');
  };

  const handleStopProcessing = () => {
    console.log('[Content UI] handleStopProcessing called');
    window.postMessage({
      type: ContentUIToContentScriptMessageType.SEND_TO_BACKGROUND,
      payload: {
        message: { type: UiToBackgroundMessageType.STOP_PROCESSING }
      }
    }, '*');
  };

  const handleTaskDelayChange = (newDelay: number) => {
    console.log('[Content UI] handleTaskDelayChange called with:', newDelay);
    setTaskProcessingDelay(newDelay);
    window.postMessage({
      type: ContentUIToContentScriptMessageType.SEND_TO_BACKGROUND,
      payload: {
        message: {
          type: UiToBackgroundMessageType.SET_TASK_DELAY,
          payload: { delay: newDelay },
        }
      }
    }, '*');
  };

  const handleToggleSidebarMode = async (newMode: 'floating' | 'embedded') => {
    console.log('[Content UI] handleToggleSidebarMode called with:', newMode);
    
    try {
      // 首先保存到 storage
      await appSettingsStorage.updateSidebarMode(newMode);
      console.log('[Content UI] Sidebar mode saved to storage:', newMode);
      
      // 然后通知 Content Script 应用新模式
      window.postMessage({
        type: ContentUIToContentScriptMessageType.SET_SIDEBAR_MODE,
        payload: { mode: newMode }
      }, '*');
    } catch (error) {
      console.error('[Content UI] Error saving sidebar mode:', error);
    }
  };

  const handleCloseUI = () => {
    console.log('[Content UI] Sending close UI message to content script');
    window.postMessage({
      type: ContentUIToContentScriptMessageType.TOGGLE_UI
    }, '*');
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden shadow-md border border-gray-200">
      <Header onOpenSettings={() => setSettingsVisible(true)} onClose={handleCloseUI} onToggleSidebarMode={handleToggleSidebarMode} />

      {/* 连接状态指示器 */}
      {connectionStatus !== 'connected' && (
        <div className={`mx-4 py-2 px-3 rounded text-sm flex items-center ${
          connectionStatus === 'reconnecting' 
            ? 'bg-blue-50 border border-blue-200 text-blue-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {connectionStatus === 'reconnecting' ? (
            <>
              <svg className="animate-spin h-4 w-4 mr-2 flex-shrink-0" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在重新连接...
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              连接断开 {lastConnectionError && `(${lastConnectionError})`}
            </>
          )}
        </div>
      )}

      <SettingsModal
        isOpen={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onTaskDelayChange={handleTaskDelayChange}
        taskProcessingDelay={taskProcessingDelay}
      />

      <main className="flex-grow flex flex-col overflow-hidden p-4 space-y-4">
        {appState.appStatus === AppStatus.RUNNING && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 py-2 px-3 mb-2 flex items-center text-sm">
            <svg className="h-4 w-4 text-yellow-400 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-yellow-700 font-medium">
              批量任务进行时，请保持 Sora 页面在前台
            </span>
          </div>
        )}
        <div className="flex-grow overflow-y-auto">
          <ChatTaskMonitor
            tasks={appState.tasks}
            currentTask={appState.currentTask}
            appStatus={appState.appStatus}
            actionQueue={actionQueue}
            onActionProcessed={handleActionProcessed}
          />
        </div>

        <div className="flex-shrink-0">
          <TaskForm
            appStatus={appState.appStatus}
            onSubmit={handleFormSubmit}
            onStop={handleStopProcessing}
          />
        </div>
      </main>
    </div>
  );
};

export default App;

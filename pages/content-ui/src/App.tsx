import React, { useState, useEffect, useCallback } from 'react';
import './index.css'; // Global styles (includes Tailwind)
import './app.css'; // App-specific styles

import Header from './components/Header';
import ChatTaskMonitor from './components/ChatTaskMonitor';
import TaskForm from './components/TaskForm';
import SettingsModal from './components/SettingsModal';

import type { ImageGenTask, AppState as AppStateType, ChatAction } from '@extension/shared/lib/types'; // Renamed AppState to AppStateType to avoid conflict with component state
import { AppStatus, BackgroundToAppMessageType, UiToBackgroundMessageType, ChatActionType } from '@extension/shared/lib/types'; // For sending messages
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

  // --- Communication with Background Script ---
  const fetchAppState = useCallback(() => {
    chrome.runtime
      .sendMessage({ type: UiToBackgroundMessageType.GET_APP_STATE })
      .then(response => {
        if (response) {
          console.log('[Content UI] Received App State from background:', response);
          setAppState(response); // Assuming background responds with the full AppStateType object
          
          // 如果包含action，将其添加到队列
          if (response.action && response.action.type !== ChatActionType.NONE) {
            setActionQueue(prev => {
              // 检查是否已存在相同的 actionId
              if (response.action.actionId && 
                  !prev.some(item => item.actionId === response.action.actionId)) {
                return [...prev, response.action];
              }
              return prev;
            });
          }
        }
      })
      .catch(err => console.error('[Content UI] Error fetching app state:', err));
  }, []);

  useEffect(() => {
    fetchAppState(); // Initial fetch

    const messageListener = (message: any, sender: chrome.runtime.MessageSender) => {
      if (sender.id !== chrome.runtime.id) return;

      if (message.type === BackgroundToAppMessageType.APP_STATE_UPDATE) {
        // 更新应用状态
        console.log('[Content UI] Received APP_STATE_UPDATE', message.payload);
        setAppState(message.payload); // Assuming payload is AppStateType
        
        // 如果包含action，将其添加到队列
        if (message.payload.action && message.payload.action.type !== ChatActionType.NONE) {
          setActionQueue(prev => {
            // 检查是否已存在相同的 actionId
            if (message.payload.action.actionId && 
                !prev.some(item => item.actionId === message.payload.action.actionId)) {
              console.log('[Content UI] Adding action to queue:', message.payload.action);
              return [...prev, message.payload.action];
            }
            return prev;
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
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
    
    chrome.runtime
      .sendMessage({
        type: UiToBackgroundMessageType.START_TASKS,
        payload: { 
          prompts: prompts, 
          quantity: formData.imageQuantity, 
          aspectRatio: formData.aspectRatio 
        },
      })
      .catch(err => console.error('Error sending START_TASKS message:', err));
  };

  const handleStopProcessing = () => {
    console.log('[Content UI] handleStopProcessing called');
    chrome.runtime
      .sendMessage({ type: UiToBackgroundMessageType.STOP_PROCESSING })
      .catch(err => console.error('Error sending STOP_PROCESSING message:', err));
  };

  const handleTaskDelayChange = (newDelay: number) => {
    console.log('[Content UI] handleTaskDelayChange called with:', newDelay);
    setTaskProcessingDelay(newDelay);
    chrome.runtime
      .sendMessage({
        type: UiToBackgroundMessageType.SET_TASK_DELAY,
        payload: { delay: newDelay },
      })
      .catch(err => console.error('Error sending SET_TASK_DELAY message:', err));
  };

  const handleToggleSidebarMode = (newMode: 'floating' | 'embedded') => {
    console.log('[Content UI] handleToggleSidebarMode called with:', newMode);
    chrome.runtime
      .sendMessage({
        type: UiToBackgroundMessageType.SET_TARGET_SIDEBAR_MODE,
        payload: { mode: newMode },
      })
      .catch(err => console.error('Error sending SET_TARGET_SIDEBAR_MODE message:', err));
  };

  const handleCloseUI = () => {
    console.log('[Content UI] Sending close UI message to content script');
    window.postMessage({ type: 'GACHA_AGENT_SR_TOGGLE_UI' }, '*');
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden shadow-md border border-gray-200">
      <Header onOpenSettings={() => setSettingsVisible(true)} onClose={handleCloseUI} onToggleSidebarMode={handleToggleSidebarMode} />

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

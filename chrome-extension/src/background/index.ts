import 'webextension-polyfill';

import {
  ContentScriptActionType,
  BackgroundUpdateFromContent,
  BackgroundToAppMessageType,
  AppStatus,
  UiToBackgroundMessageType as BackgroundActionType,
  ChatActionType,
  ChatAction,
} from '@extension/shared/lib/types';
import type {
  ImageGenTask,
  TaskStatus,
  BackgroundMessageToApp as UIMessage,
  StartTasksPayload,
  SetTaskDelayPayload,
  SetTargetSidebarModePayload,
  ExecuteTaskPayload,
  ContentScriptMessageFromBackground,
  TaskStatusUpdatePayload,
  TaskSubmittedToSoraPayload,
  PageInteractionFailedPayload,
  BackgroundMessageFromContent,
  CSReadyPayload,
  AppState,
  UiMessageToBackground,
} from '@extension/shared/lib/types';
import { v4 as uuidv4 } from 'uuid';

let taskQueue: ImageGenTask[] = [];
let soraTabId: number | null = null;
let appStatus: AppStatus = AppStatus.IDLE;
let currentTask: ImageGenTask | null = null;
let taskProcessingDelayMs: number = 2000;
let currentAction: ChatAction | null = null;
let currentDelayTimeout: NodeJS.Timeout | null = null; // 用于跟踪和取消延时

// --- Utility Functions ---
function generateTaskId(): string {
  return uuidv4();
}

function generateActionId(): string {
  return uuidv4();
}

// --- Communication Functions ---
function sendMessageToContentScript(tabId: number, message: ContentScriptMessageFromBackground | UIMessage) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, message).catch(error => {
      console.error('Background: Error sending message to CS (tab ' + tabId + '): ' + error.message, message);
      if (
        error.message?.includes('Could not establish connection') ||
        error.message?.includes('No matching signature')
      ) {
        if (soraTabId === tabId) {
          console.warn('Background: Sora tab seems closed/unresponsive. Clearing soraTabId.');
          soraTabId = null;
          if (appStatus === AppStatus.RUNNING) {
            setAppStatus(AppStatus.IDLE);
          }
        }
      }
    });
  }
}

function clearTaskDetailsInContentScript() {
  if (soraTabId) {
    chrome.tabs.sendMessage(soraTabId, { 
      type: 'CLEAR_TASK_DETAILS' 
    }).catch(error => {
      console.error('Background: Error clearing task details in CS:', error);
    });
    console.log('Background: Requested content script to clear task details');
  }
}

function broadcastAppStateToUI(specificUI?: (response?: any) => void) {
  const appStateForUI: AppState = {
    appStatus,
    tasks: [...taskQueue],
    currentTask: currentTask ? { ...currentTask } : null,
    action: currentAction,
  };
  const message: UIMessage = { type: BackgroundToAppMessageType.APP_STATE_UPDATE, payload: appStateForUI };

  if (specificUI) {
    try {
      specificUI(appStateForUI);
    } catch (e) {
      console.warn('Background: Error sending direct response to UI:', e);
    }
  }
  if (soraTabId) {
    sendMessageToContentScript(soraTabId, message);
  }
  
  // 发送状态后清除action，避免重复处理
  if (currentAction) {
    console.log('Background: Clearing action after broadcast:', currentAction.type);
    currentAction = null;
  }
}

// --- App Status Management ---
function setAppStatus(newStatus: AppStatus) {
  if (appStatus !== newStatus) {
    const oldStatus = appStatus;
    appStatus = newStatus;
    console.log('Background: App status changed from ' + oldStatus + ' to ' + appStatus + '.');
  }
  broadcastAppStateToUI();
}

// --- Action Management ---
function setAction(actionType: ChatActionType, payload?: any) {
  currentAction = {
    type: actionType,
    payload: payload,
    actionId: generateActionId(), // 添加唯一ID以便前端可以区分不同的action
  };
  console.log('Background: Setting action:', actionType, payload);
  
  broadcastAppStateToUI();
}

// --- Task Processing Logic ---
async function processTask(taskToProcess: ImageGenTask) {
  if (!soraTabId) {
    console.warn('Background: Sora tab not available for task ' + taskToProcess.id + '.');
    setAppStatus(AppStatus.IDLE);
    return;
  }

  const taskInQueueRef = taskQueue.find(t => t.id === taskToProcess.id);
  if (!taskInQueueRef || taskInQueueRef.status !== 'PENDING') {
    triggerNextTask();
    return;
  }

  console.log('Background: Processing task ' + taskInQueueRef.id + ':', taskInQueueRef.prompt);
  currentTask = taskInQueueRef;
  taskInQueueRef.status = 'SUBMITTING_TO_PAGE';
  taskInQueueRef.updatedAt = Date.now();
  
  // 设置任务开始的 action
  setAction(ChatActionType.TASK_STARTED, { task: { ...taskInQueueRef } });
  
  setAppStatus(AppStatus.RUNNING);

  // send the task to the content script for execution
  const executeMessage: ContentScriptMessageFromBackground = {
    type: ContentScriptActionType.EXECUTE_TASK,
    payload: { task: { ...taskInQueueRef } },
  };
  sendMessageToContentScript(soraTabId, executeMessage);
}

async function triggerNextTask() {
  if (appStatus !== AppStatus.RUNNING) {
    return;
  }

  const nextTask = taskQueue.find(task => task.status === 'PENDING');
  if (nextTask) {
    const previousTaskJustCompleted = currentTask && (currentTask.status === 'SUCCEEDED' || currentTask.status === 'FAILED');
    if (previousTaskJustCompleted && taskProcessingDelayMs > 0) {
      console.log('Background: Delaying next task by ' + taskProcessingDelayMs + 'ms.');
      
      // 使用可取消的延时
      await new Promise<void>((resolve, reject) => {
        currentDelayTimeout = setTimeout(() => {
          currentDelayTimeout = null;
          resolve();
        }, taskProcessingDelayMs);
      });
      
      // 延时后的完整状态检查
      if (appStatus !== AppStatus.RUNNING) {
        console.log('Background: App status changed during delay, stopping task processing.');
        return;
      }
      if (taskQueue.length === 0) {
        console.log('Background: Task queue cleared during delay, stopping task processing.');
        setAppStatus(AppStatus.IDLE);
        return;
      }
      if (!soraTabId) {
        console.log('Background: Sora tab unavailable after delay, stopping task processing.');
        setAppStatus(AppStatus.IDLE);
        return;
      }
    }
    // Re-fetch task in case its status changed or it was removed during delay (very unlikely)
    const taskToProcess = taskQueue.find(t => t.id === nextTask.id && t.status === 'PENDING');
    if (taskToProcess) {
      processTask(taskToProcess);
    } else {
      console.log('Background: Task ' + nextTask.id + ' no longer available after delay, checking for other tasks.');
      triggerNextTask();
    }
  } else {
    // If currentTask is null or terminal, and no pending tasks, then we are idle.
    if (!currentTask || currentTask.status === 'SUCCEEDED' || currentTask.status === 'FAILED') {
      // 检查是否所有任务都已完成
      const allCompleted = taskQueue.length > 0 && taskQueue.every(task => 
        task.status === 'SUCCEEDED' || task.status === 'FAILED'
      );
      
      if (allCompleted) {
        // 设置批量任务完成的 action
        setAction(ChatActionType.BATCH_COMPLETED);
        
        // 清除fetch hook中的任务详情
        clearTaskDetailsInContentScript();
      }
      
      setAppStatus(AppStatus.IDLE);
      currentTask = null;
      broadcastAppStateToUI();
    }
  }
}

// --- Main Message Listener ---
chrome.runtime.onMessage.addListener(
  (message: UiMessageToBackground | BackgroundMessageFromContent, sender, sendResponse) => {
    const senderTabId = sender.tab?.id;
    console.log(
      `Background: Received message type '${message.type}' from`,
      sender.tab ? `tab ${senderTabId} (${sender.tab.url})` : 'extension context (e.g., popup)',
    );

    if (Object.values(BackgroundActionType).includes(message.type as BackgroundActionType)) {
      const uiActionMessage = message as UiMessageToBackground;

      switch (uiActionMessage.type) {
        case BackgroundActionType.GET_APP_STATE:
          broadcastAppStateToUI(sendResponse);
          return true;

        case BackgroundActionType.START_TASKS: {
          if (appStatus !== AppStatus.IDLE) {
            sendResponse({ success: false, message: 'Cannot start tasks while processing is active.' });
            return true;
          }
          const { prompts, quantity, aspectRatio } = uiActionMessage.payload as StartTasksPayload;
          const numTasks = prompts.length;
          const newTasks: ImageGenTask[] = prompts.map((prompt, index) => ({
            id: generateTaskId(),
            originalIndex: index + 1,
            prompt,
            aspectRatio,
            imageQuantity: quantity,
            status: 'PENDING',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));
          taskQueue = newTasks;
          console.log('Background: Created new batch of ' + newTasks.length + ' tasks. Delay: ' + taskProcessingDelayMs + 'ms.');
          
          // 设置批量任务开始的 action
          setAction(ChatActionType.BATCH_TASK_STARTED);
          
          setAppStatus(AppStatus.RUNNING);
          triggerNextTask();
          sendResponse({ success: true, message: numTasks + ' tasks added to queue.' });
          return true;
        }

        case BackgroundActionType.STOP_PROCESSING: {
          const oldTaskCount = taskQueue.length;
          
          // 取消正在进行的延时
          if (currentDelayTimeout) {
            clearTimeout(currentDelayTimeout);
            currentDelayTimeout = null;
            console.log('Background: Cancelled pending task delay due to stop processing.');
          }
          
          // 设置批量任务停止的 action
          setAction(ChatActionType.BATCH_STOPPED);
          
          // 清除fetch hook中的任务详情
          clearTaskDetailsInContentScript();
          
          taskQueue = [];
          currentTask = null;
          setAppStatus(AppStatus.IDLE);
          broadcastAppStateToUI();
          sendResponse({ success: true, message: 'Queue cleared of ' + oldTaskCount + ' tasks.' });
          return true;
        }

        case BackgroundActionType.SET_TASK_DELAY: {
          const { delay } = uiActionMessage.payload as SetTaskDelayPayload;
          taskProcessingDelayMs = delay * 1000;
          sendResponse({ success: true, message: 'Task delay set to ' + (taskProcessingDelayMs / 1000) + 's.' });
          return true;
        }
        default:
          return false;
      }
    } else if (Object.values(BackgroundUpdateFromContent).includes(message.type as BackgroundUpdateFromContent)) {
      const csMessage = message as BackgroundMessageFromContent;

      switch (csMessage.type) {
        case BackgroundUpdateFromContent.BG_CS_READY: {
          soraTabId = senderTabId ?? null;
          console.log('Background: CS ready on Sora tab ' + soraTabId + '. URL: ' + csMessage.payload?.soraPageUrl);
          break;
        }

        case BackgroundUpdateFromContent.TASK_SUBMITTED_TO_SR:
          const { internalTaskId: submittedInternalId, soraId, submittedAt } = csMessage.payload;
          const submittedTask = taskQueue.find(t => t.id === submittedInternalId);
          if (submittedTask && submittedTask.status === 'SUBMITTING_TO_PAGE') {
            submittedTask.status = 'IN_PROGRESS';
            submittedTask.soraId = soraId;
            submittedTask.updatedAt = submittedAt || Date.now();
            if (currentTask && currentTask.id === submittedInternalId) {
              currentTask = { ...submittedTask };
            }
            console.log(
              'Background: Task ' + submittedInternalId + ' confirmed submitted to Sora (Sora ID: ' + soraId + ').',
            );
            
            // 设置任务更新的 action
            setAction(ChatActionType.TASK_UPDATED, { task: { ...submittedTask } });
            
            broadcastAppStateToUI();
          }
          break;

        case BackgroundUpdateFromContent.TASK_STATUS_UPDATE:
          const {
            internalTaskId,
            soraId: updatedSoraId,
            status: newStatus,
            progress, // format: 0.26
            resultUrl,
            error,
          } = csMessage.payload;
          const soraIdForLookup = updatedSoraId;

          let taskToUpdate: ImageGenTask | undefined = undefined;
          if (internalTaskId) {
            taskToUpdate = taskQueue.find(t => t.id === internalTaskId);
          } else if (soraIdForLookup) {
            taskToUpdate = taskQueue.find(t => t.soraId === soraIdForLookup);
          }

          if (taskToUpdate) {
            const oldStatus = taskToUpdate.status;
            taskToUpdate.status = newStatus;
            taskToUpdate.updatedAt = Date.now();
            if (soraIdForLookup && (!taskToUpdate.soraId || taskToUpdate.soraId !== soraIdForLookup)) {
              taskToUpdate.soraId = soraIdForLookup;
            }
            if (resultUrl) taskToUpdate.resultUrl = resultUrl;
            if (error) taskToUpdate.error = error;

            let intProgress = undefined;
            if (progress !== undefined) {
              intProgress = Math.round(progress * 100);
            }
            taskToUpdate.progress = intProgress;
            console.log(
              'Background: Task ' + taskToUpdate.id + ' status update: ' + newStatus + ', Progress: ' + intProgress + '%.',
            );

            if (currentTask && currentTask.id === taskToUpdate.id) {
              currentTask = { ...taskToUpdate }; // Update currentTask view
            }

            if (newStatus === 'SUCCEEDED' || newStatus === 'FAILED') {
              console.log('Background: Task ' + taskToUpdate.id + ' concluded: ' + newStatus + '.');
              
              // 设置任务完成的 action
              setAction(ChatActionType.TASK_FINISHED, { task: { ...taskToUpdate } });
              
              triggerNextTask();
            } else {
              // 设置任务更新的 action
              setAction(ChatActionType.TASK_UPDATED, { task: { ...taskToUpdate } });
              
              broadcastAppStateToUI();
            }
          }
          break;

        case BackgroundUpdateFromContent.PAGE_INTERACTION_FAILED:
          const { internalTaskId: failedInteractionTaskId, error: interactionError } = csMessage.payload;
          const failedInteractionTask = taskQueue.find(t => t.id === failedInteractionTaskId);
          if (failedInteractionTask) {
            failedInteractionTask.status = 'FAILED';
            failedInteractionTask.error = 'Page Interaction Failed: ' + interactionError;
            failedInteractionTask.updatedAt = Date.now();
            console.error(
              'Background: Page interaction failed for task ' + failedInteractionTaskId + ': ' + interactionError,
            );
            
            // 设置任务失败的 action
            setAction(ChatActionType.TASK_FINISHED, { task: { ...failedInteractionTask } });
            
            triggerNextTask();
          }
          break;

        default:
          break;
      }
    } else {
      // 处理PING消息
      if (message.type === 'PING') {
        sendResponse({ status: 'pong' });
        return true;
      }
      
      console.warn('Background: Received message with unknown type structure', message);
    }

    return false;
  },
);

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === soraTabId) {
    soraTabId = null;
    
    // 取消正在进行的延时
    if (currentDelayTimeout) {
      clearTimeout(currentDelayTimeout);
      currentDelayTimeout = null;
      console.log('Background: Cancelled pending task delay due to tab closure.');
    }
    
    if (appStatus === AppStatus.RUNNING) {
      // 设置批量任务停止的 action
      setAction(ChatActionType.BATCH_STOPPED);
      
      setAppStatus(AppStatus.IDLE);
      if (currentTask && ['SUBMITTING_TO_PAGE', 'IN_PROGRESS'].includes(currentTask.status)) {
        currentTask.status = 'FAILED';
        currentTask.error = 'Sora tab was closed.';
        currentTask.updatedAt = Date.now();
      }
      broadcastAppStateToUI();
    }
    console.log('Background: Sora tab ' + soraTabId + ' closed. Stopping current task.');
  }
});

console.log('Background script initialized.');

// ============== Task Definition ============== //

export type TaskStatus =
  | 'PENDING' // Task is in the queue, waiting to be processed
  | 'SUBMITTING_TO_PAGE' // Task is being sent to the content script for execution
  | 'IN_PROGRESS' // Task is actively being processed on the page
  | 'SUCCEEDED' // Task completed successfully
  | 'FAILED'; // Task failed

export interface ImageGenTask {
  id: string; // Unique ID for the task (e.g., UUID generated in background)
  originalIndex: number; // Display order / batch number from the time of creation
  prompt: string;
  aspectRatio: string; // e.g., "1:1", "2:3", "3:2"
  imageQuantity: number; // Number of images for this task (e.g., 1, 2, 4)
  status: TaskStatus;
  soraId?: string; // ID from the Sora, once submission is confirmed by content script
  progress?: number; // Optional progress for IN_PROGRESS tasks (0-100), reported by content script
  resultUrl?: string; // Optional URL to the result, reported by content script
  error?: string; // Optional error message if failed
  createdAt: number; // Timestamp of creation
  updatedAt: number; // Timestamp of last update
}

// ============== Chat Action Types ============== //

export enum ChatActionType {
  NONE = 'NONE',                     // 无操作，仅状态更新
  BATCH_TASK_STARTED = 'BATCH_TASK_STARTED',   // 开始批量任务
  TASK_STARTED = 'TASK_STARTED',     // 开始执行单个任务
  TASK_UPDATED = 'TASK_UPDATED',     // 任务状态更新
  TASK_FINISHED = 'TASK_FINISHED',   // 单个任务完成
  BATCH_COMPLETED = 'BATCH_COMPLETED', // 所有批量任务完成
  BATCH_STOPPED = 'BATCH_STOPPED',   // 批量任务被手动停止
}

export interface ChatAction {
  type: ChatActionType;
  payload?: any;  // 可能包含相关任务ID或其他数据
  actionId?: string;  // 唯一标识每个action实例
}

// ============== App Status ============== //

export enum AppStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  CONFIGURING = 'CONFIGURING',
}

export const APP_STATE_STORAGE_KEY = 'gachaAgentSRAppState';

export interface AppState {
  appStatus: AppStatus;
  tasks: ImageGenTask[];
  currentTask: ImageGenTask | null;
  action?: ChatAction | null;
  // todo: settings might be added here later
}

// ============== Chrome Message Types ============== //

// Actions sent FROM Popup/UI TO Background script
export enum UiToBackgroundMessageType {
  START_TASKS = 'BG_START_TASKS',
  STOP_PROCESSING = 'BG_STOP_PROCESSING',
  GET_APP_STATE = 'BG_GET_APP_STATE',
  SET_TASK_DELAY = 'BG_SET_TASK_DELAY',
  SET_TARGET_SIDEBAR_MODE = 'BG_SET_TARGET_SIDEBAR_MODE',
}

export interface StartTasksPayload {
  prompts: string[];
  quantity: number;
  aspectRatio: string;
}

export interface CancelTaskPayload {
  taskId: string;
}

export interface SetTaskDelayPayload {
  delay: number; // Assuming delay is in seconds or a specific unit background understands
}

export interface SetTargetSidebarModePayload {
  mode: 'floating' | 'embedded';
}

export type UiMessageToBackground =
  | { type: UiToBackgroundMessageType.START_TASKS; payload: StartTasksPayload }
  | { type: UiToBackgroundMessageType.STOP_PROCESSING }
  | { type: UiToBackgroundMessageType.GET_APP_STATE }
  | { type: UiToBackgroundMessageType.SET_TASK_DELAY; payload: SetTaskDelayPayload }
  | { type: UiToBackgroundMessageType.SET_TARGET_SIDEBAR_MODE; payload: SetTargetSidebarModePayload };

// Updates/Events sent FROM Background script TO Popup/UI
export enum BackgroundToAppMessageType {
  APP_STATE_UPDATE = 'UI_APP_STATE_UPDATE',
}

export interface AppStateUpdatePayload {
  appState: AppState;
}

export interface NotificationPayload {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export type BackgroundMessageToApp =
  | { type: BackgroundToAppMessageType.APP_STATE_UPDATE; payload: AppState };

// ============== Content Script Message Types (between Content and Background) ============== //

// Actions sent FROM Background TO Content Script
export enum ContentScriptActionType {
  EXECUTE_TASK = 'CS_EXECUTE_TASK', // Tell content script to perform a task
  APPLY_SIDEBAR_MODE = 'CS_APPLY_SIDEBAR_MODE',
}

export interface ExecuteTaskPayload {
  task: ImageGenTask; // The full task object for context
}

export interface ApplySidebarModePayload {
  mode: 'floating' | 'embedded';
}

export type ContentScriptMessageFromBackground =
  | { type: ContentScriptActionType.EXECUTE_TASK; payload: ExecuteTaskPayload }
  | { type: ContentScriptActionType.APPLY_SIDEBAR_MODE; payload: ApplySidebarModePayload };

// Updates/Events sent FROM Content Script TO Background
export enum BackgroundUpdateFromContent {
  BG_CS_READY = 'BG_CS_READY', // Content script is ready
  TASK_SUBMITTED_TO_SR = 'BG_CS_TASK_SUBMITTED_TO_SR',
  TASK_STATUS_UPDATE = 'BG_CS_TASK_STATUS_UPDATE',
  PAGE_INTERACTION_FAILED = 'BG_CS_PAGE_INTERACTION_FAILED',
}

export interface CSReadyPayload {
  soraPageUrl?: string; // Optional: URL of the page where content script is active
}

export interface TaskSubmittedToSoraPayload {
  internalTaskId: string; // The original task.id from background
  soraId: string; 
  submittedAt: number; 
}

export interface TaskStatusUpdatePayload {
  internalTaskId?: string; 
  soraId: string;
  status: TaskStatus; 
  progress?: number;
  resultUrl?: string;
  error?: string;
}

export interface PageInteractionFailedPayload {
  internalTaskId: string;
  error: string;
}

export type BackgroundMessageFromContent =
  | { type: BackgroundUpdateFromContent.BG_CS_READY; payload?: CSReadyPayload }
  | { type: BackgroundUpdateFromContent.TASK_SUBMITTED_TO_SR; payload: TaskSubmittedToSoraPayload }
  | { type: BackgroundUpdateFromContent.TASK_STATUS_UPDATE; payload: TaskStatusUpdatePayload }
  | { type: BackgroundUpdateFromContent.PAGE_INTERACTION_FAILED; payload: PageInteractionFailedPayload };

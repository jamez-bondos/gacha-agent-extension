import React, { useEffect, useRef, useState } from 'react';
import { type ImageGenTask, AppStatus, ChatActionType, ChatAction } from '@extension/shared/lib/types';
import { cn } from '../lib/utils';
import { chatSessionStorage, type ChatMessage as StoredChatMessage } from '../lib/chatStorage';
import { Trash2 } from 'lucide-react';

// 继续使用内部组件的ChatMessage类型以保持一致性
interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'task-status' | 'summary';
  content: string | React.ReactNode;
  timestamp: number;
  taskId?: string;
  status?: string;
  progress?: number;
}

interface ChatTaskMonitorProps {
  tasks: ImageGenTask[];
  currentTask?: ImageGenTask | null;
  appStatus: AppStatus;
  actionQueue: ChatAction[];
  onActionProcessed: (actionId: string) => void;
}

const ChatTaskMonitor: React.FC<ChatTaskMonitorProps> = ({
  tasks,
  currentTask,
  appStatus,
  actionQueue,
  onActionProcessed
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    // 初始化系统提示消息
    {
      id: 'initial-message',
      type: 'system',
      content: '填入提示词，设置参数，点击发送批量任务',
      timestamp: Date.now(),
    }
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [processedActionIds, setProcessedActionIds] = useState<Set<string>>(new Set());
  
  // 初始化聊天会话
  useEffect(() => {
    const initChatSession = async () => {
      try {
        // 尝试获取现有会话ID
        let currentId = await chatSessionStorage.getCurrentSessionId();
        
        if (currentId) {
          // 加载现有会话
          const session = await chatSessionStorage.getSession(currentId);
          if (session && session.messages.length > 0) {
            setMessages(session.messages as ChatMessage[]);
            setSessionId(currentId);
            // 设置滚动到底部
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);
            return;
          }
        }
        
        // 如果没有现有会话，创建新会话
        const newId = await chatSessionStorage.createNewSession();
        setSessionId(newId);
        
        // 保存初始消息到存储
        await chatSessionStorage.saveMessages(newId, messages as StoredChatMessage[]);
      } catch (error) {
        console.error('Failed to initialize chat session:', error);
      }
    };
    
    initChatSession();
  }, []);
  
  // 当消息更新时保存到存储
  useEffect(() => {
    const saveMessagesToStorage = async () => {
      if (!sessionId) return;
      
      try {
        await chatSessionStorage.saveMessages(sessionId, messages as StoredChatMessage[]);
      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    };
    
    saveMessagesToStorage();
  }, [messages, sessionId]);
  
  // 从队列中处理 action
  useEffect(() => {
    // 如果队列为空，直接返回
    if (actionQueue.length === 0) return;
    
    // 取队列中的第一个 action 进行处理
    const action = actionQueue[0];
    if (!action || !action.actionId) return;
    
    // 如果这个action已经处理过，直接通知父组件移除
    if (processedActionIds.has(action.actionId)) {
      onActionProcessed(action.actionId);
      return;
    }
    
    console.log("ChatTaskMonitor: Processing action from queue", action.type, action.actionId);
    
    const addMessage = (newMessage: ChatMessage) => {
      setMessages(prev => [...prev.filter(m => m.id !== 'initial-message'), newMessage]);
    };
    
    const updateTaskMessage = (task: ImageGenTask) => {
      setMessages(prev => {
        const existingIndex = prev.findIndex(m => m.taskId === task.id);
        if (existingIndex >= 0) {
          // 更新现有消息
          const updatedMessages = [...prev];
          updatedMessages[existingIndex] = {
            ...updatedMessages[existingIndex],
            content: getTaskStatusContent(task),
            status: task.status,
            progress: task.progress || 0,
            timestamp: Date.now()
          };
          return updatedMessages;
        } else {
          // 添加新任务消息
          return [...prev, {
            id: `task-${task.id}-${Date.now()}`,
            type: 'task-status',
            content: getTaskStatusContent(task),
            taskId: task.id,
            status: task.status,
            progress: task.progress || 0,
            timestamp: Date.now()
          }];
        }
      });
    };
    
    switch (action.type) {
      case ChatActionType.BATCH_TASK_STARTED:
        if (tasks.length > 0) {
          addMessage({
            id: `user-${Date.now()}`,
            type: 'user',
            content: `开始批量任务(任务数: x${tasks.length})，提示词: ${tasks[0].prompt}`,
            timestamp: Date.now(),
          });
        }
        break;
        
      case ChatActionType.TASK_STARTED:
        if (action.payload?.task) {
          updateTaskMessage(action.payload.task);
        } else if (currentTask) {
          updateTaskMessage(currentTask);
        }
        break;
        
      case ChatActionType.TASK_UPDATED:
        if (action.payload?.task) {
          updateTaskMessage(action.payload.task);
        }
        break;
        
      case ChatActionType.TASK_FINISHED:
        if (action.payload?.task) {
          updateTaskMessage(action.payload.task);
        }
        break;
        
      case ChatActionType.BATCH_COMPLETED:
        const succeededCount = tasks.filter(t => t.status === 'SUCCEEDED').length;
        const failedCount = tasks.filter(t => t.status === 'FAILED').length;
        
        addMessage({
          id: `summary-${Date.now()}`,
          type: 'summary',
          content: `任务完成统计: 总数 ${tasks.length}, 成功 ${succeededCount}, 失败 ${failedCount}`,
          timestamp: Date.now()
        });
        break;
        
      case ChatActionType.BATCH_STOPPED:
        addMessage({
          id: `system-${Date.now()}`,
          type: 'system',
          content: '任务已停止',
          timestamp: Date.now()
        });
        break;
    }
    
    // 记录已处理的actionId
    setProcessedActionIds(prev => {
      const newSet = new Set(prev);
      newSet.add(action.actionId!);
      // 保持集合大小在合理范围内，防止内存泄漏
      if (newSet.size > 100) {
        const oldestIds = Array.from(newSet).slice(0, 50);
        oldestIds.forEach(id => newSet.delete(id));
      }
      return newSet;
    });
    
    // 通知父组件这个action已处理完成
    onActionProcessed(action.actionId);
    
  }, [actionQueue, tasks, currentTask, processedActionIds, onActionProcessed]);
  
  // 当任务列表为空时显示初始消息
  useEffect(() => {
    if (tasks.length === 0) {
      setMessages(prev => {
        // 确保初始消息存在
        if (!prev.some(m => m.id === 'initial-message')) {
          return [
            {
              id: 'initial-message',
              type: 'system',
              content: '填入提示词，设置参数，点击发送批量任务',
              timestamp: Date.now(),
            },
            ...prev.filter(m => m.id !== 'initial-message')
          ];
        }
        return prev;
      });
    }
  }, [tasks]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);
  
  // Detect manual scrolling to temporarily disable auto-scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setShouldAutoScroll(isAtBottom);
  };
  
  // Helper function to generate task status content
  const getTaskStatusContent = (task: ImageGenTask) => {
    const statusMap: Record<string, string> = {
      'PENDING': '等待中',
      'SUBMITTING_TO_PAGE': '提交中',
      'IN_PROGRESS': '执行中',
      'SUCCEEDED': '已完成',
      'FAILED': '失败'
    };
    
    const statusText = statusMap[task.status] || task.status;
    const progressText = task.progress ? ` (${task.progress}%)` : '';
    if (task.status === 'IN_PROGRESS') {
      return `任务 #${task.originalIndex} ${statusText}${progressText}`;
    } else {
      return `任务 #${task.originalIndex} ${statusText}`;
    }
  };
  
  // 清除历史记录
  const handleClearHistory = async () => {
    if (!sessionId) return;
    
    // 初始系统消息
    const initialMessage = {
      id: 'initial-message',
      type: 'system' as const,
      content: '填入提示词，设置参数，点击发送批量任务',
      timestamp: Date.now(),
    };
    
    try {
      // 更新UI
      setMessages([initialMessage]);
      
      // 更新存储
      await chatSessionStorage.saveMessages(sessionId, [initialMessage as StoredChatMessage]);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* 固定在顶部的标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 rounded-t-lg border border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-slate-800">任务历史</h2>
        <button
          onClick={handleClearHistory}
          className="flex items-center justify-center p-1.5 text-slate-500 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
          title="清除历史记录"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      {/* 聊天消息区域 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 p-4 bg-white rounded-b-lg border-t-0 border border-gray-200 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full"
        onScroll={handleScroll}
      >
        <div className="flex flex-col space-y-3">
          {messages.map(message => (
            <ChatMessageItem key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

// ChatMessageItem component to render different message types
interface ChatMessageItemProps {
  message: ChatMessage;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const { type, content, status } = message;
  
  // Define styles based on message type
  const isUserMessage = type === 'user';
  const messageClasses = cn(
    "px-4 py-2 rounded-lg max-w-[85%]",
    {
      "self-end bg-blue-500 text-white": isUserMessage,
      "self-start": !isUserMessage,
      "bg-gray-100 text-gray-800": type === 'system' || (type === 'task-status' && status !== 'SUCCEEDED' && status !== 'FAILED'),
      "bg-green-100 text-green-800": type === 'task-status' && status === 'SUCCEEDED',
      "bg-red-100 text-red-800": type === 'task-status' && status === 'FAILED',
      "bg-yellow-100 text-yellow-800": type === 'summary'
    }
  );
  
  return (
    <div className={cn("flex", isUserMessage ? "justify-end" : "justify-start")}>
      <div className={messageClasses}>
        {content}
      </div>
    </div>
  );
};

export default ChatTaskMonitor; 
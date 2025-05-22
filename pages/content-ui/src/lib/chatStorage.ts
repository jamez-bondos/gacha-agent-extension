import { v4 as uuidv4 } from 'uuid';

// 聊天消息类型（从ChatTaskMonitor组件中提取）
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'task-status' | 'summary';
  content: string | React.ReactNode;
  timestamp: number;
  taskId?: string;
  status?: string;
  progress?: number;
}

// 聊天会话类型
export interface ChatSession {
  id: string;
  createdAt: number;
  messages: ChatMessage[];
}

// 存储键
const CURRENT_SESSION_ID_KEY = 'one_more_gen_current_chat_session_id';
const SESSION_PREFIX = 'one_more_gen_chat_session_';

export class ChatSessionStorage {
  /**
   * 获取当前会话ID
   */
  async getCurrentSessionId(): Promise<string | null> {
    const data = await chrome.storage.local.get(CURRENT_SESSION_ID_KEY);
    return data[CURRENT_SESSION_ID_KEY] || null;
  }

  /**
   * 设置当前会话ID
   */
  async setCurrentSessionId(sessionId: string): Promise<void> {
    await chrome.storage.local.set({ [CURRENT_SESSION_ID_KEY]: sessionId });
  }

  /**
   * 创建新的聊天会话
   */
  async createNewSession(): Promise<string> {
    const sessionId = uuidv4();
    const session: ChatSession = {
      id: sessionId,
      createdAt: Date.now(),
      messages: []
    };
    
    await chrome.storage.local.set({ 
      [SESSION_PREFIX + sessionId]: session,
      [CURRENT_SESSION_ID_KEY]: sessionId
    });
    
    return sessionId;
  }

  /**
   * 获取指定会话
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    const data = await chrome.storage.local.get(SESSION_PREFIX + sessionId);
    return data[SESSION_PREFIX + sessionId] || null;
  }

  /**
   * 保存消息到指定会话
   */
  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    // latest 100 messages
    session.messages = messages.slice(-100);
    await chrome.storage.local.set({ [SESSION_PREFIX + sessionId]: session });
  }

  /**
   * 获取所有会话的简要信息
   */
  async getAllSessions(): Promise<{
    id: string;
    createdAt: number;
  }[]> {
    const data = await chrome.storage.local.get(null);
    return Object.keys(data)
      .filter(key => key.startsWith(SESSION_PREFIX))
      .map(key => ({
        id: key.replace(SESSION_PREFIX, ''),
        createdAt: data[key].createdAt
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 删除指定会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    await chrome.storage.local.remove(SESSION_PREFIX + sessionId);
    
    // 如果删除的是当前会话，清除当前会话ID
    const currentSessionId = await this.getCurrentSessionId();
    if (currentSessionId === sessionId) {
      await chrome.storage.local.remove(CURRENT_SESSION_ID_KEY);
    }
  }
}

export const chatSessionStorage = new ChatSessionStorage(); 
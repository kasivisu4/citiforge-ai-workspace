import { create } from 'zustand';

export type AgentType = 'data-modeler' | 'data-analysis' | 'documentation' | 'templates' | 'dashboard-generator' | null;
export type ChatMode = 'creative' | 'deep-think' | 'sota';

export interface TableSchema {
  tableName: string;
  description: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    description: string;
  }>;
}

export interface HITLOption {
  id: string;
  label: string;
  description?: string;
  style?: Record<string, unknown>;
}

export interface HITLFormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  required?: boolean;
  options?: HITLOption[];
  default?: unknown;
  style?: Record<string, unknown>;
}

export interface HITLResponse {
  type: 'binary' | 'options' | 'form';
  title: string;
  message: string;
  options?: HITLOption[];
  fields?: HITLFormField[];
  style?: Record<string, unknown>;
  metadata?: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  sessionId?: string;
  mode?: ChatMode;
  contentType?: 'text' | 'markdown' | 'table' | 'code';
  hitl?: HITLResponse;
  metadata?: Record<string, any>;
  streaming?: boolean;
  chunks?: string[];
  category?: string;
  editable?: boolean;
}

export interface Session {
  id: string;
  agent: AgentType;
  title?: string;
  createdAt: Date;
  lastUpdated: Date;
}

export interface QueryCard {
  title: string;
  description: string;
}

interface AppState {
  activeAgent: AgentType;
  setActiveAgent: (agent: AgentType) => void;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  presetModalOpen: boolean;
  setPresetModalOpen: (open: boolean) => void;
  hitlDrawerOpen: boolean;
  setHitlDrawerOpen: (open: boolean) => void;
  sessions: Session[];
  currentSessionId?: string | null;
  startSession: (agent: AgentType, title?: string) => string;
  setCurrentSession: (id: string | null) => void;
  addSession: (session: Session) => void;
  clearSessions: () => void;
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeAgent: null,
  setActiveAgent: (agent) => set({ activeAgent: agent }),
  chatMode: 'creative',
  setChatMode: (mode) => set({ chatMode: mode }),
  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
  presetModalOpen: false,
  setPresetModalOpen: (open) => set({ presetModalOpen: open }),
  hitlDrawerOpen: false,
  setHitlDrawerOpen: (open) => set({ hitlDrawerOpen: open }),
  messages: [],
  sessions: [],
  currentSessionId: null,
  addSession: (session) => set((s) => {
    const exists = s.sessions.find((ss) => ss.id === session.id);
    if (exists) {
      return { sessions: s.sessions.map((ss) => ss.id === session.id ? session : ss), currentSessionId: session.id };
    }
    return { sessions: [...s.sessions, session], currentSessionId: session.id };
  }),
  startSession: (agent, title) => {
    const id = crypto.randomUUID();
    const now = new Date();
    set((s) => ({ sessions: [...s.sessions, { id, agent, title: title || `${agent}`, createdAt: now, lastUpdated: now }], currentSessionId: id, activeAgent: agent }));
    return id;
  },
  setCurrentSession: (id) => set({ currentSessionId: id }),
  addMessage: (msg) => set((s) => {
    const sessionId = msg.sessionId ?? s.currentSessionId ?? null;
    const now = new Date();
    const updatedSessions = s.sessions.map((sess) => sess.id === sessionId ? { ...sess, lastUpdated: now } : sess);
    // fire-and-forget update to backend session timestamp
    try {
      if (sessionId) fetch(`http://localhost:4555/sessions/${sessionId}`, { method: 'PUT' }).catch(() => {});
    } catch (e) {}
    return ({ messages: [...s.messages, { ...msg, sessionId }], sessions: updatedSessions });
  }),
  updateMessage: (id, updates) => set((s) => ({
    messages: s.messages.map((msg) => msg.id === id ? { ...msg, ...updates } : msg)
  })),
  clearSessions: () => set({ sessions: [], currentSessionId: null, messages: [] }),
  chatInput: '',
  setChatInput: (input) => set({ chatInput: input }),
}));

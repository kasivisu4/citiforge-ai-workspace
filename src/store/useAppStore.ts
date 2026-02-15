import { create } from 'zustand';

export type AgentType = 'screen-designer' | 'data-analysis' | 'documentation' | 'templates' | null;
export type ChatMode = 'creative' | 'deep-think' | 'sota';

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
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  mode?: ChatMode;
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
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
}));

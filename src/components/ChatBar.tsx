import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, ChatMode } from '@/store/useAppStore';
import { Send, ChevronUp, ChevronDown, Layout, BarChart3, FileText, Sparkles, Brain, Zap, Users } from 'lucide-react';

const agentAvatars: Record<string, { icon: typeof Layout; color: string }> = {
  'screen-designer': { icon: Layout, color: 'bg-purple-500' },
  'data-analysis': { icon: BarChart3, color: 'bg-citi-blue' },
  'documentation': { icon: FileText, color: 'bg-teal-500' },
  'templates': { icon: Sparkles, color: 'bg-amber-500' },
};

const modes: { id: ChatMode; label: string; icon: typeof Sparkles }[] = [
  { id: 'creative', label: 'Creative', icon: Sparkles },
  { id: 'deep-think', label: 'Deep Think', icon: Brain },
  { id: 'sota', label: 'SOTA', icon: Zap },
];

export function ChatBar() {
  const { activeAgent, chatMode, setChatMode, messages, addMessage } = useAppStore();
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);

  const avatar = activeAgent ? agentAvatars[activeAgent] : null;
  const AvatarIcon = avatar?.icon || Sparkles;

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      mode: chatMode,
    });
    // Simulate agent response
    setTimeout(() => {
      addMessage({
        id: crypto.randomUUID(),
        role: 'agent',
        content: `Processing your request in ${chatMode} mode. Analyzing financial data patterns and generating insights...`,
        timestamp: new Date(),
        mode: chatMode,
      });
    }, 800);
    setInput('');
  };

  return (
    <div className="fixed bottom-0 left-[320px] right-0 z-40">
      {/* Chat history */}
      <AnimatePresence>
        {expanded && messages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 320, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card border-t border-border overflow-y-auto"
          >
            <div className="p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}>
                    {msg.role === 'agent' && chatMode === 'sota' && (
                      <div className="flex items-center gap-1 mb-1.5 text-[10px] text-muted-foreground">
                        <Users size={10} />
                        <span>Agent Swarm active</span>
                        <span className="flex gap-0.5 ml-1">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="w-3 h-3 rounded-full bg-citi-blue/30 flex items-center justify-center text-[6px] font-bold text-citi-blue">
                              A{i + 1}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="h-[68px] bg-card border-t border-border flex items-center gap-3 px-4">
        {/* Agent avatar */}
        <div className={`w-9 h-9 rounded-lg ${avatar?.color || 'bg-muted'} flex items-center justify-center shrink-0`}>
          <AvatarIcon size={16} className="text-primary-foreground" />
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Input */}
        <div className="flex-1 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your agent anything..."
            className="w-full h-10 bg-muted rounded-xl px-4 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Send size={12} />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = chatMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setChatMode(mode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={12} />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

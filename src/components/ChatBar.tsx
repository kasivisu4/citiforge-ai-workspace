import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, ChatMode } from '@/store/useAppStore';
import { Send, ChevronUp, ChevronDown, Layout, BarChart3, FileText, Sparkles, Brain, Zap, Users, Paperclip, X } from 'lucide-react';

const agentAvatars: Record<string, { icon: typeof Layout; color: string }> = {
  'data-modeler': { icon: Layout, color: 'bg-citi-blue' },
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
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  // Reset attachment after sending
  const clearAttachment = () => setAttachmentFile(null);
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
    clearAttachment();
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
      <div className="bg-card border-t border-border/50 px-4 py-3 space-y-3">
        {/* Attachment display */}
        <AnimatePresence>
          {attachmentFile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg"
            >
              <FileText size={14} className="text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground truncate flex-1">{attachmentFile.name}</span>
              <button
                onClick={clearAttachment}
                className="p-1 hover:bg-primary/10 rounded-md transition-colors text-muted-foreground hover:text-foreground shrink-0"
                title="Remove attachment"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input controls */}
        <div className="h-[68px] flex items-center gap-3">
          {/* Agent avatar */}
          <div className={`w-9 h-9 rounded-lg ${avatar?.color || 'bg-muted'} flex items-center justify-center shrink-0 shadow-sm`}>
            <AvatarIcon size={16} className="text-primary-foreground" />
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={expanded ? 'Hide chat history' : 'Show chat history'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          {/* Input field wrapper */}
          <div className="flex-1 flex items-center gap-2 bg-muted/50 border border-border/50 rounded-xl hover:border-border transition-colors focus-within:border-primary/50 focus-within:bg-muted/70">
            {/* Attachment button */}
            <button
              className={`p-2 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center shrink-0 ${
                attachmentFile ? 'text-primary' : ''
              }`}
              onClick={() => document.getElementById('attach-file')?.click()}
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>

            <input
              id="attach-file"
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              aria-hidden="true"
            />

            {/* Text input */}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask your agent anything..."
              className="flex-1 h-10 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
              title="Send message"
            >
              <Send size={16} />
            </button>
          </div>

          {/* Mode selector */}
          <div className="flex items-center gap-1 bg-muted/50 border border-border/50 rounded-xl p-1">
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
                  title={mode.label}
                >
                  <Icon size={14} />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

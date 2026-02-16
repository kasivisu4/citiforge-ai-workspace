import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, ChatMode } from '@/store/useAppStore';
import { Send, Sparkles, Brain, Zap, Users, Paperclip, X, FileText } from 'lucide-react';

const modes: { id: ChatMode; label: string; icon: typeof Sparkles }[] = [
  { id: 'creative', label: 'Creative', icon: Sparkles },
  { id: 'deep-think', label: 'Deep Think', icon: Brain },
  { id: 'sota', label: 'SOTA', icon: Zap },
];

export function ChatHistory() {
  const { chatMode, setChatMode, messages, addMessage, chatInput, setChatInput, activeAgent } = useAppStore();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const clearAttachment = () => setAttachmentFile(null);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput,
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
    setChatInput('');
    clearAttachment();
  };

  return (
    <div className="w-[380px] h-screen bg-card/95 backdrop-blur-sm flex flex-col border-l border-border/50">
      {/* Header with modes */}
      <div className="px-4 py-4 border-b border-border/50 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Chat</h2>
        
        {/* Mode selector */}
        <div className="flex items-center gap-1 bg-muted/50 border border-border/50 rounded-lg p-1">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = chatMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setChatMode(mode.id)}
                title={mode.label}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-all ${
                  isActive
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={24} className="text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  {activeAgent ? 'Start by clicking a suggestion or typing a message' : 'Select an agent to begin chatting'}
                </p>
              </div>
            </motion.div>
          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}>
                  {msg.role === 'agent' && chatMode === 'sota' && (
                    <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground/80">
                      <Users size={10} />
                      <span>Agent Swarm</span>
                      <span className="flex gap-0.5 ml-0.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/30" />
                        ))}
                      </span>
                    </div>
                  )}
                  {msg.content}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="px-4 py-4 border-t border-border/50 space-y-3">
        {/* Attachment display */}
        <AnimatePresence>
          {attachmentFile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-2 px-2 py-1.5 bg-primary/5 border border-primary/20 rounded text-xs"
            >
              <FileText size={12} className="text-primary shrink-0" />
              <span className="font-medium text-foreground truncate flex-1">{attachmentFile.name}</span>
              <button
                onClick={clearAttachment}
                className="p-0.5 hover:bg-primary/10 rounded transition-colors text-muted-foreground hover:text-foreground shrink-0"
                title="Remove"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input field */}
        <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-lg hover:border-border transition-colors focus-within:border-primary/50 focus-within:bg-muted/70">
          {/* Attachment button */}
          <button
            className={`p-2 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center shrink-0 ${
              attachmentFile ? 'text-primary' : ''
            }`}
            onClick={() => document.getElementById('attach-file-chat-history')?.click()}
            title="Attach file"
          >
            <Paperclip size={14} />
          </button>

          <input
            id="attach-file-chat-history"
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
          />

          {/* Text input */}
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 h-9 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!chatInput.trim()}
            className="p-2 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
            title="Send"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

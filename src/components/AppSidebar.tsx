import { useEffect } from 'react';
import { Database, BarChart3, FileText, FolderOpen, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore, AgentType } from '@/store/useAppStore';

interface AgentDef {
  id: AgentType;
  title: string;
  description: string;
  icon: LucideIcon;
  glowClass: string;
  iconBg: string;
}

const agents: AgentDef[] = [
{
  id: 'data-modeler',
  title: 'Data Modeler',
  description: 'Design and generate data models for financial products',
  icon: Database,
  glowClass: 'glow-blue',
  iconBg: 'bg-citi-blue/10 text-citi-blue'
},
{
  id: 'data-analysis',
  title: 'Data Analysis',
  description: 'Run portfolio risk, transaction forensics, scenario modeling',
  icon: BarChart3,
  glowClass: 'glow-blue',
  iconBg: 'bg-citi-blue/10 text-citi-blue'
},
{
  id: 'documentation',
  title: 'Documentation',
  description: 'Generate audit-ready docs, API specs, regulatory reports',
  icon: FileText,
  glowClass: 'glow-teal',
  iconBg: 'bg-teal-500/10 text-teal-500'
},
{
  id: 'templates',
  title: 'Templates Gallery',
  description: 'Published charts, sample screens, starter data models',
  icon: FolderOpen,
  glowClass: 'glow-amber',
  iconBg: 'bg-amber-500/10 text-amber-500'
}];


export function AppSidebar() {
  const { activeAgent, setActiveAgent, sessions, setChatInput, setChatOpen, setCurrentSession, addSession, startSession, clearSessions } = useAppStore();

  // load sessions from backend once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('http://localhost:4555/sessions');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        data.forEach((s: any) => addSession({ ...s, createdAt: new Date(s.createdAt), lastUpdated: new Date(s.lastUpdated) }));
      } catch (err) {









        // ignore for mock server
      }})();return () => {mounted = false;};}, [addSession]);return <aside className="w-[320px] min-w-[320px] h-screen flex flex-col citi-sidebar-nav border-r border-[hsl(var(--sidebar-border))]">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-citi-blue flex items-center justify-center">M<span className="text-primary-foreground font-bold text-sm">
          </span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[hsl(var(--citi-sidebar-text-active))] tracking-tight">Maphub

          </h1>
            <p className="text-[10px] text-[hsl(var(--citi-sidebar-text))] uppercase tracking-widest">
              AI Agent Workspace
            </p>
          </div>
        </div>
      </div>

      {/* Agent Hub */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--citi-sidebar-text))] font-medium mb-3 px-2">
          Agent Hub
        </p>
        <div className="space-y-2">
          {agents.map((agent, i) => {const isActive = activeAgent === agent.id;const Icon = agent.icon;
          return (
            <motion.button
              key={agent.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (isActive) return setActiveAgent(null);
                setActiveAgent(agent.id);
                setChatOpen(true);
                setCurrentSession(null); // Clear session so a new one is created on first message
              }}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
              isActive ?
              'bg-[hsl(var(--sidebar-accent))] ' + agent.glowClass :
              'hover:bg-[hsl(var(--sidebar-accent))]'}`
              }>

                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${agent.iconBg}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${
                  isActive ? 'text-[hsl(var(--citi-sidebar-text-active))]' : 'text-[hsl(var(--citi-sidebar-text))] group-hover:text-[hsl(var(--citi-sidebar-text-active))]'}`
                  }>
                      {agent.title}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--citi-sidebar-text))] mt-0.5 leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </motion.button>);

        })}
        </div>
      </div>

      {/* Compact area - reserved for History / quick links */}
      <div className="px-4 py-4 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-medium text-[hsl(var(--citi-sidebar-text))] uppercase tracking-wider">History</p>
          {sessions.length > 0 &&
        <button
          onClick={async () => {
            try {
              await fetch('http://localhost:4555/sessions', { method: 'DELETE' });
              clearSessions();
            } catch (err) {
              console.error('Failed to clear sessions', err);
            }
          }}
          className="text-[10px] text-[hsl(var(--citi-sidebar-text))] hover:text-red-600 transition-colors"
          title="Clear all sessions">

              Clear
            </button>
        }
        </div>
        <div className="h-80 overflow-y-auto space-y-2 pr-1">
          {sessions.length === 0 &&
        <div className="text-[11px] text-[hsl(var(--citi-sidebar-text))]">No recent sessions</div>
        }

          {sessions.slice(-6).reverse().map((s) =>
        <button
          key={s.id}
          onClick={() => {
            // open session: set current session, set active agent and open chat
            setCurrentSession(s.id);
            setActiveAgent(s.agent);
            setChatOpen(true);
          }}
          className="w-full text-left flex items-center gap-3 p-2 rounded hover:bg-slate-50 transition-colors">

              <div className={`w-9 h-9 rounded-md flex items-center justify-center text-sm font-semibold bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--citi-sidebar-text-active))]`}>
                {s.agent ? s.agent.toString().slice(0, 2).toUpperCase() : 'S'}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-[hsl(var(--citi-sidebar-text))] truncate">{s.title || s.agent || 'Session'}</div>
                <div className="text-[11px] text-[hsl(var(--citi-sidebar-text))] opacity-70 mt-0.5">{new Date(s.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </button>
        )}
        </div>
      </div>
    </aside>;

}
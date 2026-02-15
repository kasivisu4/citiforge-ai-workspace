import { Layout, BarChart3, FileText, FolderOpen, LucideIcon } from 'lucide-react';
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
    id: 'screen-designer',
    title: 'Screen Designer',
    description: 'Build pixel-perfect banking UIs with compliance baked in',
    icon: Layout,
    glowClass: 'glow-purple',
    iconBg: 'bg-purple-500/10 text-purple-500',
  },
  {
    id: 'data-analysis',
    title: 'Data Analysis',
    description: 'Run portfolio risk, transaction forensics, scenario modeling',
    icon: BarChart3,
    glowClass: 'glow-blue',
    iconBg: 'bg-citi-blue/10 text-citi-blue',
  },
  {
    id: 'documentation',
    title: 'Documentation',
    description: 'Generate audit-ready docs, API specs, regulatory reports',
    icon: FileText,
    glowClass: 'glow-teal',
    iconBg: 'bg-teal-500/10 text-teal-500',
  },
  {
    id: 'templates',
    title: 'Templates Gallery',
    description: 'Published charts, sample screens, starter data models',
    icon: FolderOpen,
    glowClass: 'glow-amber',
    iconBg: 'bg-amber-500/10 text-amber-500',
  },
];

export function AppSidebar() {
  const { activeAgent, setActiveAgent } = useAppStore();

  return (
    <aside className="w-[320px] min-w-[320px] h-screen flex flex-col citi-sidebar-nav border-r border-[hsl(var(--sidebar-border))]">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-citi-blue flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[hsl(var(--citi-sidebar-text-active))] tracking-tight">
              CitiForge
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
          {agents.map((agent, i) => {
            const isActive = activeAgent === agent.id;
            const Icon = agent.icon;
            return (
              <motion.button
                key={agent.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setActiveAgent(isActive ? null : agent.id)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-[hsl(var(--sidebar-accent))] ' + agent.glowClass
                    : 'hover:bg-[hsl(var(--sidebar-accent))]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${agent.iconBg}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-[hsl(var(--citi-sidebar-text-active))]' : 'text-[hsl(var(--citi-sidebar-text))] group-hover:text-[hsl(var(--citi-sidebar-text-active))]'
                    }`}>
                      {agent.title}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--citi-sidebar-text))] mt-0.5 leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-citi-blue/20 flex items-center justify-center">
            <span className="text-citi-blue text-sm font-semibold">PS</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[hsl(var(--citi-sidebar-text-active))] truncate">
              Priya Sharma
            </p>
            <p className="text-[10px] text-[hsl(var(--citi-sidebar-text))]">
              Head of Digital Product
            </p>
          </div>
        </div>
        <div className="mt-3 mx-2 px-3 py-1.5 bg-[hsl(var(--sidebar-accent))] rounded-lg">
          <p className="text-[10px] text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
            All actions 100% audited
          </p>
        </div>
      </div>
    </aside>
  );
}

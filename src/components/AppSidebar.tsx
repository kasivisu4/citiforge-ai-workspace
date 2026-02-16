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
      }})();return () => {mounted = false;};}, [addSession]);return;















































































































}
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { Plus, TrendingUp, Shield, Activity, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Upload, Database, Box, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';



const areaData = [
  { name: 'Jan', value: 4200, prev: 3800 },
  { name: 'Feb', value: 4800, prev: 4100 },
  { name: 'Mar', value: 4600, prev: 4300 },
  { name: 'Apr', value: 5200, prev: 4500 },
  { name: 'May', value: 5800, prev: 4800 },
  { name: 'Jun', value: 6100, prev: 5200 },
  { name: 'Jul', value: 5900, prev: 5500 },
];

const barData = [
  { name: 'Equities', value: 42 },
  { name: 'Fixed Inc', value: 28 },
  { name: 'Commodities', value: 15 },
  { name: 'FX', value: 10 },
  { name: 'Alt', value: 5 },
];

const agentWorkspaces: Record<string, { title: string; subtitle: string }> = {
  'data-modeler': { title: 'Data Modeler', subtitle: 'Design and generate data models for financial products' },
  'data-analysis': { title: 'Data Analysis Engine', subtitle: 'Portfolio risk & transaction intelligence' },
  'documentation': { title: 'Documentation Suite', subtitle: 'Auto-generate audit-ready documentation' },
  'templates': { title: 'Templates Gallery', subtitle: 'Browse and import ready-made templates' },
};

function StatCard({ title, value, change, positive, icon: Icon }: {
  title: string; value: string; change: string; positive: boolean; icon: typeof TrendingUp;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="citi-card p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-destructive'}`}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-citi-blue/10 flex items-center justify-center">
          <Icon size={18} className="text-citi-blue" />
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  const { setPresetModalOpen } = useAppStore();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full"
    >
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Activity size={32} className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Select an agent to begin</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-md text-center">
        Choose an AI agent from the sidebar to transform this workspace into a powerful analysis environment.
      </p>
      <button
        onClick={() => setPresetModalOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
      >
        <Plus size={16} />
        Add Preset
      </button>
    </motion.div>
  );
}

function SuggestedQueryCard({ icon: Icon, title, description }: { icon: typeof Database; title: string; description: string }) {
  const { setChatInput } = useAppStore();

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => setChatInput(title)}
      className="citi-card p-6 text-left hover:shadow-lg transition-all duration-200 group"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon size={24} className="text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Explore</span>
        <Zap size={12} />
      </div>
    </motion.button>
  );
}

export function Dashboard() {
  const { activeAgent, setPresetModalOpen } = useAppStore();

  if (!activeAgent) {
    return (
      <div className="flex-1 h-screen overflow-y-auto citi-gradient-bg citi-grid-pattern relative flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <Activity size={32} className="text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Select an agent to begin</h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md text-center">
            Choose an AI agent from the sidebar to transform this workspace into a powerful analysis environment.
          </p>
          <button
            onClick={() => setPresetModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            <Plus size={16} />
            Add Preset
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen overflow-y-auto citi-gradient-bg citi-grid-pattern">
      <div className="p-8">
        <AnimatePresence mode="wait">
          {activeAgent === 'data-modeler' ? (
            <motion.div
              key="data-modeler"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-2xl font-bold text-foreground">Data Modeler</h2>
                <p className="text-sm text-muted-foreground mt-1">Design and generate data models for financial products</p>
              </div>

              {/* Suggested Queries - Get Started */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">Get Started</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                  <SuggestedQueryCard
                    icon={Database}
                    title="Design Model for Products"
                    description="Create a new data model for your financial products with AI guidance"
                  />
                  <SuggestedQueryCard
                    icon={Upload}
                    title="Generate from Sample File"
                    description="Upload a CSV or JSON file to auto-generate your data model"
                  />
                  <SuggestedQueryCard
                    icon={Box}
                    title="Generate from Sample Table"
                    description="Select from existing database tables to create your model"
                  />
                  <SuggestedQueryCard
                    icon={BarChart3}
                    title="Explore Templates"
                    description="Browse pre-built models for common banking products"
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={activeAgent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-foreground">{agentWorkspaces[activeAgent]?.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{agentWorkspaces[activeAgent]?.subtitle}</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Total Assets" value="$2.4T" change="+12.3% YoY" positive icon={TrendingUp} />
                <StatCard title="Risk Score" value="72/100" change="-3.2 pts" positive={false} icon={Shield} />
                <StatCard title="Active Models" value="1,247" change="+89 this week" positive icon={Activity} />
                <StatCard title="Compliance" value="99.7%" change="+0.2%" positive icon={BarChart3} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="citi-card p-5 lg:col-span-2"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Portfolio Performance</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">7-month trend analysis</p>
                    </div>
                    <PieChart size={16} className="text-muted-foreground" />
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={areaData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(195, 100%, 47%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(195, 100%, 47%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 92%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'white',
                          border: '1px solid hsl(210, 20%, 90%)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                      />
                      <Area type="monotone" dataKey="prev" stroke="hsl(210, 20%, 80%)" fill="transparent" strokeDasharray="4 4" strokeWidth={1.5} />
                      <Area type="monotone" dataKey="value" stroke="hsl(195, 100%, 47%)" fill="url(#colorValue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="citi-card p-5"
                >
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Asset Allocation</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Current distribution</p>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 92%)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} width={70} />
                      <Tooltip
                        contentStyle={{
                          background: 'white',
                          border: '1px solid hsl(210, 20%, 90%)',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(207, 100%, 22%)" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>

              {/* Activity table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="citi-card p-5"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { action: 'KYC screening model updated', agent: 'Data Analysis', status: 'Complete', time: '2m ago' },
                        { action: 'Loan portfolio heatmap generated', agent: 'Data Modeler', status: 'Complete', time: '8m ago' },
                        { action: 'Basel III report draft', agent: 'Documentation', status: 'In Review', time: '14m ago' },
                        { action: 'SWIFT message template imported', agent: 'Templates', status: 'Complete', time: '22m ago' },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-3 font-medium text-foreground">{row.action}</td>
                          <td className="py-3 text-muted-foreground">{row.agent}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              row.status === 'Complete'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 text-right text-muted-foreground text-xs">{row.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { X, BarChart3, TrendingUp, Shield, FileText, Layout, Database, Wallet, Globe, AlertTriangle, CheckCircle } from 'lucide-react';

const presets = [
  { title: 'Loan Portfolio Heatmap', category: 'Risk', icon: BarChart3 },
  { title: 'KYC Journey Flow', category: 'Compliance', icon: Shield },
  { title: 'SWIFT Message Builder', category: 'Payments', icon: Globe },
  { title: 'Transaction Forensics', category: 'AML', icon: AlertTriangle },
  { title: 'Basel III Dashboard', category: 'Regulatory', icon: FileText },
  { title: 'FX Trading Screen', category: 'Markets', icon: TrendingUp },
  { title: 'Client Onboarding', category: 'Operations', icon: CheckCircle },
  { title: 'Portfolio Analytics', category: 'Wealth', icon: Wallet },
  { title: 'Credit Risk Model', category: 'Risk', icon: Database },
  { title: 'AML Screening Panel', category: 'Compliance', icon: Shield },
  { title: 'Rate Curve Builder', category: 'Markets', icon: TrendingUp },
  { title: 'Regulatory Report', category: 'Regulatory', icon: FileText },
];

const categoryColors: Record<string, string> = {
  Risk: 'bg-destructive/10 text-destructive',
  Compliance: 'bg-purple-50 text-purple-600',
  Payments: 'bg-citi-blue/10 text-citi-blue',
  AML: 'bg-amber-50 text-amber-600',
  Regulatory: 'bg-teal-50 text-teal-600',
  Markets: 'bg-emerald-50 text-emerald-600',
  Operations: 'bg-blue-50 text-blue-600',
  Wealth: 'bg-indigo-50 text-indigo-600',
};

export function PresetModal() {
  const { presetModalOpen, setPresetModalOpen } = useAppStore();

  return (
    <AnimatePresence>
      {presetModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
            onClick={() => setPresetModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-8 top-16 bottom-16 left-[340px] z-50 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">Banking Presets</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Import ready-made templates into your workspace</p>
              </div>
              <button
                onClick={() => setPresetModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {presets.map((preset, i) => {
                  const Icon = preset.icon;
                  return (
                    <motion.button
                      key={preset.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setPresetModalOpen(false)}
                      className="citi-card p-4 text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                          <Icon size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{preset.title}</p>
                          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${categoryColors[preset.category]}`}>
                            {preset.category}
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

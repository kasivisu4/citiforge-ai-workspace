import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { X, Check, Pencil, XCircle } from 'lucide-react';

export function HITLDrawer() {
  const { hitlDrawerOpen, setHitlDrawerOpen } = useAppStore();

  return (
    <AnimatePresence>
      {hitlDrawerOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/10 z-40"
            onClick={() => setHitlDrawerOpen(false)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[400px] bg-card border-l border-border z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-foreground">Human Approval Required</h3>
                <p className="text-xs text-muted-foreground mt-0.5">AI is waiting for your input</p>
              </div>
              <button
                onClick={() => setHitlDrawerOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="citi-card p-4 mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Proposed Field Mapping</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">customer_id</span>
                    <span className="font-medium text-foreground">→ client_ref</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">txn_amount</span>
                    <span className="font-medium text-foreground">→ transaction_value</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">risk_flag</span>
                    <span className="font-medium text-foreground">→ compliance_indicator</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</label>
                <textarea
                  className="w-full mt-2 h-24 bg-muted rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
                  placeholder="Add any modifications or context..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2">
              <button
                onClick={() => setHitlDrawerOpen(false)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Check size={14} /> Accept
              </button>
              <button
                onClick={() => setHitlDrawerOpen(false)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                <Pencil size={14} /> Modify
              </button>
              <button
                onClick={() => setHitlDrawerOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/20 transition-colors"
              >
                <XCircle size={14} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

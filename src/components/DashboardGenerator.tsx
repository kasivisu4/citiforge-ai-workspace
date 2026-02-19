import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Plus, GripVertical, Trash2, Edit3, Check, X, BarChart3,
  TrendingUp, Filter, LayoutGrid, LayoutList, Sliders, Loader2,
  PieChart as PieIcon, Activity, RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChartType = 'bar' | 'area' | 'line' | 'pie' | 'filter-select' | 'filter-range' | 'kpi';

interface DashboardWidget {
  id: string;
  type: ChartType;
  title: string;
  prompt: string;
  data: any[];
  span: 1 | 2 | 3; // grid columns
  loading: boolean;
  filterKey?: string; // cross-filter key
}

interface ActiveFilter {
  key: string;
  value: string | number | [number, number] | null;
}

// ─── Mock data generators ─────────────────────────────────────────────────────

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(195 80% 55%)',
  'hsl(38 90% 55%)',
  'hsl(270 60% 60%)',
  'hsl(160 60% 45%)',
];

function generateMockData(prompt: string, type: ChartType): any[] {
  const lower = prompt.toLowerCase();
  if (type === 'pie') {
    return [
      { name: 'Equities', value: 42 },
      { name: 'Fixed Inc', value: 28 },
      { name: 'Commodities', value: 15 },
      { name: 'FX', value: 10 },
      { name: 'Alternatives', value: 5 },
    ];
  }
  if (type === 'filter-select') {
    return ['All', 'Equities', 'Fixed Income', 'FX', 'Commodities'];
  }
  if (type === 'filter-range') {
    return [0, 100];
  }
  if (type === 'kpi') {
    return [{ value: lower.includes('risk') ? '72/100' : lower.includes('asset') ? '$2.4T' : '99.7%', change: '+3.2%', positive: true }];
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  return months.map((m, i) => ({
    name: m,
    value: Math.round(3000 + Math.random() * 3000 + i * 400),
    prev: Math.round(2500 + Math.random() * 2500 + i * 300),
  }));
}

function generateFilterOptions(filterKey: string): string[] {
  return ['All', 'Equities', 'Fixed Income', 'FX', 'Commodities', 'Alternatives'];
}

// ─── Widget type catalogue ────────────────────────────────────────────────────

const WIDGET_TYPES: { type: ChartType; label: string; icon: typeof BarChart3; description: string }[] = [
  { type: 'bar', label: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { type: 'area', label: 'Area Chart', icon: TrendingUp, description: 'Show trends over time' },
  { type: 'line', label: 'Line Chart', icon: Activity, description: 'Multi-series time series' },
  { type: 'pie', label: 'Pie Chart', icon: PieIcon, description: 'Part-to-whole distribution' },
  { type: 'kpi', label: 'KPI Card', icon: Sliders, description: 'Single metric highlight' },
  { type: 'filter-select', label: 'Filter (Select)', icon: Filter, description: 'Dropdown cross-filter' },
  { type: 'filter-range', label: 'Filter (Range)', icon: Sliders, description: 'Numeric range slider' },
];

// ─── Individual chart renderers ───────────────────────────────────────────────

function ChartContent({
  widget,
  activeFilters,
}: {
  widget: DashboardWidget;
  activeFilters: ActiveFilter[];
}) {
  const filtered = widget.data.filter((row: any) => {
    for (const f of activeFilters) {
      if (f.value === null || f.value === 'All') continue;
      if (row[f.key] !== undefined && row[f.key] !== f.value) return false;
    }
    return true;
  });

  const data = filtered.length > 0 ? filtered : widget.data;

  if (widget.type === 'kpi') {
    const d = widget.data[0];
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <p className="text-3xl font-bold text-foreground">{d?.value}</p>
        <p className={`text-sm font-medium ${d?.positive ? 'text-emerald-600' : 'text-destructive'}`}>{d?.change}</p>
      </div>
    );
  }

  if (widget.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="prev" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }} />
          <Area type="monotone" dataKey="prev" stroke="hsl(var(--border))" fill="transparent" strokeDasharray="4 4" strokeWidth={1.5} />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill={`url(#grad-${widget.id})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="prev" stroke="hsl(var(--secondary))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={widget.data} cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {widget.data.map((_: any, i: number) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

// ─── Filter widget renderers ──────────────────────────────────────────────────

function FilterWidget({
  widget,
  onFilter,
  currentFilter,
}: {
  widget: DashboardWidget;
  onFilter: (key: string, value: any) => void;
  currentFilter: ActiveFilter | undefined;
}) {
  const key = widget.filterKey || widget.id;

  if (widget.type === 'filter-select') {
    const options = generateFilterOptions(key);
    return (
      <div className="flex flex-col gap-2 h-full justify-center">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Filter by {key}</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onFilter(key, opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                (currentFilter?.value ?? 'All') === opt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary hover:text-foreground'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (widget.type === 'filter-range') {
    const [min, max] = widget.data as [number, number];
    const currentVal = (currentFilter?.value as [number, number]) ?? [min, max];
    return (
      <div className="flex flex-col gap-3 h-full justify-center">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Range: {currentVal[0]} – {currentVal[1]}</p>
        <input
          type="range"
          min={min}
          max={max}
          value={currentVal[1]}
          onChange={(e) => onFilter(key, [currentVal[0], Number(e.target.value)])}
          className="w-full accent-primary"
        />
      </div>
    );
  }

  return null;
}

// ─── Sortable Widget Card ─────────────────────────────────────────────────────

function SortableWidget({
  widget,
  activeFilters,
  onDelete,
  onUpdatePrompt,
  onFilter,
}: {
  widget: DashboardWidget;
  activeFilters: ActiveFilter[];
  onDelete: (id: string) => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onFilter: (key: string, value: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [editingPrompt, setEditingPrompt] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(widget.prompt);
  const promptRef = useRef<HTMLInputElement>(null);
  const isFilter = widget.type.startsWith('filter');
  const currentFilter = activeFilters.find((f) => f.key === (widget.filterKey || widget.id));

  const spanClass = widget.span === 3 ? 'col-span-3' : widget.span === 2 ? 'col-span-2' : 'col-span-1';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`${spanClass} citi-card flex flex-col group`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/40">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
        <span className="text-xs font-semibold text-foreground flex-1 truncate">{widget.title}</span>

        {/* Span toggle */}
        <button
          onClick={() => {/* handled via onUpdatePrompt with span change via dedicated handler */}}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
          title="Toggle width"
        >
          {widget.span === 1 ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
        </button>

        {/* Edit prompt */}
        {!isFilter && (
          <button
            onClick={() => { setEditingPrompt(true); setTimeout(() => promptRef.current?.focus(), 50); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
            title="Update chart via prompt"
          >
            <Edit3 size={13} />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => onDelete(widget.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          title="Remove widget"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Inline prompt editor */}
      <AnimatePresence>
        {editingPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-border/40 bg-muted/30 px-4 py-2"
          >
            <div className="flex items-center gap-2">
              <RefreshCw size={12} className="text-muted-foreground shrink-0" />
              <input
                ref={promptRef}
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onUpdatePrompt(widget.id, draftPrompt); setEditingPrompt(false); }
                  if (e.key === 'Escape') setEditingPrompt(false);
                }}
                placeholder="Describe what you want to visualize…"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={() => { onUpdatePrompt(widget.id, draftPrompt); setEditingPrompt(false); }}
                className="text-primary hover:text-primary/80 shrink-0"
              >
                <Check size={13} />
              </button>
              <button onClick={() => setEditingPrompt(false)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 p-4 min-h-[160px]">
        {widget.loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs">Generating…</span>
          </div>
        ) : isFilter ? (
          <FilterWidget widget={widget} onFilter={onFilter} currentFilter={currentFilter} />
        ) : (
          <ChartContent widget={widget} activeFilters={activeFilters} />
        )}
      </div>
    </motion.div>
  );
}

// ─── Add Widget Panel ─────────────────────────────────────────────────────────

function AddWidgetPanel({ onAdd, onClose }: { onAdd: (type: ChartType, prompt: string) => void; onClose: () => void }) {
  const [selectedType, setSelectedType] = useState<ChartType>('bar');
  const [prompt, setPrompt] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="citi-card p-5 mb-6 border-2 border-dashed border-primary/30 bg-primary/5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Add Component</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      {/* Type grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
        {WIDGET_TYPES.map(({ type, label, icon: Icon, description }) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
              selectedType === type
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Prompt input */}
      {!selectedType.startsWith('filter') && (
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 mb-4">
          <Sliders size={14} className="text-muted-foreground shrink-0" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && prompt.trim() && onAdd(selectedType, prompt)}
            placeholder={`Describe your ${selectedType} chart (e.g. "Portfolio returns by asset class")`}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      )}

      <button
        onClick={() => onAdd(selectedType, prompt || selectedType)}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Add to Dashboard
      </button>
    </motion.div>
  );
}

// ─── Layout row/col controls ──────────────────────────────────────────────────

function LayoutToolbar({
  onAddRow,
  onAddCol,
  onTogglePanel,
  showPanel,
}: {
  onAddRow: () => void;
  onAddCol: () => void;
  onTogglePanel: () => void;
  showPanel: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <button
        onClick={onTogglePanel}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
          showPanel ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:border-primary/50'
        }`}
      >
        <Plus size={15} />
        Add Component
      </button>
      <button
        onClick={onAddRow}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-card border border-border text-foreground hover:border-primary/50 transition-all"
      >
        <LayoutList size={15} />
        Add Row
      </button>
      <button
        onClick={onAddCol}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-card border border-border text-foreground hover:border-primary/50 transition-all"
      >
        <LayoutGrid size={15} />
        Add Column
      </button>
    </div>
  );
}

// ─── Main Dashboard Generator ─────────────────────────────────────────────────

let widgetCounter = 0;

function mkId() {
  return `w-${++widgetCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function createWidget(type: ChartType, prompt: string): DashboardWidget {
  const typeLabel = WIDGET_TYPES.find((t) => t.type === type)?.label ?? type;
  return {
    id: mkId(),
    type,
    title: prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt || typeLabel,
    prompt,
    data: [],
    span: type === 'kpi' ? 1 : type.startsWith('filter') ? 1 : 2,
    loading: true,
    filterKey: type.startsWith('filter') ? type.replace('filter-', '') : undefined,
  };
}

export function DashboardGenerator() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Simulate backend fetch for chart data
  const fetchChartData = useCallback((widgetId: string, type: ChartType, prompt: string) => {
    setTimeout(() => {
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === widgetId
            ? { ...w, loading: false, data: generateMockData(prompt, type) }
            : w
        )
      );
    }, 800 + Math.random() * 600);
  }, []);

  const handleAddWidget = useCallback((type: ChartType, prompt: string) => {
    const widget = createWidget(type, prompt);
    setWidgets((prev) => [...prev, widget]);
    fetchChartData(widget.id, type, prompt);
    setShowAddPanel(false);
  }, [fetchChartData]);

  const handleDelete = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleUpdatePrompt = useCallback((id: string, prompt: string) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, prompt, title: prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt, loading: true, data: [] }
          : w
      )
    );
    const widget = widgets.find((w) => w.id === id);
    if (widget) fetchChartData(id, widget.type, prompt);
  }, [widgets, fetchChartData]);

  const handleFilter = useCallback((key: string, value: any) => {
    setActiveFilters((prev) => {
      const existing = prev.findIndex((f) => f.key === key);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { key, value };
        return updated;
      }
      return [...prev, { key, value }];
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      setWidgets((prev) => {
        const oldIndex = prev.findIndex((w) => w.id === active.id);
        const newIndex = prev.findIndex((w) => w.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleAddRow = () => {
    // Add a full-width separator area hint — just adds a wide chart by default
    handleAddWidget('area', 'Row overview – trend over time');
  };

  const handleAddCol = () => {
    // Add a narrow KPI
    handleAddWidget('kpi', 'Key metric');
  };

  const activeWidget = widgets.find((w) => w.id === activeId);

  return (
    <div className="flex-1 h-screen overflow-y-auto citi-gradient-bg citi-grid-pattern">
      <div className="p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutGrid size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Dashboard Generator</h2>
              <p className="text-sm text-muted-foreground">Drag, drop, and prompt your way to beautiful dashboards</p>
            </div>
          </div>
          {activeFilters.filter((f) => f.value && f.value !== 'All').length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Active filters:</span>
              {activeFilters.filter((f) => f.value && f.value !== 'All').map((f) => (
                <button
                  key={f.key}
                  onClick={() => handleFilter(f.key, 'All')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {f.key}: {String(f.value)}
                  <X size={10} />
                </button>
              ))}
              <button
                onClick={() => setActiveFilters([])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </motion.div>

        {/* Toolbar */}
        <LayoutToolbar
          onAddRow={handleAddRow}
          onAddCol={handleAddCol}
          onTogglePanel={() => setShowAddPanel((v) => !v)}
          showPanel={showAddPanel}
        />

        {/* Add Widget Panel */}
        <AnimatePresence>
          {showAddPanel && (
            <AddWidgetPanel onAdd={handleAddWidget} onClose={() => setShowAddPanel(false)} />
          )}
        </AnimatePresence>

        {/* Empty state */}
        {widgets.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
              <LayoutGrid size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Your canvas is empty</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Click <strong>Add Component</strong> to start building your dashboard. Mix charts and filters for cross-filtering magic.
            </p>
            <button
              onClick={() => setShowAddPanel(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              <Plus size={16} />
              Add your first component
            </button>
          </motion.div>
        )}

        {/* Widget grid */}
        {widgets.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-4 auto-rows-[220px]">
                <AnimatePresence>
                  {widgets.map((widget) => (
                    <SortableWidget
                      key={widget.id}
                      widget={widget}
                      activeFilters={activeFilters}
                      onDelete={handleDelete}
                      onUpdatePrompt={handleUpdatePrompt}
                      onFilter={handleFilter}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>

            {/* Drag overlay */}
            <DragOverlay>
              {activeWidget && (
                <div className="citi-card p-4 shadow-2xl opacity-90 rotate-2">
                  <p className="text-xs font-semibold text-foreground">{activeWidget.title}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

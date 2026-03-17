import { useState, useEffect, useMemo, useCallback, DragEvent } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  X, Check, BarChart3, TrendingUp, Activity, PieChart as PieIcon,
  LayoutGrid, Sliders, Plus, Minus, Copy, Wand2, GripVertical,
  ArrowRight, ChevronRight, Table2, FileText,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChartType = 'bar' | 'area' | 'line' | 'pie' | 'heatmap' | 'filter-select' | 'filter-range' | 'kpi' | 'grid' | 'text' | 'report';

export interface ChartYKey {
  key: string;
  label: string;
  color: string;
}

export interface ChartConfig {
  xAxisKey: string;
  xAxisLabel: string;
  yAxisLabel: string;
  yKeys: ChartYKey[];
  showGrid: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  strokeWidth: number;
  barRadius: number;
  innerRadius: number;
  outerRadius: number;
  smooth: boolean;
  dotted: boolean;
}

export interface EditableWidget {
  id: string;
  type: ChartType;
  title: string;
  prompt: string;
  span: 1 | 2 | 3;
  data: any[];
  sourceId: string;
  filterKey?: string;
  config: ChartConfig;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const COLOR_PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Ocean',     colors: ['#0088FE', '#00C49F', '#06b6d4', '#3b82f6', '#8b5cf6', '#6366f1'] },
  { name: 'Sunset',    colors: ['#FF8042', '#FFBB28', '#FF6384', '#e11d48', '#f97316', '#eab308'] },
  { name: 'Forest',    colors: ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#42a244'] },
  { name: 'Berry',     colors: ['#8b5cf6', '#7c3aed', '#6d28d9', '#a855f7', '#c084fc', '#e879f9'] },
  { name: 'Citi',      colors: ['hsl(207,100%,22%)', 'hsl(195,80%,55%)', 'hsl(38,90%,55%)', 'hsl(270,60%,60%)', 'hsl(160,60%,45%)', 'hsl(0,75%,55%)'] },
  { name: 'Grayscale', colors: ['#374151', '#6b7280', '#9ca3af', '#d1d5db', '#1f2937', '#4b5563'] },
];

export const DEFAULT_COLORS = COLOR_PALETTES[0].colors;

export function defaultChartConfig(type: ChartType): ChartConfig {
  // area/line keep two series for comparison; bar/pie/heatmap default to single
  const twoSeries = type === 'area' || type === 'line';
  return {
    xAxisKey: 'name',
    xAxisLabel: '',
    yAxisLabel: '',
    yKeys: twoSeries
      ? [
          { key: 'value', label: 'Value',    color: DEFAULT_COLORS[0] },
          { key: 'prev',  label: 'Previous', color: DEFAULT_COLORS[1] },
        ]
      : [
          { key: 'value', label: 'Value', color: DEFAULT_COLORS[0] },
        ],
    showGrid: true,
    showLegend: type === 'line' || type === 'area',
    showTooltip: true,
    strokeWidth: 2,
    barRadius: 4,
    innerRadius: 40,
    outerRadius: 70,
    smooth: true,
    dotted: false,
  };
}

const CHART_TYPE_OPTIONS: { type: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { type: 'bar',     label: 'Bar',     icon: BarChart3  },
  { type: 'area',    label: 'Area',    icon: TrendingUp },
  { type: 'line',    label: 'Line',    icon: Activity   },
  { type: 'pie',     label: 'Pie',     icon: PieIcon    },
  { type: 'heatmap', label: 'Heatmap', icon: LayoutGrid },
  { type: 'kpi',     label: 'KPI',     icon: Sliders    },
  { type: 'grid',    label: 'Grid',    icon: Table2     },
  { type: 'text',    label: 'Text',    icon: FileText   },
];

// ─── Prompt → config helper ───────────────────────────────────────────────────

export function applyPromptToConfig(
  prompt: string,
  availableKeys: string[],
  currentConfig: ChartConfig,
): Partial<ChartConfig> {
  const p = prompt.toLowerCase();
  const updates: Partial<ChartConfig> = {};

  // Keys that are numeric/non-categorical and should never be the x-axis
  const NUMERIC_KEYS = new Set(['value', 'prev']);
  const categoricalKeys = availableKeys.filter(k => !NUMERIC_KEYS.has(k));

  // Prefer a categorical key explicitly mentioned in the prompt/title.
  // Prefix-matching handles singular/plural: "industry" matches key "industries"
  const promptWords = p.split(/\W+/).filter(w => w.length >= 4);
  const mentionedCatKey = categoricalKeys.find(k => {
    const kLower = k.toLowerCase();
    return promptWords.some(w => kLower.startsWith(w) || w.startsWith(kLower));
  });

  if (mentionedCatKey) {
    updates.xAxisKey = mentionedCatKey;
  } else {
    const timeKeys = availableKeys.filter(k =>
      ['name', 'date', 'month', 'year', 'quarter', 'week', 'period', 'time'].some(t => k.toLowerCase().includes(t)),
    );
    if (timeKeys.length > 0) updates.xAxisKey = timeKeys[0];
  }

  const isCategoricalX = !!mentionedCatKey;
  // For value series: exclude the chosen xAxisKey and other categorical/string keys
  const valueKeys = availableKeys.filter(k =>
    k !== (updates.xAxisKey ?? currentConfig.xAxisKey) && NUMERIC_KEYS.has(k),
  );
  const mentionedKeys = valueKeys.filter(k => p.includes(k.toLowerCase()));
  // Categorical x-axis → single value bar/slice; time x-axis → allow two series
  const maxSeries = isCategoricalX ? 1 : 2;
  const seriesKeys = mentionedKeys.length > 0 ? mentionedKeys : valueKeys.slice(0, maxSeries);

  if (seriesKeys.length > 0) {
    updates.yKeys = seriesKeys.map((k, i) => ({
      key:   k,
      label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
      color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }));
  }

  if (p.includes('monthly') || p.includes('month')) updates.xAxisLabel = 'Month';
  else if (p.includes('weekly'))                     updates.xAxisLabel = 'Week';
  else if (p.includes('quarterly'))                  updates.xAxisLabel = 'Quarter';
  if (p.includes('revenue'))                         updates.yAxisLabel = 'Revenue ($)';
  else if (p.includes('risk'))                       updates.yAxisLabel = 'Risk Score';
  else if (p.includes('volume'))                     updates.yAxisLabel = 'Volume';
  else if (p.includes('%') || p.includes('percent')) updates.yAxisLabel = 'Percentage (%)';

  if (p.includes('no grid') || p.includes('clean')) updates.showGrid = false;
  if (p.includes('legend'))                         updates.showLegend = true;
  if (p.includes('smooth'))                         updates.smooth = true;
  if (p.includes('dotted') || p.includes('dashed')) updates.dotted = true;

  return updates;
}

// ─── Chart Preview ────────────────────────────────────────────────────────────

function ChartPreview({ widget, config }: { widget: EditableWidget; config: ChartConfig }) {
  const { data } = widget;

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <BarChart3 size={24} className="opacity-30" />
        <p className="text-xs">No data — save and re-open after data loads</p>
      </div>
    );
  }

  if (widget.type === 'kpi') {
    const d = data[0];
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <p className="text-4xl font-bold">{d?.value ?? '—'}</p>
        <p className={`text-sm font-medium ${d?.positive ? 'text-emerald-500' : 'text-rose-500'}`}>{d?.change ?? ''}</p>
      </div>
    );
  }

  if (widget.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%"
            innerRadius={`${config.innerRadius}%`} outerRadius={`${config.outerRadius}%`}
            paddingAngle={3} dataKey="value"
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
          >
            {data.map((_: any, i: number) => (
              <Cell key={i} fill={config.yKeys[i % Math.max(config.yKeys.length, 1)]?.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
          {config.showTooltip && <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: config.xAxisLabel ? 20 : 4 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
          <XAxis dataKey={config.xAxisKey} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={config.xAxisLabel ? { value: config.xAxisLabel, position: 'insideBottom', offset: -8, fontSize: 10 } : undefined} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 10 } : undefined} />
          {config.showTooltip && <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />}
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {config.yKeys.map(yk => <Bar key={yk.key} dataKey={yk.key} name={yk.label} fill={yk.color} radius={[config.barRadius, config.barRadius, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: config.xAxisLabel ? 20 : 4 }}>
          <defs>
            {config.yKeys.map((yk, i) => (
              <linearGradient key={yk.key} id={`grad-p-${widget.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={yk.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={yk.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
          <XAxis dataKey={config.xAxisKey} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          {config.showTooltip && <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />}
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {config.yKeys.map((yk, i) => (
            <Area key={yk.key} type={config.smooth ? 'monotone' : 'linear'} dataKey={yk.key} name={yk.label}
              stroke={yk.color} fill={`url(#grad-p-${widget.id}-${i})`}
              strokeWidth={config.strokeWidth} strokeDasharray={config.dotted ? '4 4' : undefined} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: config.xAxisLabel ? 20 : 4 }}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
          <XAxis dataKey={config.xAxisKey} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          {config.showTooltip && <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />}
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {config.yKeys.map(yk => (
            <Line key={yk.key} type={config.smooth ? 'monotone' : 'linear'} dataKey={yk.key} name={yk.label}
              stroke={yk.color} strokeWidth={config.strokeWidth} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'heatmap') {
    const points = data.filter((row: any) => row && typeof row === 'object');
    const metrics = config.yKeys.length > 0
      ? config.yKeys.map((yk) => ({ key: yk.key, label: yk.label }))
      : [{ key: 'value', label: 'Value' }, { key: 'prev', label: 'Prev' }];
    const vals = points.flatMap((row: any) =>
      metrics.map((m) => Number(row?.[m.key])).filter((v) => Number.isFinite(v))
    );
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    const range = max - min || 1;
    const intensity = (raw: unknown) => {
      const v = Number(raw);
      if (!Number.isFinite(v)) return 0.08;
      return 0.12 + ((v - min) / range) * 0.78;
    };
    if (!points.length) return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <BarChart3 size={24} className="opacity-30" />
        <p className="text-xs">No data — save and re-open after data loads</p>
      </div>
    );
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-[10px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-muted-foreground px-1 py-1 font-medium">Metric</th>
              {points.map((row: any, idx: number) => (
                <th key={idx} className="text-muted-foreground px-1 py-1 font-medium">{String(row?.name ?? `P${idx + 1}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
             {metrics.map((metric, metricIdx) => {
               const cellColor = config.yKeys[metricIdx]?.color ?? DEFAULT_COLORS[metricIdx % DEFAULT_COLORS.length];
               return (
                 <tr key={metric.key}>
                   <td className="text-muted-foreground px-1 py-1 font-medium">{metric.label}</td>
                   {points.map((row: any, idx: number) => {
                     const raw = row?.[metric.key];
                     return (
                       <td key={idx}>
                         <div className="relative w-full rounded border border-border overflow-hidden">
                           <div className="absolute inset-0" style={{ background: cellColor, opacity: intensity(raw) }} />
                           <div className="relative px-1 py-2 text-foreground text-center">
                             {Number.isFinite(Number(raw)) ? Number(raw).toLocaleString() : '-'}
                           </div>
                         </div>
                       </td>
                     );
                   })}
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>
    );
  }

  if (widget.type === 'grid') {
    if (!data.length) return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <BarChart3 size={24} className="opacity-30" />
        <p className="text-xs">No data</p>
      </div>
    );
    const columns = Object.keys(data[0]).filter((k) => !k.startsWith('_'));
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col} className="text-left text-muted-foreground px-2 py-1.5 font-medium whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row: any, i: number) => (
              <tr key={i} className="border-b border-border/40 hover:bg-primary/5 transition-colors">
                {columns.map((col) => (
                  <td key={col} className="px-2 py-1.5 text-foreground whitespace-nowrap">{String(row[col] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (widget.type === 'text') {
    return (
      <div className="h-full p-3 overflow-auto flex items-start">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {widget.prompt || <span className="text-muted-foreground italic text-xs">No text content. Use the Text tab to add content.</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
      Preview not available for this chart type
    </div>
  );
}

// ─── Draggable Key Chip ───────────────────────────────────────────────────────

function KeyChip({ dataKey, onDragStart }: { dataKey: string; onDragStart: (k: string) => void }) {
  return (
    <div
      draggable
      onDragStart={(e: DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('text/plain', dataKey);
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart(dataKey);
      }}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-card border border-border text-[11px] font-mono text-foreground cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5 transition-all select-none"
      title={`Drag "${dataKey}" onto X-axis or Y-series`}
    >
      <GripVertical size={9} className="text-muted-foreground" />
      {dataKey}
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ label, value, onDrop, hint, color }: {
  label: string; value: string; onDrop: (key: string) => void; hint?: string; color?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); const k = e.dataTransfer.getData('text/plain'); if (k) onDrop(k); setOver(false); }}
      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-all ${
        over ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-dashed border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        {value ? (
          <div className="flex items-center gap-1.5">
            {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
            <span className="text-xs font-mono font-medium text-foreground truncate">{value}</span>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">{hint ?? 'Drop a data key here'}</p>
        )}
      </div>
      <ArrowRight size={13} className={`shrink-0 transition-colors ${over ? 'text-primary' : 'text-muted-foreground/40'}`} />
    </div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-foreground">{label}</span>
      <button onClick={() => onChange(!checked)} style={{ height: 22, width: 40 }}
        className={`rounded-full transition-colors relative flex items-center ${checked ? 'bg-primary' : 'bg-border'}`}>
        <span className={`absolute top-0.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
          style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );
}

function NumberSlider({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm text-foreground">{label}</label>
        <span className="text-xs text-foreground font-mono bg-muted px-2 py-0.5 rounded">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary h-1.5 rounded-full" />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors" />
    </div>
  );
}

function YSeriesRow({ yk, index, onUpdate, onRemove }: {
  yk: ChartYKey; index: number;
  onUpdate: (i: number, p: Partial<ChartYKey>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 group/row p-2 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
      <input type="color" value={yk.color.startsWith('hsl') ? '#0088FE' : yk.color}
        onChange={(e) => onUpdate(index, { color: e.target.value })}
        className="w-7 h-7 rounded-lg border border-border cursor-pointer bg-transparent shrink-0" title="Series color" />
      <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
        <input value={yk.key} onChange={(e) => onUpdate(index, { key: e.target.value })} placeholder="data key"
          className="bg-muted/50 border border-transparent rounded-md px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 w-full" />
        <input value={yk.label} onChange={(e) => onUpdate(index, { label: e.target.value })} placeholder="display label"
          className="bg-muted/50 border border-transparent rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 w-full" />
      </div>
      <button onClick={() => onRemove(index)} className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
        <Minus size={14} />
      </button>
    </div>
  );
}

function JsonPreview({ widget, config }: { widget: EditableWidget; config: ChartConfig }) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify({
    widgetId: widget.id,
    type: widget.type,
    title: widget.title,
    prompt: widget.prompt,
    sourceId: widget.sourceId,
    span: widget.span,
    config: {
      xAxisKey: config.xAxisKey,
      xAxisLabel: config.xAxisLabel || undefined,
      yAxisLabel: config.yAxisLabel || undefined,
      yKeys: config.yKeys,
      display: {
        showGrid: config.showGrid, showLegend: config.showLegend, showTooltip: config.showTooltip,
        strokeWidth: config.strokeWidth, barRadius: config.barRadius,
        smooth: config.smooth, dotted: config.dotted,
        innerRadius: config.innerRadius, outerRadius: config.outerRadius,
      },
    },
  }, null, 2), [widget, config]);

  return (
    <div className="relative h-full">
      <button
        onClick={() => { navigator.clipboard.writeText(json).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-card border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground text-[11px] transition-all"
      >
        {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="text-[11px] bg-muted/40 rounded-xl p-4 pr-20 overflow-auto h-full text-foreground font-mono leading-relaxed border border-border/50">
        {json}
      </pre>
    </div>
  );
}

function PalettePicker({ yKeys, onChange }: { yKeys: ChartYKey[]; onChange: (keys: ChartYKey[]) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {COLOR_PALETTES.map((palette) => (
        <button key={palette.name}
          onClick={() => onChange(yKeys.map((yk, i) => ({ ...yk, color: palette.colors[i % palette.colors.length] })))}
          className="flex flex-col items-start gap-1.5 p-2.5 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/5 transition-all group"
        >
          <div className="flex gap-1">
            {palette.colors.slice(0, 5).map((c) => <div key={c} className="w-4 h-4 rounded" style={{ background: c }} />)}
          </div>
          <span className="text-[11px] text-muted-foreground group-hover:text-foreground">{palette.name}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

type TabId = 'prompt' | 'axes' | 'series' | 'style' | 'json';

interface ChartEditDialogProps {
  widget: EditableWidget;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Partial<EditableWidget> & { config: ChartConfig }) => void;
  schemaKeys?: string[];
  onFetchPreview?: (xAxisKey: string, widgetType: ChartType, prompt: string) => Promise<any[]>;
}

export function ChartEditDialog({ widget, open, onClose, onSave, schemaKeys, onFetchPreview }: ChartEditDialogProps) {
  const [draftTitle,    setDraftTitle]    = useState(widget.title);
  const [draftPrompt,   setDraftPrompt]   = useState(widget.prompt);
  const [draftType,     setDraftType]     = useState<ChartType>(widget.type);
  const [draftSpan,     setDraftSpan]     = useState<1 | 2 | 3>(widget.span);
  const [draftConfig,   setDraftConfig]   = useState<ChartConfig>({ ...widget.config });
  const [activeTab,     setActiveTab]     = useState<TabId>('prompt');
  const [promptApplied, setPromptApplied] = useState(false);
  const [previewData,   setPreviewData]   = useState<any[]>(widget.data);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [, setDraggingKey] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(widget.title);
    setDraftPrompt(widget.prompt);
    setDraftType(widget.type);
    setDraftSpan(widget.span);
    setDraftConfig({ ...widget.config });
    setPreviewData(widget.data);
    setActiveTab('prompt');
    setPromptApplied(false);
  }, [widget.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPreviewData(widget.data);
  }, [widget.data]);

  const updateConfig = useCallback((partial: Partial<ChartConfig>) => {
    setDraftConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const availableKeys = useMemo(
    () =>
      schemaKeys && schemaKeys.length > 0
        ? schemaKeys
        : widget.data.length > 0
          ? Object.keys(widget.data[0]).filter((k) => !k.startsWith('_'))
          : [],
    [schemaKeys, widget.data],
  );

  const applyPrompt = async () => {
    const updates = applyPromptToConfig(draftPrompt, availableKeys, draftConfig);
    updateConfig(updates);
    setPromptApplied(true);
    setTimeout(() => setPromptApplied(false), 2500);
    if (onFetchPreview) {
      const newXAxisKey = updates.xAxisKey ?? draftConfig.xAxisKey;
      setPreviewLoading(true);
      const data = await onFetchPreview(newXAxisKey, draftType, draftPrompt);
      setPreviewLoading(false);
      if (data.length > 0) setPreviewData(data);
    }
  };

  const updateYKey = (i: number, partial: Partial<ChartYKey>) => {
    const next = [...draftConfig.yKeys];
    next[i] = { ...next[i], ...partial };
    updateConfig({ yKeys: next });
  };
  const removeYKey = (i: number) => updateConfig({ yKeys: draftConfig.yKeys.filter((_, j) => j !== i) });
  const addYKey = (key = '') => {
    const idx = draftConfig.yKeys.length;
    updateConfig({
      yKeys: [...draftConfig.yKeys, {
        key:   key || `series${idx + 1}`,
        label: key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') : `Series ${idx + 1}`,
        color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      }],
    });
  };

  const handleSave = () => {
    onSave({
      title:  draftTitle.trim()  || widget.title,
      prompt: draftPrompt.trim() || widget.prompt,
      type:   draftType,
      span:   draftSpan,
      config: draftConfig,
    });
    onClose();
  };

  const isFilter = draftType.startsWith('filter');
  const isText = draftType === 'text';
  const isKpi = draftType === 'kpi';
  const isGrid = draftType === 'grid';

  const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: 'prompt', label: isText ? '✦ Text' : '✦ Prompt' },
    { id: 'axes',   label: 'Axes',   disabled: isFilter || draftType === 'kpi' || isText || draftType === 'grid' },
    { id: 'series', label: 'Series', disabled: isFilter || draftType === 'kpi' || isText || draftType === 'grid' },
    { id: 'style',  label: 'Style',  disabled: isFilter || isText },
    { id: 'json',   label: 'JSON',   disabled: isText },
  ];

  const availableManualShortcuts = (['axes', 'series', 'style'] as const).filter(
    t => !tabs.find(tab => tab.id === t)?.disabled,
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="p-0 gap-0 flex flex-col overflow-hidden border-0 shadow-2xl [&>button:last-child]:hidden"
        style={{ width: '98vw', maxWidth: '98vw', height: '92vh', maxHeight: '92vh' }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              {isKpi ? <TrendingUp size={16} className="text-primary" />
                : isGrid ? <Table2 size={16} className="text-primary" />
                : isFilter ? <Sliders size={16} className="text-primary" />
                : isText ? <FileText size={16} className="text-primary" />
                : <BarChart3 size={16} className="text-primary" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-tight">
                {draftTitle || (isKpi ? 'Edit KPI' : isGrid ? 'Edit Data Grid' : isFilter ? 'Edit Filter' : isText ? 'Edit Text' : 'Edit Chart')}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isKpi ? 'KPI widget settings' : isGrid ? 'Data grid settings' : isFilter ? 'Filter widget settings' : isText ? 'Text widget settings' : 'Prompt-first chart editor'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm">
              <Check size={14} />
              Apply Changes
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: preview + keys */}
          <div className="flex flex-col border-r border-border bg-muted/20" style={{ width: '55vw', minWidth: '40vw' }}>
            {!isFilter && (
              <div className="px-4 pt-3 pb-2 border-b border-border/50 shrink-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chart Type</p>
                <div className="flex gap-1.5 flex-wrap">
                  {CHART_TYPE_OPTIONS.filter(o => !o.type.startsWith('filter')).map(({ type, label, icon: Icon }) => (
                    <button key={type} onClick={() => setDraftType(type)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                        draftType === type ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 p-4 min-h-0 overflow-hidden">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Live Preview</p>
              <div className="relative rounded-xl border border-border/50 bg-card overflow-hidden p-3" style={{ height: 'calc(100% - 20px)' }}>
                <ChartPreview widget={{ ...widget, type: draftType, data: previewData }} config={draftConfig} />
                {previewLoading && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="animate-spin">⟳</span> Updating preview…
                    </div>
                  </div>
                )}
              </div>
            </div>

            {availableKeys.length > 0 && (
              <div className="px-4 py-3 border-t border-border/50 shrink-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Available Keys
                  <span className="ml-1 font-normal text-muted-foreground/60 normal-case tracking-normal">— drag onto axes / series</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availableKeys.map((k) => <KeyChip key={k} dataKey={k} onDragStart={setDraggingKey} />)}
                </div>
              </div>
            )}

            <div className="px-4 pb-4 shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Widget Width</p>
              <div className="flex gap-1.5">
                {([1, 2, 3] as const).map((s) => (
                  <button key={s} onClick={() => setDraftSpan(s)}
                    className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                      draftSpan === s ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {s === 1 ? '⅓ Width' : s === 2 ? '⅔ Width' : 'Full Width'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: tabs */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            <div className="flex gap-0.5 px-6 pt-3 border-b border-border shrink-0">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)} disabled={tab.disabled}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
                    activeTab === tab.id ? 'text-primary border-primary bg-primary/5'
                    : tab.disabled ? 'text-muted-foreground/40 border-transparent cursor-not-allowed'
                    : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">

                {activeTab === 'prompt' && (
                  <div className="space-y-6">
                    <Section label="Basic Info">
                      <FieldInput label="Chart Title" value={draftTitle} onChange={setDraftTitle} placeholder="e.g. Monthly Revenue Trend" />
                    </Section>
                    <Section label={isText ? 'Text Content' : 'AI Prompt — describe what to visualize'}>
                      <div>
                        <textarea value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)}
                          onKeyDown={(e) => { if (!isText && (e.metaKey || e.ctrlKey) && e.key === 'Enter') applyPrompt(); }}
                          placeholder={isText ? 'Enter your report text, analysis notes, or any formatted content…' : 'Describe the chart, e.g.: "Show monthly revenue vs previous period as a smooth area chart with legend."'}
                          rows={isText ? 10 : 5}
                          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 resize-none transition-colors leading-relaxed"
                        />
                        {!isText && <p className="text-[10px] text-muted-foreground mt-1">Ctrl/⌘+Enter to apply</p>}
                      </div>
                      {!isText && <button onClick={applyPrompt}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${
                          promptApplied ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm shadow-primary/20'
                        }`}
                      >
                        {promptApplied ? <><Check size={15} /> Config updated from prompt</> : <><Wand2 size={15} /> Generate Config from Prompt</>}
                      </button>}
                      {!isText && promptApplied && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                          <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Config auto-updated</p>
                            <p className="text-[11px] text-emerald-600/80 mt-0.5">X-axis key, Y-series, labels and style were inferred. Switch to Axes/Series to fine-tune.</p>
                          </div>
                        </div>
                      )}
                    </Section>
                    {!isText && availableManualShortcuts.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="h-px flex-1 bg-border" /><span className="text-xs">or edit manually</span><div className="h-px flex-1 bg-border" />
                        </div>
                        <div className={`grid gap-2 ${availableManualShortcuts.length === 1 ? 'grid-cols-1' : availableManualShortcuts.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {availableManualShortcuts.map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-sm text-muted-foreground hover:text-foreground transition-all"
                            >
                              <ChevronRight size={14} />
                              {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'axes' && (
                  <div className="space-y-6">
                    <Section label="X Axis">
                      <DropZone label="X Axis Key" value={draftConfig.xAxisKey} onDrop={(k) => updateConfig({ xAxisKey: k })} hint="Drag a key here, or type below" />
                      <FieldInput label="Key (manual)" value={draftConfig.xAxisKey} onChange={(v) => updateConfig({ xAxisKey: v })} placeholder="e.g. name, month, date" />
                      <FieldInput label="Axis Label (optional)" value={draftConfig.xAxisLabel} onChange={(v) => updateConfig({ xAxisLabel: v })} placeholder="e.g. Month" />
                    </Section>
                    <Section label="Y Axis">
                      <FieldInput label="Axis Label (optional)" value={draftConfig.yAxisLabel} onChange={(v) => updateConfig({ yAxisLabel: v })} placeholder="e.g. Revenue ($M)" />
                      <div className="mt-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Data Series — drag keys from the left panel or add manually</p>
                        <DropZone label="Drop key to add Y series" value="" onDrop={(k) => addYKey(k)} hint="Drag a key from Available Keys on the left" />
                        <div className="space-y-2 mt-2">
                          {draftConfig.yKeys.map((yk, i) => (
                            <YSeriesRow key={`${yk.key}-${i}`} yk={yk} index={i} onUpdate={updateYKey} onRemove={removeYKey} />
                          ))}
                          {draftConfig.yKeys.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-3">No series — drop a key above or click Add.</p>
                          )}
                        </div>
                        <button onClick={() => addYKey()} className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 mt-2 transition-colors">
                          <Plus size={14} /> Add series manually
                        </button>
                      </div>
                    </Section>
                    {draftType === 'pie' && (
                      <Section label="Pie Dimensions">
                        <NumberSlider label="Inner Radius (%)" value={draftConfig.innerRadius} min={0} max={90} onChange={(v) => updateConfig({ innerRadius: v })} />
                        <NumberSlider label="Outer Radius (%)" value={draftConfig.outerRadius} min={10} max={95} onChange={(v) => updateConfig({ outerRadius: v })} />
                      </Section>
                    )}
                  </div>
                )}

                {activeTab === 'series' && (
                  <div className="space-y-6">
                    <Section label="Color Palette">
                      <PalettePicker yKeys={draftConfig.yKeys} onChange={(keys) => updateConfig({ yKeys: keys })} />
                    </Section>
                    <Section label="Y-Axis Series — drag keys from the panel or edit manually">
                      <DropZone label="Drop key to add new series" value="" onDrop={(k) => addYKey(k)} hint="Drag a key from Available Keys on the left" />
                      <div className="space-y-2 mt-2">
                        {draftConfig.yKeys.map((yk, i) => (
                          <YSeriesRow key={`${yk.key}-${i}`} yk={yk} index={i} onUpdate={updateYKey} onRemove={removeYKey} />
                        ))}
                        {draftConfig.yKeys.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No series — drop a key above or click Add.</p>
                        )}
                      </div>
                      <button onClick={() => addYKey()} className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 mt-1 transition-colors">
                        <Plus size={14} /> Add series manually
                      </button>
                    </Section>
                  </div>
                )}

                {activeTab === 'style' && (
                  <div className="space-y-6">
                    <Section label="Chart Display">
                      <div className="divide-y divide-border/40 rounded-xl border border-border overflow-hidden bg-card">
                        <div className="px-3"><Toggle checked={draftConfig.showGrid}    onChange={(v) => updateConfig({ showGrid: v })}    label="Show Grid Lines" /></div>
                        <div className="px-3"><Toggle checked={draftConfig.showLegend}  onChange={(v) => updateConfig({ showLegend: v })}  label="Show Legend" /></div>
                        <div className="px-3"><Toggle checked={draftConfig.showTooltip} onChange={(v) => updateConfig({ showTooltip: v })} label="Show Tooltip on Hover" /></div>
                        {(draftType === 'line' || draftType === 'area') && (<>
                          <div className="px-3"><Toggle checked={draftConfig.smooth} onChange={(v) => updateConfig({ smooth: v })} label="Smooth Curves" /></div>
                          <div className="px-3"><Toggle checked={draftConfig.dotted} onChange={(v) => updateConfig({ dotted: v })} label="Dotted Lines" /></div>
                        </>)}
                      </div>
                    </Section>
                    {draftType === 'bar' && (
                      <Section label="Bar Style">
                        <NumberSlider label="Corner Radius" value={draftConfig.barRadius} min={0} max={20} onChange={(v) => updateConfig({ barRadius: v })} />
                      </Section>
                    )}
                    {(draftType === 'line' || draftType === 'area') && (
                      <Section label="Line Style">
                        <NumberSlider label="Stroke Width" value={draftConfig.strokeWidth} min={1} max={8} onChange={(v) => updateConfig({ strokeWidth: v })} />
                      </Section>
                    )}
                  </div>
                )}

                {activeTab === 'json' && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-3">Backend-ready JSON configuration for this widget.</p>
                    <div style={{ height: 'calc(92vh - 220px)' }}>
                      <JsonPreview widget={{ ...widget, type: draftType, span: draftSpan, title: draftTitle, prompt: draftPrompt }} config={draftConfig} />
                    </div>
                  </div>
                )}

              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

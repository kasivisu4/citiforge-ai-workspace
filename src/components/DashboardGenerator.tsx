import { useState, useCallback, useRef, useEffect } from 'react';
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
  PieChart as PieIcon, Activity, Bot,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChartType = 'bar' | 'area' | 'line' | 'pie' | 'heatmap' | 'filter-select' | 'filter-range' | 'kpi';

interface DashboardWidget {
  id: string;
  type: ChartType;
  sourceId: string;
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

interface DashboardSchemaColumn {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'unknown';
  filterable: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface DashboardDataSchema {
  columns: DashboardSchemaColumn[];
}

interface DashboardDataSource {
  id: string;
  label: string;
}

const DEFAULT_DATA_SCHEMA: DashboardDataSchema = {
  columns: [
    { name: 'imports_exports', type: 'string', filterable: true, options: ['All', 'Imports', 'Exports'] },
    { name: 'industries', type: 'string', filterable: true, options: ['All', 'Automotive', 'Electronics', 'Pharma', 'Energy'] },
    { name: 'products', type: 'string', filterable: true, options: ['All', 'Trade Finance', 'Supply Chain Finance', 'Commodity Credit'] },
  ],
};

interface DashboardPromptBundle {
  dataSource: {
    kind: 'backend';
    sourceId: string;
    generatedAt: string;
    activeFilters: ActiveFilter[];
  };
  components: Array<{
    id: string;
    type: ChartType;
    sourceId: string;
    title: string;
    prompt: string;
    span: 1 | 2 | 3;
    filterKey?: string;
  }>;
}

function bundleWidgetsForPrompt(widgets: DashboardWidget[], activeFilters: ActiveFilter[], sourceId: string): DashboardPromptBundle {
  return {
    dataSource: {
      kind: 'backend',
      sourceId,
      generatedAt: new Date().toISOString(),
      activeFilters,
    },
    components: widgets.map((widget) => ({
      id: widget.id,
      type: widget.type,
      sourceId: widget.sourceId,
      title: widget.title,
      prompt: widget.prompt,
      span: widget.span,
      filterKey: widget.filterKey,
    })),
  };
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

function formatColumnLabel(columnName: string): string {
  return columnName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSelectableColumns(schema: DashboardDataSchema): DashboardSchemaColumn[] {
  return schema.columns.filter((column) => column.filterable && Array.isArray(column.options) && column.options.length > 0);
}

function getRangeColumns(schema: DashboardDataSchema): DashboardSchemaColumn[] {
  return schema.columns.filter((column) => column.filterable && column.type === 'number');
}

function generateFilterOptions(filterKey: string, schema: DashboardDataSchema): string[] {
  const targetColumn = schema.columns.find((column) => column.name === filterKey);
  if (!targetColumn) return ['All'];
  if (Array.isArray(targetColumn.options) && targetColumn.options.length > 0) return targetColumn.options;
  return ['All'];
}

function resolveChartFilter(
  row: Record<string, unknown>,
  schema: DashboardDataSchema
): { key: string; value: string | number } | null {
  const explicitFilterKey = row._filterKey;
  const explicitFilterValue = row._filterValue;
  if (typeof explicitFilterKey === 'string' && (typeof explicitFilterValue === 'string' || typeof explicitFilterValue === 'number')) {
    return { key: explicitFilterKey, value: explicitFilterValue };
  }

  const nameColumn = schema.columns.find((column) => column.name === 'name' && column.filterable);
  if (nameColumn && row.name !== undefined && row.name !== null && String(row.name).length > 0) {
    return { key: 'name', value: String(row.name) };
  }

  const candidate = schema.columns.find((column) =>
    column.filterable &&
    (column.type === 'string' || column.type === 'boolean') &&
    column.name !== 'name' &&
    row[column.name] !== undefined &&
    row[column.name] !== null &&
    String(row[column.name]).length > 0
  );

  if (candidate) {
    return { key: candidate.name, value: String(row[candidate.name]) };
  }

  if (row.name !== undefined && row.name !== null) {
    return { key: 'name', value: String(row.name) };
  }

  return null;
}

function extractChartRow(eventLike: unknown): Record<string, unknown> | null {
  if (!eventLike || typeof eventLike !== 'object') return null;
  const record = eventLike as Record<string, unknown>;

  if (record.payload && typeof record.payload === 'object') {
    return record.payload as Record<string, unknown>;
  }

  const activePayload = record.activePayload;
  if (Array.isArray(activePayload) && activePayload.length > 0) {
    const first = activePayload[0] as Record<string, unknown>;
    if (first?.payload && typeof first.payload === 'object') {
      return first.payload as Record<string, unknown>;
    }
  }

  return record;
}

// ─── Widget type catalogue ────────────────────────────────────────────────────

const WIDGET_TYPES: { type: ChartType; label: string; icon: typeof BarChart3; description: string }[] = [
  { type: 'bar', label: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { type: 'area', label: 'Area Chart', icon: TrendingUp, description: 'Show trends over time' },
  { type: 'line', label: 'Line Chart', icon: Activity, description: 'Multi-series time series' },
  { type: 'pie', label: 'Pie Chart', icon: PieIcon, description: 'Part-to-whole distribution' },
  { type: 'heatmap', label: 'Heatmap', icon: LayoutGrid, description: 'Color intensity across rows/metrics' },
  { type: 'kpi', label: 'KPI Card', icon: Sliders, description: 'Single metric highlight' },
  { type: 'filter-select', label: 'Filter (Select)', icon: Filter, description: 'Dropdown cross-filter' },
  { type: 'filter-range', label: 'Filter (Range)', icon: Sliders, description: 'Numeric range slider' },
];

// ─── Individual chart renderers ───────────────────────────────────────────────

function ChartContent({
  widget,
  activeFilters,
  dataSchema,
  onApplyFilter,
}: {
  widget: DashboardWidget;
  activeFilters: ActiveFilter[];
  dataSchema: DashboardDataSchema;
  onApplyFilter: (key: string, value: string | number) => void;
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
    const handleChartClick = (evt: any) => {
      const payload = extractChartRow(evt);
      if (!payload || typeof payload !== 'object') return;
      const filter = resolveChartFilter(payload as Record<string, unknown>, dataSchema);
      if (filter) onApplyFilter(filter.key, filter.value);
    };

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} onClick={handleChartClick}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} onClick={handleChartClick} />
          <Bar dataKey="prev" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} opacity={0.6} onClick={handleChartClick} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'area') {
    const handleChartClick = (evt: any) => {
      const payload = extractChartRow(evt);
      if (!payload || typeof payload !== 'object') return;
      const filter = resolveChartFilter(payload as Record<string, unknown>, dataSchema);
      if (filter) onApplyFilter(filter.key, filter.value);
    };

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} onClick={handleChartClick}>
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
          <Area type="monotone" dataKey="prev" stroke="hsl(var(--border))" fill="transparent" strokeDasharray="4 4" strokeWidth={1.5} onClick={handleChartClick} />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill={`url(#grad-${widget.id})`} strokeWidth={2} onClick={handleChartClick} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'line') {
    const handleChartClick = (evt: any) => {
      const payload = extractChartRow(evt);
      if (!payload || typeof payload !== 'object') return;
      const filter = resolveChartFilter(payload as Record<string, unknown>, dataSchema);
      if (filter) onApplyFilter(filter.key, filter.value);
    };

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} onClick={handleChartClick}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} onClick={handleChartClick} />
          <Line type="monotone" dataKey="prev" stroke="hsl(var(--secondary))" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" onClick={handleChartClick} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'pie') {
    const handlePieClick = (entry: any) => {
      const row = extractChartRow(entry);
      if (!row) return;
      const filter = resolveChartFilter(row, dataSchema);
      if (filter) onApplyFilter(filter.key, filter.value);
    };

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={widget.data} cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} onClick={handlePieClick}>
            {widget.data.map((_: any, i: number) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widget.type === 'heatmap') {
    const points = data.filter((row: any) => row && typeof row === 'object');
    const metrics = [
      { key: 'value', label: 'Value' },
      { key: 'prev', label: 'Prev' },
    ];

    const values = points.flatMap((row: any) =>
      metrics
        .map((metric) => Number(row?.[metric.key]))
        .filter((value) => Number.isFinite(value))
    );

    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const range = max - min || 1;

    const intensity = (raw: unknown) => {
      const value = Number(raw);
      if (!Number.isFinite(value)) return 0.08;
      const normalized = (value - min) / range;
      return 0.12 + normalized * 0.78;
    };

    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-[10px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-muted-foreground px-1 py-1 font-medium">Metric</th>
              {points.map((row: any, index: number) => (
                <th key={`${String(row?.name ?? 'col')}-${index}`} className="text-muted-foreground px-1 py-1 font-medium">{String(row?.name ?? `P${index + 1}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.key}>
                <td className="text-muted-foreground px-1 py-1 font-medium">{metric.label}</td>
                {points.map((row: any, index: number) => {
                  const rawValue = row?.[metric.key];
                  const alpha = intensity(rawValue);
                  const filter = resolveChartFilter(row as Record<string, unknown>, dataSchema);
                  return (
                    <td key={`${metric.key}-${index}`}>
                      <button
                        onClick={() => {
                          if (filter) onApplyFilter(filter.key, filter.value);
                        }}
                        className="w-full rounded px-1 py-2 border border-border text-foreground hover:border-primary/60 transition-colors"
                        style={{ backgroundColor: `hsl(var(--primary) / ${alpha})` }}
                      >
                        {Number.isFinite(Number(rawValue)) ? Number(rawValue).toLocaleString() : '-'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

// ─── Filter widget renderers ──────────────────────────────────────────────────

function FilterWidget({
  widget,
  onFilter,
  onUpdateFilterKey,
  currentFilter,
  dataSchema,
  sourceId,
  activeFilters,
}: {
  widget: DashboardWidget;
  onFilter: (key: string, value: any) => void;
  onUpdateFilterKey: (id: string, key: string) => void;
  currentFilter: ActiveFilter | undefined;
  dataSchema: DashboardDataSchema;
  sourceId: string;
  activeFilters: ActiveFilter[];
}) {
  const key = widget.filterKey || widget.id;
  const [draftValue, setDraftValue] = useState(String(currentFilter?.value ?? 'All'));
  const [optionSearch, setOptionSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<string[]>([]);
  const [rangeDraft, setRangeDraft] = useState<[number, number]>([0, 100]);
  const fallbackOptions = generateFilterOptions(key, dataSchema);
  const options = remoteOptions.length > 0 ? remoteOptions : fallbackOptions;
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(optionSearch.toLowerCase())
  );
  const rangeColumns = getRangeColumns(dataSchema);
  const selectedColumnMeta = dataSchema.columns.find((column) => column.name === key);
  const fallbackRangeMeta = rangeColumns[0];
  const rangeMin = Number(selectedColumnMeta?.min ?? fallbackRangeMeta?.min ?? 0);
  const rangeMax = Number(selectedColumnMeta?.max ?? fallbackRangeMeta?.max ?? 100);
  const currentRange = (currentFilter?.value as [number, number]) ?? [rangeMin, rangeMax];

  useEffect(() => {
    setDraftValue(String(currentFilter?.value ?? 'All'));
    setOptionSearch('');
  }, [currentFilter?.value, key]);

  useEffect(() => {
    if (widget.type !== 'filter-select') return;

    const filtersPayload = activeFilters.reduce<Record<string, string | number | [number, number] | null>>((acc, filter) => {
      if (filter.key !== key) acc[filter.key] = filter.value;
      return acc;
    }, {});

    fetch('http://localhost:4555/dashboard/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: sourceId,
        column: key,
        filters: filtersPayload,
      }),
    })
      .then((res) => res.json())
      .then((payload) => {
        const options = Array.isArray(payload?.options) ? payload.options.map(String) : [];
        setRemoteOptions(options);
      })
      .catch(() => {
        setRemoteOptions([]);
      });
  }, [widget.type, sourceId, key, activeFilters]);

  useEffect(() => {
    if (widget.type !== 'filter-range') return;
    setRangeDraft([currentRange[0], currentRange[1]]);
  }, [widget.type, currentRange[0], currentRange[1], key, rangeMin, rangeMax]);

  useEffect(() => {
    if (widget.type !== 'filter-select') return;
    if (!options.length) return;
    if (!options.includes(draftValue)) {
      setDraftValue(options[0]);
    }
  }, [widget.type, options, draftValue]);

  if (widget.type === 'filter-select') {
    const filterableColumns = getSelectableColumns(dataSchema);

    const applyDraft = () => {
      const normalized = draftValue.trim();
      if (!normalized) return;
      onFilter(key, normalized);
    };

    return (
      <div className="flex flex-col gap-2 h-full justify-center">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Filter by</p>
          <select
            value={key}
            onChange={(e) => onUpdateFilterKey(widget.id, e.target.value)}
            className="bg-card border border-border rounded-md text-xs px-2 py-1 text-foreground"
          >
            {filterableColumns.map((column) => (
              <option key={column.name} value={column.name}>{formatColumnLabel(column.name)}</option>
            ))}
          </select>
        </div>
        {options.length > 5 ? (
          <div className="flex flex-col gap-2">
            <input
              value={optionSearch}
              onChange={(e) => setOptionSearch(e.target.value)}
              placeholder="Search options"
              className="bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={draftValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setDraftValue(nextValue);
                  onFilter(key, nextValue);
                }}
                className="flex-1 bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground"
              >
                {filteredOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <button
                onClick={applyDraft}
                className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground"
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    );
  }

  if (widget.type === 'filter-range') {
    const applyRange = () => {
      const boundedMin = Math.max(rangeMin, Math.min(rangeDraft[0], rangeMax));
      const boundedMax = Math.max(boundedMin, Math.min(rangeDraft[1], rangeMax));
      onFilter(key, [boundedMin, boundedMax]);
    };

    return (
      <div className="flex flex-col gap-3 h-full justify-center">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Range column</p>
          <select
            value={key}
            onChange={(e) => onUpdateFilterKey(widget.id, e.target.value)}
            className="bg-card border border-border rounded-md text-xs px-2 py-1 text-foreground"
          >
            {rangeColumns.map((column) => (
              <option key={column.name} value={column.name}>{formatColumnLabel(column.name)}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Range: {currentRange[0]} – {currentRange[1]}</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={rangeMin}
            max={rangeMax}
            value={rangeDraft[0]}
            onChange={(e) => setRangeDraft((prev) => [Number(e.target.value), prev[1]])}
            className="bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground"
            placeholder="Min"
          />
          <input
            type="number"
            min={rangeMin}
            max={rangeMax}
            value={rangeDraft[1]}
            onChange={(e) => setRangeDraft((prev) => [prev[0], Number(e.target.value)])}
            className="bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground"
            placeholder="Max"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={applyRange}
            className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground"
          >
            Apply
          </button>
          <button
            onClick={() => onFilter(key, [rangeMin, rangeMax])}
            className="px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Sortable Widget Card ─────────────────────────────────────────────────────

function SortableWidget({
  widget,
  activeFilters,
  dataSchema,
  sourceId,
  onDelete,
  onToggleSpan,
  onUpdatePrompt,
  onUpdateTitle,
  onUpdateFilterKey,
  onFilter,
}: {
  widget: DashboardWidget;
  activeFilters: ActiveFilter[];
  dataSchema: DashboardDataSchema;
  sourceId: string;
  onDelete: (id: string) => void;
  onToggleSpan: (id: string) => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateFilterKey: (id: string, key: string) => void;
  onFilter: (key: string, value: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [editingPrompt, setEditingPrompt] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(widget.title);
  const [draftPrompt, setDraftPrompt] = useState(widget.prompt);
  const titleRef = useRef<HTMLInputElement>(null);
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
          onClick={() => onToggleSpan(widget.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
          title="Toggle width"
        >
          {widget.span === 1 ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
        </button>

        {!isFilter && (
          <button
            onClick={() => { setEditingTitle(true); setTimeout(() => titleRef.current?.focus(), 50); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
            title="Edit title"
          >
            <Edit3 size={13} />
          </button>
        )}

        {/* Edit prompt */}
        {!isFilter && (
          <button
            onClick={() => { setEditingPrompt(true); setTimeout(() => promptRef.current?.focus(), 50); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
            title="Update chart via prompt"
          >
            <Bot size={13} />
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
        {editingTitle && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-border/40 bg-muted/30 px-4 py-2"
          >
            <div className="flex items-center gap-2">
              <Edit3 size={12} className="text-muted-foreground shrink-0" />
              <input
                ref={titleRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onUpdateTitle(widget.id, draftTitle); setEditingTitle(false); }
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                placeholder="Widget title"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={() => { onUpdateTitle(widget.id, draftTitle); setEditingTitle(false); }}
                className="text-primary hover:text-primary/80 shrink-0"
              >
                <Check size={13} />
              </button>
              <button onClick={() => setEditingTitle(false)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
        {editingPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-border/40 bg-muted/30 px-4 py-2"
          >
            <div className="flex items-center gap-2">
              <Bot size={12} className="text-muted-foreground shrink-0" />
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
          <FilterWidget
            widget={widget}
            onFilter={onFilter}
            onUpdateFilterKey={onUpdateFilterKey}
            currentFilter={currentFilter}
            dataSchema={dataSchema}
            sourceId={sourceId}
            activeFilters={activeFilters}
          />
        ) : (
          <ChartContent widget={widget} activeFilters={activeFilters} dataSchema={dataSchema} onApplyFilter={onFilter} />
        )}
      </div>
    </motion.div>
  );
}

// ─── Add Widget Panel ─────────────────────────────────────────────────────────

function AddWidgetPanel({
  onAdd,
  onClose,
  selectableColumns,
  rangeColumns,
}: {
  onAdd: (type: ChartType, title: string, prompt: string) => void;
  onClose: () => void;
  selectableColumns: DashboardSchemaColumn[];
  rangeColumns: DashboardSchemaColumn[];
}) {
  const [selectedType, setSelectedType] = useState<ChartType>('bar');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedFilterColumn, setSelectedFilterColumn] = useState(selectableColumns[0]?.name ?? '');
  const [selectedRangeColumn, setSelectedRangeColumn] = useState(rangeColumns[0]?.name ?? 'value');

  useEffect(() => {
    if (!selectedFilterColumn && selectableColumns[0]?.name) {
      setSelectedFilterColumn(selectableColumns[0].name);
    }
  }, [selectableColumns, selectedFilterColumn]);

  useEffect(() => {
    if (!selectedRangeColumn && rangeColumns[0]?.name) {
      setSelectedRangeColumn(rangeColumns[0].name);
    }
  }, [rangeColumns, selectedRangeColumn]);

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
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <Edit3 size={14} className="text-muted-foreground shrink-0" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Component title (e.g. Portfolio Returns)"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
            <Sliders size={14} className="text-muted-foreground shrink-0" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && prompt.trim() && onAdd(selectedType, title, prompt)}
              placeholder={`Prompt for ${selectedType} chart (e.g. "Show monthly returns by asset class")`}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      )}

      {selectedType === 'filter-select' && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter column</p>
          <select
            value={selectedFilterColumn}
            onChange={(e) => setSelectedFilterColumn(e.target.value)}
            className="w-full bg-card border border-border rounded-lg text-xs px-3 py-2 text-foreground"
          >
            {selectableColumns.map((column) => (
              <option key={column.name} value={column.name}>{formatColumnLabel(column.name)}</option>
            ))}
          </select>
        </div>
      )}

      {selectedType === 'filter-range' && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Range column</p>
          <select
            value={selectedRangeColumn}
            onChange={(e) => setSelectedRangeColumn(e.target.value)}
            className="w-full bg-card border border-border rounded-lg text-xs px-3 py-2 text-foreground"
          >
            {rangeColumns.map((column) => (
              <option key={column.name} value={column.name}>{formatColumnLabel(column.name)}</option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={() => {
          if (selectedType === 'filter-select') {
            const nextColumn = selectedFilterColumn || selectableColumns[0]?.name || 'name';
            onAdd(selectedType, `Filter: ${formatColumnLabel(nextColumn)}`, nextColumn);
            return;
          }
          if (selectedType === 'filter-range') {
            const nextColumn = selectedRangeColumn || rangeColumns[0]?.name || 'value';
            onAdd(selectedType, `Range: ${formatColumnLabel(nextColumn)}`, nextColumn);
            return;
          }
          onAdd(selectedType, title, prompt || title || selectedType);
        }}
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

function createWidget(type: ChartType, title: string, prompt: string, sourceId: string): DashboardWidget {
  const typeLabel = WIDGET_TYPES.find((t) => t.type === type)?.label ?? type;
  const normalizedTitle = (title || '').trim();
  const normalizedPrompt = (prompt || '').trim();
  const fallbackTitle = normalizedPrompt.length > 40 ? normalizedPrompt.slice(0, 40) + '…' : normalizedPrompt || typeLabel;
  return {
    id: mkId(),
    type,
    sourceId,
    title: normalizedTitle || fallbackTitle,
    prompt: normalizedPrompt || normalizedTitle || typeLabel,
    data: [],
    span: type === 'kpi' ? 1 : type.startsWith('filter') ? 1 : 2,
    loading: true,
    filterKey: type.startsWith('filter') ? (normalizedPrompt || 'name') : undefined,
  };
}

export function DashboardGenerator() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [dataSources, setDataSources] = useState<DashboardDataSource[]>([]);
  const [sourceId, setSourceId] = useState('global-trade');
  const [dataSchema, setDataSchema] = useState<DashboardDataSchema>(DEFAULT_DATA_SCHEMA);
  const [schemaBySource, setSchemaBySource] = useState<Record<string, DashboardDataSchema>>({});
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch('http://localhost:4555/dashboard/data-sources')
      .then((res) => res.json())
      .then((payload) => {
        const nextSources = Array.isArray(payload?.sources)
          ? payload.sources
              .filter((record: unknown) => Boolean(record && typeof record === 'object'))
              .map((record: unknown) => {
                const source = record as Record<string, unknown>;
                return {
                  id: String(source.id ?? ''),
                  label: String(source.label ?? ''),
                };
              })
              .filter((record: DashboardDataSource) => record.id.length > 0)
          : [];
        if (!nextSources.length) return;
        setDataSources(nextSources);
        setSourceId((current) => current || nextSources[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`http://localhost:4555/dashboard/schema?source=${encodeURIComponent(sourceId)}`)
      .then((res) => res.json())
      .then((payload) => {
        const schema = payload?.schema as Partial<DashboardDataSchema> | undefined;
        if (!schema) return;
        const columns = Array.isArray(schema.columns)
          ? schema.columns
              .filter((column) => Boolean(column && typeof column === 'object'))
              .map((column) => {
                const next = column as unknown as Record<string, unknown>;
                const columnType = String(next.type ?? 'unknown');
                return {
                  name: String(next.name ?? ''),
                  type: (columnType === 'string' || columnType === 'number' || columnType === 'boolean' ? columnType : 'unknown') as DashboardSchemaColumn['type'],
                  filterable: Boolean(next.filterable),
                  options: Array.isArray(next.options) ? next.options.map(String) : undefined,
                  min: typeof next.min === 'number' ? next.min : undefined,
                  max: typeof next.max === 'number' ? next.max : undefined,
                };
              })
              .filter((column) => column.name.length > 0)
          : [];
        const resolvedSchema = { columns: columns.length ? columns : DEFAULT_DATA_SCHEMA.columns };
        setDataSchema(resolvedSchema);
        setSchemaBySource((prev) => ({
          ...prev,
          [sourceId]: resolvedSchema,
        }));
      })
      .catch(() => {
        setDataSchema(DEFAULT_DATA_SCHEMA);
        setSchemaBySource((prev) => ({
          ...prev,
          [sourceId]: DEFAULT_DATA_SCHEMA,
        }));
      });
  }, [sourceId]);

  const fetchChartData = useCallback(
    async (widgetId: string, widgetSourceId: string, type: ChartType, prompt: string, filters: ActiveFilter[]) => {
      const filtersPayload = filters.reduce<Record<string, string | number | [number, number] | null>>((acc, filter) => {
        acc[filter.key] = filter.value;
        return acc;
      }, {});

      try {
        const res = await fetch('http://localhost:4555/dashboard/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: widgetSourceId,
            widgetType: type,
            prompt,
            filters: filtersPayload,
          }),
        });
        if (!res.ok) throw new Error('Query failed');
        const payload = await res.json();
        const nextData = Array.isArray(payload?.data) ? payload.data : [];
        setWidgets((prev) =>
          prev.map((w) =>
            w.id === widgetId
              ? { ...w, loading: false, data: nextData }
              : w
          )
        );
      } catch {
        setWidgets((prev) =>
          prev.map((w) =>
            w.id === widgetId
              ? { ...w, loading: false, data: generateMockData(prompt, type) }
              : w
          )
        );
      }
    },
    []
  );

  const handleAddWidget = useCallback((type: ChartType, title: string, prompt: string) => {
    const widget = createWidget(type, title, prompt, sourceId);
    setWidgets((prev) => [...prev, widget]);
    if (type === 'filter-select') {
      setWidgets((prev) => prev.map((w) => (w.id === widget.id ? { ...w, loading: false, data: [] } : w)));
    } else {
      fetchChartData(widget.id, widget.sourceId, type, widget.prompt, activeFilters);
    }
    setShowAddPanel(false);
  }, [fetchChartData, activeFilters, sourceId]);

  const handleDelete = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleUpdatePrompt = useCallback((id: string, prompt: string) => {
    const nextPrompt = prompt.trim();
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, prompt: nextPrompt, loading: true, data: [] }
          : w
      )
    );
    const widget = widgets.find((w) => w.id === id);
    if (widget && !widget.type.startsWith('filter')) {
      fetchChartData(id, widget.sourceId, widget.type, nextPrompt || widget.prompt, activeFilters);
    }
  }, [widgets, fetchChartData, activeFilters]);

  const handleUpdateTitle = useCallback((id: string, title: string) => {
    const nextTitle = title.trim();
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, title: nextTitle || w.title }
          : w
      )
    );
  }, []);

  const handleToggleSpan = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const nextSpan = w.span === 1 ? 2 : w.span === 2 ? 3 : 1;
        return { ...w, span: nextSpan };
      })
    );
  }, []);

  const handleUpdateFilterKey = useCallback((widgetId: string, nextFilterKey: string) => {
    const widget = widgets.find((item) => item.id === widgetId);
    const oldFilterKey = widget?.filterKey;
    const widgetSchema = widget?.sourceId ? schemaBySource[widget.sourceId] : undefined;
    const nextColumn = (widgetSchema ?? dataSchema).columns.find((column) => column.name === nextFilterKey);

    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === widgetId
          ? {
              ...widget,
              filterKey: nextFilterKey,
              title: `Filter: ${formatColumnLabel(nextFilterKey)}`,
              prompt: nextFilterKey,
            }
          : widget
      )
    );

    setActiveFilters((prev) => {
      const withoutOld = oldFilterKey ? prev.filter((item) => item.key !== oldFilterKey) : [...prev];
      if (withoutOld.some((item) => item.key === nextFilterKey)) return withoutOld;
      if (nextColumn?.type === 'number' && typeof nextColumn.min === 'number' && typeof nextColumn.max === 'number') {
        return [...withoutOld, { key: nextFilterKey, value: [nextColumn.min, nextColumn.max] }];
      }
      return [...withoutOld, { key: nextFilterKey, value: 'All' }];
    });
  }, [widgets, dataSchema, schemaBySource]);

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
    handleAddWidget('area', 'Row overview', 'Trend over time for key business metrics');
  };

  const handleAddCol = () => {
    // Add a narrow KPI
    handleAddWidget('kpi', 'Key metric', 'Show the most important KPI value and delta');
  };

  useEffect(() => {
    widgets
      .filter((widget) => !widget.type.startsWith('filter'))
      .forEach((widget) => {
        fetchChartData(widget.id, widget.sourceId, widget.type, widget.prompt, activeFilters);
      });
  }, [activeFilters]);

  const dashboardBundle = bundleWidgetsForPrompt(widgets, activeFilters, sourceId);
  const selectableColumns = getSelectableColumns(dataSchema);
  const rangeColumns = getRangeColumns(dataSchema);

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
            <div className="ml-auto">
              <p className="text-[10px] text-muted-foreground mb-1 text-right">Default source for new components</p>
              <select
                value={sourceId}
                onChange={(e) => { setSourceId(e.target.value); }}
                className="bg-card border border-border text-xs text-foreground rounded-lg px-3 py-2"
              >
                {dataSources.map((source) => (
                  <option key={source.id} value={source.id}>{source.label}</option>
                ))}
              </select>
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
        {widgets.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(dashboardBundle, null, 2)).catch(() => {})}
              className="px-3 py-1.5 text-xs rounded-lg bg-card border border-border text-foreground hover:border-primary/50 transition-all"
            >
              Bundle Prompts (Copy JSON)
            </button>
          </div>
        )}

        {/* Add Widget Panel */}
        <AnimatePresence>
          {showAddPanel && (
            <AddWidgetPanel onAdd={handleAddWidget} onClose={() => setShowAddPanel(false)} selectableColumns={selectableColumns} rangeColumns={rangeColumns} />
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
                      dataSchema={schemaBySource[widget.sourceId] ?? dataSchema}
                      sourceId={widget.sourceId}
                      onDelete={handleDelete}
                      onToggleSpan={handleToggleSpan}
                      onUpdatePrompt={handleUpdatePrompt}
                      onUpdateTitle={handleUpdateTitle}
                      onUpdateFilterKey={handleUpdateFilterKey}
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

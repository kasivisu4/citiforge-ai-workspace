import { useState, useEffect, useRef, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Shield, ArrowUpRight, ArrowDownRight, PieChart } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, ChatMode, type HITLResponse as StoreHITLResponse } from '@/store/useAppStore';
import { Send, Sparkles, Brain, Zap, Users, Paperclip, X, FileText, Database, Upload, Box, BarChart3, Plus, Activity, Clock, Check, MessageSquare, Copy, Download, Edit3, Search, ArrowUpDown } from 'lucide-react';

const modes: {id: ChatMode;label: string;icon: typeof Sparkles;}[] = [
{ id: 'creative', label: 'Creative', icon: Sparkles },
{ id: 'deep-think', label: 'Deep Think', icon: Brain },
{ id: 'sota', label: 'SOTA', icon: Zap }];


interface TableSchema {
  tableName: string;
  description: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    description: string;
  }>;
}

interface AgentResponse {
  type: 'text' | 'table' | 'markdown' | 'hitl';
  contentType?: 'text' | 'markdown' | 'table' | 'code';
  content: string;
  hitl?: StoreHITLResponse;
  metadata?: Record<string, any>;
  category?: string;
  editable?: boolean;
  streaming?: boolean;
}

const suggestedQueries = {
  'data-modeler': [
  {
    icon: Database,
    title: 'Design a Model for [Product]',
    description: 'Build a custom data model from scratch. AI guides you along the way.',
    color: 'bg-blue-500/10 border-blue-200/30'
  },
  {
    icon: Upload,
    title: 'Generate from Sample File',
    description: 'Upload a CSV or JSON file to auto-generate your data model',
    color: 'bg-purple-500/10 border-purple-200/30'
  },
  {
    icon: Box,
    title: 'Generate from Existing Table',
    description: 'Select from existing database table to create your model',
    color: 'bg-amber-500/10 border-amber-200/30'
  },
  {
    icon: BarChart3,
    title: 'Explore Templates',
    description: 'Browse ready-to-use models for popular financial products',
    color: 'bg-emerald-500/10 border-emerald-200/30'
  }]

};

interface QueryCard {
  icon: typeof Database;
  title: string;
  description: string;
  color: string;
}

function SuggestedQueryCard({ card, onSelect }: {card: QueryCard;onSelect: (title: string) => void;}) {
  const Icon = card.icon;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onSelect(card.title)}
      className={`p-4 rounded-lg border ${card.color} hover:shadow-md transition-all text-left w-full group hover:border-blue-300`}>

      <div className="flex items-start gap-3">
        <Icon size={20} className="text-blue-600 mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{card.title}</h4>
          <p className="text-xs text-gray-600 mt-1">{card.description}</p>
        </div>
      </div>
    </motion.button>);

}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0s' }} />
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
    </div>);

}

function TableSchemaDisplay({ schema }: {schema: TableSchema;}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-3 max-w-2xl">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{schema.tableName}</h3>
          <p className="text-xs text-muted-foreground mt-1">{schema.description}</p>
        </div>
        <button
          onClick={copyToClipboard}
          className="p-2 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground shrink-0"
          title="Copy JSON">

          {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Column</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Nullable</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {schema.columns.map((col, idx) =>
            <tr key={idx} className="border-b border-border/30 hover:bg-primary/5 transition-colors">
                <td className="py-2 px-2 font-mono text-foreground">{col.name}</td>
                <td className="py-2 px-2 text-primary font-mono">{col.type}</td>
                <td className="py-2 px-2">
                  {col.nullable ?
                <span className="text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded">Yes</span> :

                <span className="text-emerald-600 text-xs bg-emerald-50 px-2 py-1 rounded">No</span>
                }
                </td>
                <td className="py-2 px-2 text-muted-foreground">{col.description}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Download size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Click copy to export JSON schema</span>
      </div>
    </motion.div>);

}

// Generic content renderers
function TextRenderer({ content }: {content: string;}) {
  return <p className="whitespace-pre-wrap text-sm">{content}</p>;
}

function EditableMarkdownTable({ content, messageId, onUpdate }: {content: string;messageId: string;onUpdate: (id: string, updatedContent: string) => void;}) {
  const lines = content.split('\n').filter((l) => l.trim());
  const tableLines = lines.filter((l) => l.includes('|'));
  const headerLine = tableLines[0];
  const columns = headerLine.split('|').map((c) => c.trim()).filter(Boolean);
  const dataLines = tableLines.slice(2);

  const [rows, setRows] = useState(dataLines.map((line) =>
  line.split('|').map((c) => c.trim()).filter(Boolean)
  ));
  const [editCell, setEditCell] = useState<{row: number;col: number;} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCol, setFilterCol] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let result = rows.filter((row) => {
      if (!searchTerm) return true;
      return row.some((cell) => cell.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    if (filterCol !== null) {
      result = result.filter((row) => row[filterCol]?.toLowerCase().includes(searchTerm || ''));
    }

    if (sortCol !== null) {
      result.sort((a, b) => {
        const aVal = a[sortCol]?.toLowerCase() || '';
        const bVal = b[sortCol]?.toLowerCase() || '';
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    return result;
  }, [rows, searchTerm, filterCol, sortCol, sortAsc]);

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const newRows = [...rows];
    const actualRowIdx = rows.indexOf(filteredRows[rowIdx]);
    if (actualRowIdx !== -1) {
      newRows[actualRowIdx][colIdx] = value;
      setRows(newRows);
    }
  };

  const handleSave = () => {
    // Reconstruct markdown table
    const headerStr = `| ${columns.join(' | ')} |`;
    const separatorStr = `|${columns.map(() => '---').join('|')}|`;
    const dataStr = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
    const updatedContent = `${headerStr}\n${separatorStr}\n${dataStr}`;
    onUpdate(messageId, updatedContent);
    setEditCell(null);
  };

  const useVirtual = filteredRows.length > 200;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-5xl">

      {/* Search and Filter Controls */}
      <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-200">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gray-600" />
          <input
            type="text"
            placeholder="Search in table..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-1 border border-gray-300 rounded text-xs" />

          <select
            value={filterCol ?? 'all'}
            onChange={(e) => setFilterCol(e.target.value === 'all' ? null : parseInt(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded text-xs">

            <option value="all">All columns</option>
            {columns.map((col, idx) =>
            <option key={idx} value={idx}>{col}</option>
            )}
          </select>
        </div>
        <div className="text-xs text-gray-600">
          Showing {filteredRows.length} of {rows.length} rows
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded">
        {!useVirtual &&
        <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50 sticky top-0">
                {columns.map((col, idx) =>
              <th
                key={idx}
                onClick={() => {
                  if (sortCol === idx) {
                    setSortAsc(!sortAsc);
                  } else {
                    setSortCol(idx);
                    setSortAsc(true);
                  }
                }}
                className="text-left py-2 px-3 font-semibold text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-200 transition-colors group">

                    <div className="flex items-center gap-1">
                      {col}
                      {sortCol === idx &&
                  <ArrowUpDown size={12} className={sortAsc ? '' : 'rotate-180'} />
                  }
                    </div>
                  </th>
              )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, displayIdx) => {
              const actualRowIdx = rows.indexOf(row);
              return (
                <tr key={actualRowIdx} className="border-b border-gray-200 hover:bg-gray-50">
                    {row.map((cell, colIdx) =>
                  <td
                    key={`${actualRowIdx}-${colIdx}`}
                    className="py-2 px-3 text-gray-700 whitespace-nowrap cursor-text hover:bg-blue-50"
                    onClick={() => setEditCell({ row: actualRowIdx, col: colIdx })}>

                        {editCell?.row === actualRowIdx && editCell?.col === colIdx ?
                    <input
                      autoFocus
                      type="text"
                      value={cell}
                      onChange={(e) => {
                        const newRows = [...rows];
                        newRows[actualRowIdx][colIdx] = e.target.value;
                        setRows(newRows);
                      }}
                      onBlur={() => setEditCell(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditCell(null)}
                      className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-gray-900 text-xs" /> :


                    <span>{cell}</span>
                    }
                      </td>
                  )}
                  </tr>);

            })}
            </tbody>
          </table>
        }

        {useVirtual &&
        <div className="w-full text-xs">
            {/* Header as grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(0,1fr))] gap-0 border-b border-gray-300 bg-gray-50 sticky top-0">
              {columns.map((col, idx) =>
            <div key={idx} className="py-2 px-3 font-semibold text-gray-700 text-left">
                  <div className="flex items-center gap-1">
                    {col}
                    {sortCol === idx &&
                <ArrowUpDown size={12} className={sortAsc ? '' : 'rotate-180'} />
                }
                  </div>
                </div>
            )}
            </div>

            <List
            height={Math.min(500, filteredRows.length * 36)}
            itemCount={filteredRows.length}
            itemSize={36}
            width={'100%'}>

              {({ index, style }) => {
              const row = filteredRows[index];
              const actualRowIdx = rows.indexOf(row);
              return (
                <div
                  style={style}
                  key={actualRowIdx}
                  className={`grid grid-cols-[repeat(${columns.length},minmax(0,1fr))] gap-0 border-b border-gray-200 hover:bg-gray-50 items-center py-2 px-0`}>

                    {row.map((cell, colIdx) =>
                  <div
                    key={`${actualRowIdx}-${colIdx}`}
                    className="py-0 px-3 text-gray-700 whitespace-nowrap cursor-text hover:bg-blue-50"
                    onClick={() => setEditCell({ row: actualRowIdx, col: colIdx })}>

                        {editCell?.row === actualRowIdx && editCell?.col === colIdx ?
                    <input
                      autoFocus
                      type="text"
                      value={cell}
                      onChange={(e) => {
                        const newRows = [...rows];
                        newRows[actualRowIdx][colIdx] = e.target.value;
                        setRows(newRows);
                      }}
                      onBlur={() => setEditCell(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditCell(null)}
                      className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-gray-900 text-xs" /> :


                    <span>{cell}</span>
                    }
                      </div>
                  )}
                  </div>);

            }}
            </List>
          </div>
        }
      </div>

      {/* Action Buttons - SEPARATE FROM HITL */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <span className="text-xs text-gray-600">Click any cell to edit • Scroll to view all columns</span>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-all">

          Save Changes
        </button>
      </div>
    </motion.div>);

}

function MarkdownRenderer({ content, messageId, isEditing, onEdit }: {content: string;messageId?: string;isEditing?: boolean;onEdit?: (id: string, updatedContent: string) => void;}) {
  // Check if content contains a markdown table
  if (content.includes('|')) {
    const lines = content.split('\n').filter((l) => l.trim());
    const isTable = lines.some((l) => l.includes('|'));

    if (isTable && isEditing && messageId && onEdit) {
      return <EditableMarkdownTable content={content} messageId={messageId} onUpdate={onEdit} />;
    }

    if (isTable) {
      // Parse markdown table
      const tableLines = lines.filter((l) => l.includes('|'));
      const headerLine = tableLines[0];
      const columns = headerLine.split('|').map((c) => c.trim()).filter(Boolean);
      const dataLines = tableLines.slice(2); // Skip header and separator
      const rows = dataLines.map((line) =>
      line.split('|').map((c) => c.trim()).filter(Boolean)
      );

      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-4xl">

          <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50 sticky top-0">
                  {columns.map((col, idx) =>
                  <th key={idx} className="text-left py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">
                      {col}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) =>
                <tr key={rIdx} className="border-b border-gray-200 hover:bg-gray-50">
                    {row.map((cell, cIdx) =>
                  <td key={cIdx} className="py-2 px-3 text-gray-700 whitespace-nowrap">
                        {cell}
                      </td>
                  )}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>);

    }
  }

  // Regular markdown rendering
  const html = content.
  split('\n').
  filter((line) => line.trim()).
  map((line) => {
    if (line.startsWith('# ')) return `<h1 class="text-lg font-bold mt-2 mb-1">${line.slice(2)}</h1>`;
    if (line.startsWith('## ')) return `<h2 class="text-base font-semibold mt-1.5 mb-1">${line.slice(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3 class="text-sm font-semibold mt-1 mb-0.5">${line.slice(4)}</h3>`;
    if (line.startsWith('- ') || line.startsWith('* ')) return `<li class="ml-4 text-sm">${line.slice(2)}</li>`;
    if (line.includes('**') && line.includes('**')) {
      const processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<p class="text-sm">${processed}</p>`;
    }
    if (line.trim()) return `<p class="text-sm">${line}</p>`;
    return '';
  }).
  filter(Boolean).
  join('');

  return <div className="space-y-1" dangerouslySetInnerHTML={{ __html: html }} />;
}

function TableRenderer({ content, metadata }: {content: string;metadata?: Record<string, any>;}) {
  const [copied, setCopied] = useState(false);

  // Parse table from content or metadata
  let columns: string[] = [];
  let rows: string[][] = [];

  if (metadata?.columns) {
    columns = metadata.columns;
    rows = metadata.rows || [];
  } else {
    // Try to parse from content (CSV-like format)
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length > 0) {
      columns = lines[0].split('|').map((c) => c.trim()).filter(Boolean);
      rows = lines.slice(1).map((line) =>
      line.split('|').map((c) => c.trim()).filter(Boolean)
      );
    }
  }

  const copyToClipboard = () => {
    const csv = [columns, ...rows].map((row) => row.join(',')).join('\n');
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-3xl overflow-x-auto">

      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-gray-600">Table View</span>
        <button
          onClick={copyToClipboard}
          className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-900"
          title="Copy to CSV">

          {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
        </button>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50">
            {columns.map((col, idx) =>
            <th key={idx} className="text-left py-2 px-3 font-semibold text-gray-700">
                {col}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) =>
          <tr key={rIdx} className="border-b border-gray-200 hover:bg-gray-50">
              {row.map((cell, cIdx) =>
            <td key={cIdx} className="py-2 px-3 text-gray-700">
                  {cell}
                </td>
            )}
            </tr>
          )}
        </tbody>
      </table>
    </motion.div>);

}

function StepProgress({ current, total, title }: {current: number;total: number;title?: string;}) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(1, current), safeTotal);
  const pct = Math.round((safeCurrent / safeTotal) * 100);
  const displayTitle = safeCurrent >= safeTotal ? 'Completed' : title;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500">
        <span>{displayTitle ? `Step ${safeCurrent}: ${displayTitle}` : 'Progress'}</span>
        <span>{safeCurrent}/{safeTotal}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MixedRenderer({ content, metadata }: {content: string;metadata?: Record<string, any>;}) {
  const textStep = metadata?.stepMap?.text ?? 1;
  const tableStep = metadata?.stepMap?.table ?? (textStep + 1);
  const stepTotal = metadata?.stepTotal ?? Math.max(textStep, tableStep);
  const stepCurrent = metadata?.stepCurrent ?? textStep;
  const stepTitle = metadata?.stepTitle;

  return (
    <div className="space-y-4">
      <StepProgress current={stepCurrent} total={stepTotal} title={stepTitle} />
      {content.trim() &&
      <div className="space-y-1">
          <TextRenderer content={content} />
        </div>
      }
      {metadata?.columns?.length && metadata?.rows?.length &&
      <div className="space-y-1">
          <TableRenderer content={content} metadata={metadata} />
        </div>
      }
    </div>
  );
}

function GenericHITLForm({ hitl, messageId, onAction }: {hitl: StoreHITLResponse;messageId?: string;onAction: (actionId: string, messageId?: string, payload?: Record<string, unknown>) => void;}) {
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    (hitl.fields || []).forEach((field) => {
      if (field.default !== undefined) {
        initial[field.name] = field.default;
      } else if (field.type === 'boolean') {
        initial[field.name] = false;
      } else {
        initial[field.name] = '';
      }
    });
    return initial;
  });

  const options = hitl.options || [];
  const metadataHint =
  hitl.metadata && typeof hitl.metadata === 'object' && 'hint' in hitl.metadata ?
  String((hitl.metadata as { hint?: unknown }).hint ?? '') :
  '';

  const variantFor = (style?: Record<string, unknown>) => {
    const variant = String(style?.variant || '').toLowerCase();
    if (variant === 'primary') return 'primary';
    if (variant === 'destructive' || variant === 'danger') return 'destructive';
    return 'secondary';
  };

  const renderField = (field: NonNullable<StoreHITLResponse['fields']>[number]) => {
    const value = formValues[field.name];

    if (field.type === 'textarea') {
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
          className="w-full mt-1 h-24 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder={field.label}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
          className="w-full mt-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select...</option>
          {(field.options || []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 mt-1 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.checked }))}
          />
          {field.label}
        </label>
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
        className="w-full mt-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
        placeholder={field.label}
      />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-gray-200 rounded-lg p-4 space-y-3 max-w-2xl">

      {hitl.title &&
      <div>
          <h3 className="text-sm font-semibold text-gray-900">{hitl.title}</h3>
          {hitl.message &&
        <p className="text-xs text-gray-600 mt-1">{hitl.message}</p>
        }
        </div>
      }

      {hitl.fields?.length ?
      <div className="space-y-3 pt-2">
          {hitl.fields.map((field) =>
        <div key={field.name}>
              <label className="text-xs font-medium text-gray-700">
                {field.label}
                {field.required ? <span className="text-red-600"> *</span> : null}
              </label>
              {renderField(field)}
            </div>
        )}
        </div> :
      null}

      {options.length ?
      <div className="flex flex-wrap gap-2 pt-2">
          {options.map((option) => {
          const variant = variantFor(option.style);
          const isPrimary = variant === 'primary';
          const isDestructive = variant === 'destructive';

          return (
            <motion.button
              key={option.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAction(option.id, messageId, formValues)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
              isPrimary ?
              'bg-blue-500 text-white hover:bg-blue-600 shadow-sm' :
              isDestructive ?
              'bg-red-500/20 text-red-700 border border-red-200 hover:bg-red-500/30' :
              'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'}`
              }>

              {option.label}
            </motion.button>);

        })}
        </div> :
      hitl.type === 'form' ?
      <div className="pt-2">
          <button
          onClick={() => onAction('submit_form', messageId, formValues)}
          className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-blue-500 text-white hover:bg-blue-600 shadow-sm">

            Submit
          </button>
        </div> :
      null}

      {metadataHint &&
      <p className="text-xs text-gray-600 pt-2 border-t border-gray-200">{metadataHint}</p>
      }
    </motion.div>);

}

function ContentRenderer({
  contentType,
  content,
  metadata




}: {contentType?: string;content: string;metadata?: Record<string, any>;}) {
  const hasText = content.trim().length > 0;
  const hasTable = !!metadata?.columns?.length && !!metadata?.rows?.length;
  const stepTotal = metadata?.stepTotal ?? 0;
  const stepCurrent = metadata?.stepCurrent ?? 1;
  const stepTitle = metadata?.stepTitle;

  const withProgress = (node: JSX.Element) => (
    <div className="space-y-4">
      {stepTotal ? <StepProgress current={stepCurrent} total={stepTotal} title={stepTitle} /> : null}
      {node}
    </div>
  );

  if (hasText && hasTable) {
    return <MixedRenderer content={content} metadata={metadata} />;
  }
  if (contentType === 'markdown') {
    return withProgress(<MarkdownRenderer content={content} />);
  }
  if (contentType === 'table' || hasTable) {
    return withProgress(<TableRenderer content={content} metadata={metadata} />);
  }
  return withProgress(<TextRenderer content={content} />);
}

// Simulate a streaming backend response. Streams text and table rows as structured chunks,
// with each chunk containing { type, content }.
function simulateStreamingResponse(
userInput: string,
messageId: string,
sendChunk: (id: string, chunk: { type: string; content: unknown; step?: number; step_title?: string }) => void,
finalize: (id: string, finalContent: string, meta?: any) => void)
{
  const mock = generateMockHITLResponse(userInput as string);

  const full = mock.content || '';
  // If there is a markdown table, split it out so we stream the intro first.
  const tableIndex = full.indexOf('\n|');
  let intro = full;
  let table = '';
  if (tableIndex !== -1) {
    intro = full.slice(0, tableIndex).trim();
    table = full.slice(tableIndex).trim();
  }

  // Chunk intro into words as paragraph type
  const words = intro.split(/(\s+)/).filter(Boolean);
  let idx = 0;

  sendChunk(messageId, { type: 'steps', content: JSON.stringify({ total: 3, current: 1 }) });

  const interval = setInterval(() => {
    if (idx < words.length) {
      const next = words[idx++];
      sendChunk(messageId, { type: 'paragraph', content: next, step: 1, step_title: 'Plan overview' });
      return;
    }

    // Stream table rows if present
    if (table) {
      const lines = table.split('\n').filter(l => l.trim());
      for (const line of lines) {
        sendChunk(messageId, { type: 'table-row', content: line + '\n', step: 2, step_title: 'Stream table rows' });
      }
    }

    clearInterval(interval);

    // Finalize with complete content
    const finalContent = intro + (table ? '\n\n' + table : '');
    sendChunk(messageId, { type: 'done', content: '', step: 3, step_title: 'Finalize' });
    finalize(messageId, finalContent, { hitl: mock.hitl, metadata: mock.metadata, contentType: mock.contentType });
  }, 120);

  // return cancel function
  return () => clearInterval(interval);
}
function generateMockHITLResponse(userInput: string): AgentResponse {
  const lowerInput = userInput.toLowerCase();
  const isModelRequest = lowerInput.includes('design') || lowerInput.includes('model') || lowerInput.includes('product');

  if (isModelRequest) {
    // Return a markdown response with HITL options
    const tableContent = `
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| productId | UUID | No | Unique identifier for the product |
| productName | VARCHAR(255) | No | Human-readable name of the product |
| productType | ENUM | No | Category: DEPOSIT, CREDIT, INVESTMENT, INSURANCE |
| description | TEXT | Yes | Detailed product description |
| launchDate | DATE | No | Date when product was launched |
| status | ENUM | No | ACTIVE, DEPRECATED, BETA, RETIRED |
| riskLevel | ENUM | Yes | LOW, MEDIUM, HIGH, VERY_HIGH |
| minimumInvestment | DECIMAL(15,2) | Yes | Minimum investment amount required |
| managerId | UUID | No | Reference to product manager |
| createdAt | TIMESTAMP | No | Record creation timestamp |
    `.trim();

    return {
      type: 'hitl',
      contentType: 'markdown',
      content: 'I\'ve designed a **Products** table schema for your financial database. This table will store all product information including type, status, and risk management data. Review the schema below:\n\n' + tableContent,
      hitl: {
        type: 'form',
        title: 'Review and Approve Data Model Plan',
        message: 'Provide final details, then submit approval.',
        fields: [
        {
          name: 'approval_notes',
          label: 'Approval notes',
          type: 'textarea',
          required: false,
          default: ''
        },
        {
          name: 'target_table',
          label: 'Target table name',
          type: 'text',
          required: true,
          default: 'products'
        },
        {
          name: 'risk_reviewed',
          label: 'Risk review completed',
          type: 'boolean',
          required: false,
          default: false
        }],

        metadata: {
          hint: 'Submit the form to continue, or modify in chat before submitting.'
        }
      } as StoreHITLResponse,
      metadata: {
        schemaName: 'products'
      }
    };
  }

  return {
    type: 'text',
    contentType: 'text',
    content: 'I can help you design database models. Try asking me to "design a model for products" or specify the entity you\'d like to model.'
  };
}

export function Canvas() {
  const { activeAgent, setPresetModalOpen, chatMode, setChatMode, messages, addMessage, updateMessage, chatInput, setChatInput, currentSessionId, addSession, startSession, setCurrentSession } = useAppStore();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestionsShown, setSuggestionsShown] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [hitlUnlockedFor, setHitlUnlockedFor] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const mentionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const atSuggestions = ['@productName', '@managerId', '@launchDate', '@status'];

  const clearAttachment = () => setAttachmentFile(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show suggestions when agent is selected
  useEffect(() => {
    // Check if there are messages for the current session (or no session history if session is new/null)
    const hasMessages = messages.some((m) => m.sessionId === currentSessionId);
    if (activeAgent && !hasMessages) {
      setSuggestionsShown(true);
    }
  }, [activeAgent, currentSessionId, messages]);

  const handleSend = async () => {
    if (!chatInput.trim()) return;

    let sessionId = currentSessionId;

    // Create session if it doesn't exist
    if (!sessionId && activeAgent) {
      try {
        const res = await fetch('http://localhost:4555/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: activeAgent, title: chatInput.slice(0, 30) || 'New Session' })
        });
        if (res.ok) {
          const session = await res.json();
          addSession({ ...session, createdAt: new Date(session.createdAt), lastUpdated: new Date(session.lastUpdated) });
          setCurrentSession(session.id);
          sessionId = session.id;
        } else {
          throw new Error('failed');
        }
      } catch (err) {
        // fallback to local session
        sessionId = startSession(activeAgent, chatInput.slice(0, 30));
        setCurrentSession(sessionId);
      }
    }

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
      mode: chatMode,
      sessionId: sessionId || undefined
    });
    const inputText = chatInput;
    setChatInput('');
    clearAttachment();
    setSuggestionsShown(false);

    // Stream agent response from a dummy backend
    setIsTyping(true);

    const agentId = crypto.randomUUID();
    // initial placeholder message
    addMessage({
      id: agentId,
      role: 'agent',
      content: '',
      timestamp: new Date(),
      mode: chatMode,
      contentType: 'text',
      sessionId: sessionId || undefined
    });

    // sendChunk uses the store to append content incrementally (handles { type, content })
    const sendChunk = (id: string, chunk: { type: string; content: any; step?: number; step_title?: string; total?: number }) => {
      const store = useAppStore.getState();
      const msg = store.messages.find((m) => m.id === id);
      const current = msg?.content || '';
      const nextMetadata = { ...(msg?.metadata || {}) } as Record<string, any>;

      // Handle step metadata chunk: sets total number of steps
      if (chunk.type === 'step-metadata' && chunk.total) {
        nextMetadata.stepTotal = Number(chunk.total);
        updateMessage(id, { metadata: nextMetadata });
        return;
      }

      // Handle explicit step chunks: type='step' indicates step is now executing
      if (chunk.type === 'step' && chunk.step) {
        nextMetadata.stepCurrent = chunk.step;
        nextMetadata.stepTitle = String(chunk.content ?? '');
        updateMessage(id, { metadata: nextMetadata });
        return;
      }

      if (chunk.type === 'steps' && chunk.content) {
        const total = Number(chunk.content.total ?? 0);
        const currentStep = Number(chunk.content.current ?? 1);
        nextMetadata.stepTotal = Number.isFinite(total) ? total : 0;
        nextMetadata.stepCurrent = Number.isFinite(currentStep) ? currentStep : 1;
        updateMessage(id, { metadata: nextMetadata });
        return;
      }

      if (chunk.step) {
        const nextStepMap = { ...(nextMetadata.stepMap || {}) };
        if (chunk.type === 'paragraph') nextStepMap.text = chunk.step;
        if (chunk.type === 'table-row') nextStepMap.table = chunk.step;
        nextMetadata.stepMap = nextStepMap;
        nextMetadata.stepCurrent = chunk.step;
      }

      if (chunk.step_title) {
        nextMetadata.stepTitle = chunk.step_title;
      }

      if (chunk.type === 'table-row' && chunk.content && typeof chunk.content === 'object') {
        const row = chunk.content as Record<string, any>;
        const existing = nextMetadata.rows || [];
        const columns = nextMetadata.columns || Object.keys(row);
        const newRow = columns.map((name: string) => row[name] ?? '');
        nextMetadata.columns = columns;
        nextMetadata.rows = [...existing, newRow];
        updateMessage(id, { metadata: nextMetadata });
        return;
      }

      updateMessage(id, { content: current + String(chunk.content ?? ''), metadata: nextMetadata });
    };

    const finalize = (id: string, finalContent: string, meta?: any) => {
      // Preserve accumulated streamed content; append final text if it's different
      const store = useAppStore.getState();
      const msg = store.messages.find((m) => m.id === id);
      const accumulated = msg?.content || '';

      // Extract table and hitl from meta
      const { table, hitl } = meta || {};

      // Build final message updates: keep accumulated text, add table/hitl metadata
      const updates: any = {
        content: accumulated, // keep the streamed text
        metadata: { ...(msg?.metadata || {}) }
      };

      if (table) {
        // Extract columns (as strings) and rows from table schema
        const columnNames = table.columns?.map((c: any) => c.name) || [];
        const rowData = table.rows?.map((r: any) => columnNames.map((name: string) => r[name] || '')) || [];
        updates.metadata = {
          ...(updates.metadata || {}),
          columns: columnNames,
          rows: rowData,
          table // keep full table schema in metadata too
        };
        updates.contentType = 'table'; // render as table
      }

      if (hitl) {
        updates.hitl = hitl;
      }

      updateMessage(id, updates);
      setIsTyping(false);
    };

    // Try POST streaming first -> server at /stream
    const streamFromServer = (userInput: string, id: string) => {
      try {
        const STREAM_BASE = 'http://localhost:4555';
        const controller = new AbortController();

        fetch(`${STREAM_BASE}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: userInput, id }),
          signal: controller.signal
        })
          .then(async (res) => {
            if (!res.ok) throw new Error('Stream failed');

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No readable stream');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');

              // Keep the last incomplete line in buffer
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const chunk = JSON.parse(line);
                    if (chunk.type === 'done') {
                      sendChunk(id, chunk);
                      finalize(id, chunk.content, chunk.meta);
                    } else {
                      sendChunk(id, chunk);
                    }
                  } catch (err) {
                    console.error('Failed to parse chunk', err);
                  }
                }
              }
            }
          })
          .catch((err) => {
            if (err.name !== 'AbortError') {
              // Fallback to simulator
              simulateStreamingResponse(userInput, id, sendChunk, finalize);
            }
          });

        return () => controller.abort();
      } catch (err) {
        return null;
      }
    };

    const cancel = streamFromServer(inputText, agentId);
    if (!cancel) {
      // fallback to local simulator
      simulateStreamingResponse(inputText, agentId, sendChunk, finalize);
    }
  };



  const handleQuerySelect = (title: string) => {
    setChatInput(title);
    setSuggestionsShown(false);
  };

  const handleHITLAction = async (actionId: string, messageId?: string, payload?: Record<string, unknown>) => {
    const STREAM_BASE = 'http://localhost:4555';

    try {
      const res = await fetch(`${STREAM_BASE}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hitlActionResult: {
            actionId,
            messageId,
            sessionId: currentSessionId ?? undefined,
            payload: payload || {},
            submittedAt: Date.now() / 1000
          }
        })
      });

      if (!res.ok) {
        throw new Error('Failed to submit HITL action result');
      }

      const body = await res.text();
      const firstLine = body.split('\n').find((line) => line.trim());
      let backendMessage = 'HITL action result submitted to backend.';
      if (firstLine) {
        const parsed = JSON.parse(firstLine);
        if (parsed?.type === 'done' && parsed?.content) {
          backendMessage = String(parsed.content);
        }
      }

      addMessage({
        id: crypto.randomUUID(),
        role: 'agent',
        content: backendMessage,
        timestamp: new Date(),
        mode: chatMode,
        contentType: 'text'
      });
    } catch (error) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'agent',
        content: 'Failed to submit HITL action result to backend.',
        timestamp: new Date(),
        mode: chatMode,
        contentType: 'text'
      });
    }

    // If user chooses to modify, unlock chat input for this HITL message
    if (actionId === 'modify' || actionId === 'edit_schema') {
      if (messageId) setHitlUnlockedFor((s) => Array.from(new Set([...s, messageId])));
      return;
    }
  };

  // Table editing removed: schema updates should come from backend flows

  return (
    <div className="flex-1 h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar - always visible */}
      <div className="flex items-center justify-end p-4 border-b border-border">
        <div className="text-sm font-medium text-foreground">KV00001
        </div>
      </div>

      {/* Main content area */}
      {!activeAgent ? <div className="flex-1 citi-gradient-bg citi-grid-pattern flex items-center justify-center relative overflow-hidden">
          <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-8">

            <div className="w-20 h-20 rounded-2xl bg-citi-light-blue flex items-center justify-center mb-6 border border-citi-blue/30">
              <Activity size={40} className="text-citi-blue" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Maphub</h1>
            <p className="text-muted-foreground mb-8 max-w-md">
              Select an AI agent from the sidebar to get started with powerful data modeling, analysis, and automation tools.
            </p>
            <button
            onClick={() => setPresetModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30">

              <Plus size={16} />
              Explore Presets
            </button>
          </motion.div>
        </div> :

      <>
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
        <AnimatePresence>
          {!messages.some((m) => m.sessionId === currentSessionId) && suggestionsShown && activeAgent === 'data-modeler' &&
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4">

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Modeler</h2>
                <p className="text-sm text-gray-600">Design and generate intelligent data models for financial products</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                {suggestedQueries['data-modeler'].map((query) =>
                <SuggestedQueryCard
                  key={query.title}
                  card={query}
                  onSelect={handleQuerySelect} />

                )}
              </div>
            </motion.div>
            }

          {!messages.some((m) => m.sessionId === currentSessionId) && activeAgent && activeAgent !== 'data-modeler' &&
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {activeAgent === 'data-analysis' ? 'Data Analysis Engine' : activeAgent === 'documentation' ? 'Documentation Suite' : 'Templates Gallery'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeAgent === 'data-analysis' ? 'Portfolio risk & transaction intelligence' : activeAgent === 'documentation' ? 'Auto-generate audit-ready documentation' : 'Browse and import ready-made templates'}
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { title: 'Total Assets', value: '$2.4T', change: '+12.3% YoY', positive: true, icon: TrendingUp },
                  { title: 'Risk Score', value: '72/100', change: '-3.2 pts', positive: false, icon: Shield },
                  { title: 'Active Models', value: '1,247', change: '+89 this week', positive: true, icon: Activity },
                  { title: 'Compliance', value: '99.7%', change: '+0.2%', positive: true, icon: BarChart3 },
                ].map((stat) => (
                  <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="citi-card p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${stat.positive ? 'text-emerald-600' : 'text-destructive'}`}>
                          {stat.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {stat.change}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <stat.icon size={18} className="text-secondary" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="citi-card p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Portfolio Performance</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">7-month trend analysis</p>
                    </div>
                    <PieChart size={16} className="text-muted-foreground" />
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={[
                      { name: 'Jan', value: 4200, prev: 3800 },
                      { name: 'Feb', value: 4800, prev: 4100 },
                      { name: 'Mar', value: 4600, prev: 4300 },
                      { name: 'Apr', value: 5200, prev: 4500 },
                      { name: 'May', value: 5800, prev: 4800 },
                      { name: 'Jun', value: 6100, prev: 5200 },
                      { name: 'Jul', value: 5900, prev: 5500 },
                    ]}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(195, 100%, 47%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(195, 100%, 47%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 92%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(210, 20%, 90%)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Area type="monotone" dataKey="prev" stroke="hsl(210, 20%, 80%)" fill="transparent" strokeDasharray="4 4" strokeWidth={1.5} />
                      <Area type="monotone" dataKey="value" stroke="hsl(195, 100%, 47%)" fill="url(#colorValue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="citi-card p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Asset Allocation</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Current distribution</p>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={[
                      { name: 'Equities', value: 42 },
                      { name: 'Fixed Inc', value: 28 },
                      { name: 'Commodities', value: 15 },
                      { name: 'FX', value: 10 },
                      { name: 'Alt', value: 5 },
                    ]} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 92%)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(210, 10%, 50%)' }} width={70} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(210, 20%, 90%)', borderRadius: '12px', fontSize: '12px' }} />
                      <Bar dataKey="value" fill="hsl(207, 100%, 22%)" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>

              {/* Recent Activity */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="citi-card p-5">
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${row.status === 'Complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
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
            }

          {messages.filter((m) => m.sessionId === currentSessionId).map((msg, idx) =>
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

              <div className={`flex flex-col gap-3 ${msg.role === 'user' ? 'max-w-[70%]' : 'max-w-[90%]'}`}>
                {msg.role === 'user' ?
                <div className="flex flex-col gap-2">
                    <div className="px-4 py-3 rounded-lg bg-blue-500 text-white rounded-br-none text-sm">
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-500 px-2 self-end">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div> :

                <div className="flex flex-col gap-2">
                    <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg rounded-bl-none p-4">
                      <ContentRenderer
                      contentType={msg.contentType}
                      content={msg.content}
                      metadata={msg.metadata} />

                      
                      {msg.hitl &&
                    <GenericHITLForm
                      hitl={msg.hitl}
                      messageId={msg.id}
                      onAction={handleHITLAction} />

                    }
                    </div>
                    <span className="text-xs text-gray-500 px-2">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                }
              </div>
            </motion.div>
            )}

          {isTyping &&
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start">

              <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg rounded-bl-none">
                <TypingIndicator />
              </div>
            </motion.div>
            }
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card px-6 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            {/* Attachment display */}
            <AnimatePresence>
              {attachmentFile &&
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2 mb-2 bg-primary/5 border border-primary/20 rounded-lg text-xs">

                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="font-medium text-foreground truncate flex-1">{attachmentFile.name}</span>
                  <button
                    onClick={clearAttachment}
                    className="p-1 hover:bg-primary/10 rounded transition-colors text-muted-foreground hover:text-foreground shrink-0"
                    title="Remove">

                    <X size={12} />
                  </button>
                </motion.div>
                }
            </AnimatePresence>

            {/* Input field */}
            <div className="relative flex items-center gap-2 bg-muted/50 border border-border rounded-xl hover:border-border/80 transition-colors focus-within:border-primary/50 focus-within:bg-card focus-within:ring-1 focus-within:ring-ring">
              {/* Attachment button */}
              <button
                  className={`p-2.5 transition-colors flex items-center justify-center shrink-0 ${
                  attachmentFile ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
                  }
                  onClick={() => document.getElementById('attach-file-canvas')?.click()}
                  title="Attach file"
                  aria-label="Attach file">

                <Paperclip size={16} />
              </button>

              <input
                  id="attach-file-canvas"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />


              {/* Text input */}
              {(() => {
                  const sessionMsgs = messages.filter((m) => m.sessionId === currentSessionId);
                  const activeHitlMsg = sessionMsgs.find((m) => m.hitl);
                  const isLocked = !!activeHitlMsg && !(activeHitlMsg && hitlUnlockedFor.includes(activeHitlMsg.id));
                  return (
                    <input
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        // Show mentions when @ is freshly typed
                        const val = e.target.value;
                        const lastAt = val.lastIndexOf('@');
                        if (lastAt !== -1 && lastAt === val.length - 1) {
                          setShowMentions(true);
                          setMentionIndex(null);
                        } else if (!val.includes('@')) {
                          setShowMentions(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!isLocked) handleSend();
                          return;
                        }
                        if (e.key === 'ArrowDown' && showMentions) {
                          e.preventDefault();
                          setMentionIndex(0);
                          setTimeout(() => mentionRefs.current[0]?.focus(), 0);
                          return;
                        }
                      }}
                      placeholder={isLocked ? 'Action required: approve or modify the plan to continue' : 'Ask your agent anything...'}
                      disabled={isLocked}
                      className="flex-1 h-11 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50" />);


                })()}

              {/* Send button */}
              <button
                  onClick={handleSend}
                  disabled={!chatInput.trim()}
                  className="p-2.5 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
                  title="Send"
                  aria-label="Send message">

                <Send size={16} />
              </button>

              {/* @-mention popup */}
              <AnimatePresence>
                {showMentions &&
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    role="listbox"
                    aria-label="Mentions"
                    className="absolute left-4 bottom-full mb-2 z-50 w-56"
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setMentionIndex((prev) => {
                          const next = prev === null ? 0 : Math.min(atSuggestions.length - 1, prev + 1);
                          setTimeout(() => mentionRefs.current[next]?.focus(), 0);
                          return next;
                        });
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setMentionIndex((prev) => {
                          const next = prev === null ? atSuggestions.length - 1 : Math.max(0, prev - 1);
                          setTimeout(() => mentionRefs.current[next]?.focus(), 0);
                          return next;
                        });
                      }
                    }}>

                    <div className="bg-card border border-border rounded-lg shadow-lg p-1.5 space-y-0.5">
                      <p className="text-[10px] font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Mention a field</p>
                      {atSuggestions.map((s, idx) =>
                      <button
                        key={s}
                        ref={(el) => mentionRefs.current[idx] = el}
                        type="button"
                        role="option"
                        aria-selected={mentionIndex === idx}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const i = chatInput.lastIndexOf('@');
                            const newVal = chatInput.slice(0, i) + s + ' ';
                            setChatInput(newVal);
                            setMentionIndex(null);
                            setShowMentions(false);
                            setTimeout(() => chatInputRef.current?.focus(), 0);
                          }
                        }}
                        onClick={() => {
                          const i = chatInput.lastIndexOf('@');
                          const newVal = chatInput.slice(0, i) + s + ' ';
                          setChatInput(newVal);
                          setMentionIndex(null);
                          setShowMentions(false);
                          setTimeout(() => chatInputRef.current?.focus(), 0);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-md font-mono transition-colors focus:outline-none ${
                        mentionIndex === idx ?
                        'bg-primary/10 text-primary' :
                        'text-foreground hover:bg-muted'}`
                        }>

                          {s}
                        </button>
                      )}
                    </div>
                  </motion.div>
                  }
              </AnimatePresence>
            </div>
          </div>

          {/* Mode selector - pill toggle */}
          <div className="flex items-center gap-0.5 bg-muted/60 border border-border/50 rounded-xl p-1 shrink-0">
            {modes.map((mode) => {
                const Icon = mode.icon;
                const isActive = chatMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setChatMode(mode.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive ?
                    'bg-card text-foreground shadow-sm' :
                    'text-muted-foreground hover:text-foreground'}`
                    }
                    title={mode.label}>

                  <Icon size={14} />
                  <span className="hidden lg:inline">{mode.label}</span>
                </button>);

              })}
          </div>
        </div>
        
        <p className="text-[10px] text-muted-foreground text-center">Press Enter to send, Shift+Enter for new line</p>
      </div>
        </>
      }
    </div>);

}
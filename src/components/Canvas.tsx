import { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, ChatMode, type HITLResponse as StoreHITLResponse } from '@/store/useAppStore';
import { Send, Sparkles, Brain, Zap, Users, Paperclip, X, FileText, Database, Upload, Box, BarChart3, Plus, Activity, Clock, Check, MessageSquare, Copy, Download, Edit3, Search, ArrowUpDown } from 'lucide-react';

const modes: { id: ChatMode; label: string; icon: typeof Sparkles }[] = [
  { id: 'creative', label: 'Creative', icon: Sparkles },
  { id: 'deep-think', label: 'Deep Think', icon: Brain },
  { id: 'sota', label: 'SOTA', icon: Zap },
];

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

interface HITLOption {
  id: string;
  label: string;
  action: string;
  metadata?: Record<string, any>;
  style?: 'primary' | 'secondary' | 'destructive';
}

interface HITLResponse {
  type: 'hitl';
  title?: string;
  description?: string;
  options: HITLOption[];
  metadata?: Record<string, any>;
}

interface AgentResponse {
  type: 'text' | 'table' | 'markdown' | 'hitl';
  contentType?: 'text' | 'markdown' | 'table' | 'code';
  content: string;
  hitl?: HITLResponse;
  metadata?: Record<string, any>;
  category?: string;
  editable?: boolean;
  streaming?: boolean;
}

const suggestedQueries = {
  'data-modeler': [
    {
      icon: Database,
      title: 'Design Model for Products',
      description: 'Create a new data model for your financial products with AI guidance',
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
      title: 'Generate from Sample Table',
      description: 'Select from existing database tables to create your model',
      color: 'bg-amber-500/10 border-amber-200/30'
    },
    {
      icon: BarChart3,
      title: 'Explore Templates',
      description: 'Browse pre-built models for common banking products',
      color: 'bg-emerald-500/10 border-emerald-200/30'
    },
  ]
};

interface QueryCard {
  icon: typeof Database;
  title: string;
  description: string;
  color: string;
}

function SuggestedQueryCard({ card, onSelect }: { card: QueryCard; onSelect: (title: string) => void }) {
  const Icon = card.icon;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onSelect(card.title)}
      className={`p-4 rounded-lg border ${card.color} hover:shadow-md transition-all text-left w-full group hover:border-blue-300`}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className="text-blue-600 mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{card.title}</h4>
          <p className="text-xs text-gray-600 mt-1">{card.description}</p>
        </div>
      </div>
    </motion.button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0s' }} />
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
    </div>
  );
}

function TableSchemaDisplay({ schema }: { schema: TableSchema }) {
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
      className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-3 max-w-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{schema.tableName}</h3>
          <p className="text-xs text-muted-foreground mt-1">{schema.description}</p>
        </div>
        <button
          onClick={copyToClipboard}
          className="p-2 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground shrink-0"
          title="Copy JSON"
        >
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
            {schema.columns.map((col, idx) => (
              <tr key={idx} className="border-b border-border/30 hover:bg-primary/5 transition-colors">
                <td className="py-2 px-2 font-mono text-foreground">{col.name}</td>
                <td className="py-2 px-2 text-primary font-mono">{col.type}</td>
                <td className="py-2 px-2">
                  {col.nullable ? (
                    <span className="text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded">Yes</span>
                  ) : (
                    <span className="text-emerald-600 text-xs bg-emerald-50 px-2 py-1 rounded">No</span>
                  )}
                </td>
                <td className="py-2 px-2 text-muted-foreground">{col.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Download size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Click copy to export JSON schema</span>
      </div>
    </motion.div>
  );
}

// Generic content renderers
function TextRenderer({ content }: { content: string }) {
  return <p className="whitespace-pre-wrap text-sm">{content}</p>;
}

function EditableMarkdownTable({ content, messageId, onUpdate }: { content: string; messageId: string; onUpdate: (id: string, updatedContent: string) => void }) {
  const lines = content.split('\n').filter((l) => l.trim());
  const tableLines = lines.filter((l) => l.includes('|'));
  const headerLine = tableLines[0];
  const columns = headerLine.split('|').map((c) => c.trim()).filter(Boolean);
  const dataLines = tableLines.slice(2);
  
  const [rows, setRows] = useState(dataLines.map((line) =>
    line.split('|').map((c) => c.trim()).filter(Boolean)
  ));
  const [editCell, setEditCell] = useState<{ row: number; col: number } | null>(null);
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
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-5xl"
    >
      {/* Search and Filter Controls */}
      <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-200">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gray-600" />
          <input
            type="text"
            placeholder="Search in table..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-1 border border-gray-300 rounded text-xs"
          />
          <select
            value={filterCol ?? 'all'}
            onChange={(e) => setFilterCol(e.target.value === 'all' ? null : parseInt(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded text-xs"
          >
            <option value="all">All columns</option>
            {columns.map((col, idx) => (
              <option key={idx} value={idx}>{col}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-600">
          Showing {filteredRows.length} of {rows.length} rows
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded">
        {!useVirtual && (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50 sticky top-0">
                {columns.map((col, idx) => (
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
                    className="text-left py-2 px-3 font-semibold text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-200 transition-colors group"
                  >
                    <div className="flex items-center gap-1">
                      {col}
                      {sortCol === idx && (
                        <ArrowUpDown size={12} className={sortAsc ? '' : 'rotate-180'} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, displayIdx) => {
                const actualRowIdx = rows.indexOf(row);
                return (
                  <tr key={actualRowIdx} className="border-b border-gray-200 hover:bg-gray-50">
                    {row.map((cell, colIdx) => (
                      <td
                        key={`${actualRowIdx}-${colIdx}`}
                        className="py-2 px-3 text-gray-700 whitespace-nowrap cursor-text hover:bg-blue-50"
                        onClick={() => setEditCell({ row: actualRowIdx, col: colIdx })}
                      >
                        {editCell?.row === actualRowIdx && editCell?.col === colIdx ? (
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
                            className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-gray-900 text-xs"
                          />
                        ) : (
                          <span>{cell}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {useVirtual && (
          <div className="w-full text-xs">
            {/* Header as grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(0,1fr))] gap-0 border-b border-gray-300 bg-gray-50 sticky top-0">
              {columns.map((col, idx) => (
                <div key={idx} className="py-2 px-3 font-semibold text-gray-700 text-left">
                  <div className="flex items-center gap-1">
                    {col}
                    {sortCol === idx && (
                      <ArrowUpDown size={12} className={sortAsc ? '' : 'rotate-180'} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <List
              height={Math.min(500, filteredRows.length * 36)}
              itemCount={filteredRows.length}
              itemSize={36}
              width={'100%'}
            >
              {({ index, style }) => {
                const row = filteredRows[index];
                const actualRowIdx = rows.indexOf(row);
                return (
                  <div
                    style={style}
                    key={actualRowIdx}
                    className={`grid grid-cols-[repeat(${columns.length},minmax(0,1fr))] gap-0 border-b border-gray-200 hover:bg-gray-50 items-center py-2 px-0`}
                  >
                    {row.map((cell, colIdx) => (
                      <div
                        key={`${actualRowIdx}-${colIdx}`}
                        className="py-0 px-3 text-gray-700 whitespace-nowrap cursor-text hover:bg-blue-50"
                        onClick={() => setEditCell({ row: actualRowIdx, col: colIdx })}
                      >
                        {editCell?.row === actualRowIdx && editCell?.col === colIdx ? (
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
                            className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-gray-900 text-xs"
                          />
                        ) : (
                          <span>{cell}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }}
            </List>
          </div>
        )}
      </div>

      {/* Action Buttons - SEPARATE FROM HITL */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <span className="text-xs text-gray-600">Click any cell to edit • Scroll to view all columns</span>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-all"
        >
          Save Changes
        </button>
      </div>
    </motion.div>
  );
}

function MarkdownRenderer({ content, messageId, isEditing, onEdit }: { content: string; messageId?: string; isEditing?: boolean; onEdit?: (id: string, updatedContent: string) => void }) {
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
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-4xl"
        >
          <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50 sticky top-0">
                  {columns.map((col, idx) => (
                    <th key={idx} className="text-left py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-gray-200 hover:bg-gray-50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 text-gray-700 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      );
    }
  }

  // Regular markdown rendering
  const html = content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
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
    })
    .filter(Boolean)
    .join('');

  return <div className="space-y-1" dangerouslySetInnerHTML={{ __html: html }} />;
}

function TableRenderer({ content, metadata }: { content: string; metadata?: Record<string, any> }) {
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
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-3xl overflow-x-auto"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-gray-600">Table View</span>
        <button
          onClick={copyToClipboard}
          className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-900"
          title="Copy to CSV"
        >
          {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
        </button>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50">
            {columns.map((col, idx) => (
              <th key={idx} className="text-left py-2 px-3 font-semibold text-gray-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="border-b border-gray-200 hover:bg-gray-50">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="py-2 px-3 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}

function GenericHITLForm({ hitl, messageId, onAction }: { hitl: StoreHITLResponse; messageId?: string; onAction: (actionId: string, action: string, messageId?: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-gray-200 rounded-lg p-4 space-y-3 max-w-2xl"
    >
      {hitl.title && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{hitl.title}</h3>
          {hitl.description && (
            <p className="text-xs text-gray-600 mt-1">{hitl.description}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {hitl.options.map((option) => {
          const isPrimary = option.style === 'primary';
          const isSecondary = option.style === 'secondary';
          const isDestructive = option.style === 'destructive';

          return (
            <motion.button
              key={option.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAction(option.id, option.action, messageId)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                isPrimary
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                  : isDestructive
                  ? 'bg-red-500/20 text-red-700 border border-red-200 hover:bg-red-500/30'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>

      {hitl.metadata?.hint && (
        <p className="text-xs text-gray-600 pt-2 border-t border-gray-200">{hitl.metadata.hint}</p>
      )}
    </motion.div>
  );
}

function ContentRenderer({
  contentType,
  content,
  metadata,
}: {
  contentType?: string;
  content: string;
  metadata?: Record<string, any>;
}) {
  if (contentType === 'markdown') {
    return <MarkdownRenderer content={content} />;
  }
  if (contentType === 'table') {
    return <TableRenderer content={content} metadata={metadata} />;
  }
  return <TextRenderer content={content} />;
}

// Simulate a streaming backend response. Streams descriptive text in chunks,
// and appends markdown table content in one shot if present.
function simulateStreamingResponse(
  userInput: string,
  messageId: string,
  sendChunk: (id: string, chunk: string) => void,
  finalize: (id: string, finalContent: string, meta?: any) => void
) {
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

  // Chunk intro into words
  const words = intro.split(/(\s+)/).filter(Boolean);
  let idx = 0;

  const interval = setInterval(() => {
    if (idx < words.length) {
      const next = words[idx++];
      sendChunk(messageId, next);
      return;
    }

    clearInterval(interval);

    // Append table at once (if any) and attach hitl/metadata
    const finalContent = intro + (table ? '\n\n' + table : '');
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
        type: 'hitl',
        title: 'Approve Data Model Plan',
        description: 'Does this schema match your requirements?',
        options: [
          {
            id: 'approve',
            label: 'Approve Plan',
            action: 'approve_plan',
            style: 'primary',
          },
          {
            id: 'edit-schema',
            label: 'Edit Schema',
            action: 'edit_schema',
            style: 'secondary',
          },
        ],
        metadata: {
          hint: 'You can still edit the schema after approval.',
        },
      } as StoreHITLResponse,
      metadata: {
        schemaName: 'products',
      },
    };
  }

  return {
    type: 'text',
    contentType: 'text',
    content: 'I can help you design database models. Try asking me to "design a model for products" or specify the entity you\'d like to model.',
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
    const hasMessages = messages.some(m => m.sessionId === currentSessionId);
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

    // sendChunk uses the store to append content incrementally
    const sendChunk = (id: string, chunk: string) => {
      const store = useAppStore.getState();
      const msg = store.messages.find((m) => m.id === id);
      const current = msg?.content || '';
      updateMessage(id, { content: current + chunk });
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
      };
      
      if (table) {
        // Extract columns (as strings) and rows from table schema
        const columnNames = table.columns?.map((c: any) => c.name) || [];
        const rowData = table.rows?.map((r: any) => columnNames.map((name: string) => r[name] || '')) || [];
        updates.metadata = { 
          columns: columnNames,
          rows: rowData,
          table, // keep full table schema in metadata too
        };
        updates.contentType = 'table'; // render as table
      }
      
      if (hitl) {
        updates.hitl = hitl;
      }
      
      updateMessage(id, updates);
      setIsTyping(false);
    };

    // Try EventSource streaming first (frontend) -> server at /stream
    const streamFromServer = (userInput: string, id: string) => {
      try {
        if (typeof window === 'undefined' || !('EventSource' in window)) return null;
        const params = new URLSearchParams({ input: userInput, id });
        const STREAM_BASE = 'http://localhost:4555';
        const es = new EventSource(`${STREAM_BASE}/stream?${params.toString()}`);

        es.addEventListener('chunk', (e: MessageEvent) => {
          try {
            sendChunk(id, e.data);
          } catch (err) {
            console.error('chunk handler error', err);
          }
        });

        es.addEventListener('done', (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data);
            finalize(id, payload.content, payload.meta);
          } catch (err) {
            finalize(id, typeof e.data === 'string' ? e.data : String(e.data));
          }
          es.close();
        });

        es.addEventListener('error', () => {
          // on error, close and fallback to local simulator
          es.close();
          simulateStreamingResponse(userInput, id, sendChunk, finalize);
        });

        return () => es.close();
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

  const handleHITLAction = (optionId: string, action: string, messageId?: string) => {
    // If user chooses to modify, unlock chat input for this HITL message
    if (action === 'modify' || action === 'edit_schema') {
      if (messageId) setHitlUnlockedFor((s) => Array.from(new Set([...s, messageId])));
      return;
    }

    // Approve path: send confirmation message and keep input locked by default
    let responseContent = '';
    if (action === 'approve_plan') {
      responseContent = 'Perfect! Your data model plan has been approved. We can now proceed with implementing the schema in your database. Would you like me to generate the SQL migration script or do you want to configure any additional settings?';
    } else {
      responseContent = `Action "${action}" processed. Ready for next steps!`;
    }

    addMessage({
      id: crypto.randomUUID(),
      role: 'agent',
      content: responseContent,
      timestamp: new Date(),
      mode: chatMode,
      contentType: 'text',
    });
  };

  // Table editing removed: schema updates should come from backend flows

  return (
    <div className="flex-1 h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar - always visible */}
      <div className="flex items-center justify-end p-4 border-b border-border">
        <div className="text-sm font-medium text-foreground">Priya Sharma</div>
      </div>

      {/* Main content area */}
      {!activeAgent ? (
        <div className="flex-1 citi-gradient-bg citi-grid-pattern flex items-center justify-center relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center px-8"
          >
            <div className="w-20 h-20 rounded-2xl bg-citi-light-blue flex items-center justify-center mb-6 border border-citi-blue/30">
              <Activity size={40} className="text-citi-blue" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to CitiForge</h1>
            <p className="text-muted-foreground mb-8 max-w-md">
              Select an AI agent from the sidebar to get started with powerful data modeling, analysis, and automation tools.
            </p>
            <button
              onClick={() => setPresetModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
            >
              <Plus size={16} />
              Explore Presets
            </button>
          </motion.div>
        </div>
      ) : (
        <>
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
        <AnimatePresence>
          {(!messages.some(m => m.sessionId === currentSessionId)) && suggestionsShown && activeAgent === 'data-modeler' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Modeler</h2>
                <p className="text-sm text-gray-600">Design and generate data models for financial products</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                {suggestedQueries['data-modeler'].map((query) => (
                  <SuggestedQueryCard
                    key={query.title}
                    card={query}
                    onSelect={handleQuerySelect}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {messages.filter((m) => m.sessionId === currentSessionId).map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex flex-col gap-3 ${msg.role === 'user' ? 'max-w-[70%]' : 'max-w-[90%]'}`}>
                {msg.role === 'user' ? (
                  <div className="flex flex-col gap-2">
                    <div className="px-4 py-3 rounded-lg bg-blue-500 text-white rounded-br-none text-sm">
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-500 px-2 self-end">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg rounded-bl-none p-4">
                      <ContentRenderer
                        contentType={msg.contentType}
                        content={msg.content}
                        metadata={msg.metadata}
                      />
                      
                      {msg.hitl && (
                        <GenericHITLForm
                          hitl={msg.hitl}
                          messageId={msg.id}
                          onAction={handleHITLAction}
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 px-2">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg rounded-bl-none">
                <TypingIndicator />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-6 space-y-4">
        {/* Mode selector moved into the chat input bar for compact layout */}

        <div className="flex items-start gap-3">
          {/* Mode selector (left of chat input) */}
          <div className="flex-shrink-0">
            <label htmlFor="chat-mode-select" className="sr-only">Mode</label>
            <select
              id="chat-mode-select"
              aria-label="Chat mode"
              value={chatMode}
              onChange={(e) => setChatMode(e.target.value as ChatMode)}
              className="h-10 px-3 py-1 text-sm rounded-lg border border-border bg-card text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              {modes.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            {/* Attachment display */}
            <AnimatePresence>
          {attachmentFile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs"
            >
              <FileText size={14} className="text-blue-600 shrink-0" />
              <span className="font-medium text-gray-900 truncate flex-1">{attachmentFile.name}</span>
              <button
                onClick={clearAttachment}
                className="p-1 hover:bg-blue-100 rounded transition-colors text-gray-600 hover:text-gray-900 shrink-0"
                title="Remove"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input field */}
        <div className="relative z-20 flex items-center gap-2 bg-muted/50 border border-border rounded-lg hover:border-border/80 transition-colors focus-within:border-primary/50 focus-within:bg-card focus-within:ring-1 focus-within:ring-ring">
          {/* Mode select is rendered to the left of the input (only one instance above) */}
          {/* Attachment button */}
          <button
            className={`p-2 transition-colors flex items-center justify-center shrink-0 ${
              attachmentFile ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => document.getElementById('attach-file-canvas')?.click()}
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip size={16} />
          </button>

          <input
            id="attach-file-canvas"
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
          />

          {/* Text input */}
          {/** Disable input while a HITL prompt is active unless the user clicked Modify for that message */}
          {(() => {
            const sessionMsgs = messages.filter((m) => m.sessionId === currentSessionId);
            const activeHitlMsg = sessionMsgs.find((m) => m.hitl);
            const isLocked = !!activeHitlMsg && !(activeHitlMsg && hitlUnlockedFor.includes(activeHitlMsg.id));
            return (
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter to send
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isLocked) handleSend();
                    return;
                  }

                  if (e.key === 'ArrowDown' && chatInput.includes('@')) {
                    e.preventDefault();
                    setMentionIndex(0);
                    setTimeout(() => mentionRefs.current[0]?.focus(), 0);
                    return;
                  }
                }}
                placeholder={isLocked ? 'Action required: approve or modify the plan to continue' : 'Ask your agent anything...'}
                disabled={isLocked}
                className="flex-1 h-10 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-2 disabled:opacity-50"
              />
            );
          })()}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!chatInput.trim()}
            className="p-2 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
            title="Send"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>

          {/* @-mention helpers (keyboard accessible) */}
          {chatInput.includes('@') && (
            <div
              role="listbox"
              aria-label="Mentions"
              className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 z-40 w-[min(380px,80%)] max-w-md"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIndex((prev) => {
                    const next = prev === null ? 0 : Math.min((atSuggestions.length - 1), prev + 1);
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
              }}
            >
              <div className="bg-white border border-gray-200 rounded shadow-sm p-2">
                {atSuggestions.map((s, idx) => (
                  <button
                    key={s}
                    ref={(el) => (mentionRefs.current[idx] = el)}
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
                        setTimeout(() => chatInputRef.current?.focus(), 0);
                      }
                    }}
                    onClick={() => {
                      const i = chatInput.lastIndexOf('@');
                      const newVal = chatInput.slice(0, i) + s + ' ';
                      setChatInput(newVal);
                      setMentionIndex(null);
                      setTimeout(() => chatInputRef.current?.focus(), 0);
                    }}
                    className={`w-full text-left px-2 py-1 text-xs rounded focus:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300 ${mentionIndex === idx ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
        </div>
        
        <p className="text-[10px] text-muted-foreground text-center">Press Enter to send, Shift+Enter for new line</p>
      </div>
        </>
      )}
    </div>
  );
}

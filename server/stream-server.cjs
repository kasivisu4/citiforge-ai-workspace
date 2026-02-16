const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 4555;

function writeSSE(res, event, data) {
  if (event) res.write(`event: ${event}\n`);
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  res.write(`data: ${payload}\n\n`);
}

function generateMock(userInput) {
  const lower = (userInput || '').toLowerCase();
  const isModel = lower.includes('design') || lower.includes('model') || lower.includes('product');

  if (isModel) {
    const table = `| Column | Type | Nullable | Description |\n|--------|------|----------|-------------|\n| productId | UUID | No | Unique identifier for the product |\n| productName | VARCHAR(255) | No | Human-readable name of the product |\n| productType | ENUM | No | Category: DEPOSIT, CREDIT, INVESTMENT, INSURANCE |\n| description | TEXT | Yes | Detailed product description |`;

    const intro = "I've designed a Products table schema for your financial database. Review the schema below:";

    const content = intro + '\n\n' + table;

    const hitl = {
      type: 'hitl',
      title: 'Approve Data Model Plan',
      description: 'Does this schema match your requirements?',
      options: [
        { id: 'approve', label: 'Approve Plan', action: 'approve_plan', style: 'primary' },
        { id: 'edit-schema', label: 'Edit Schema', action: 'edit_schema', style: 'secondary' }
      ],
      metadata: { hint: 'You can still edit the schema after approval.' }
    };

    return { content, hitl, metadata: { schemaName: 'products' }, contentType: 'markdown' };
  }

  return { content: 'I can help you design database models. Try asking me to design a model for products.', contentType: 'text' };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  // simple in-memory sessions store for the mock server
  server.sessions = server.sessions || [];
  if (parsed.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SSE stream server running');
    return;
  }

  if (parsed.pathname === '/stream' || parsed.pathname === '/sse') {
    const q = parsed.query || {};
    const input = q.input || '';

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const mock = generateMock(input);
    const full = mock.content || '';
    const tableIndex = full.indexOf('\n|');
    let intro = full;
    let table = '';
    if (tableIndex !== -1) {
      intro = full.slice(0, tableIndex).trim();
      table = full.slice(tableIndex).trim();
    }

    const words = intro.split(/(\s+)/).filter(Boolean);
    let idx = 0;

    const interval = setInterval(() => {
      if (idx < words.length) {
        writeSSE(res, 'chunk', words[idx++]);
        return;
      }

      clearInterval(interval);

      // send final combined content
      const finalContent = intro + (table ? '\n\n' + table : '');
      writeSSE(res, 'done', JSON.stringify({ content: finalContent, meta: { hitl: mock.hitl, metadata: mock.metadata, contentType: mock.contentType } }));
      // close after a brief delay
      setTimeout(() => res.end(), 200);
    }, 120);

    // heartbeat
    const hb = setInterval(() => writeSSE(res, 'ping', 'keepalive'), 20000);

    req.on('close', () => {
      clearInterval(interval);
      clearInterval(hb);
    });

    return;
  }

  // Sessions API
  if (parsed.pathname === '/sessions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(server.sessions));
    return;
  }

  if (parsed.pathname === '/sessions' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const id = (Math.random() * 1e9).toFixed(0);
        const now = new Date();
        const session = { id, agent: payload.agent || null, title: payload.title || (payload.agent || 'Session'), createdAt: now, lastUpdated: now };
        server.sessions.push(session);
        res.writeHead(201, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(session));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }

  // Update session (patch lastUpdated)
  if (parsed.pathname && parsed.pathname.startsWith('/sessions/') && (req.method === 'PUT' || req.method === 'PATCH')) {
    const parts = parsed.pathname.split('/');
    const id = parts[2];
    const sess = server.sessions.find((s) => s.id === id);
    if (!sess) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    sess.lastUpdated = new Date();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(sess));
    return;
  }

  // fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`SSE mock server listening on http://localhost:${PORT}`);
});

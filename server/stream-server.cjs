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
    const intro = "I've designed a Products table schema for your financial database. Review the schema below:";
    const tableRows = [
      { id: 'p1', name: 'Product A', price: 9.99, currency: 'USD', available_since: '2024-01-10T00:00:00Z' },
      { id: 'p2', name: 'Product B', price: 19.99, currency: 'USD', available_since: '2024-02-15T00:00:00Z' }
    ];

    const content = intro;

    const hitl = {
      type: 'form',
      title: 'Review and Approve Data Model Plan',
      message: 'Provide final details, then submit approval.',
      fields: [
        { name: 'approval_notes', label: 'Approval notes', type: 'textarea', required: false, default: '' },
        { name: 'target_table', label: 'Target table name', type: 'text', required: true, default: 'products' },
        { name: 'risk_reviewed', label: 'Risk review completed', type: 'boolean', required: false, default: false }
      ],
      metadata: { hint: 'Submit the form to continue, or modify in chat before submitting.' }
    };

    return { content, hitl, metadata: { schemaName: 'products', tableDataString: JSON.stringify(tableRows) }, contentType: 'text' };
  }

  return { content: 'I can help you design database models. Try asking me to design a model for products.', contentType: 'text' };
}

function buildSuggestedQueries(userInput) {
  const text = String(userInput || '').toLowerCase();
  if (text.includes('migration') || text.includes('sql')) {
    return [
      {
        id: 'sq_generate_sql',
        title: '⚡ Generate Migration',
        description: 'Create SQL migration from the latest schema.',
        prompt: 'Generate SQL migration script for this schema.',
        variant: 'primary'
      },
      {
        id: 'sq_edit_schema',
        title: '🛠 Edit Schema',
        description: 'Adjust fields and naming before apply.',
        prompt: 'Edit the schema with my latest changes.'
      },
      {
        id: 'sq_validate_model',
        title: '🧪 Validate Model',
        description: 'Run consistency and type checks.',
        prompt: 'Validate this model and list any risks or inconsistencies.'
      }
    ];
  }

  return [
    {
      id: 'sq_generate_sql',
      title: '⚡ Generate Migration',
      description: 'Create migration SQL from your latest schema.',
      prompt: 'Generate SQL migration script for this schema.',
      variant: 'primary'
    },
    {
      id: 'sq_edit_schema',
      title: '🛠 Edit Schema',
      description: 'Adjust fields, enums, and naming quickly.',
      prompt: 'Edit the schema with my latest changes.'
    },
    {
      id: 'sq_seed_data',
      title: '🌱 Create Seed Data',
      description: 'Generate realistic sample records for testing.',
      prompt: 'Create representative seed data for this schema.'
    }
  ];
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
    const startSSEStream = (input) => {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const mock = generateMock(input);
      const full = mock.content || '';
      const intro = full.trim();

      const words = intro.split(/(\s+)/).filter(Boolean);
      let idx = 0;

      writeSSE(res, 'chunk', JSON.stringify({ render_type: 'start', total_steps: 3 }));
      writeSSE(res, 'chunk', JSON.stringify({ render_type: 'step', message: 'Plan overview', step: 1 }));

      const interval = setInterval(() => {
        if (idx < words.length) {
          writeSSE(res, 'chunk', JSON.stringify({ render_type: 'text', message: words[idx++], step: 1, step_name: 'Plan overview' }));
          return;
        }

        clearInterval(interval);

        // send final combined content
        const finalContent = intro;
        writeSSE(res, 'chunk', JSON.stringify({ render_type: 'step', message: 'Finalize', step: 3 }));
        writeSSE(res, 'done', JSON.stringify({ render_type: 'done', message: finalContent, meta: { hitl: mock.hitl, metadata: mock.metadata, contentType: mock.contentType, suggestedQueries: buildSuggestedQueries(input) } }));
        // close after a brief delay
        setTimeout(() => res.end(), 200);
      }, 120);

      // heartbeat
      const hb = setInterval(() => writeSSE(res, 'ping', 'keepalive'), 20000);

      req.on('close', () => {
        clearInterval(interval);
        clearInterval(hb);
      });
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => body += chunk.toString());
      req.on('end', () => {
        let payload = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch (err) {
          payload = {};
        }

        if (payload.hitlActionResult) {
          const actionId = String(payload.hitlActionResult.actionId || '');
          let suggestedQueries = [
            {
              id: 'sq_generate_sql',
              title: '⚡ Generate Migration',
              description: 'Create migration SQL from the latest schema.',
              prompt: 'Generate SQL migration script for this schema.',
              variant: 'primary'
            },
            {
              id: 'sq_edit_schema',
              title: '🛠 Edit Schema',
              description: 'Adjust fields, enums, and naming before finalizing.',
              prompt: 'Edit the schema with my latest changes.'
            },
            {
              id: 'sq_refine_constraints',
              title: '✅ Tighten Rules',
              description: 'Add nullable, compliance, and naming constraints.',
              prompt: 'Refine this schema with stricter constraints and validation rules.'
            },
            {
              id: 'sq_add_indexes',
              title: '📈 Suggest Indexes',
              description: 'Recommend indexes for read/write performance.',
              prompt: 'Suggest indexes and explain expected performance impact.'
            }
          ];

          if (actionId === 'submit_form') {
            suggestedQueries = [
              {
                id: 'sq_generate_sql',
                title: '⚡ Generate Migration',
                description: 'Create migration SQL for approved schema values.',
                prompt: 'Generate SQL migration script using the approved form values.',
                variant: 'primary'
              },
              {
                id: 'sq_edit_schema',
                title: '🛠 Edit Schema',
                description: 'Update the model before moving ahead.',
                prompt: 'Edit the approved schema with additional changes.'
              },
              {
                id: 'sq_validate_model',
                title: '🧪 Validate Model',
                description: 'Run consistency and type validation checks.',
                prompt: 'Validate this model and list any risks or inconsistencies.'
              },
              {
                id: 'sq_seed_data',
                title: '🌱 Create Seed Data',
                description: 'Produce realistic sample records for testing.',
                prompt: 'Create representative seed data for this approved schema.'
              }
            ];
          } else if (actionId === 'modify' || actionId === 'edit_schema') {
            suggestedQueries = [
              {
                id: 'sq_generate_sql',
                title: '⚡ Generate Migration',
                description: 'Build migration SQL once edits are complete.',
                prompt: 'Generate SQL migration for the updated schema.',
                variant: 'primary'
              },
              {
                id: 'sq_edit_schema',
                title: '🛠 Edit Schema',
                description: 'Continue refining fields and enums.',
                prompt: 'Edit core fields, data types, and enums based on feedback.'
              },
              {
                id: 'sq_compare_versions',
                title: '🔎 Compare Versions',
                description: 'Highlight changes from prior proposal.',
                prompt: 'Compare the current schema with the previous version and summarize differences.'
              },
              {
                id: 'sq_collect_requirements',
                title: '🧩 Capture Gaps',
                description: 'List open questions before final approval.',
                prompt: 'List the missing requirements I should confirm before approval.'
              }
            ];
          }

          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          console.log('[MOCK HITL] Received action result via /stream:', JSON.stringify(payload.hitlActionResult));
          res.write(JSON.stringify({ render_type: 'done', message: 'HITL action result received.', meta: { hitlActionResult: payload.hitlActionResult, suggestedQueries } }) + '\n');
          res.end();
          return;
        }

        startSSEStream(payload.message || payload.input || '');
      });
      return;
    }

    const q = parsed.query || {};
    const input = q.message || q.input || '';
    startSSEStream(input);

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

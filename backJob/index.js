import express from 'express';
import { randomUUID } from 'node:crypto';
import { Inngest } from 'inngest';
import { serve } from 'inngest/express';

const app = express();
const PORT = 3000;

// 1. O middleware de JSON deve vir ANTES da rota do Inngest
app.use(express.json());

// Armazenamento em memória para os relatórios
const reports = new Map();

// Cliente Inngest configurado explicitamente para modo dev local
const inngest = new Inngest({
  id: 'report-api',
  isDev: true,
});

// Funções
const sayHello = inngest.createFunction(
  { id: 'say-hello', triggers: [{ event: 'test/hello' }] },
  async ({ step }) => {
    await step.sleep('wait-a-moment', '5s');
    return 'Hello from background!';
  }
);

const makeReport = inngest.createFunction(
  { 
    id: 'make-report', 
    triggers: [{ event: 'report/requested' }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    await step.sleep('do-the-slow-work', '8s');

    await step.run('build-report', async () => {
      if (topic === 'fail') {
        const existing = reports.get(id);
        if (existing) {
          reports.set(id, { ...existing, status: 'failed' });
        }
        throw new Error('The report oven is broken!');
      }

      const existing = reports.get(id);
      if (existing) {
        reports.set(id, {
          ...existing,
          status: 'done',
          result: `Summary report for ${topic}: Generated successfully after analysis.`,
        });
      }
    });

    return { id, status: 'done' };
  }
);

const heartbeat = inngest.createFunction(
  { id: 'heartbeat', triggers: [{ cron: '* * * * *' }] },
  async ({ step }) => {
    return await step.run('summarize-reports', async () => {
      let pending = 0;
      let done = 0;
      let failed = 0;

      for (const report of reports.values()) {
        if (report.status === 'pending') pending++;
        else if (report.status === 'done') done++;
        else if (report.status === 'failed') failed++;
      }

      const summary = `Heartbeat: ${pending} pending, ${done} done, ${failed} failed`;
      console.log(summary);
      return { pending, done, failed, summary };
    });
  }
);

// 2. Desativar verificação de assinatura localmente no serve para evitar o erro 401
app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [sayHello, makeReport, heartbeat],
    serveHost: 'http://localhost:3000',
    servePath: '/api/inngest',
  })
);

// Endpoints da API
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/reports', async (req, res) => {
  const { topic } = req.body || {};

  if (!topic || typeof topic !== 'string' || topic.trim() === '') {
    return res.status(400).json({ error: 'Field "topic" is required.' });
  }

  const id = randomUUID();
  const reportItem = {
    id,
    topic,
    status: 'pending',
  };

  reports.set(id, reportItem);

  await inngest.send({
    name: 'report/requested',
    data: { id, topic },
  });

  res.status(202).json({ id, status: 'pending' });
});

app.get('/reports/:id', (req, res) => {
  const { id } = req.params;
  const report = reports.get(id);

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  res.status(200).json(report);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
import express from 'express';
import { randomUUID } from 'node:crypto';
import { Inngest } from 'inngest';
import { serve } from 'inngest/express';

const app = express();
const PORT = 3000;

const reports = new Map();

const inngest = new Inngest({
    id: 'report-api',
    isDev: true,
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});


const sayHello = inngest.createFunction(
  { id: 'say-hello', 
    triggers: [{ event: 'test/hello' }] 
},
  async ({ step }) => {
    await step.sleep('wait-a-moment', '5s');
    return 'Hello from background!';
  }
);

const makeReport = inngest.createFunction(
  { id: 'make-report', triggers: [{ event: 'report/requested' }] },
  async ({ event, step }) => {
    const { id, topic } = event.data;

    await step.sleep('do-the-slow-work', '8s');

    await step.run('build-report', async () => {
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

app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [sayHello, makeReport],
  })
);

app.post('/reports', async (req, res) => {
  const { topic } = req.body;
  const id = randomUUID();

  const reportItem = {
    id,
    topic: topic || 'general',
    status: 'pending',
  };
reports.set(id, reportItem);

await inngest.send({
    name: 'report/requested',
    data: {
        id,
        topic: reportItem.topic,
    },
});

res.status(202).json({
    id,
    status: 'pending',
});
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


import express from 'express';
import { Inngest } from 'inngest';
import { serve } from 'inngest/express';

const app = express();
const PORT = 3000;

app.use(express.json());

// Stage 0: Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Stage 1: Inngest Client (usar id: 'report-api')
const inngest = new Inngest({ id: 'report-api' });

const sayHello = inngest.createFunction(
  { id: 'say-hello', 
    triggers: [{ event: 'test/hello' }] 
},
  async ({ step }) => {
    await step.sleep('wait-a-moment', '5s');
    return 'Hello from background!';
  }
);

app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [sayHello],
  })
);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
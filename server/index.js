import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { proposalLatexToPdf } from './pdfExport.js';
import { answerAgentQuestion, generateProposal, repairProposalLatex, reviewProposal, startAgentSession, suggestFigure } from './proposalGenerator.js';
import { searchPapers } from './literature.js';

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    mode: process.env.LLM_API_KEY ? 'api-ready' : 'local-fallback'
  });
});

app.post('/api/agent/start', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.topic || '').trim()) {
      response.status(400).json({ error: 'Topic is required.' });
      return;
    }

    response.json(await startAgentSession(payload));
  } catch (error) {
    response.status(500).json({
      error: 'Agent start failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/agent/answer', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.answer || '').trim()) {
      response.status(400).json({ error: 'Answer is required.' });
      return;
    }

    response.json(await answerAgentQuestion(payload));
  } catch (error) {
    response.status(500).json({
      error: 'Answer integration failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/proposal', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.topic || '').trim()) {
      response.status(400).json({ error: 'Topic is required.' });
      return;
    }

    const result = await generateProposal(payload);
    response.json(result);
  } catch (error) {
    response.status(500).json({
      error: 'Proposal generation failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/repair', async (request, response) => {
  try {
    if (!String(request.body?.proposalLatex || '').trim()) {
      response.status(400).json({ error: 'proposalLatex is required.' });
      return;
    }

    response.json(await repairProposalLatex(request.body));
  } catch (error) {
    response.status(500).json({
      error: 'Repair failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/review', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.proposalLatex || '').trim()) {
      response.status(400).json({ error: 'proposalLatex is required.' });
      return;
    }

    response.json(await reviewProposal(payload));
  } catch (error) {
    response.status(500).json({
      error: 'Review failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/figure/suggest', async (request, response) => {
  try {
    const payload = request.body || {};

    if (!String(payload.topic || payload.title || '').trim()) {
      response.status(400).json({ error: 'A topic or title is required.' });
      return;
    }

    response.json(await suggestFigure(payload));
  } catch (error) {
    response.status(500).json({
      error: 'Figure suggestion failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/literature/search', async (request, response) => {
  try {
    const query = String(request.body?.query || '').trim();

    if (!query) {
      response.status(400).json({ error: 'A search query is required.' });
      return;
    }

    response.json({ papers: await searchPapers(query) });
  } catch (error) {
    response.status(500).json({
      error: 'Literature search failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/export/pdf', async (request, response) => {
  try {
    const payload = request.body || {};
    const latex = String(payload.proposalLatex || '').trim();

    if (!latex) {
      response.status(400).json({ error: 'proposalLatex is required.' });
      return;
    }

    const title = String(payload.title || 'proposal').trim();
    const pdf = await proposalLatexToPdf(latex, title, payload.figureImages || []);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="proposal.pdf"');
    response.send(pdf);
  } catch (error) {
    response.status(500).json({
      error: 'PDF export failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(port, () => {
  console.log(`Proposal API listening on http://127.0.0.1:${port}`);
});

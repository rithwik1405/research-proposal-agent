const DEFAULT_REQUIREMENTS = `Proposal must include:
- Project title
- Abstract
- Motivation and significance (plain language; why it matters and why now)
- Research gap and specific objectives/aims with concrete outcomes
- Method or approach tied to each objective
- Figure or diagram with caption
- Expected results and a clear endpoint within the timeline
- Research milestones with timeline estimates
- Evaluation plan with measurable criteria
- Intellectual Merit (how it advances knowledge; what is creative/original/transformative)
- Broader Impacts (benefits beyond the field: education, broadening participation, societal benefit, or open tools/data)
- Risks and mitigation
- Resources (key tools, datasets, mentors)
- References grounded in real prior work`;

const EMPTY_PROJECT_FOR_SERVER = {
  title: '',
  topic: '',
  problem: '',
  method: '',
  timeline: '',
  evaluation: '',
  resources: '',
  references: '',
  requirements: DEFAULT_REQUIREMENTS
};

const SYSTEM_PROMPT = `You are a research proposal agent for a CS research proposal.

Produce TWO outputs, in this exact order, each in its own fenced code block. Do NOT put the LaTeX inside JSON.

First, the complete proposal as LaTeX in a latex code block:
\`\`\`latex
<complete compile-ready LaTeX source for proposal.tex>
\`\`\`

Then, a short review object in a json code block:
\`\`\`json
{
  "reviewerScore": {
    "overall": 3.5,
    "criteria": [
      { "name": "Significance", "score": 4, "comment": "one concise sentence" },
      { "name": "Approach", "score": 3, "comment": "one concise sentence" },
      { "name": "Innovation", "score": 3, "comment": "one concise sentence" },
      { "name": "Feasibility", "score": 4, "comment": "one concise sentence" }
    ]
  },
  "complianceMatrix": [
    {
      "requirement": "requirement text",
      "status": "Covered | Needs work",
      "evidence": "short evidence",
      "fix": "short next action"
    }
  ],
  "evaluationReport": "plain text or Markdown report with missing items, weak claims, timeline risks, and revision priorities",
  "questions": ["short clarifying question"]
}
\`\`\`

Score like a strict grant reviewer on a 1-5 scale (1 = poor, 3 = acceptable, 5 = excellent). Significance = importance of the problem; Approach = soundness and clarity of method and evaluation; Innovation = novelty versus prior work; Feasibility = credible scope, milestones, and resources. overall is the mean of the four criteria, rounded to one decimal. Be discerning: reserve 5s for genuinely strong sections.

The json block must be small and must not contain LaTeX. Keep the two blocks separate.

Rules:
- The proposal artifact must be LaTeX, not Markdown.
- Return a complete LaTeX document with \\documentclass[10pt]{article}, 0.9-inch margins, title, sections, and bibliography/source notes.
- Use compile-safe LaTeX. Avoid minted, shell-escape, external images, custom fonts, or packages that require extra system tools.
- Do not use \\includegraphics or external image files. Do not use TikZ, pgf, or pstricks. Do not use the \\begin{center}...\\end{center} environment or \\begin{minipage} — these cause nesting errors.
- Build the figure with EXACTLY this safe, balanced pattern (use \\centering, a tabular, and a caption — nothing nested):
\\begin{figure}[h]
\\centering
\\begin{tabular}{|c|}
\\hline
Game state $\\rightarrow$ Agent action $\\rightarrow$ Data log $\\rightarrow$ Bug/balance analysis $\\rightarrow$ Report \\\\
\\hline
\\end{tabular}
\\caption{Workflow of the proposed agent.}
\\end{figure}
- CRITICAL: every \\begin{X} must have a matching \\end{X} in the correct order (same name and case). Never close one environment with another's \\end. Keep LaTeX simple so it compiles on the first try.
- Escape special characters in body text: write \\_ \\& \\# \\% (never bare _ & # %), and put any math, subscripts, or symbols inside $...$ (e.g. $x_1$, $\\geq 90\\%$). A bare _ or ^ in text causes a "Missing $" error.
- Write the final artifact as a research proposal, not as a short course implementation report.
- Keep the proposed research plan credible, appropriately scoped, and supported by milestones, resources, risks, and evaluation criteria.
- Mark unsupported claims as assumptions.
- Include a concrete agent workflow when the method involves an agent.
- Include at least one LaTeX-native figure, diagram, workflow chart, or architecture sketch with a caption.
- Do not invent citations. Use source notes or assumptions when sources are missing.
- If the input includes a "sources" list, treat those as the real literature for this proposal: the References section MUST list those sources and the related-work/novelty discussion MUST cite them inline. Each reference uses ONLY the author, year, and title given — do NOT add or invent journal names, venues, conference names, volume/issue numbers, page ranges, or DOIs (you do not have that data, so anything you add would be fabricated). Keep each reference to one line. Do NOT list "course requirements", "provided demo workflow", or the assignment itself as references, and do not invent citations beyond the provided sources.
- If no sources are provided, keep a brief References/source-notes section and clearly mark unsupported claims as assumptions.
- If "revisionNotes" are provided, treat them as the author's revision instructions for this draft and apply them directly (e.g., tighten scope, sharpen the research question, add a baseline).
- Do not use placeholder text, square brackets, "TODO", "lorem", or generic filler. Every section must contain concrete, specific content about this project's actual topic — named methods, metrics, datasets, and realistic milestones, not vague boilerplate.
- NEVER fabricate specific people, advisor or mentor names, institutions, lab names, grant numbers, or affiliations. Refer to roles generically (e.g., "a faculty advisor with reinforcement-learning expertise") and leave real names for the author to fill in.
- LENGTH LIMIT (hard): the entire proposal INCLUDING references MUST NOT exceed 4 pages; aim for 3. Keep total prose to ~1100-1500 words. Abstract <= 100 words. Use FEW sections and merge related ones to avoid header overhead: put the workflow figure inside Methodology, combine Expected Results with Milestones, and fold Intellectual Merit into Related Work. Each section is 1-2 SHORT paragraphs OR a brief list, never both. Caps: <=3 objectives, <=4 milestones, <=5 evaluation metrics, <=3 risks. Cut aggressively rather than exceed the limit.
- Keep the layout compact so it fits the page budget: use \\documentclass[10pt]{article} with \\usepackage[margin=0.9in]{geometry}, add \\setlength{\\parskip}{2pt} and \\setlength{\\parindent}{0pt}, and load \\usepackage{enumitem} with \\setlist{nosep} so lists and spacing stay tight.

Write to NSF GRFP standards (a strong fellowship research proposal):
- Open with a compelling, PLAIN-LANGUAGE motivation an interdisciplinary reviewer outside the subfield can follow — no unexplained jargon. Make the research question explicit, not implied.
- State 2-3 specific objectives/aims, each with a CONCRETE outcome (what will be discovered, built, or measured) and a clear endpoint feasible within the timeline. Tie the method directly to these objectives.
- Include an explicit "Intellectual Merit" section: how the work advances knowledge and what is creative, original, or transformative versus prior work.
- Include an explicit "Broader Impacts" section using real NSF-style categories (education/teaching, broadening participation, societal or economic benefit, open-source tools or datasets). Do not invent vague impacts.
- Be persuasive and concise: every sentence should earn its place; favor specific nouns and numbers over adjectives. Prioritize the panel UNDERSTANDING the work over showing off citations.
- Ground novelty and related work in the provided sources rather than generic claims.
- If a "figures" array is provided in the input, include EACH figure's "latex" VERBATIM in the proposal (in order, in sensible Figure sections) — they are already compile-safe. Do NOT redesign them or invent additional figures beyond the ones provided.`;

const QUESTION_SYSTEM_PROMPT = `You are running an interactive proposal-agent workflow.

Return strict JSON:
{
  "project": {
    "title": "",
    "problem": "",
    "method": "",
    "timeline": "",
    "evaluation": "",
    "resources": "",
    "references": ""
  },
  "fieldSuggestions": [
    {
      "field": "title | problem | method | timeline | evaluation | resources | references",
      "label": "human-readable label",
      "value": "specific suggested content",
      "confidence": "High | Medium | Low",
      "reason": "why this suggestion fits the rough idea"
    }
  ],
  "decisions": [
    {
      "id": "short-stable-id",
      "title": "decision title",
      "field": "problem | method | timeline | evaluation | resources | references",
      "question": "context-aware decision prompt",
      "options": [
        {
          "label": "short option label",
          "value": "content to write into the project state",
          "rationale": "when this option is a good fit"
        }
      ]
    }
  ],
  "questions": [
    {
      "field": "problem | method | evaluation | timeline | resources | references",
      "question": "one concise question",
      "reason": "why this answer matters",
      "priority": "High | Medium | Low"
    }
  ],
  "updates": ["short state update"]
}

Rules:
- Provide a fieldSuggestion for EVERY field: title, problem, method, timeline, evaluation, resources, references (skip references only if the user will supply papers).
- Ground every suggestion in the user's ACTUAL research idea. Write real, specific proposal content for that topic — concrete problems, methods, metrics, milestones, and tools that fit it.
- Never output placeholders, square brackets, "TODO", "e.g. ...", "lorem", or generic meta text such as "students need help turning ideas into proposals". Each value must read like real proposal content a reviewer would accept.
- Prefer specific nouns and numbers (named techniques, datasets, metrics, phase durations) over vague phrasing.
- Provide 2-3 decisions that are REAL trade-offs for THIS research idea — competing methods/algorithms, target domains or datasets, scope choices, or evaluation strategies specific to the topic. Each option's "value" must be concrete content tailored to the idea (e.g., for game-testing AI: "Deep Q-Network" vs "PPO" vs "evolutionary search"). Never produce generic decisions about "the proposal workflow", "the demo", "rubric alignment", or "student ownership".

First infer concrete proposal data from the rough idea. Give the user suggested data and selectable options before asking open-ended questions. Ask open-ended questions only for information that cannot be reasonably inferred.`;

const FIGURE_SYSTEM_PROMPT = `You design ONE compile-safe LaTeX figure for a CS research proposal.

Return only a single LaTeX figure environment inside a latex code block:
\`\`\`latex
\\begin{figure}[h]
\\centering
\\begin{tabular}{|c|}
\\hline
concise diagram of the proposed method or workflow using text and $\\rightarrow$ arrows \\\\
\\hline
\\end{tabular}
\\caption{One concrete sentence describing what the figure shows.}
\\end{figure}
\`\`\`

Rules:
- The figure must depict THIS project's specific method, workflow, or architecture — not a generic diagram.
- Use ONLY \\centering, tabular, itemize, and text arrows ($\\rightarrow$). Never use TikZ, pgf, \\begin{center}, minipage, or \\includegraphics.
- Every \\begin{X} has a matching \\end{X}. Keep it simple so it compiles on the first try.
- Always include a concrete \\caption.`;

export async function suggestFigure(payload) {
  const project = normalizePayload(payload);
  const focus = clean(payload.input);

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    const model = clean(process.env.LLM_MODEL);

    if (!model) {
      throw new Error('LLM_MODEL is required when LLM_API_KEY and LLM_API_URL are configured.');
    }

    const content = await callModel({
      systemPrompt: FIGURE_SYSTEM_PROMPT,
      payload: {
        topic: project.topic || project.title,
        problem: project.problem,
        method: project.method,
        focus
      },
      model,
      temperature: 0.3,
      jsonMode: false
    });

    const latex = extractFencedBlock(clean(content), ['latex', 'tex']);
    const figureLatex = /\\begin\{figure\}/.test(latex) ? latex : buildLocalFigure(project);

    return { mode: 'api', latex: figureLatex, caption: extractCaption(figureLatex) };
  }

  const figureLatex = buildLocalFigure(project);
  return { mode: 'local-fallback', latex: figureLatex, caption: extractCaption(figureLatex) };
}

function buildLocalFigure(project) {
  const topic = project.title || project.topic || 'the proposed system';
  return String.raw`\begin{figure}[h]
\centering
\begin{tabular}{|c|}
\hline
Input $\rightarrow$ Agent action $\rightarrow$ Data log $\rightarrow$ Analysis $\rightarrow$ Report \\
\hline
\end{tabular}
\caption{High-level workflow of ${escapeLatex(topic)}.}
\end{figure}`;
}

function extractCaption(latex) {
  const match = String(latex || '').match(/\\caption\{([^}]*)\}/);
  return match?.[1]?.trim() || '';
}

const REVIEWER_SYSTEM_PROMPT = `You are an independent, strict grant reviewer (NSF-style) evaluating a research proposal you did NOT write. Judge it on its merits and be discerning.

Return strict JSON:
{
  "reviewerScore": {
    "overall": 3.5,
    "criteria": [
      { "name": "Significance", "score": 4, "comment": "one concise sentence" },
      { "name": "Approach", "score": 3, "comment": "one concise sentence" },
      { "name": "Innovation", "score": 3, "comment": "one concise sentence" },
      { "name": "Feasibility", "score": 4, "comment": "one concise sentence" }
    ]
  },
  "summary": "2-4 sentence overall assessment in a reviewer's voice",
  "suggestedEdits": [
    { "section": "e.g. Motivation", "issue": "what is weak", "suggestion": "a concrete, specific edit to make" }
  ]
}

Scoring: 1 = poor, 3 = acceptable, 5 = excellent. Reserve 5s for genuinely strong sections; do not inflate. overall is the mean of the four criteria, rounded to one decimal.
Definitions: Significance = importance of the problem; Approach = soundness and clarity of method and evaluation; Innovation = novelty versus prior work; Feasibility = credible scope, milestones, and resources.
Provide 2-5 suggestedEdits targeting the weakest parts — each concrete and actionable. Do not invent edits for sections that are already strong.`;

function normalizeSuggestedEdits(edits) {
  if (!Array.isArray(edits)) return [];

  return edits
    .map((edit) => ({
      section: clean(edit?.section) || 'General',
      issue: clean(edit?.issue),
      suggestion: clean(edit?.suggestion)
    }))
    .filter((edit) => edit.suggestion)
    .slice(0, 6);
}

const REPAIR_SYSTEM_PROMPT = `You fix LaTeX that failed to compile. Return ONLY the corrected, complete LaTeX document inside a latex code block — no explanation.

Keep the content and structure identical; change ONLY what breaks compilation:
- Escape stray special characters in text (\\_ \\& \\# \\%) and wrap any math, subscripts, or symbols in $...$.
- Make every \\begin{env} match its \\end{env} (same name and case), correctly nested and balanced.
- Remove TikZ, pgf, pstricks, \\begin{center}, and \\begin{minipage}; keep any figure as a simple figure + \\centering + tabular + \\caption.
- Do not reference image files with \\includegraphics unless they already appear in the document.

Return the full document from \\documentclass to \\end{document} in one latex code block.`;

export async function repairProposalLatex(payload) {
  const proposalLatex = clean(payload.proposalLatex);
  const errorText = clean(payload.error).slice(0, 1500);

  if (!proposalLatex) {
    throw new Error('proposalLatex is required for repair.');
  }

  if (!(process.env.LLM_API_KEY && process.env.LLM_API_URL)) {
    return { proposalLatex };
  }

  const model = clean(process.env.LLM_MODEL);
  const content = await callModel({
    systemPrompt: REPAIR_SYSTEM_PROMPT,
    payload: { compilerError: errorText, latex: proposalLatex },
    model,
    temperature: 0.1,
    jsonMode: false
  });
  const fixed = extractFencedBlock(clean(content), ['latex', 'tex']);

  return { proposalLatex: looksLikeLatex(fixed) ? fixed : proposalLatex };
}

export async function reviewProposal(payload) {
  const proposal = clean(payload.proposalLatex);
  const checklist = extractChecklist(clean(payload.requirements) || DEFAULT_REQUIREMENTS);

  if (!proposal) {
    throw new Error('proposalLatex is required for review.');
  }

  const cfg = reviewLlmConfig();

  if (cfg.apiKey && cfg.apiUrl && cfg.model) {
    const content = await callModel({
      systemPrompt: REVIEWER_SYSTEM_PROMPT,
      payload: { proposal: proposal.slice(0, 16000), checklist },
      model: cfg.model,
      temperature: 0.2,
      jsonMode: true,
      config: cfg
    });
    const parsed = parseJsonContent(content);

    return {
      mode: 'api',
      model: cfg.model,
      reviewerScore: normalizeReviewerScore(parsed.reviewerScore, []),
      summary: clean(parsed.summary) || 'No summary returned.',
      suggestedEdits: normalizeSuggestedEdits(parsed.suggestedEdits)
    };
  }

  return {
    mode: 'local-fallback',
    model: 'template',
    reviewerScore: normalizeReviewerScore(null, []),
    summary: 'Configure an LLM API key to get independent reviewer feedback.',
    suggestedEdits: []
  };
}

export async function startAgentSession(payload) {
  const project = normalizePayload(payload);
  const checklist = extractChecklist(project.requirements || DEFAULT_REQUIREMENTS);

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    const result = await refineProjectWithApi({
      task: 'start',
      project,
      checklist,
      activeQuestion: null,
      answer: ''
    });

    return {
      ...result,
      project: keepOnlyAcceptedStartFields(project, result.project),
      checklist,
      inputSummary: summarizeProjectInput(result.project),
      runMessage: `Initialized topic and prepared ${result.fieldSuggestions.length} suggested field(s) and ${result.decisions.length} decision card(s).`
    };
  }

  const questions = buildQuestionObjects(project);
  const fieldSuggestions = buildFieldSuggestions(project);
  const decisions = buildDecisionCards(project);

  return {
    mode: 'local-fallback',
    provider: 'template',
    project,
    checklist,
    suggestedProject: projectFromSuggestions(project, fieldSuggestions),
    fieldSuggestions,
    decisions,
    questions,
    inputSummary: summarizeProjectInput(project),
    updates: [`Initialized topic: ${project.title}.`],
    runMessage: `Initialized topic and prepared ${fieldSuggestions.length} fallback suggestion(s).`,
    transcript: {
      prompt: { task: 'start', project, checklist },
      rawResponse: 'Generated by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

export async function answerAgentQuestion(payload) {
  const project = normalizePayload(payload.project || payload);
  const checklist = extractChecklist(project.requirements || payload.requirements || DEFAULT_REQUIREMENTS);
  const activeQuestion = normalizeQuestion(payload.question);
  const answer = clean(payload.answer);

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    const result = await refineProjectWithApi({
      task: 'integrate-answer',
      project,
      checklist,
      activeQuestion,
      answer
    });

    return {
      ...result,
      checklist,
      inputSummary: summarizeProjectInput(result.project),
      runMessage: result.updates.join(' ') || 'Integrated answer with model reasoning.'
    };
  }

  const integration = integrateAnswerLocally(project, answer, activeQuestion);
  const questions = buildQuestionObjects(integration.project);

  return {
    mode: 'local-fallback',
    provider: 'template',
    project: integration.project,
    checklist,
    suggestedProject: projectFromSuggestions(integration.project, buildFieldSuggestions(integration.project)),
    fieldSuggestions: buildFieldSuggestions(integration.project),
    decisions: buildDecisionCards(integration.project),
    questions,
    inputSummary: summarizeProjectInput(integration.project),
    updates: integration.updates,
    runMessage: `${integration.updates.join(' ')} ${questions.length} follow-up question(s) remain.`.trim(),
    transcript: {
      prompt: { task: 'integrate-answer', project, activeQuestion, answer, checklist },
      rawResponse: 'Integrated by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

export async function generateProposal(payload) {
  const project = normalizePayload(payload);
  const requirements = project.requirements || DEFAULT_REQUIREMENTS;
  const checklist = extractChecklist(requirements);
  const sources = normalizeSources(payload.sources);
  const notes = clean(payload.notes);
  const figures = normalizeFigures(payload.figures);

  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) {
    return generateWithApi(project, checklist, sources, notes, figures);
  }

  return generateLocally(project, checklist);
}

function normalizeFigures(figures) {
  if (!Array.isArray(figures)) return [];

  return figures
    .map((figure) => ({
      latex: clean(figure?.latex),
      image: Boolean(figure?.image),
      imageName: clean(figure?.imageName)
    }))
    .filter((figure) => figure.latex || figure.image);
}

// Trim user-provided sources to a small, prompt-safe shape.
function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];

  return sources
    .map((source) => ({
      title: clean(source.title),
      authors: clean(source.authors),
      year: source.year ? String(source.year) : '',
      abstract: clean(source.abstract).slice(0, 400)
    }))
    .filter((source) => source.title)
    .slice(0, 12);
}

async function refineProjectWithApi(payload) {
  const model = clean(process.env.LLM_MODEL);

  if (!model) {
    throw new Error('LLM_MODEL is required when LLM_API_KEY and LLM_API_URL are configured.');
  }

  const content = await callModel({
    systemPrompt: QUESTION_SYSTEM_PROMPT,
    payload,
    model,
    temperature: 0.2
  });
  const parsed = parseJsonContent(content);
  const nextProject = mergeProject(payload.project, normalizePayload(parsed.project || {}));
  const fieldSuggestions = normalizeFieldSuggestions(parsed.fieldSuggestions, nextProject);
  const decisions = normalizeDecisions(parsed.decisions, nextProject);
  const questions = normalizeQuestions(parsed.questions, nextProject);

  return {
    mode: 'api',
    provider: process.env.LLM_API_URL,
    project: nextProject,
    suggestedProject: nextProject,
    fieldSuggestions,
    decisions,
    questions,
    updates: Array.isArray(parsed.updates) ? parsed.updates.map(clean).filter(Boolean) : ['Updated project state.'],
    transcript: {
      prompt: payload,
      rawResponse: content
    }
  };
}

async function generateWithApi(project, checklist, sources = [], notes = '', figures = []) {
  const model = clean(process.env.LLM_MODEL);

  if (!model) {
    throw new Error('LLM_MODEL is required when LLM_API_KEY and LLM_API_URL are configured.');
  }

  const promptPayload = {
    project,
    checklist,
    sources,
    revisionNotes: notes,
    figures,
    outputContract: {
      latexBlock: 'Complete compile-ready LaTeX source for proposal.tex, in a ```latex fence',
      jsonBlock: 'A ```json fence with complianceMatrix, evaluationReport, and questions'
    }
  };

  // The proposal returns a ```latex block plus a small ```json block, so LaTeX
  // never has to be escaped inside JSON. Retry once if the LaTeX is missing.
  let content = await callModel({
    systemPrompt: SYSTEM_PROMPT,
    payload: promptPayload,
    model,
    temperature: 0.2,
    jsonMode: false
  });
  let parsed = parseProposalResponse(content);

  if (!hasUsableProposal(parsed)) {
    content = await callModel({
      systemPrompt: SYSTEM_PROMPT,
      payload: promptPayload,
      model,
      temperature: 0.2,
      jsonMode: false
    });
    parsed = parseProposalResponse(content);
  }

  return {
    mode: 'api',
    provider: process.env.LLM_API_URL,
    ...coerceResult(parsed, project, checklist),
    transcript: {
      prompt: promptPayload,
      rawResponse: content
    }
  };
}

// A usable proposal needs real LaTeX and a populated compliance matrix; if
// either is missing the JSON was malformed or truncated.
function hasUsableProposal(parsed) {
  const latex = unwrapLatexCandidate(clean(parsed?.proposalLatex));
  const matrixOk = Array.isArray(parsed?.complianceMatrix) && parsed.complianceMatrix.length > 0;
  return looksLikeLatex(latex) && matrixOk;
}

async function callModel({ systemPrompt, payload, model, temperature, jsonMode = true, config = null }) {
  const cfg = config || mainLlmConfig();

  if (cfg.provider === 'gemini') {
    return callGemini({ systemPrompt, payload, model, temperature, jsonMode, cfg });
  }

  return callOpenAiCompatible({ systemPrompt, payload, model, temperature, cfg });
}

async function callGemini({ systemPrompt, payload, model, temperature, jsonMode = true, cfg }) {
  const baseUrl = clean(cfg?.apiUrl) || 'https://generativelanguage.googleapis.com/v1beta';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': cfg?.apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(payload, null, 2) }]
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: 32768,
        // Only force JSON output when the whole response is JSON. The proposal
        // call returns mixed fenced blocks (latex + json), so JSON mode is off.
        ...(jsonMode ? { responseMimeType: 'application/json' } : {})
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini API returned ${response.status}`);
  }

  const content = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n');

  if (!content) {
    throw new Error('Gemini API returned no text content.');
  }

  return content;
}

async function callOpenAiCompatible({ systemPrompt, payload, model, temperature, cfg }) {
  const response = await fetch(clean(cfg?.apiUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg?.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload, null, 2) }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `API returned ${response.status}`);
  }

  return readModelContent(data);
}

function generateLocally(project, checklist) {
  const questions = buildQuestions(project);
  const proposalLatex = buildLocalProposalLatex(project);
  const complianceMatrix = checklist.map((requirement) => {
    const evidence = findRequirementEvidence(requirement, project);

    return {
      requirement,
      status: evidence ? 'Covered' : 'Needs work',
      evidence: evidence || 'No strong evidence in the current project state.',
      fix: evidence ? 'Keep this section specific.' : `Add concrete detail for: ${requirement}.`
    };
  });

  const needsWork = complianceMatrix.filter((row) => row.status === 'Needs work');
  const evaluationReport = `# Evaluation Report

## Summary
- Mode: local deterministic fallback.
- Covered requirements: ${complianceMatrix.length - needsWork.length}/${complianceMatrix.length}.
- Remaining questions: ${questions.length}.

## Weak Claims And Risks
${needsWork.length ? needsWork.map((row) => `- ${row.requirement}: ${row.fix}`).join('\n') : '- No missing checklist items detected by the fallback checker.'}

## Revision Priorities
${questions.length ? questions.map((question) => `- ${question}`).join('\n') : '- Draft is ready for API-backed review or human revision.'}
`;

  return {
    mode: 'local-fallback',
    provider: 'template',
    proposalLatex,
    complianceMatrix,
    reviewerScore: normalizeReviewerScore(null, complianceMatrix),
    evaluationReport,
    questions,
    transcript: {
      prompt: { project, checklist },
      rawResponse: 'Generated by local fallback because LLM_API_KEY or LLM_API_URL is not configured.'
    }
  };
}

function buildLocalProposalLatex(project) {
  const title = project.title || project.topic;
  const problem = project.problem || 'The current problem is still underspecified and should be refined through clarifying questions.';
  const method = project.method || 'The agent workflow will collect a rough research direction, ask targeted clarification questions, update project state, draft a research proposal, check requirements, and revise weak sections.';
  const evaluation = project.evaluation || 'Evaluate the first and revised drafts against section coverage, missing fields, weak claims, prior-work comparison, research milestones, and proposal-specific success criteria.';
  const timeline = project.timeline || 'Phase 1 literature and requirement review; Phase 2 workflow and method design; Phase 3 prototype or study setup; Phase 4 evaluation and analysis; Phase 5 final proposal revision and source notes.';
  const resources = project.resources || 'This browser app, a local Node API service, an optional LLM API key, proposal-writing references, and source notes for unsupported claims.';
  const references = project.references || 'Course proposal requirements and demo scaffold. Additional claims are treated as assumptions.';

  return String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\setlist{nosep}
\title{${escapeLatex(title)}}
\author{}
\date{}

\begin{document}
\maketitle

\begin{abstract}
This project builds a proposal agent that turns a rough research direction into a structured research proposal. The workflow collects project intent, calls an API-backed generator when configured, produces a LaTeX proposal draft, checks requirements, and lists revision questions.
\end{abstract}

\section{Motivation and Gap}
${latexParagraph(problem)}

Students often have partial ideas but need help converting them into proposal sections with clear methods, milestones, and evaluation criteria. \textbf{Assumption:} a lightweight guided workflow is sufficient for a useful classroom demo.

\section{Project Goal}
Create a working proposal generator that can produce a LaTeX proposal, compliance matrix, evaluation report, and follow-up questions from a rough idea.

\section{Method and Agent Workflow}
${latexParagraph(method)}

\begin{enumerate}
\item Capture topic, problem, method, timeline, evaluation plan, resources, and requirement text.
\item Send the structured state to the local API service.
\item Use the configured LLM API when available; otherwise use a deterministic fallback.
\item Return LaTeX source, requirement coverage, self-evaluation, and clarification questions.
\item Compile \texttt{proposal.tex} into \texttt{proposal.pdf} with a LaTeX engine.
\end{enumerate}

\section{Figure}
\begin{figure}[h]
\centering
\fbox{\begin{minipage}{0.9\linewidth}
\centering
Rough idea $\rightarrow$ structured suggestions $\rightarrow$ student decisions $\rightarrow$ accepted project state $\rightarrow$ LaTeX proposal $\rightarrow$ compliance review $\rightarrow$ revised PDF
\end{minipage}}
\caption{Proposed workflow for turning a rough idea into a reviewed proposal artifact.}
\end{figure}

\section{Expected Results and Research Milestones}
${latexParagraph(timeline)}

Expected result: a reproducible workflow that can start from a rough research direction and produce proposal artifacts with explicit milestones, assumptions, and review evidence.

\section{Evaluation Plan}
${latexParagraph(evaluation)}

Test cases include a complete idea, a missing-information idea, a requirement-check case, and a revision case after weak claims are flagged.

\section{Risks and Mitigation}
\begin{itemize}
\item API key is missing: use deterministic fallback and document that mode.
\item Generated claims are unsupported: mark them as assumptions and ask for source notes.
\item Research scope becomes too broad: narrow the contribution, milestones, and evaluation criteria before drafting.
\end{itemize}

\section{Resources}
${latexParagraph(resources)}

\section{References and Assumptions}
${latexParagraph(references)}

\end{document}
`;
}

function buildQuestions(project) {
  return buildQuestionObjects(project).map((question) => question.question);
}

function buildQuestionObjects(project) {
  const questions = [];
  const add = (field, question, reason, priority = 'High') => {
    questions.push({
      id: `${field}-${questions.length + 1}`,
      field,
      question,
      reason,
      priority
    });
  };

  if (!isSpecific(project.problem, 80)) {
    add(
      'problem',
      'What concrete problem does this proposal solve, and who experiences it?',
      'The proposal needs a specific motivation and user or stakeholder.'
    );
  }

  if (!isSpecific(project.method, 80)) {
    add(
      'method',
      'What exact workflow or technical method will the project implement?',
      'The method should describe stages, inputs, outputs, and the API-backed loop.'
    );
  }

  if (!isSpecific(project.evaluation, 60)) {
    add(
      'evaluation',
      'What measurable checks will prove the revised proposal is better than the first draft?',
      'The evaluation plan needs concrete tests or metrics.'
    );
  }

  if (!isSpecific(project.timeline, 40)) {
    add(
      'timeline',
      'What research milestones and timeline estimates make this proposal credible?',
      'The proposal needs scoped milestones, feasibility evidence, and realistic risks.'
    );
  }

  if (!isSpecific(project.resources, 30)) {
    add(
      'resources',
      'What tools, APIs, files, or fallback mode will make this reproducible?',
      'The proposal needs implementation resources and API-key handling.',
      'Medium'
    );
  }

  if (!isSpecific(project.references, 30)) {
    add(
      'references',
      'What sources or assumptions should ground the claims?',
      'Unsupported claims should be marked as assumptions or tied to source notes.',
      'Medium'
    );
  }

  if (!questions.length) {
    add(
      'next-step',
      'The project state looks draftable. Should I generate the proposal now?',
      'No required missing field remains in the basic checker.',
      'Low'
    );
  }

  return questions.slice(0, 5);
}

function integrateAnswerLocally(project, answer, question) {
  const targetField = question?.field && question.field !== 'next-step' ? question.field : firstMissingField(project);
  const nextProject = { ...project };
  const updates = [];

  if (targetField && Object.hasOwn(nextProject, targetField)) {
    nextProject[targetField] = mergeField(nextProject[targetField], answer);
    updates.push(`Updated ${targetField}.`);
  } else {
    nextProject.method = mergeField(nextProject.method, answer);
    updates.push('Updated method.');
  }

  return { project: nextProject, updates };
}

function buildFieldSuggestions(project) {
  const topic = project.title || project.topic || 'the project';
  const suggestions = [
    {
      field: 'title',
      label: 'Project Title',
      value: project.title || titleCase(topic),
      confidence: 'High',
      reason: 'Use the rough idea as the working title so the proposal has a stable anchor.'
    },
    {
      field: 'problem',
      label: 'Problem Framing',
      value:
        project.problem ||
        `Students or project authors have a rough idea for ${topic}, but need help turning it into a structured, rubric-aligned proposal with clear scope and evaluation.`,
      confidence: project.problem ? 'High' : 'Medium',
      reason: 'A proposal needs a concrete user pain point before method details are useful.'
    },
    {
      field: 'method',
      label: 'Method / Agent Workflow',
      value:
        project.method ||
        'Build an agent workflow that extracts project state from a rough idea, presents suggested fields and decision options, accepts user edits, drafts a proposal, checks requirements, and revises weak sections.',
      confidence: project.method ? 'High' : 'Medium',
      reason: 'The method should describe the agent process rather than only promising a final text draft.'
    },
    {
      field: 'evaluation',
      label: 'Evaluation Plan',
      value:
        project.evaluation ||
        'Test complete, missing-info, requirement-check, unsupported-claim, and revision scenarios. Compare draft quality by checklist coverage, specificity, and whether weak claims are flagged.',
      confidence: project.evaluation ? 'High' : 'Medium',
      reason: 'The course proposal needs evidence that the workflow improves the artifact.'
    },
    {
      field: 'timeline',
      label: 'Research Milestones',
      value:
        project.timeline ||
        'Phase 1: proposal-writing research and prior-work review. Phase 2: workflow and method design. Phase 3: prototype or study setup. Phase 4: evaluation and unsupported-claim review. Phase 5: final proposal revision and source notes.',
      confidence: project.timeline ? 'High' : 'Medium',
      reason: 'Research milestones help reviewers judge feasibility, expected outcomes, and scope.'
    },
    {
      field: 'resources',
      label: 'Resources',
      value: project.resources || 'React, Vite, Node, Gemini API, local fallback mode, sample research ideas, and course requirements.',
      confidence: project.resources ? 'High' : 'Medium',
      reason: 'Resource notes make the API-backed workflow reproducible.'
    },
    {
      field: 'references',
      label: 'Sources / Assumptions',
      value: project.references || 'Course proposal requirements, the provided demo workflow, and explicit assumptions for unsupported claims.',
      confidence: project.references ? 'High' : 'Medium',
      reason: 'Source notes prevent the proposal from inventing unsupported claims.'
    }
  ];

  return suggestions.filter((item) => clean(item.value));
}

function buildDecisionCards(project) {
  const topic = project.title || project.topic || 'this project';

  return [
    {
      id: 'problem-framing',
      title: 'Choose The Problem Framing',
      field: 'problem',
      question: 'Which problem framing should the proposal emphasize?',
      options: [
        {
          label: 'Rubric alignment',
          value: `Students have rough ideas for ${topic}, but struggle to translate them into proposal sections that satisfy the course rubric.`,
          rationale: 'Best when the project is mainly about proposal structure and grading requirements.'
        },
        {
          label: 'Revision quality',
          value: `Students can produce a first draft for ${topic}, but need help identifying weak claims, missing evidence, and unclear evaluation plans before submission.`,
          rationale: 'Best when the agent focuses on critique and revision.'
        },
        {
          label: 'Scope control',
          value: `Students often choose research directions that are too broad or underspecified, so they need a workflow that narrows the idea into a credible proposal with explicit milestones and evaluation criteria.`,
          rationale: 'Best when feasibility, milestones, and research scope are the main risks.'
        }
      ]
    },
    {
      id: 'method-style',
      title: 'Choose The Agent Method',
      field: 'method',
      question: 'What should the core agent workflow optimize for?',
      options: [
        {
          label: 'Structured extraction',
          value:
            'The agent extracts project fields from a rough idea, shows suggested data for user approval, and only asks clarifying questions when required fields remain uncertain.',
          rationale: 'Best for reducing manual prompting.'
        },
        {
          label: 'Rubric-first drafting',
          value:
            'The agent parses requirements into a checklist, maps each project field to required proposal sections, drafts the proposal, and produces a compliance matrix.',
          rationale: 'Best when grading coverage is the main concern.'
        },
        {
          label: 'Critique and revise',
          value:
            'The agent drafts quickly, judges the draft for missing sections and weak claims, proposes targeted revisions, and lets the user accept or edit changes.',
          rationale: 'Best for a visible revision loop.'
        }
      ]
    },
    {
      id: 'evaluation-choice',
      title: 'Choose Evaluation Evidence',
      field: 'evaluation',
      question: 'How should the demo prove the workflow is useful?',
      options: [
        {
          label: 'Before / after',
          value: 'Compare a rough initial draft with the revised proposal on required-section coverage, specificity, and unresolved assumptions.',
          rationale: 'Simple and convincing for a classroom demo.'
        },
        {
          label: 'Scenario tests',
          value: 'Run normal, missing-information, requirement-check, unsupported-claim, and revision scenarios, then report pass/fail outcomes.',
          rationale: 'Best for demonstrating agent behavior across cases.'
        },
        {
          label: 'Human review',
          value: 'Have the student review whether each suggested field is accurate, useful, and ready for the final proposal before export.',
          rationale: 'Best when student ownership is important.'
        }
      ]
    }
  ];
}

function normalizeFieldSuggestions(suggestions, project) {
  const parsed = Array.isArray(suggestions)
    ? suggestions
        .map((item) => ({
          field: clean(item.field),
          label: clean(item.label) || labelForField(item.field),
          value: clean(item.value),
          confidence: clean(item.confidence) || 'Medium',
          reason: clean(item.reason) || 'Suggested by the model from the rough idea.'
        }))
        .filter((item) => item.field && item.value)
    : [];

  // Trust the model's idea-specific suggestions. Only fall back to the generic
  // template when the model returned nothing — never pad real suggestions with
  // boilerplate, which is what produced placeholder-y cards.
  return parsed.length ? parsed : buildFieldSuggestions(project);
}

function normalizeDecisions(decisions, project) {
  const parsed = Array.isArray(decisions)
    ? decisions
        .map((decision, index) => ({
          id: clean(decision.id) || `decision-${index + 1}`,
          title: clean(decision.title) || 'Decision Needed',
          field: clean(decision.field) || 'problem',
          question: clean(decision.question) || 'Which option best fits the project?',
          options: Array.isArray(decision.options)
            ? decision.options
                .map((option) => ({
                  label: clean(option.label),
                  value: clean(option.value),
                  rationale: clean(option.rationale)
                }))
                .filter((option) => option.label && option.value)
            : []
        }))
        .filter((decision) => decision.options.length)
    : [];

  return parsed.length ? parsed : buildDecisionCards(project);
}

function projectFromSuggestions(project, suggestions) {
  const next = { ...project };

  suggestions.forEach((suggestion) => {
    if (Object.hasOwn(next, suggestion.field) && suggestion.value) {
      next[suggestion.field] = suggestion.value;
    }
  });

  return next;
}

function keepOnlyAcceptedStartFields(originalProject, suggestedProject) {
  return {
    ...EMPTY_PROJECT_FOR_SERVER,
    ...originalProject,
    title: suggestedProject.title || originalProject.title,
    topic: originalProject.topic || originalProject.title,
    requirements: originalProject.requirements || DEFAULT_REQUIREMENTS
  };
}

function labelForField(field) {
  const labels = {
    title: 'Project Title',
    problem: 'Problem Framing',
    method: 'Method / Agent Workflow',
    timeline: 'Research Milestones',
    evaluation: 'Evaluation Plan',
    resources: 'Resources',
    references: 'Sources / Assumptions'
  };

  return labels[clean(field)] || titleCase(field);
}

function summarizeProjectInput(project) {
  const fields = [
    ['Topic', project.title || project.topic],
    ['Problem', project.problem],
    ['Method', project.method],
    ['Timeline', project.timeline],
    ['Evaluation', project.evaluation],
    ['Resources', project.resources],
    ['References', project.references]
  ];
  const missing = buildQuestionObjects(project)
    .filter((question) => question.field !== 'next-step')
    .map((question) => question.reason);

  return {
    fields,
    missing,
    markdown: `# Intake Summary

${fields.map(([label, value]) => `- ${label}: ${clean(value) || 'Missing'}`).join('\n')}

## Missing or Weak Inputs
${missing.length ? missing.map((item) => `- ${item}`).join('\n') : '- None detected by the basic checker.'}
`
  };
}

function normalizeQuestions(questions, project) {
  const parsed = Array.isArray(questions)
    ? questions.map(normalizeQuestion).filter((question) => question.question)
    : [];

  return (parsed.length ? parsed : buildQuestionObjects(project)).slice(0, 5);
}

function normalizeQuestion(question) {
  if (!question) return null;

  if (typeof question === 'string') {
    return {
      id: `question-${question.slice(0, 18)}`,
      field: 'method',
      question: clean(question),
      reason: 'The model requested this clarification.',
      priority: 'High'
    };
  }

  return {
    id: clean(question.id) || `${clean(question.field) || 'question'}-${clean(question.question).slice(0, 18)}`,
    field: clean(question.field) || 'method',
    question: clean(question.question),
    reason: clean(question.reason) || 'This detail will improve the proposal.',
    priority: clean(question.priority) || 'High'
  };
}

function firstMissingField(project) {
  const firstQuestion = buildQuestionObjects(project).find((question) => question.field !== 'next-step');
  return firstQuestion?.field || 'method';
}

function mergeProject(current, incoming) {
  const next = { ...current };

  Object.entries(incoming).forEach(([key, value]) => {
    const cleaned = clean(value);
    if (cleaned) next[key] = cleaned;
  });

  return next;
}

function mergeField(current, addition) {
  const base = clean(current);
  const next = clean(addition);

  if (!base) return next;
  if (!next) return base;
  if (base.toLowerCase().includes(next.toLowerCase())) return base;
  return `${base}\n${next}`;
}

function normalizePayload(payload) {
  return {
    topic: clean(payload.topic),
    title: clean(payload.title) || clean(payload.topic),
    problem: clean(payload.problem),
    method: clean(payload.method),
    timeline: clean(payload.timeline),
    evaluation: clean(payload.evaluation),
    resources: clean(payload.resources),
    references: clean(payload.references),
    requirements: clean(payload.requirements) || DEFAULT_REQUIREMENTS
  };
}

function extractChecklist(requirements) {
  const items = clean(requirements)
    .split(/\n|;/)
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 4)
    .filter((line) => !/^proposal must include:?$/i.test(line));

  return [...new Set(items.length ? items : DEFAULT_REQUIREMENTS.split('\n').slice(1).map((line) => line.replace(/^-\s*/, '')))];
}

function findRequirementEvidence(requirement, project) {
  const text = requirement.toLowerCase();

  if (/title/.test(text) && project.title) return project.title;
  if (/abstract/.test(text)) return 'Draft includes an abstract section.';
  if (/motivation|gap|problem/.test(text) && project.problem) return project.problem;
  if (/goal/.test(text) && project.title) return 'Goal section is generated from the project topic.';
  if (/method|workflow|approach/.test(text) && project.method) return project.method;
  if (/expected|milestone|timeline/.test(text) && project.timeline) return project.timeline;
  if (/evaluation|metric|test/.test(text) && project.evaluation) return project.evaluation;
  if (/risk|mitigation/.test(text)) return 'Fallback draft includes risks and mitigations.';
  if (/resource|budget|tool/.test(text) && project.resources) return project.resources;
  if (/reference|assumption|source/.test(text) && project.references) return project.references;

  return '';
}

function readModelContent(data) {
  if (typeof data?.choices?.[0]?.message?.content === 'string') {
    return data.choices[0].message.content;
  }

  if (typeof data?.output_text === 'string') {
    return data.output_text;
  }

  const outputText = data?.output
    ?.flatMap((item) => item?.content || [])
    ?.map((item) => item?.text)
    ?.filter(Boolean)
    ?.join('\n');

  if (outputText) return outputText;

  return JSON.stringify(data);
}

function parseJsonContent(content) {
  const trimmed = clean(content);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Malformed JSON (often bad LaTeX escaping). Salvage the proposal draft via
    // regex so the real generated proposal survives instead of being dropped to
    // the generic local template.
    const recoveredLatex = extractNestedLatexString(candidate);

    return {
      proposalLatex: recoveredLatex || (looksLikeLatex(trimmed) ? trimmed : ''),
      complianceMatrix: [],
      evaluationReport: '# Evaluation Report\n\nThe API returned text that was not valid JSON; recovered the proposal draft directly.',
      questions: ['Should the API prompt be tightened to return strict JSON?']
    };
  }
}

// Parse the proposal response, which is a ```latex code block followed by a
// small ```json block. Keeping LaTeX out of the JSON avoids the escaping
// failures that come from embedding a whole document in a JSON string.
function parseProposalResponse(content) {
  const text = clean(content);
  const latexBlock = extractFencedBlock(text, ['latex', 'tex']);
  const jsonBlock = extractFencedBlock(text, ['json']);

  let meta = {};
  if (jsonBlock) {
    try {
      meta = JSON.parse(jsonBlock);
    } catch {
      meta = {};
    }
  }

  const proposalLatex = looksLikeLatex(latexBlock)
    ? latexBlock
    : looksLikeLatex(text)
      ? text
      : extractNestedLatexString(text) || latexBlock;

  return {
    proposalLatex,
    complianceMatrix: meta.complianceMatrix,
    evaluationReport: meta.evaluationReport,
    questions: meta.questions,
    reviewerScore: meta.reviewerScore
  };
}

function extractFencedBlock(text, langs) {
  const alt = langs.join('|');
  const source = String(text || '');
  const full = source.match(new RegExp('```(?:' + alt + ')\\s*([\\s\\S]*?)```', 'i'));

  if (full?.[1]) {
    return full[1].trim();
  }

  // Opening fence with no closing fence (truncated output): take to the end.
  const open = source.match(new RegExp('```(?:' + alt + ')\\s*([\\s\\S]*)$', 'i'));
  return open?.[1]?.trim() || '';
}

function coerceResult(result, project, checklist) {
  const complianceMatrix = Array.isArray(result.complianceMatrix) && result.complianceMatrix.length
    ? result.complianceMatrix.map((row) => ({
        requirement: clean(row.requirement),
        status: clean(row.status) || 'Needs work',
        evidence: clean(row.evidence),
        fix: clean(row.fix)
      }))
    : checklist.map((requirement) => ({
        requirement,
        status: 'Needs work',
        evidence: 'API did not provide matrix evidence.',
        fix: 'Regenerate with stricter output instructions.'
      }));

  return {
    proposalLatex: extractProposalLatex(result, project),
    complianceMatrix,
    reviewerScore: normalizeReviewerScore(result.reviewerScore, complianceMatrix),
    evaluationReport: clean(result.evaluationReport) || '# Evaluation Report\n\nNo evaluation report returned.',
    questions: Array.isArray(result.questions) ? result.questions.map(clean).filter(Boolean).slice(0, 5) : []
  };
}

const REVIEWER_CRITERIA = ['Significance', 'Approach', 'Innovation', 'Feasibility'];

// Normalize the model's reviewer score; if missing, estimate an overall from
// compliance coverage so the Review tab always has a score to show.
function normalizeReviewerScore(raw, complianceMatrix) {
  const clampScore = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.min(5, Math.max(1, Math.round(num * 10) / 10));
  };

  const rawCriteria = Array.isArray(raw?.criteria) ? raw.criteria : [];
  const criteria = REVIEWER_CRITERIA.map((name) => {
    const match = rawCriteria.find((item) => clean(item?.name).toLowerCase() === name.toLowerCase());
    return {
      name,
      score: clampScore(match?.score),
      comment: clean(match?.comment)
    };
  });

  const scored = criteria.filter((item) => item.score != null);

  if (scored.length) {
    const overall = clampScore(raw?.overall) ?? Math.round((scored.reduce((sum, item) => sum + item.score, 0) / scored.length) * 10) / 10;
    return {
      overall,
      estimated: false,
      criteria: criteria.map((item) => ({
        name: item.name,
        score: item.score ?? overall,
        comment: item.comment || 'Scored by the reviewer agent.'
      }))
    };
  }

  // Fallback: estimate from coverage (1-5 scale) when the model gave no score.
  const total = complianceMatrix.length || 1;
  const covered = complianceMatrix.filter((row) => /^covered$/i.test(row.status)).length;
  const estimatedOverall = Math.round((1 + 4 * (covered / total)) * 10) / 10;

  return {
    overall: estimatedOverall,
    estimated: true,
    criteria: REVIEWER_CRITERIA.map((name) => ({
      name,
      score: estimatedOverall,
      comment: 'Estimated from section coverage; the model did not return a score.'
    }))
  };
}

function extractProposalLatex(result, project) {
  const candidates = [
    result?.proposalLatex,
    result?.proposalTex,
    result?.latex,
    result?.tex
  ]
    .map(clean)
    .filter(Boolean);

  for (const candidate of candidates) {
    const unwrapped = unwrapLatexCandidate(candidate);
    if (looksLikeLatex(unwrapped)) {
      return unwrapped;
    }
  }

  return buildLocalProposalLatex(project);
}

function unwrapLatexCandidate(value) {
  let candidate = stripCodeFence(clean(value));

  for (let index = 0; index < 3; index += 1) {
    const trimmed = candidate.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) break;

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        candidate = stripCodeFence(parsed);
        continue;
      }

      const nested = parsed?.proposalLatex || parsed?.proposalTex || parsed?.latex || parsed?.tex;
      if (nested) {
        candidate = stripCodeFence(String(nested));
        continue;
      }

      break;
    } catch {
      const extracted = extractNestedLatexString(trimmed);
      if (extracted) {
        candidate = stripCodeFence(extracted);
        continue;
      }
      break;
    }
  }

  return candidate;
}

function stripCodeFence(value) {
  const trimmed = clean(value);
  const fenced = trimmed.match(/```(?:latex|tex)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || trimmed;
}

function isSpecific(value, length) {
  return clean(value).length >= length;
}

function clean(value) {
  return String(value || '').trim();
}

function looksLikeLatex(value) {
  return /^\\(?:documentclass\b|begin\{document\}|section\{)/.test(String(value || '').trim());
}

function extractNestedLatexString(value) {
  const match = String(value || '').match(/"proposalLatex"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:complianceMatrix|evaluationReport|questions)"/);

  if (!match?.[1]) {
    return '';
  }

  return match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function latexParagraph(value) {
  return escapeLatex(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

function escapeLatex(value) {
  return String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function providerOf(provider, url) {
  const p = clean(provider).toLowerCase();
  const u = clean(url).toLowerCase();

  if (p === 'gemini' || u.includes('generativelanguage.googleapis.com')) {
    return 'gemini';
  }

  return 'openai-compatible';
}

function getProvider() {
  return providerOf(process.env.LLM_PROVIDER, process.env.LLM_API_URL);
}

// Main LLM (generation) config from LLM_* env.
function mainLlmConfig() {
  return {
    provider: getProvider(),
    apiUrl: clean(process.env.LLM_API_URL),
    apiKey: clean(process.env.LLM_API_KEY),
    model: clean(process.env.LLM_MODEL)
  };
}

// Reviewer config — a completely separate LLM (e.g. Groq/Llama or OpenAI) when
// LLM_REVIEW_API_URL is set; otherwise the main LLM with an optional alt model.
function reviewLlmConfig() {
  const reviewUrl = clean(process.env.LLM_REVIEW_API_URL);

  if (reviewUrl) {
    // A different provider was specified — it must use its OWN key, never the
    // main provider's key.
    return {
      provider: providerOf(process.env.LLM_REVIEW_PROVIDER, reviewUrl),
      apiUrl: reviewUrl,
      apiKey: clean(process.env.LLM_REVIEW_API_KEY),
      model: clean(process.env.LLM_REVIEW_MODEL) || clean(process.env.LLM_MODEL)
    };
  }

  return {
    provider: getProvider(),
    apiUrl: clean(process.env.LLM_API_URL),
    apiKey: clean(process.env.LLM_API_KEY),
    model: clean(process.env.LLM_REVIEW_MODEL) || clean(process.env.LLM_MODEL)
  };
}

function titleCase(value) {
  return clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

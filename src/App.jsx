import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

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

const EMPTY_PROJECT = {
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

const PROJECT_FIELDS = [
  ['problem', 'Problem'],
  ['method', 'Method'],
  ['evaluation', 'Evaluation'],
  ['timeline', 'Timeline'],
  ['resources', 'Resources'],
  ['references', 'Sources']
];

const STAGES = [
  ['1', 'Extract', 'LLM turns the rough idea into structured proposal data'],
  ['2', 'Decide', 'You choose or edit candidate framings'],
  ['3', 'Assemble', 'Accepted fields become project state'],
  ['4', 'Draft', 'LLM writes proposal artifacts'],
  ['5', 'Review', 'Matrix and critique check weak spots']
];

const TABS = [
  ['pdf', FileText, 'PDF'],
  ['latex', FileText, 'LaTeX'],
  ['matrix', ClipboardCheck, 'Matrix'],
  ['evaluation', ListChecks, 'Review']
];

const MEMORY_KEY = 'proposal-agent-final-project-memory-v1';

const RUN_LOG_PAGE_SIZE = 6;

const PAPERS_PAGE_SIZE = 4;

function App() {
  const [topicInput, setTopicInput] = useState('');
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [fieldSuggestions, setFieldSuggestions] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [customNote, setCustomNote] = useState('');
  const [result, setResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [runLog, setRunLog] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pdf');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [decisionIndex, setDecisionIndex] = useState(0);
  const [decisionChoices, setDecisionChoices] = useState({});
  const [revisionNotes, setRevisionNotes] = useState('');
  const [runLogPage, setRunLogPage] = useState(0);
  const [papers, setPapers] = useState([]);
  const [papersPage, setPapersPage] = useState(0);
  const [sourcesBusy, setSourcesBusy] = useState('');
  const [figures, setFigures] = useState([]);
  const [figureInput, setFigureInput] = useState('');
  const [figureIndex, setFigureIndex] = useState(0);
  const [figureBusy, setFigureBusy] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const lastQueryRef = useRef('');
  const [memorySavedAt, setMemorySavedAt] = useState('');
  const [memoryReady, setMemoryReady] = useState(false);

  const matrixStats = useMemo(() => {
    const rows = result?.complianceMatrix || [];
    const covered = rows.filter((row) => /^covered$/i.test(row.status)).length;
    return { covered, total: rows.length };
  }, [result]);

  const acceptedCount = PROJECT_FIELDS.filter(([field]) => Boolean(project[field])).length;
  const acceptedSuggestionCount = fieldSuggestions.filter((suggestion) => project[suggestion.field] === suggestion.value).length;
  const currentSuggestion = fieldSuggestions[suggestionIndex] || null;
  const currentDecision = decisions[decisionIndex] || null;
  const currentQuestion = questions[0];

  const runLogPages = Math.max(1, Math.ceil(runLog.length / RUN_LOG_PAGE_SIZE));
  const safeRunLogPage = Math.min(runLogPage, runLogPages - 1);
  const visibleRunLog = runLog.slice(
    safeRunLogPage * RUN_LOG_PAGE_SIZE,
    safeRunLogPage * RUN_LOG_PAGE_SIZE + RUN_LOG_PAGE_SIZE
  );

  useEffect(() => {
    loadSavedMemory({ silent: true });
    setMemoryReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    setRunLogPage(Math.max(0, Math.ceil(runLog.length / RUN_LOG_PAGE_SIZE) - 1));
  }, [runLog.length]);

  // Jump to the newest figure when one is added (and stay in range on removal).
  useEffect(() => {
    setFigureIndex(Math.max(0, figures.length - 1));
  }, [figures.length]);

  // Auto-suggest related papers once the idea has a title and none are loaded yet.
  // Keyed on project.title only — typing the rough idea must not trigger searches.
  useEffect(() => {
    const title = (project.title || '').trim();
    if (!title || papers.length || title === lastQueryRef.current) return;

    const handle = setTimeout(() => {
      lastQueryRef.current = title;
      findPapers();
    }, 700);

    return () => clearTimeout(handle);
  }, [project.title, papers.length]);

  // Keep the "Sources" field (Accepted Project State) and the matching
  // "Sources / Assumptions" suggestion card in sync with the checked Related
  // Works papers, so selected papers show in both places and flow into the
  // proposal's References.
  useEffect(() => {
    const selected = papers.filter((paper) => paper.selected);
    if (!selected.length) return;

    const referencesText = selected
      .map((paper) => [paper.authors, paper.year ? `(${paper.year})` : '', paper.title].filter(Boolean).join(' '))
      .join('; ');

    setProject((current) => (current.references === referencesText ? current : { ...current, references: referencesText }));
    setFieldSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.field === 'references'
          ? { ...suggestion, value: referencesText, reason: 'Built from the Related Works papers you selected.' }
          : suggestion
      )
    );
  }, [papers]);

  useEffect(() => {
    if (!memoryReady) return;

    if (!topicInput && !fieldSuggestions.length && !decisions.length && !result && !papers.length) {
      return;
    }

    saveMemory({ silent: true });
  }, [
    memoryReady,
    topicInput,
    project,
    fieldSuggestions,
    decisions,
    questions,
    result,
    runLog,
    activeTab,
    suggestionIndex,
    decisionIndex,
    decisionChoices,
    revisionNotes,
    papers,
    figures,
    figureInput
  ]);

  async function startAgent() {
    return startAgentForTopic(topicInput);
  }

  async function startSampleAgent() {
    const sampleTopic = 'AI agent that playtests games to detect bugs and balance issues';
    setTopicInput(sampleTopic);
    return startAgentForTopic(sampleTopic);
  }

  async function startAgentForTopic(nextTopic) {
    setStatus('starting');
    setError('');
    clearArtifacts();

    try {
      const data = await postJson('/api/agent/start', {
        topic: nextTopic,
        requirements: DEFAULT_REQUIREMENTS
      });

      setProject({ ...EMPTY_PROJECT, ...data.project });
      setFieldSuggestions(data.fieldSuggestions || []);
      setDecisions(data.decisions || []);
      setQuestions(data.questions || []);
      setSuggestionIndex(0);
      setDecisionIndex(0);
      setRunLog([
        logEntry('Extract', data.runMessage || 'LLM prepared structured suggestions.'),
        logEntry('Decide', `Review ${(data.fieldSuggestions || []).length} fields and ${(data.decisions || []).length} decision card(s).`)
      ]);
      setCustomNote('');
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  async function submitCustomNote() {
    const trimmed = customNote.trim();
    if (!trimmed) return;

    setStatus('answering');
    setError('');

    try {
      const data = await postJson('/api/agent/answer', {
        project,
        question: currentQuestion || {
          field: 'method',
          question: 'Integrate this user note into the project state.',
          reason: 'The user provided a custom refinement.',
          priority: 'Medium'
        },
        answer: trimmed,
        requirements: DEFAULT_REQUIREMENTS
      });

      setProject({ ...EMPTY_PROJECT, ...data.project });
      setFieldSuggestions(data.fieldSuggestions || []);
      setDecisions(data.decisions || []);
      setQuestions(data.questions || []);
      setSuggestionIndex(0);
      setDecisionIndex(0);
      setRunLog((current) => [
        ...current,
        logEntry('Update', data.runMessage || 'Integrated custom note.'),
        logEntry('Decide', `Refreshed ${(data.fieldSuggestions || []).length} suggested field(s).`)
      ]);
      setCustomNote('');
      clearArtifacts();
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  async function generateProposal() {
    setStatus('drafting');
    setError('');

    const selectedPapers = papers.filter((paper) => paper.selected);
    // The selected papers ARE the references. Override the project's Sources
    // field so the proposal cites them instead of boilerplate placeholders.
    const referencesText = selectedPapers.length
      ? selectedPapers.map((paper) => [paper.authors, paper.year ? `(${paper.year})` : '', paper.title].filter(Boolean).join(' ')).join('; ')
      : project.references;
    const { figures: figurePayload, figureImages } = figuresForGeneration();

    try {
      const data = await postJson('/api/proposal', {
        ...project,
        references: referencesText,
        topic: project.topic || project.title,
        requirements: DEFAULT_REQUIREMENTS,
        sources: selectedPapers,
        notes: revisionNotes,
        figures: figurePayload
      });

      setResult(data);
      setRunLog((current) => [
        ...current,
        logEntry('Draft', `Generated proposal using ${data.mode}.`),
        logEntry('Review', `Coverage ${countCovered(data.complianceMatrix)}/${data.complianceMatrix?.length || 0}.`)
      ]);

      // Compile the PDF separately so a missing LaTeX engine never discards the draft.
      try {
        const nextPdfUrl = await exportPdfUrl(data.proposalLatex, project.title || 'proposal', figureImages);
        updatePdfUrl(nextPdfUrl);
        setActiveTab('pdf');
      } catch (pdfError) {
        // Auto-repair: send the broken LaTeX + error back to the model, then recompile once.
        try {
          const repaired = await postJson('/api/repair', {
            proposalLatex: data.proposalLatex,
            error: readError(pdfError)
          });
          const fixedLatex = repaired.proposalLatex || data.proposalLatex;
          const nextPdfUrl = await exportPdfUrl(fixedLatex, project.title || 'proposal', figureImages);
          setResult((current) => (current ? { ...current, proposalLatex: fixedLatex } : current));
          updatePdfUrl(nextPdfUrl);
          setActiveTab('pdf');
          setRunLog((current) => [
            ...current,
            logEntry('Export', 'First compile failed — auto-repaired the LaTeX and recompiled successfully.')
          ]);
        } catch (repairError) {
          updatePdfUrl('');
          setActiveTab('latex');
          setRunLog((current) => [
            ...current,
            logEntry('Export', `Draft ready, but PDF compile failed: ${summarizePdfError(repairError)} Open the LaTeX tab or download .tex.`)
          ]);
        }
      }
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  async function findPapers(queryArg) {
    // Prefer the rough idea/topic over the formal title — it yields far more
    // relevant results from OpenAlex than decorative title wording.
    const query = (queryArg || project.topic || topicInput || project.title || '').trim();
    if (!query) return;

    setSourcesBusy('searching');
    setError('');

    try {
      const data = await postJson('/api/literature/search', { query });
      const fetched = (data.papers || []).map((paper) => ({ ...paper, uploaded: false, selected: false }));

      setPapers((current) => {
        const uploads = current.filter((paper) => paper.uploaded);
        const previouslySelected = new Set(current.filter((paper) => !paper.uploaded && paper.selected).map((paper) => paper.id));
        const merged = fetched.map((paper) => ({ ...paper, selected: previouslySelected.has(paper.id) }));
        return [...merged, ...uploads];
      });
      setPapersPage(0);
      setRunLog((current) => [
        ...current,
        logEntry('Sources', `Suggested ${fetched.length} related paper(s) for "${query}".`)
      ]);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setSourcesBusy('');
    }
  }

  function togglePaper(id) {
    setPapers((current) => current.map((paper) => (paper.id === id ? { ...paper, selected: !paper.selected } : paper)));
    clearArtifacts();
  }

  async function handleUpload(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setSourcesBusy('uploading');
    setError('');

    try {
      for (const file of files) {
        const uploaded = {
          id: `upload-${file.name}-${file.size}`,
          title: file.name.replace(/\.[^.]+$/, ''),
          authors: 'Uploaded by you',
          year: '',
          url: '',
          uploaded: true,
          selected: true
        };

        setPapers((current) => (current.some((paper) => paper.id === uploaded.id) ? current : [...current, uploaded]));
      }
      setRunLog((current) => [...current, logEntry('Sources', `Uploaded ${files.length} file(s) (selected by default).`)]);
      clearArtifacts();
    } catch (uploadError) {
      setError(readError(uploadError));
    } finally {
      setSourcesBusy('');
    }
  }

  // Compile a single figure's LaTeX into a small PDF for a rendered preview.
  async function compileFigurePreview(figureLatex) {
    const latex = (figureLatex || '').trim();
    if (!latex) return '';

    const previewDoc = `\\documentclass[11pt]{article}\n\\usepackage[margin=0.6in]{geometry}\n\\begin{document}\n\\thispagestyle{empty}\n${latex}\n\\end{document}`;

    try {
      return await exportPdfUrl(previewDoc, 'figure-preview');
    } catch {
      return '';
    }
  }

  // Suggest ANOTHER figure and append it to the list (you can stack several).
  async function suggestFigureFn() {
    const topic = (project.topic || project.title || topicInput || '').trim();
    if (!topic) return;

    setFigureBusy(true);
    setError('');

    try {
      const data = await postJson('/api/figure/suggest', {
        topic,
        title: project.title,
        problem: project.problem,
        method: project.method,
        input: figureInput
      });
      const latex = data.latex || '';
      const previewUrl = await compileFigurePreview(latex);
      const newFigure = { id: `fig-${Date.now()}`, kind: 'latex', latex, caption: data.caption || '', previewUrl };

      setFigures((current) => [...current, newFigure]);
      setFigureInput('');
      setRunLog((current) => [...current, logEntry('Figure', 'Added a suggested figure to the draft.')]);
      clearArtifacts();
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setFigureBusy(false);
    }
  }

  function handleFigureImage(fileList) {
    const file = Array.from(fileList || [])[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const extMatch = file.name.match(/\.(png|jpe?g|pdf)$/i);
      const ext = extMatch ? extMatch[0].toLowerCase() : '.png';
      const newFigure = {
        id: `fig-${Date.now()}`,
        kind: 'image',
        imageName: `userfigure${Date.now()}${ext}`,
        imageDataUrl: String(reader.result),
        caption: '',
        latex: '',
        previewUrl: ''
      };
      setFigures((current) => [...current, newFigure]);
      setRunLog((current) => [...current, logEntry('Figure', `Added your uploaded figure (${file.name}).`)]);
      clearArtifacts();
    };
    reader.readAsDataURL(file);
  }

  function removeFigure(id) {
    setFigures((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    clearArtifacts();
  }

  async function renderFigurePreviewFor(id) {
    setFigureBusy(true);
    try {
      const target = figures.find((item) => item.id === id);
      const url = await compileFigurePreview(target?.latex || '');
      setFigures((current) => current.map((item) => (item.id === id ? { ...item, previewUrl: url } : item)));
    } finally {
      setFigureBusy(false);
    }
  }

  // Build the figures to inject into the proposal plus any image bytes to compile.
  function figuresForGeneration() {
    const payloadFigures = [];
    const figureImages = [];

    figures.forEach((item) => {
      if (item.kind === 'image' && item.imageDataUrl) {
        const caption = item.caption || 'Figure provided by the author.';
        payloadFigures.push({
          latex: `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.85\\linewidth]{${item.imageName}}\n\\caption{${caption}}\n\\end{figure}`,
          image: true,
          imageName: item.imageName
        });
        figureImages.push({ name: item.imageName, base64: item.imageDataUrl });
      } else if (item.latex) {
        payloadFigures.push({ latex: item.latex });
      }
    });

    return { figures: payloadFigures, figureImages };
  }

  function toggleSuggestion(suggestion) {
    const accepted = project[suggestion.field] === suggestion.value;

    if (accepted) {
      // Un-accept: clear the field so a different framing can be tried.
      updateProjectField(suggestion.field, '');
      setRunLog((current) => [...current, logEntry('Undo', `Un-accepted ${suggestion.label || suggestion.field}.`)]);
      return;
    }

    updateProjectField(suggestion.field, suggestion.value);
    advanceSuggestion();
    setRunLog((current) => [...current, logEntry('Accept', `Accepted ${suggestion.label || suggestion.field}.`)]);
  }

  function skipSuggestion() {
    if (!currentSuggestion) return;
    advanceSuggestion();
    setRunLog((current) => [...current, logEntry('Skip', `Skipped ${currentSuggestion.label || currentSuggestion.field}.`)]);
  }

  function advanceSuggestion() {
    setSuggestionIndex((current) => Math.min(current + 1, Math.max(fieldSuggestions.length - 1, 0)));
  }

  function chooseOption(decision, option) {
    const alreadyChosen = decisionChoices[decision.id] === option.label;

    if (alreadyChosen) {
      // Clicking the chosen option again clears it, so you can try another.
      updateProjectField(decision.field, '');
      setDecisionChoices((current) => {
        const next = { ...current };
        delete next[decision.id];
        return next;
      });
      setRunLog((current) => [...current, logEntry('Decision', `Cleared choice for ${decision.title}.`)]);
      return;
    }

    updateProjectField(decision.field, option.value);
    setDecisionChoices((current) => ({ ...current, [decision.id]: option.label }));
    setRunLog((current) => [...current, logEntry('Decision', `Selected ${option.label} for ${decision.title}.`)]);
  }

  function skipDecision() {
    if (!currentDecision) return;
    advanceDecision();
    setRunLog((current) => [...current, logEntry('Skip', `Skipped ${currentDecision.title}.`)]);
  }

  function advanceDecision() {
    setDecisionIndex((current) => Math.min(current + 1, Math.max(decisions.length - 1, 0)));
  }

  function updateProjectField(field, value) {
    setProject((current) => ({
      ...current,
      [field]: value,
      topic: current.topic || current.title || topicInput
    }));
    clearArtifacts();
  }

  function clearArtifacts() {
    setResult(null);
    updatePdfUrl('');
    setReviewResult(null);
  }

  async function runReview() {
    if (!result?.proposalLatex) return;

    setReviewBusy(true);
    setError('');

    try {
      const data = await postJson('/api/review', {
        proposalLatex: result.proposalLatex,
        requirements: DEFAULT_REQUIREMENTS,
        title: project.title
      });
      setReviewResult(data);
      setRunLog((current) => [
        ...current,
        logEntry('Review', `Reviewer (${data.model}) scored the draft ${data.reviewerScore?.overall ?? '?'}/5.`)
      ]);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setReviewBusy(false);
    }
  }

  function useSuggestedEdit(edit) {
    const note = [edit.section, edit.suggestion].filter(Boolean).join(': ');
    setRevisionNotes(note);
    setRunLog((current) => [...current, logEntry('Review', 'Loaded a suggested edit into revision notes.')]);
  }

  function updatePdfUrl(nextUrl) {
    setPdfUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextUrl;
    });
  }

  function reset() {
    setTopicInput('');
    setProject(EMPTY_PROJECT);
    setFieldSuggestions([]);
    setDecisions([]);
    setQuestions([]);
    setCustomNote('');
    clearArtifacts();
    setRunLog([]);
    setError('');
    setActiveTab('pdf');
    setSuggestionIndex(0);
    setDecisionIndex(0);
    setDecisionChoices({});
    setRevisionNotes('');
    setPapers([]);
    setPapersPage(0);
    setFigures([]);
    setFigureInput('');
    setFigureIndex(0);
    lastQueryRef.current = '';
  }

  function downloadLatex() {
    const proposal = result?.proposalLatex || '';
    const blob = new Blob([proposal], { type: 'text/x-tex;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'proposal.tex';
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function downloadPdf() {
    if (!result?.proposalLatex) return;

    setStatus('exporting');
    setError('');

    try {
      const href = pdfUrl || (await exportPdfUrl(result.proposalLatex, project.title || 'proposal', figuresForGeneration().figureImages));
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'proposal.pdf';
      anchor.click();
      if (!pdfUrl) URL.revokeObjectURL(href);
      setRunLog((current) => [...current, logEntry('Export', 'Downloaded proposal.pdf.')]);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  function saveMemory({ silent = false } = {}) {
    const snapshot = {
      savedAt: new Date().toISOString(),
      topicInput,
      project,
      fieldSuggestions,
      decisions,
      questions,
      result: compactResult(result),
      runLog,
      activeTab,
      suggestionIndex,
      decisionIndex,
      decisionChoices,
      revisionNotes,
      papers,
      figures: figures.filter((item) => item.kind === 'latex').map(({ id, kind, latex, caption }) => ({ id, kind, latex, caption })),
      figureInput
    };

    localStorage.setItem(MEMORY_KEY, JSON.stringify(snapshot));
    setMemorySavedAt(snapshot.savedAt);

    if (!silent) {
      setRunLog((current) => [...current, logEntry('Memory', 'Saved workspace memory.')]);
    }
  }

  async function loadSavedMemory({ silent = false } = {}) {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) {
      if (!silent) setError('No saved memory found.');
      return;
    }

    try {
      const snapshot = JSON.parse(raw);
      setTopicInput(snapshot.topicInput || '');
      setProject({ ...EMPTY_PROJECT, ...(snapshot.project || {}) });
      setFieldSuggestions(Array.isArray(snapshot.fieldSuggestions) ? snapshot.fieldSuggestions : []);
      setDecisions(Array.isArray(snapshot.decisions) ? snapshot.decisions : []);
      setQuestions(Array.isArray(snapshot.questions) ? snapshot.questions : []);
      setResult(snapshot.result || null);
      setRunLog(Array.isArray(snapshot.runLog) ? snapshot.runLog : []);
      setActiveTab(snapshot.activeTab || 'pdf');
      setSuggestionIndex(Number(snapshot.suggestionIndex || 0));
      setDecisionIndex(Number(snapshot.decisionIndex || 0));
      setDecisionChoices(snapshot.decisionChoices && typeof snapshot.decisionChoices === 'object' ? snapshot.decisionChoices : {});
      setRevisionNotes(snapshot.revisionNotes || '');
      setPapers(Array.isArray(snapshot.papers) ? snapshot.papers : []);
      setFigures(
        Array.isArray(snapshot.figures)
          ? snapshot.figures.map((item) => ({
              id: item.id || `fig-${Math.random().toString(16).slice(2)}`,
              kind: 'latex',
              latex: item.latex || '',
              caption: item.caption || '',
              previewUrl: ''
            }))
          : []
      );
      setFigureInput(snapshot.figureInput || '');
      setMemorySavedAt(snapshot.savedAt || '');
      setError('');

      if (snapshot.result?.proposalLatex) {
        try {
          updatePdfUrl(await exportPdfUrl(snapshot.result.proposalLatex, snapshot.project?.title || 'proposal'));
        } catch {
          updatePdfUrl('');
        }
      } else {
        updatePdfUrl('');
      }

      if (!silent) {
        setRunLog((current) => [...current, logEntry('Memory', 'Reloaded saved workspace memory.')]);
      }
    } catch {
      setError('Saved memory is unreadable. Clear it and save again.');
    }
  }

  function clearSavedMemory() {
    localStorage.removeItem(MEMORY_KEY);
    setMemorySavedAt('');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Research Mentor</h1>
        <span className="status-pill">
          <Sparkles size={16} aria-hidden="true" />
          {result?.mode || (fieldSuggestions.length ? 'structuring' : 'ready')}
        </span>
      </header>

      <section className="workspace single-pane">
        <section className="workflow-artifact">
          <div className="topic-launch">
            <label htmlFor="project-topic">
              Rough Idea
              <input
                id="project-topic"
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') startAgent();
                }}
                placeholder="Example: AI agent that playtests games for bugs and balance issues"
              />
            </label>
            <div className="actions framework-actions">
              <button className="primary" disabled={!topicInput.trim() || status !== 'idle'} onClick={startAgent} type="button">
                {status === 'starting' ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
                Structure Idea
              </button>
              <button className="secondary" disabled={status !== 'idle'} onClick={startSampleAgent} type="button">
                <Sparkles size={18} aria-hidden="true" />
                Sample
              </button>
              <button className="secondary icon-button" onClick={reset} type="button" aria-label="Reset">
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="memory-bar">
            <div>
              <strong>Memory</strong>
              <span>{memorySavedAt ? `Saved ${formatSavedAt(memorySavedAt)}` : 'No saved workspace yet'}</span>
            </div>
            <div className="memory-actions">
              <button className="secondary" type="button" onClick={() => saveMemory()}>
                Save
              </button>
              <button className="secondary" type="button" onClick={() => loadSavedMemory()}>
                Reload
              </button>
              <button className="secondary" type="button" onClick={clearSavedMemory}>
                Clear
              </button>
            </div>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}


          <div className="workflow-grid" aria-label="Workflow stages">
            {STAGES.map(([number, title, description], index) => (
              <article className="stage-card" key={title}>
                <div className="stage-topline">
                  <span className="stage-number">{number}</span>
                  <span className={`stage-status ${stageStatus(index, fieldSuggestions, decisions, project, result)}`}>
                    {stageLabel(index, fieldSuggestions, decisions, project, result)}
                  </span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>

          <RelatedWorksPanel
            papers={papers}
            page={papersPage}
            pageSize={PAPERS_PAGE_SIZE}
            busy={sourcesBusy}
            onPageChange={setPapersPage}
            onToggle={togglePaper}
            onUpload={handleUpload}
            onRefresh={() => findPapers()}
          />

          <div className="workspace-grid">
            <section className="workspace-panel suggestions-panel">
              <PanelHeader title="LLM Suggested Structure" meta={`${fieldSuggestions.length} fields`} />
              {fieldSuggestions.length ? (
                <div className="suggestion-deck">
                  <div className="deck-progress">
                    <span>{Math.min(suggestionIndex + 1, fieldSuggestions.length)} / {fieldSuggestions.length}</span>
                    <strong>{acceptedSuggestionCount} accepted</strong>
                  </div>
                  {currentSuggestion ? (
                    <article className="suggestion-card active-card" key={`${currentSuggestion.field}-${currentSuggestion.value}`}>
                      <div className="card-line">
                        <h3>{currentSuggestion.label || labelForField(currentSuggestion.field)}</h3>
                        <span className={`priority ${String(currentSuggestion.confidence || 'medium').toLowerCase()}`}>
                          {currentSuggestion.confidence || 'Medium'}
                        </span>
                      </div>
                      <p>{currentSuggestion.value}</p>
                      <small>{currentSuggestion.reason}</small>
                      <div className="deck-actions">
                        <button
                          className={project[currentSuggestion.field] === currentSuggestion.value ? 'secondary accepted' : 'primary'}
                          type="button"
                          onClick={() => toggleSuggestion(currentSuggestion)}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          {project[currentSuggestion.field] === currentSuggestion.value ? 'Accepted — Undo' : 'Accept and Next'}
                        </button>
                        <button className="secondary" type="button" onClick={skipSuggestion}>
                          Skip
                        </button>
                      </div>
                    </article>
                  ) : null}
                  <div className="deck-nav">
                    <button
                      className="secondary"
                      type="button"
                      disabled={suggestionIndex === 0}
                      onClick={() => setSuggestionIndex((current) => Math.max(current - 1, 0))}
                    >
                      Previous
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={suggestionIndex >= fieldSuggestions.length - 1}
                      onClick={() => setSuggestionIndex((current) => Math.min(current + 1, fieldSuggestions.length - 1))}
                    >
                      Next
                    </button>
                  </div>
                  <div className="deck-strip" aria-label="Suggestion progress">
                    {fieldSuggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.field}-${index}`}
                        className={[
                          'deck-dot',
                          index === suggestionIndex ? 'current' : '',
                          project[suggestion.field] === suggestion.value ? 'done' : ''
                        ].join(' ')}
                        type="button"
                        aria-label={`Open ${suggestion.label || labelForField(suggestion.field)}`}
                        onClick={() => setSuggestionIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState text="Enter a rough idea, then let the model structure it." compact />
              )}

              <FigurePanel
                figures={figures}
                index={figures.length ? Math.min(figureIndex, figures.length - 1) : 0}
                input={figureInput}
                busy={figureBusy}
                onIndexChange={setFigureIndex}
                onInputChange={setFigureInput}
                onSuggest={suggestFigureFn}
                onUpload={handleFigureImage}
                onRemove={removeFigure}
                onRenderPreview={renderFigurePreviewFor}
              />
            </section>

            <section className="workspace-panel decisions-panel">
              <PanelHeader title="Decision Needed" meta={`${Object.keys(decisionChoices).length}/${decisions.length} decided`} />
              {decisions.length ? (
                <div className="decision-deck">
                  <div className="deck-progress">
                    <span>{Math.min(decisionIndex + 1, decisions.length)} / {decisions.length}</span>
                    <strong>{Object.keys(decisionChoices).length} decided</strong>
                  </div>
                  {currentDecision ? (
                    <article className="decision-card active-card" key={currentDecision.id}>
                      <h3>{currentDecision.title}</h3>
                      <p>{currentDecision.question}</p>
                      <div className="option-stack">
                        {currentDecision.options.map((option) => (
                          <button
                            className={
                              decisionChoices[currentDecision.id] === option.label ? 'option-button selected' : 'option-button'
                            }
                            key={`${currentDecision.id}-${option.label}`}
                            type="button"
                            onClick={() => chooseOption(currentDecision, option)}
                          >
                            <strong>
                              {decisionChoices[currentDecision.id] === option.label ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
                              {option.label}
                            </strong>
                            <span>{option.value}</span>
                            <small>{option.rationale}</small>
                          </button>
                        ))}
                      </div>
                      <div className="deck-actions">
                        <button className="secondary" type="button" onClick={skipDecision}>
                          Skip
                        </button>
                      </div>
                    </article>
                  ) : null}
                  <div className="deck-nav">
                    <button
                      className="secondary"
                      type="button"
                      disabled={decisionIndex === 0}
                      onClick={() => setDecisionIndex((current) => Math.max(current - 1, 0))}
                    >
                      Previous
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={decisionIndex >= decisions.length - 1}
                      onClick={() => setDecisionIndex((current) => Math.min(current + 1, decisions.length - 1))}
                    >
                      Next
                    </button>
                  </div>
                  <div className="deck-strip" aria-label="Decision progress">
                    {decisions.map((decision, index) => (
                      <button
                        key={`${decision.id}-${index}`}
                        className={['deck-dot', index === decisionIndex ? 'current' : ''].join(' ')}
                        type="button"
                        aria-label={`Open ${decision.title}`}
                        onClick={() => setDecisionIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState text="No major decision is open. Review the accepted state or draft the proposal." compact />
              )}

              <section className="custom-note">
                <h3>Extra Note</h3>
                <textarea
                  value={customNote}
                  onChange={(event) => setCustomNote(event.target.value)}
                  placeholder={currentQuestion?.question || 'Add a detail the options missed.'}
                />
                <button className="primary" disabled={!customNote.trim() || status !== 'idle'} onClick={submitCustomNote} type="button">
                  {status === 'answering' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                  Let LLM Integrate
                </button>
              </section>
            </section>

            <section className="workspace-panel state-panel">
              <PanelHeader title="Accepted Project State" meta={`${acceptedCount}/${PROJECT_FIELDS.length} ready`} />
              <label>
                Project Title
                <input value={project.title} onChange={(event) => updateProjectField('title', event.target.value)} />
              </label>
              {PROJECT_FIELDS.map(([field, label]) => (
                <label key={field}>
                  {label}
                  <textarea value={project[field] || ''} onChange={(event) => updateProjectField(field, event.target.value)} />
                </label>
              ))}
              <button className="primary" disabled={!project.title || status !== 'idle'} onClick={generateProposal} type="button">
                {status === 'drafting' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
                Generate Proposal
              </button>
            </section>
          </div>

          <div className="workflow-columns">
            <section className="workflow-panel">
              <div className="panel-header">
                <h2>Run Log</h2>
                {runLog.length ? <span>{runLog.length} entries</span> : null}
              </div>
              {runLog.length ? (
                <>
                  <ol className="run-log">
                    {visibleRunLog.map((entry) => (
                      <li key={entry.id}>
                        <span>{entry.stage}</span>
                        <p>{entry.message}</p>
                      </li>
                    ))}
                  </ol>
                  {runLogPages > 1 ? (
                    <div className="deck-nav">
                      <button
                        className="secondary"
                        type="button"
                        disabled={safeRunLogPage === 0}
                        onClick={() => setRunLogPage((current) => Math.max(current - 1, 0))}
                      >
                        Previous
                      </button>
                      <span>{safeRunLogPage + 1} / {runLogPages}</span>
                      <button
                        className="secondary"
                        type="button"
                        disabled={safeRunLogPage >= runLogPages - 1}
                        onClick={() => setRunLogPage((current) => Math.min(current + 1, runLogPages - 1))}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState text="Run log appears after the idea is structured." compact />
              )}
            </section>

            <section className="workflow-panel artifacts-panel">
              <div className="artifact-toolbar">
                <nav className="tabs" aria-label="Generated artifacts">
                  {TABS.map(([id, Icon, label]) => (
                    <button
                      key={id}
                      className={activeTab === id ? 'tab active' : 'tab'}
                      type="button"
                      onClick={() => setActiveTab(id)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </nav>
                <button className="secondary" type="button" disabled={!result?.proposalLatex} onClick={downloadLatex}>
                  <Download size={17} aria-hidden="true" />
                  LaTeX
                </button>
                <button
                  className="primary"
                  type="button"
                  disabled={!result?.proposalLatex || status !== 'idle'}
                  onClick={downloadPdf}
                >
                  {status === 'exporting' ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
                  PDF
                </button>
              </div>

              <div className="artifact-summary">
                <div>
                  <span>Coverage</span>
                  <strong>{matrixStats.total ? `${matrixStats.covered}/${matrixStats.total}` : '0/0'}</strong>
                </div>
                <div>
                  <span>Accepted</span>
                  <strong>{acceptedCount}/{PROJECT_FIELDS.length}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{result?.provider ? formatProvider(result.provider) : 'waiting'}</strong>
                </div>
              </div>

              <div className="revision-bar">
                <input
                  value={revisionNotes}
                  onChange={(event) => setRevisionNotes(event.target.value)}
                  placeholder="Revision notes for the next draft (optional) — e.g., tighten scope, add a baseline"
                />
                <button
                  className="secondary"
                  type="button"
                  disabled={!project.title || status !== 'idle'}
                  onClick={generateProposal}
                >
                  {status === 'drafting' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
                  Regenerate
                </button>
              </div>

              {activeTab === 'evaluation' ? (
                <ReviewPanel
                  result={result}
                  review={reviewResult}
                  busy={reviewBusy}
                  onRun={runReview}
                  onUseEdit={useSuggestedEdit}
                />
              ) : (
                renderArtifact(activeTab, result, pdfUrl)
              )}
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.error || 'Request failed.');
  }

  return data;
}

async function exportPdfUrl(proposalLatex, title, figureImages = []) {
  const response = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      proposalLatex,
      figureImages
    })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.detail || data.error || 'PDF export failed.');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function renderArtifact(activeTab, result, pdfUrl) {
  if (!result) {
    return <EmptyState text="Proposal artifacts appear after Generate Proposal." />;
  }

  if (activeTab === 'pdf') {
    return pdfUrl ? (
      <iframe className="pdf-preview" src={pdfUrl} title="Compiled proposal PDF" />
    ) : (
      <EmptyState text="PDF preview is rendering." />
    );
  }

  if (activeTab === 'matrix') {
    return (
      <div className="matrix-wrap">
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Status</th>
              <th>Evidence</th>
              <th>Fix</th>
            </tr>
          </thead>
          <tbody>
            {(result.complianceMatrix || []).map((row, index) => (
              <tr key={`${row.requirement}-${index}`}>
                <td>{row.requirement}</td>
                <td>
                  <span className={/^covered$/i.test(row.status) ? 'badge covered' : 'badge needs-work'}>{row.status}</span>
                </td>
                <td>{row.evidence}</td>
                <td>{row.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }


  return <pre className="proposal-output">{result.proposalLatex}</pre>;
}

function PanelHeader({ title, meta }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}

function EmptyState({ text, compact = false }) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'}>
      <FileText size={compact ? 24 : 32} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function ReviewPanel({ result, review, busy, onRun, onUseEdit }) {
  if (!result?.proposalLatex) {
    return <EmptyState text="Generate a proposal first, then run the reviewer." />;
  }

  const score = review?.reviewerScore;

  return (
    <div className="review-panel">
      <div className="review-toolbar">
        <button className="primary" type="button" disabled={busy} onClick={onRun}>
          {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Gauge size={16} aria-hidden="true" />}
          {review ? 'Re-run review' : 'Get reviewer feedback'}
        </button>
        {review?.model ? <span className="review-model">reviewed by {review.model}</span> : null}
      </div>

      {busy && !review ? (
        <EmptyState text="An independent reviewer is reading your proposal…" compact />
      ) : review ? (
        <div className="review-result">
          {score ? (
            <div className={`review-score ${scoreTone(score.overall)}`}>
              <span>Reviewer score</span>
              <strong>{score.overall}<small> / 5</small></strong>
            </div>
          ) : null}

          {score?.criteria?.length ? (
            <ul className="review-criteria">
              {score.criteria.map((criterion) => (
                <li key={criterion.name}>
                  <span>{criterion.name}</span>
                  <strong>{criterion.score}/5</strong>
                  {criterion.comment ? <small>{criterion.comment}</small> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {review.summary ? (
            <div className="review-feedback">
              <h3>Feedback</h3>
              <p>{review.summary}</p>
            </div>
          ) : null}

          {review.suggestedEdits?.length ? (
            <div className="review-edits">
              <h3>Suggested edits</h3>
              {review.suggestedEdits.map((edit, index) => (
                <div className="edit-card" key={index}>
                  <strong>{edit.section}</strong>
                  {edit.issue ? <small>{edit.issue}</small> : null}
                  <p>{edit.suggestion}</p>
                  <button className="secondary" type="button" onClick={() => onUseEdit(edit)}>
                    Use as revision note
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState text="Click “Get reviewer feedback” — a separate LLM will score and critique this draft." compact />
      )}
    </div>
  );
}

function scoreTone(value) {
  const num = Number(value);
  if (num >= 4) return 'tone-strong';
  if (num >= 3) return 'tone-ok';
  return 'tone-weak';
}

function RelatedWorksPanel({ papers, page, pageSize, busy, onPageChange, onToggle, onUpload, onRefresh }) {
  const selectedCount = papers.filter((paper) => paper.selected).length;
  const searching = busy === 'searching';
  const totalPages = Math.max(1, Math.ceil(papers.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visiblePapers = papers.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <section className="related-works">
      <div className="panel-header">
        <h2>
          <BookOpen size={18} aria-hidden="true" /> Related Works
        </h2>
        <span>{selectedCount} selected for references</span>
      </div>
      <p className="related-hint">
        Papers similar to your topic, suggested automatically. Check the ones to cite (uploads are included by default) — selected
        papers become the proposal&apos;s References.
      </p>

      <div className="rw-actions">
        <label className="secondary upload-btn">
          {busy === 'uploading' ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
          Upload your own
          <input
            type="file"
            accept=".pdf,.txt,.md,.bib"
            multiple
            hidden
            onChange={(event) => {
              onUpload(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        <button className="secondary" type="button" disabled={Boolean(busy)} onClick={onRefresh}>
          {searching ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
          Refresh suggestions
        </button>
      </div>

      {searching && !papers.length ? (
        <EmptyState text="Finding related papers for your topic…" compact />
      ) : papers.length ? (
        <>
          <ul className="paper-grid">
          {visiblePapers.map((paper) => (
            <li key={paper.id} className={paper.selected ? 'paper-card checked' : 'paper-card'}>
              <label className="paper-check">
                <input type="checkbox" checked={paper.selected} onChange={() => onToggle(paper.id)} />
                <span className="paper-body">
                  <strong>{paper.title}</strong>
                  <small>
                    {[paper.authors, paper.year, paper.citationCount != null ? `${paper.citationCount} cites` : '']
                      .filter(Boolean)
                      .join(' · ')}
                    {paper.uploaded ? ' · uploaded' : ''}
                  </small>
                  {paper.url ? (
                    <a href={paper.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                      View paper
                    </a>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
          </ul>
          {totalPages > 1 ? (
            <div className="deck-nav">
              <button className="secondary" type="button" disabled={safePage === 0} onClick={() => onPageChange(safePage - 1)}>
                Previous
              </button>
              <span>{safePage + 1} / {totalPages}</span>
              <button
                className="secondary"
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => onPageChange(safePage + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState text="Related papers appear here once your idea has a title. Use Refresh to fetch, or upload your own." compact />
      )}
    </section>
  );
}

function FigurePanel({ figures, index, input, busy, onIndexChange, onInputChange, onSuggest, onUpload, onRemove, onRenderPreview }) {
  return (
    <section className="figure-panel">
      <div className="panel-header">
        <h2>
          <ImageIcon size={16} aria-hidden="true" /> Figures
        </h2>
        <span>{figures.length} in draft</span>
      </div>
      <p className="related-hint">
        Suggest figures for the draft (add as many as you need, with optional guidance), or upload your own images. Every figure here
        goes into the proposal.
      </p>

      <div className="figure-actions">
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Optional: what the next figure should show"
        />
        <div className="figure-buttons">
          <button className="primary" type="button" disabled={busy} onClick={onSuggest}>
            {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {figures.length ? 'Suggest another' : 'Suggest figure'}
          </button>
          <label className="secondary upload-btn">
            <Upload size={16} aria-hidden="true" />
            Upload image
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              hidden
              onChange={(event) => {
                onUpload(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {figures.length ? (
        (() => {
          const item = figures[index];
          if (!item) return null;
          return (
            <div className="figure-deck">
              <div className="deck-progress">
                <span>{index + 1} / {figures.length}</span>
                <strong>{item.kind === 'image' ? 'uploaded' : 'AI suggested'}</strong>
              </div>
              <article className="figure-card">
                <div className="figure-card-head">
                  <strong>Figure {index + 1}</strong>
                  <button className="icon-x" type="button" aria-label="Remove figure" onClick={() => onRemove(item.id)}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
                {item.caption ? <small>{item.caption}</small> : null}
                {item.kind === 'image' ? (
                  item.imageName.endsWith('.pdf') ? (
                    <p className="figure-pdf-note">PDF figure attached.</p>
                  ) : (
                    <img className="figure-thumb" src={item.imageDataUrl} alt={`Figure ${index + 1}`} />
                  )
                ) : item.previewUrl ? (
                  <iframe className="figure-preview-frame" src={item.previewUrl} title={`Figure ${index + 1} preview`} />
                ) : (
                  <button className="secondary" type="button" disabled={busy} onClick={() => onRenderPreview(item.id)}>
                    {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
                    Render preview
                  </button>
                )}
                {item.kind === 'latex' ? (
                  <details className="figure-code">
                    <summary>Show LaTeX</summary>
                    <pre>{item.latex}</pre>
                  </details>
                ) : null}
              </article>
              {figures.length > 1 ? (
                <div className="deck-nav">
                  <button className="secondary" type="button" disabled={index === 0} onClick={() => onIndexChange(index - 1)}>
                    Previous
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={index >= figures.length - 1}
                    onClick={() => onIndexChange(index + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          );
        })()
      ) : (
        <EmptyState text="No figures yet. Click Suggest figure (uses your topic), or upload your own image." compact />
      )}
    </section>
  );
}

function stageStatus(index, fieldSuggestions, decisions, project, result) {
  if (index === 0 && fieldSuggestions.length) return 'status-complete';
  if (index === 1 && decisions.length) return 'status-complete';
  if (index === 2 && PROJECT_FIELDS.some(([field]) => project[field])) return 'status-complete';
  if (index >= 3 && result) return 'status-complete';
  return 'status-waiting';
}

function stageLabel(index, fieldSuggestions, decisions, project, result) {
  if (index === 0 && fieldSuggestions.length) return 'Shown';
  if (index === 1 && decisions.length) return 'Shown';
  if (index === 2 && PROJECT_FIELDS.some(([field]) => project[field])) return 'Shown';
  if (index >= 3 && result) return 'Shown';
  return 'Ready';
}

function countCovered(rows = []) {
  return rows.filter((row) => /^covered$/i.test(row.status)).length;
}

function labelForField(field) {
  const found = PROJECT_FIELDS.find(([key]) => key === field);
  return found?.[1] || 'Field';
}

function logEntry(stage, message) {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    stage,
    message
  };
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}


function summarizePdfError(error) {
  const text = readError(error);
  const lines = text.split('\n').map((line) => line.trim());
  // Prefer the engine's own "error:" line over the long command echo and warnings.
  const picked = lines.find((line) => /^error:/i.test(line)) || lines[0] || text;
  return picked.length > 160 ? `${picked.slice(0, 160)}…` : picked;
}

function formatProvider(provider) {
  if (!provider) return 'waiting';
  if (/generativelanguage|gemini/i.test(provider)) return 'Gemini';
  if (provider === 'template') return 'Local fallback';

  try {
    return new URL(provider).hostname;
  } catch {
    return provider;
  }
}

function compactResult(result) {
  if (!result) return null;

  return {
    mode: result.mode,
    provider: result.provider,
    proposalLatex: result.proposalLatex,
    complianceMatrix: result.complianceMatrix,
    evaluationReport: result.evaluationReport,
    reviewerScore: result.reviewerScore,
    questions: result.questions
  };
}

function formatSavedAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default App;

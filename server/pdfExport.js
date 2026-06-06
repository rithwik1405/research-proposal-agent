import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Resolve the tectonic LaTeX engine: an explicit TECTONIC_PATH wins, then the
// binary bundled under server/bin, and finally whatever is on the system PATH.
function resolveTectonicBin() {
  if (process.env.TECTONIC_PATH) {
    return process.env.TECTONIC_PATH;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.join(here, 'bin', process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');

  return existsSync(bundled) ? bundled : 'tectonic';
}

const TECTONIC_BIN = resolveTectonicBin();

// Tectonic fetches LaTeX support files on first use and caches them. Pin the
// cache to a dedicated temp dir we control so it never fails to create its
// default location, and so it stays outside the Vite-watched project tree.
const TECTONIC_CACHE_DIR = process.env.TECTONIC_CACHE_DIR || path.join(tmpdir(), 'tectonic-cache');

export async function proposalLatexToPdf(latex, title = 'proposal') {
  const source = String(latex || '').trim();

  if (!source) {
    throw new Error('LaTeX source is empty.');
  }

  const workdir = await mkdtemp(path.join(tmpdir(), 'proposal-tex-'));
  const texPath = path.join(workdir, 'proposal.tex');
  const pdfPath = path.join(workdir, 'proposal.pdf');

  try {
    await mkdir(TECTONIC_CACHE_DIR, { recursive: true });
    await writeFile(texPath, sanitizeLatexForExport(ensureCompleteLatexDocument(source, title)), 'utf8');
    await execFileAsync(TECTONIC_BIN, ['--outdir', workdir, texPath], {
      cwd: workdir,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 8,
      env: { ...process.env, TECTONIC_CACHE_DIR }
    });

    return await readFile(pdfPath);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function sanitizeLatexForExport(source) {
  return fixTikzArrowTips(replaceExternalImageIncludes(source));
}

// Safety net for model-generated TikZ: the deprecated `arrows` library tips
// (latex', stealth') break under the modern arrows.meta library. Rewrite them
// to the arrows.meta names and make sure that library is actually loaded.
function fixTikzArrowTips(source) {
  let out = String(source || '');

  if (!/tikz|pgf/i.test(out)) {
    return out;
  }

  out = out
    .replace(/latex'/g, 'Latex')
    .replace(/stealth'/g, 'Stealth')
    .replace(/>=\s*latex\b/g, '>=Latex')
    .replace(/>=\s*stealth\b/g, '>=Stealth');

  if (/\\begin\{tikzpicture\}/.test(out) && !/\\usetikzlibrary\{[^}]*arrows\.meta[^}]*\}/.test(out)) {
    if (/\\usepackage(?:\[[^\]]*\])?\{tikz\}/.test(out)) {
      out = out.replace(
        /(\\usepackage(?:\[[^\]]*\])?\{tikz\})/,
        '$1\n\\usetikzlibrary{arrows.meta,positioning}'
      );
    } else if (/\\begin\{document\}/.test(out)) {
      out = out.replace(
        /(\\begin\{document\})/,
        '\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta,positioning}\n$1'
      );
    }
  }

  return out;
}

function replaceExternalImageIncludes(source) {
  return String(source || '').replace(
    /\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^{}]+)\}/g,
    (_, filename) => imagePlaceholder(filename)
  );
}

function imagePlaceholder(filename) {
  return String.raw`\begin{center}
\fbox{\begin{minipage}{0.86\linewidth}
\centering
\textbf{Workflow diagram}\\[0.45em]
Rough idea $\rightarrow$ structured state $\rightarrow$ student decisions $\rightarrow$ proposal draft $\rightarrow$ compliance review $\rightarrow$ revised PDF\\[0.45em]
\footnotesize External image asset \texttt{${escapeLatex(filename)}} was not provided, so the exporter rendered this LaTeX-native placeholder.
\end{minipage}}
\end{center}`;
}

function ensureCompleteLatexDocument(source, title) {
  if (/\\documentclass\b/.test(source) && /\\begin\{document\}/.test(source)) {
    return normalizeCompleteLatexDocument(source);
  }

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
${source}
\end{document}
`;
}

function normalizeCompleteLatexDocument(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const beginIndex = lines.findIndex((line) => /\\begin\{document\}/.test(line));
  const endIndex = findLastIndex(lines, (line) => /\\end\{document\}/.test(line));

  if (beginIndex === -1) {
    return source;
  }

  const preambleLines = lines.slice(0, beginIndex);
  const bodyLines = lines.slice(beginIndex + 1, endIndex === -1 ? lines.length : endIndex);
  const documentClass = preambleLines.find((line) => /\\documentclass\b/.test(line)) || '\\documentclass[11pt]{article}';
  const preamble = [];
  const movedPreamble = [];

  preambleLines.forEach((line) => {
    if (/\\documentclass\b/.test(line)) return;
    if (/\\begin\{document\}|\\end\{document\}/.test(line)) return;
    preamble.push(line);
  });

  const cleanBody = bodyLines.filter((line) => {
    if (/\\documentclass\b|\\begin\{document\}|\\end\{document\}/.test(line)) return false;
    if (/^\s*\\(?:usepackage|geometry)\b/.test(line)) {
      movedPreamble.push(line);
      return false;
    }
    return true;
  });

  const normalizedPreamble = ensureDefaultPreamble([documentClass, ...preamble, ...movedPreamble]);

  return `${dedupeLines(normalizedPreamble).join('\n')}\n\\begin{document}\n${cleanBody.join('\n').trim()}\n\\end{document}\n`;
}

function ensureDefaultPreamble(lines) {
  const source = lines.join('\n');
  const next = [...lines];

  if (!/\\usepackage(?:\[[^\]]*\])?\{geometry\}/.test(source)) {
    next.push('\\usepackage[margin=1in]{geometry}');
  }

  if (!/\\usepackage(?:\[[^\]]*\])?\{hyperref\}/.test(source)) {
    next.push('\\usepackage[hidelinks]{hyperref}');
  }

  if (!/\\usepackage(?:\[[^\]]*\])?\{enumitem\}/.test(source)) {
    next.push('\\usepackage{enumitem}');
  }

  return next;
}

function dedupeLines(lines) {
  const seen = new Set();

  return lines.filter((line) => {
    const key = line.trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }

  return -1;
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

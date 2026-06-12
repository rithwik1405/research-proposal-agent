// Literature search via the OpenAlex API (free, no key, generous limits).
// We use a real scholarly source rather than asking the LLM so that retrieved
// papers are real and verifiable instead of hallucinated citations.

const OPENALEX_URL = 'https://api.openalex.org/works';

export async function searchPapers(query, limit = 8) {
  const q = clean(query);

  if (!q) {
    throw new Error('A search query is required.');
  }

  const params = new URLSearchParams({
    search: q,
    per_page: String(limit),
    select: 'id,title,publication_year,authorships,primary_location,doi,cited_by_count'
  });
  const url = `${OPENALEX_URL}?${params.toString()}`;

  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) break;
    if (response.status !== 429) break;
    await sleep(1000 * (attempt + 1));
  }

  if (!response.ok) {
    throw new Error(`OpenAlex returned ${response.status}.`);
  }

  const data = await response.json();
  const works = Array.isArray(data?.results) ? data.results : [];

  return works
    .map((work) => ({
      id: clean(work.id) || clean(work.doi) || clean(work.title),
      title: sanitizeText(decodeEntities(work.title)),
      authors: (work.authorships || [])
        .map((authorship) => sanitizeText(decodeEntities(authorship?.author?.display_name)))
        .filter(Boolean)
        .slice(0, 6)
        .join(', '),
      year: work.publication_year || '',
      citationCount: Number.isFinite(work.cited_by_count) ? work.cited_by_count : null,
      url: clean(work.primary_location?.landing_page_url) || clean(work.doi) || clean(work.id)
    }))
    .filter((paper) => paper.title);
}

function clean(value) {
  return String(value || '').trim();
}

function decodeEntities(value) {
  return clean(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Clean corrupted / unrenderable text from the paper database: keep only
// ASCII-printable plus accented Latin (U+00C0-U+024F, so names like Gutierrez
// survive), dropping control/replacement chars and non-Latin scripts the PDF
// font can't render; then collapse absurd repeated-character runs (corruption,
// e.g. a Greek letter followed by 16 f's).
function sanitizeText(value) {
  return clean(value)
    .replace(/[^ -~À-ɏ]/g, '')
    .replace(/(\S)\1{3,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

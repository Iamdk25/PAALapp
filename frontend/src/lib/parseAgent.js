/**
 * CrewAI prints agent output in a Unicode box; every line starts/ends with │ etc.
 * That breaks JSON.parse and makes the UI show an unreadable wall of text.
 */
export function stripCrewConsoleFormatting(text) {
  if (typeof text !== 'string' || !text.length) return typeof text === 'string' ? text : ''
  return text
    .split(/\r?\n/)
    .map((line) => {
      let s = line.replace(/^[\s\u2500-\u257F]*\u2502/, '')
      s = s.replace(/\u2502[\s\u2500-\u257F]*$/, '')
      return s
    })
    .join('\n')
}

export function normalizeAgentOutput(raw) {
  return stripCrewConsoleFormatting(typeof raw === 'string' ? raw : String(raw ?? ''))
}

/** Try fenced ```json blocks from last to first (final answer is usually last). */
function extractFencedJsonBlocks(normalized) {
  const matches = [...normalized.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  return matches.map((m) => m[1].trim()).filter(Boolean)
}

/** Parse first top-level JSON object starting at `{` with string-aware braces. */
function tryParseBalancedJsonObject(str, startIdx) {
  if (str[startIdx] !== '{') return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = startIdx; i < str.length; i++) {
    const c = str[i]
    if (esc) {
      esc = false
      continue
    }
    if (inStr) {
      if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        const slice = str.slice(startIdx, i + 1)
        try {
          return JSON.parse(slice)
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function parseTutorJsonObject(normalized) {
  const blocks = extractFencedJsonBlocks(normalized)
  for (let b = blocks.length - 1; b >= 0; b--) {
    try {
      const j = JSON.parse(blocks[b])
      if (j && typeof j.response === 'string') return j
    } catch {
      /* try next fence */
    }
  }
  try {
    const j = JSON.parse(normalized.trim())
    if (j && typeof j.response === 'string') return j
  } catch {
    /* try scanning for embedded JSON */
  }
  let pos = 0
  while (pos < normalized.length) {
    const i = normalized.indexOf('{', pos)
    if (i === -1) break
    const j = tryParseBalancedJsonObject(normalized, i)
    if (j && typeof j.response === 'string') return j
    pos = i + 1
  }
  return null
}

export function parseTutorPayload(raw) {
  const normalized = normalizeAgentOutput(raw)
  const fallback = { text: normalized.trim() || String(raw ?? ''), suggestedPrompts: [] }
  const j = parseTutorJsonObject(normalized)
  if (!j) return fallback
  const sp = j.suggested_prompts ?? j.suggestedPrompts
  const prompts = Array.isArray(sp) ? sp.filter(Boolean) : []
  return {
    text: j.response,
    suggestedPrompts: prompts.slice(0, 5),
  }
}

function parseJsonObjectScanning(normalized, predicate) {
  const blocks = extractFencedJsonBlocks(normalized)
  for (let b = blocks.length - 1; b >= 0; b--) {
    try {
      const j = JSON.parse(blocks[b])
      if (predicate(j)) return j
    } catch {
      /* next */
    }
  }
  try {
    const j = JSON.parse(normalized.trim())
    if (predicate(j)) return j
  } catch {
    /* scan */
  }
  let pos = 0
  while (pos < normalized.length) {
    const i = normalized.indexOf('{', pos)
    if (i === -1) break
    const j = tryParseBalancedJsonObject(normalized, i)
    if (j && predicate(j)) return j
    pos = i + 1
  }
  return null
}

/** Normalize quiz items from the agent (legacy MC-only vs typed quiz). */
export function normalizeQuizQuestion(q) {
  if (!q || typeof q !== 'object') return q
  const t = q.type
  if (t === 'tf' || t === 'sa' || t === 'mc') return q
  if (q.options && typeof q.options === 'object') return { ...q, type: 'mc' }
  return { ...q, type: 'mc' }
}

export function parseQuizPayload(raw) {
  const normalized = normalizeAgentOutput(raw)
  const j = parseJsonObjectScanning(normalized, (o) => o?.quiz && Array.isArray(o.quiz))
  if (!j?.quiz || !Array.isArray(j.quiz)) return null
  return j.quiz.map(normalizeQuizQuestion)
}

/** Fix JSON strings where newlines were escaped as literal \n */
export function normalizeFeedbackMarkdown(s) {
  if (typeof s !== 'string') return String(s ?? '')
  let t = s.trim()
  if (t.includes('\\n') && !t.includes('\n')) {
    t = t.replace(/\\n/g, '\n')
  }
  return t
}

export function parseGradePayload(raw) {
  const normalized = normalizeAgentOutput(raw)
  const j = parseJsonObjectScanning(
    normalized,
    (o) => o && typeof o.score === 'string',
  )
  if (!j) return null
  let feedback = j.feedback
  if (typeof feedback !== 'string') feedback = feedback != null ? String(feedback) : ''
  feedback = normalizeFeedbackMarkdown(feedback)
  const items = Array.isArray(j.items)
    ? j.items.map((it, i) => ({
        index: typeof it.index === 'number' ? it.index : i,
        correct: typeof it.correct === 'boolean' ? it.correct : undefined,
        correctAnswer: it.correct_answer != null ? String(it.correct_answer) : '',
      }))
    : []
  return {
    score: j.score,
    feedback,
    reviewTopics: Array.isArray(j.review_topics) ? j.review_topics.filter(Boolean) : [],
    items,
  }
}

export function parseProgressPayload(raw) {
  const normalized = normalizeAgentOutput(raw)
  return parseJsonObjectScanning(
    normalized,
    (o) =>
      o &&
      (typeof o.overall_strength === 'string' ||
        Array.isArray(o.recommendations) ||
        Array.isArray(o.strengths)),
  )
}

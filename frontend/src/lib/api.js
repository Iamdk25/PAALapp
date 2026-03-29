const CHAT = '/api/chat'
const COURSES_URL = '/api/courses'

function formatHttpError(data, res) {
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg || JSON.stringify(d)).join(' ')
  return res.statusText || `Request failed (${res.status})`
}

/**
 * @param {() => Promise<string | null | undefined>} getToken - from usePaalApi()
 */
async function authHeaders(getToken) {
  const token = typeof getToken === 'function' ? await getToken() : 'local-dev-mock'
  const bearer = token && String(token).trim() ? String(token).trim() : 'local-dev-mock'
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearer}`,
  }
}

/**
 * Public catalog — no auth required (same-origin or CORS).
 */
export async function fetchCourses() {
  const res = await fetch(COURSES_URL)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.detail ?? res.statusText
    throw new Error(typeof err === 'string' ? err : `HTTP ${res.status}`)
  }
  if (!Array.isArray(data)) return []
  return data
}

/**
 * Chapter/topic tree for Study Hub (from outline.json when pipeline has run).
 */
export async function fetchCourseOutline(courseId) {
  const url = `${COURSES_URL}/${encodeURIComponent(courseId)}/outline`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data?.detail ?? res.statusText
    throw new Error(typeof err === 'string' ? err : `HTTP ${res.status}`)
  }
  return data
}

/**
 * POST /api/chat — user_id comes from JWT; body does not include user_id.
 */
export async function postChat(
  { action, topic, course, chat_history, quiz_options: quizOptions },
  getToken,
) {
  const headers = await authHeaders(getToken)
  const body = {
    action,
    topic: topic ?? '',
    course: course || 'test_course_101',
    chat_history: chat_history || [],
  }
  if (quizOptions != null && action === 'quiz') {
    body.quiz_options = quizOptions
  }
  const res = await fetch(CHAT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatHttpError(data, res))
  const answer = typeof data.answer === 'string' ? data.answer : String(data.answer ?? '')
  return answer
}

/** GET /api/history/{course} */
export async function fetchChatHistory(course, getToken) {
  const headers = await authHeaders(getToken)
  const path = `/api/history/${encodeURIComponent(course)}`
  const res = await fetch(path, { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatHttpError(data, res))
  return data
}

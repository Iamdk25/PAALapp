/** Per-user localStorage keys so switching Clerk accounts does not leak history on this device. */
function chatsKey(scopeId) {
  return `paal_chats_v2:${scopeId}`
}

function quizKey(scopeId) {
  return `paal_quiz_v2:${scopeId}`
}

export function loadChats(scopeId) {
  if (!scopeId) return {}
  try {
    const raw = localStorage.getItem(chatsKey(scopeId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveChats(scopeId, map) {
  if (!scopeId) return
  localStorage.setItem(chatsKey(scopeId), JSON.stringify(map))
}

export function loadQuizHistory(scopeId) {
  if (!scopeId) return []
  try {
    const raw = localStorage.getItem(quizKey(scopeId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveQuizHistory(scopeId, list) {
  if (!scopeId) return
  localStorage.setItem(quizKey(scopeId), JSON.stringify(list.slice(0, 80)))
}

export function appendQuizAttempt(scopeId, entry) {
  const list = loadQuizHistory(scopeId)
  list.unshift({
    id: crypto.randomUUID(),
    at: Date.now(),
    ...entry,
  })
  saveQuizHistory(scopeId, list)
  return list
}

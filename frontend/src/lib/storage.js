const CHATS_KEY = 'paal_chats_v1'
const QUIZ_KEY = 'paal_quiz_history_v1'

export function loadChats() {
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveChats(map) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(map))
}

export function loadQuizHistory() {
  try {
    const raw = localStorage.getItem(QUIZ_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveQuizHistory(list) {
  localStorage.setItem(QUIZ_KEY, JSON.stringify(list.slice(0, 80)))
}

export function appendQuizAttempt(entry) {
  const list = loadQuizHistory()
  list.unshift({
    id: crypto.randomUUID(),
    at: Date.now(),
    ...entry,
  })
  saveQuizHistory(list)
  return list
}

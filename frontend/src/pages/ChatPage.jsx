import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { findCourseById } from '../data/courses'
import { postChat } from '../lib/api'
import { useCourses } from '../hooks/useCourses'
import { useCourseOutline } from '../hooks/useCourseOutline'
import { usePaalApi } from '../hooks/usePaalApi'
import { AssistantMarkdown } from '../components/AssistantMarkdown'
import { parseTutorPayload } from '../lib/parseAgent'
import { toChatHistory } from '../lib/chatHistory'
import { loadChats, saveChats } from '../lib/storage'
import { loadQuizHistory } from '../lib/storage'
import { usePaalStorageScope } from '../providers/StorageScopeProvider.jsx'

export default function ChatPage() {
  const { scopeId } = usePaalStorageScope()
  const { getToken } = usePaalApi()
  const { courses, loading: coursesLoading, error: coursesError, refetch } = useCourses()
  const [searchParams] = useSearchParams()
  const initialFromUrl = searchParams.get('course')

  const [chatId, setChatId] = useState(() => crypto.randomUUID())
  const [courseId, setCourseId] = useState(null)

  useEffect(() => {
    if (!courses.length) return
    if (courseId && findCourseById(courses, courseId)) return
    const hit = initialFromUrl ? findCourseById(courses, initialFromUrl) : null
    setCourseId(hit ? hit.id : courses[0].id)
  }, [courses, courseId, initialFromUrl])

  const course = useMemo(
    () => (courseId ? findCourseById(courses, courseId) : null),
    [courses, courseId],
  )

  const { chapters: outlineChapters, loading: outlineLoading, error: outlineError } =
    useCourseOutline(courseId)

  /** Prefer live outline; while loading, keep catalog chapters so dropdowns are not empty. */
  const chaptersList = useMemo(() => {
    if (outlineChapters.length) return outlineChapters
    return course?.chapters ?? []
  }, [outlineChapters, course?.chapters])

  /** Must match Pinecone metadata `course` (raw_pdfs folder name). */
  const apiCourse = course?.pineconeCourse ?? ''

  const [chapterId, setChapterId] = useState('')
  const chapter = useMemo(
    () => chaptersList.find((c) => c.id === chapterId) ?? chaptersList[0],
    [chaptersList, chapterId],
  )

  const [topicChoice, setTopicChoice] = useState('')

  useEffect(() => {
    if (!chaptersList.length) return
    setChapterId((prev) => {
      if (prev && chaptersList.some((c) => c.id === prev)) return prev
      return chaptersList[0].id
    })
  }, [courseId, chaptersList])

  useEffect(() => {
    const ch = chaptersList.find((c) => c.id === chapterId) ?? chaptersList[0]
    if (!ch) return
    setTopicChoice((prev) => (ch.topics?.includes(prev) ? prev : ch.topics?.[0] ?? ''))
  }, [chapterId, chaptersList])

  const sessionTopicLabel = useMemo(() => {
    if (!chapter) return topicChoice || 'Study session'
    return `${chapter.title} — ${topicChoice || chapter.topics[0] || 'General'}`
  }, [chapter, topicChoice])

  const [messages, setMessages] = useState([])
  const [suggestedPrompts, setSuggestedPrompts] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const [recentList, setRecentList] = useState(() =>
    Object.values(loadChats(scopeId)).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
  )

  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const refreshRecentList = useCallback(() => {
    setRecentList(
      Object.values(loadChats(scopeId)).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    )
  }, [scopeId])

  const persist = useCallback(() => {
    const map = loadChats(scopeId)
    const title = `${course?.code ?? 'Course'} · ${topicChoice || 'Chat'}`
    map[chatId] = {
      id: chatId,
      courseId,
      title,
      messages,
      updatedAt: Date.now(),
    }
    saveChats(scopeId, map)
    setRecentList(Object.values(map).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)))
  }, [scopeId, chatId, courseId, course?.code, topicChoice, messages])

  useEffect(() => {
    if (messages.length) persist()
  }, [messages, persist])

  const quizScores = useMemo(() => loadQuizHistory(scopeId).slice(0, 5), [scopeId])

  const newChat = () => {
    if (messages.length > 0) {
      const map = loadChats(scopeId)
      const c = findCourseById(courses, courseId)
      map[chatId] = {
        id: chatId,
        courseId,
        title: `${c?.code ?? 'Course'} · ${sessionTopicLabel}`,
        messages: messagesRef.current,
        updatedAt: Date.now(),
      }
      saveChats(scopeId, map)
      refreshRecentList()
    }
    setChatId(crypto.randomUUID())
    setMessages([])
    setSuggestedPrompts([])
    setError('')
    setInput('')
  }

  /** Switch course: save current thread to history, then start a fresh session (ChatGPT-style). */
  const switchToCourse = useCallback(
    (newCourseId) => {
      if (!newCourseId || newCourseId === courseId) return
      const msgs = messagesRef.current
      if (msgs.length > 0) {
        const map = loadChats(scopeId)
        const c = findCourseById(courses, courseId)
        map[chatId] = {
          id: chatId,
          courseId,
          title: `${c?.code ?? 'Course'} · ${sessionTopicLabel}`,
          messages: msgs,
          updatedAt: Date.now(),
        }
        saveChats(scopeId, map)
        refreshRecentList()
      }
      setCourseId(newCourseId)
      setChatId(crypto.randomUUID())
      setMessages([])
      setSuggestedPrompts([])
      setInput('')
      setError('')
    },
    [courseId, courses, chatId, sessionTopicLabel, scopeId, refreshRecentList],
  )

  const openSavedChat = (id) => {
    const map = loadChats(scopeId)
    const saved = map[id]
    if (!saved) return
    setChatId(saved.id)
    setCourseId(saved.courseId)
    setMessages(saved.messages ?? [])
    setSuggestedPrompts([])
    setError('')
    refreshRecentList()
  }

  const appendAssistant = (content, prompts) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content }])
    setSuggestedPrompts(Array.isArray(prompts) ? prompts : [])
  }

  const runExplain = async () => {
    if (!apiCourse) {
      setError('Select a course with uploaded materials.')
      return
    }
    setError('')
    setLoading('explain')
    try {
      const history = toChatHistory(messages)
      const raw = await postChat(
        {
          action: 'explain',
          topic: sessionTopicLabel,
          course: apiCourse,
          chat_history: history,
        },
        getToken,
      )
      const { text, suggestedPrompts: sp } = parseTutorPayload(raw)
      appendAssistant(text, sp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(null)
    }
  }

  const runAsk = async (question) => {
    const q = question.trim()
    if (!q) return
    if (!apiCourse) {
      setError('Select a course with uploaded materials.')
      return
    }
    setError('')
    const prior = toChatHistory(messages)
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: q }])
    setLoading('ask')
    try {
      const raw = await postChat(
        {
          action: 'ask',
          topic: q,
          course: apiCourse,
          chat_history: prior,
        },
        getToken,
      )
      const { text, suggestedPrompts: sp } = parseTutorPayload(raw)
      appendAssistant(text, sp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(null)
    }
  }

  const runSummarize = async () => {
    if (!apiCourse) {
      setError('Select a course with uploaded materials.')
      return
    }
    setError('')
    setLoading('summarize')
    try {
      const history = toChatHistory(messages)
      const raw = await postChat(
        {
          action: 'summarize',
          topic: sessionTopicLabel,
          course: apiCourse,
          chat_history: history,
        },
        getToken,
      )
      const { text, suggestedPrompts: sp } = parseTutorPayload(raw)
      appendAssistant(text, sp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(null)
    }
  }

  const runNotes = async () => {
    if (!apiCourse) {
      setError('Select a course with uploaded materials.')
      return
    }
    setError('')
    setLoading('notes')
    try {
      const history = toChatHistory(messages)
      const raw = await postChat(
        {
          action: 'generate_notes',
          topic: sessionTopicLabel,
          course: apiCourse,
          chat_history: history,
        },
        getToken,
      )
      const pdfTitle = `${course?.code ?? 'Course'} · ${sessionTopicLabel}`
      const { openNotesPdfFromMarkdown } = await import('../lib/notesPdf')
      await openNotesPdfFromMarkdown(raw, {
        title: pdfTitle,
        courseCode: course?.code ?? 'PAAL',
        topicLabel: sessionTopicLabel,
      })
      appendAssistant(
        `**Study notes PDF ready.** A preview opened in a new tab and a copy was saved to your downloads (${pdfTitle}).`,
        [],
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(null)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    runAsk(input)
    setInput('')
  }

  if (coursesLoading) {
    return (
      <PageShell hideFooter>
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16 text-slate-600">
          Loading courses…
        </div>
      </PageShell>
    )
  }

  if (coursesError) {
    return (
      <PageShell hideFooter>
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-red-800">{coursesError}</p>
          <p className="mt-2 text-sm text-slate-600">Make sure the PAAL server is running, then try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-usf-green px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </PageShell>
    )
  }

  if (!courses.length) {
    return (
      <PageShell hideFooter>
        <div className="mx-auto max-w-lg px-6 py-16 text-center text-slate-700">
          <p className="font-semibold text-usf-green">No courses available yet</p>
          <p className="mt-2 text-sm text-slate-600">Please check back soon.</p>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell hideFooter>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="flex max-h-[38vh] w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50/90 md:max-h-none md:h-full md:w-60 md:shrink-0 md:border-b-0 md:border-r lg:w-64 xl:w-72">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">Your courses</p>
              <ul className="mt-2 space-y-1">
                {courses.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => switchToCourse(c.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        c.id === courseId
                          ? 'bg-usf-green text-white shadow-sm'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span className="block font-semibold tabular-nums">{c.code}</span>
                      <span
                        className={`mt-0.5 block truncate text-xs font-normal ${
                          c.id === courseId ? 'text-white/90' : 'text-slate-500'
                        }`}
                      >
                        {c.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={newChat}
              className="rounded-xl border-2 border-dashed border-usf-green/40 px-3 py-2 text-sm font-semibold text-usf-green transition hover:bg-usf-green-light"
            >
              + New chat
            </button>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">Quick actions</p>
              <div className="mt-2 flex flex-col gap-2">
                <Link
                  to={`/quiz?course=${courseId}&topic=${encodeURIComponent(sessionTopicLabel)}`}
                  className="rounded-lg bg-white px-3 py-2 text-center text-sm font-medium text-usf-green shadow-sm ring-1 ring-slate-200 transition hover:ring-usf-green"
                >
                  Generate quiz
                </Link>
                <button
                  type="button"
                  onClick={runNotes}
                  disabled={!!loading}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-usf-green shadow-sm ring-1 ring-slate-200 transition hover:ring-usf-green disabled:opacity-50"
                >
                  {loading === 'notes' ? 'Building PDF…' : 'Download notes (PDF)'}
                </button>
                <button
                  type="button"
                  onClick={runSummarize}
                  disabled={!!loading}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-usf-green shadow-sm ring-1 ring-slate-200 transition hover:ring-usf-green disabled:opacity-50"
                >
                  {loading === 'summarize' ? 'Summarizing…' : 'Summarize this session'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">Chat history</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Tap to reopen. Switching course saves your current chat here.</p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm md:max-h-40">
                {recentList.slice(0, 12).map((item) => {
                  const cc = findCourseById(courses, item.courseId)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openSavedChat(item.id)}
                        className={`w-full rounded-md px-2 py-1.5 text-left ${
                          item.id === chatId ? 'bg-white font-medium shadow-sm' : 'hover:bg-white/80'
                        }`}
                        title={item.title}
                      >
                        <span className="block truncate text-sm">{item.title}</span>
                        {cc && (
                          <span className="block truncate text-[10px] text-slate-500">{cc.code}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="w-full max-w-none">
              <h1 className="text-lg font-bold text-usf-green sm:text-xl">Study Hub</h1>
              <p className="text-sm text-slate-600">
                Choose chapter and topic, then start the tutor. Answers use your uploaded textbook chunks for{' '}
                <span className="font-medium text-slate-800">{course?.title}</span> only.
              </p>
              {outlineError && (
                <p className="mt-2 text-xs text-amber-800" role="status">
                  Could not refresh outline ({outlineError}). Using catalog data.
                </p>
              )}
              {outlineLoading && (
                <p className="mt-1 text-xs text-slate-500">Updating chapter list from server…</p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-medium text-slate-600">
                  Chapter
                  <select
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    disabled={!chaptersList.length}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
                  >
                    {chaptersList.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                  Topic
                  <select
                    value={topicChoice}
                    onChange={(e) => setTopicChoice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
                    disabled={!chapter}
                  >
                    {(chapter?.topics ?? []).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={runExplain}
                  disabled={!!loading}
                  className="rounded-xl bg-usf-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-usf-green-dark disabled:opacity-50"
                >
                  {loading === 'explain' ? 'Teaching…' : 'Start teaching this topic'}
                </button>
                <Link
                  to="/analytics"
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  View analytics
                </Link>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
            <div className="flex min-h-0 w-full flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-5">
              {error && (
                <div
                  className="mb-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-5 pr-1">
                {messages.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-600 sm:px-10 sm:py-12">
                    <p className="text-base leading-relaxed">
                      Select your course context, then tap{' '}
                      <strong className="text-usf-green">Start teaching this topic</strong> to load an explanation.
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      On larger screens, follow-up ideas from the tutor appear in the <strong className="font-medium text-slate-700">Suggested prompts</strong> panel on the right.
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[min(100%,48rem)] rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-sm sm:text-base ${
                        m.role === 'user'
                          ? 'bg-usf-green text-white'
                          : 'border border-slate-100/80 bg-white text-slate-800 shadow-[0_2px_12px_rgba(15,23,42,0.06)]'
                      }`}
                    >
                      {m.role === 'assistant' ? (
                        <AssistantMarkdown content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile / narrow: prompts above composer so center stays wide on lg+ */}
              {suggestedPrompts.length > 0 && (
                <div className="shrink-0 border-t border-slate-200 bg-white/95 py-3 lg:hidden">
                  <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">Suggested prompts</p>
                  <div className="mt-2 max-h-32 space-y-2 overflow-y-auto">
                    {suggestedPrompts.map((p, idx) => (
                      <button
                        key={`m-${idx}-${p.slice(0, 48)}`}
                        type="button"
                        onClick={() => runAsk(p)}
                        disabled={!!loading}
                        className="w-full rounded-xl border border-usf-green/25 bg-usf-green-light/80 px-3 py-2.5 text-left text-sm font-medium text-usf-green transition hover:border-usf-green hover:bg-usf-green hover:text-white disabled:opacity-50"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz scores: visible when right rail is hidden (below lg) */}
              <div className="shrink-0 border-t border-slate-200 bg-white/95 py-3 lg:hidden">
                <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">Recent quiz scores</p>
                <ul className="mt-2 max-h-28 space-y-2 overflow-y-auto text-xs text-slate-600">
                  {quizScores.length === 0 && <li className="text-slate-500">No quizzes yet</li>}
                  {quizScores.map((q) => (
                    <li key={q.id} className="rounded-md bg-slate-50 px-2 py-2 shadow-sm ring-1 ring-slate-100">
                      <span className="font-semibold text-usf-green">{q.score}</span>{' '}
                      <span className="text-slate-500">{q.course}</span>
                      <br />
                      <span className="line-clamp-2">{q.topic}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <form onSubmit={handleSend} className="shrink-0 border-t border-slate-200 bg-white py-4">
                <label htmlFor="chat-input" className="sr-only">
                  Message
                </label>
                <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-inner focus-within:ring-2 focus-within:ring-usf-green/30">
                  <textarea
                    id="chat-input"
                    rows={3}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about this course…"
                    className="min-h-[5rem] flex-1 resize-y bg-transparent px-2 py-1.5 text-base text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!!loading || !input.trim()}
                    className="h-11 shrink-0 self-end rounded-xl bg-usf-green px-5 text-sm font-semibold text-white transition hover:bg-usf-green-dark disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right: suggested prompts + quiz scores (lg+) */}
        <aside className="hidden min-h-0 w-60 shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-slate-50/95 lg:flex lg:border-l lg:border-t-0 xl:w-72">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-200/80">
            <div className="shrink-0 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">Suggested prompts</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Tap a follow-up after each tutor reply. Keeps the main chat open for reading.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {suggestedPrompts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-3 py-4 text-sm leading-relaxed text-slate-500">
                  Start the tutor or ask a question — ideas to go deeper will show up here.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {suggestedPrompts.map((p, idx) => (
                    <li key={`r-${idx}-${p.slice(0, 48)}`}>
                      <button
                        type="button"
                        onClick={() => runAsk(p)}
                        disabled={!!loading}
                        className="w-full rounded-xl border border-usf-green/20 bg-white px-3 py-3 text-left text-sm font-medium leading-snug text-slate-800 shadow-sm transition hover:border-usf-green hover:bg-usf-green hover:text-white disabled:opacity-50"
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-h-0 shrink-0 flex-col border-t border-slate-200/60 bg-slate-50/90 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">Recent quiz scores</p>
            <ul className="mt-2 max-h-[min(12rem,35vh)] space-y-2 overflow-y-auto text-[11px] leading-snug text-slate-600">
              {quizScores.length === 0 && <li className="text-slate-500">No quizzes yet</li>}
              {quizScores.map((q) => (
                <li key={q.id} className="rounded-md bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-100">
                  <span className="font-semibold text-usf-green">{q.score}</span>{' '}
                  <span className="text-slate-500">{q.course}</span>
                  <br />
                  <span className="line-clamp-2">{q.topic}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </PageShell>
  )
}

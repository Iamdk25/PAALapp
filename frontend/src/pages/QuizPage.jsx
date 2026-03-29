import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { findCourseById } from '../data/courses'
import { postChat } from '../lib/api'
import { useCourses } from '../hooks/useCourses'
import { useCourseOutline } from '../hooks/useCourseOutline'
import { usePaalApi } from '../hooks/usePaalApi'
import {
  normalizeAgentOutput,
  normalizeFeedbackMarkdown,
  parseGradePayload,
  parseQuizPayload,
} from '../lib/parseAgent'
import { appendQuizAttempt, loadQuizHistory } from '../lib/storage'
import { AssistantMarkdown } from '../components/AssistantMarkdown'

const difficulties = ['Easy', 'Medium', 'Hard', 'Mixed']

function IconCheck({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function IconX({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function normTf(v) {
  if (v === true) return 'true'
  if (v === false) return 'false'
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  if (s === 'true' || s === 't') return 'true'
  if (s === 'false' || s === 'f') return 'false'
  return s
}

function itemAtGrade(items, idx) {
  if (!items?.length) return null
  const hit = items.find((x) => x.index === idx)
  if (hit) return hit
  return items[idx] ?? null
}

/** After submit: MC/TF from keys; SA from grader `items` when present. */
function getQuestionOutcome(q, userAnswer, gradeItems, idx) {
  const qt = q.type === 'tf' || q.type === 'sa' ? q.type : 'mc'
  const item = itemAtGrade(gradeItems, idx)

  if (qt === 'sa') {
    if (item && typeof item.correct === 'boolean') {
      return {
        correct: item.correct,
        correctLabel: (item.correctAnswer || q.sample_answer || '').trim() || 'See feedback below.',
      }
    }
    return { correct: null, correctLabel: (q.sample_answer || '').trim() }
  }

  if (qt === 'mc') {
    const u = String(userAnswer || '').trim().toUpperCase()
    const c = String(q.correct || '').trim().toUpperCase()
    const ok = u.length > 0 && c.length > 0 && u === c
    const letter = c || '?'
    const optText = q.options?.[letter] ?? q.options?.[letter.toLowerCase()]
    const correctLabel = optText ? `${letter} — ${optText}` : letter
    return { correct: ok, correctLabel }
  }

  const ok = normTf(userAnswer) === normTf(q.correct)
  const correctLabel = normTf(q.correct) === 'true' ? 'True' : 'False'
  return { correct: ok, correctLabel }
}

function answerComplete(q, val) {
  const t = q?.type === 'tf' || q?.type === 'sa' || q?.type === 'mc' ? q.type : 'mc'
  if (t === 'mc') return typeof val === 'string' && /^[A-D]$/i.test(String(val).trim())
  if (t === 'tf') return val === 'true' || val === 'false'
  if (t === 'sa') return typeof val === 'string' && val.trim().length > 0
  return false
}

export default function QuizPage() {
  const { getToken } = usePaalApi()
  const { courses, loading: coursesLoading, error: coursesError, refetch } = useCourses()
  const [searchParams] = useSearchParams()
  const qpCourse = searchParams.get('course')
  const qpTopic = searchParams.get('topic')

  const [courseId, setCourseId] = useState(null)

  useEffect(() => {
    if (!courses.length) return
    if (courseId && findCourseById(courses, courseId)) return
    const hit = qpCourse ? findCourseById(courses, qpCourse) : null
    setCourseId(hit ? hit.id : courses[0].id)
  }, [courses, courseId, qpCourse])

  const course = useMemo(() => (courseId ? findCourseById(courses, courseId) : null), [courses, courseId])
  const apiCourse = course?.pineconeCourse ?? ''

  const { chapters: outlineChapters, loading: outlineLoading, error: outlineError } =
    useCourseOutline(courseId)

  const chaptersList = useMemo(() => {
    if (outlineChapters.length) return outlineChapters
    return course?.chapters ?? []
  }, [outlineChapters, course?.chapters])

  const [chapterId, setChapterId] = useState('')
  const [topicChoice, setTopicChoice] = useState('')

  const urlPrefillConsumed = useRef(false)

  useEffect(() => {
    urlPrefillConsumed.current = false
  }, [qpCourse, qpTopic, courseId])

  useEffect(() => {
    if (!chaptersList.length) return
    setChapterId((prev) => {
      if (prev && chaptersList.some((c) => c.id === prev)) return prev
      return chaptersList[0].id
    })
  }, [courseId, chaptersList])

  useEffect(() => {
    if (!chaptersList.length || !qpTopic?.trim() || urlPrefillConsumed.current) return
    if (qpCourse && courseId !== qpCourse) return
    const parts = qpTopic.split(/\s[—–-]\s/)
    if (parts.length < 2) return
    const chapterTitle = parts[0].trim()
    const topicPart = parts.slice(1).join(' — ').trim()
    const ch = chaptersList.find(
      (c) => c.title === chapterTitle || c.title.trim() === chapterTitle,
    )
    if (!ch) return
    const tops = ch.topics?.length ? ch.topics : ['General']
    urlPrefillConsumed.current = true
    setChapterId(ch.id)
    setTopicChoice(tops.includes(topicPart) ? topicPart : tops[0] ?? topicPart)
  }, [chaptersList, qpTopic, qpCourse, courseId])

  useEffect(() => {
    const ch = chaptersList.find((c) => c.id === chapterId) ?? chaptersList[0]
    if (!ch) return
    const tops = ch.topics?.length ? ch.topics : ['General']
    setTopicChoice((prev) => (tops.includes(prev) ? prev : tops[0] ?? ''))
  }, [chapterId, chaptersList])

  const chapter = useMemo(
    () => chaptersList.find((c) => c.id === chapterId) ?? chaptersList[0],
    [chaptersList, chapterId],
  )

  const sessionTopicLabel = useMemo(() => {
    if (!chapter) return `${course?.title ?? 'Course'} — General`
    const tops = chapter.topics?.length ? chapter.topics : ['General']
    const t = topicChoice || tops[0] || 'General'
    return `${chapter.title} — ${t}`
  }, [chapter, topicChoice, course?.title])

  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState('Medium')
  const [mc, setMc] = useState(true)
  const [tf, setTf] = useState(false)
  const [sa, setSa] = useState(false)

  const [quizRaw, setQuizRaw] = useState('')
  const [questions, setQuestions] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState('')
  const [gradeResult, setGradeResult] = useState(null)
  const [history, setHistory] = useState(() => loadQuizHistory())

  const setAnswer = (idx, value) => {
    setAnswers((prev) => ({ ...prev, [idx]: value }))
  }

  const generate = async () => {
    if (!apiCourse) {
      setError('Select a course with uploaded materials.')
      return
    }
    if (!mc && !tf && !sa) {
      setError('Select at least one question type.')
      return
    }
    setError('')
    setGradeResult(null)
    setAnswers({})
    setLoading(true)
    try {
      const raw = await postChat(
        {
          action: 'quiz',
          topic: sessionTopicLabel,
          course: apiCourse,
          chat_history: [],
          quiz_options: {
            num_questions: numQuestions,
            multiple_choice: mc,
            true_false: tf,
            short_answer: sa,
            difficulty,
          },
        },
        getToken,
      )
      const qs = parseQuizPayload(raw)
      setQuizRaw(raw)
      if (!qs || !qs.length) {
        setQuestions(null)
        setError('The tutor returned text we could not parse as a quiz. Try again or shorten the topic.')
      } else {
        setQuestions(qs)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate quiz')
      setQuestions(null)
    } finally {
      setLoading(false)
    }
  }

  const submitGrade = async () => {
    if (!questions || !quizRaw) return
    setError('')
    setGrading(true)
    setGradeResult(null)
    try {
      const answered = questions.map((q, i) => answers[i] ?? '')
      const submission = {
        studentAnswers: answered,
        difficulty,
        topic: sessionTopicLabel,
      }
      const chat_history = [
        { role: 'assistant', content: quizRaw },
        { role: 'user', content: `Submission JSON: ${JSON.stringify(submission)}` },
      ]
      const raw = await postChat(
        {
          action: 'grade_quiz',
          topic: JSON.stringify(submission),
          course: apiCourse,
          chat_history,
        },
        getToken,
      )
      const parsed = parseGradePayload(raw)
      if (parsed) {
        setGradeResult({ ...parsed, raw })
        appendQuizAttempt({
          course: course?.code ?? apiCourse,
          topic: sessionTopicLabel,
          score: parsed.score,
          feedback: parsed.feedback,
        })
        setHistory(loadQuizHistory())
      } else {
        const fb = normalizeFeedbackMarkdown(normalizeAgentOutput(raw))
        setGradeResult({ score: '—', feedback: fb, reviewTopics: [], items: [], raw })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grading failed')
    } finally {
      setGrading(false)
    }
  }

  const allAnswered =
    questions && questions.length > 0 && questions.every((q, i) => answerComplete(q, answers[i]))

  if (coursesLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[40vh] items-center justify-center text-slate-600">Loading courses…</div>
      </PageShell>
    )
  }

  if (coursesError) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-red-800">{coursesError}</p>
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
      <PageShell>
        <div className="mx-auto max-w-lg px-6 py-16 text-center text-slate-700">
          <p className="font-semibold text-usf-green">No courses available</p>
          <p className="mt-2 text-sm text-slate-600">Please check back later.</p>
        </div>
      </PageShell>
    )
  }

  const topicOptions = chapter?.topics?.length ? chapter.topics : ['General']

  return (
    <PageShell>
      <section className="bg-usf-green py-10 text-center text-white sm:py-14">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-usf-gold text-2xl text-usf-green-dark">
            📜
          </div>
          <h1 className="text-3xl font-bold">Quiz generator</h1>
          <p className="mt-2 text-white/90">Personalized practice for your USF courses — then score and review weak spots.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-portal lg:col-span-2">
          <h2 className="text-lg font-bold text-usf-green">Configure your quiz</h2>
          <p className="mt-1 text-sm text-slate-600">
            Questions are drawn from the materials available for the course you select. Chapter and topic match Study Hub.
          </p>

          <label className="mt-5 block text-sm font-medium text-slate-700">
            Course
            <select
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </label>

          {outlineError && (
            <p className="mt-2 text-xs text-amber-800" role="status">
              Could not refresh outline ({outlineError}). Using catalog data.
            </p>
          )}
          {outlineLoading && (
            <p className="mt-1 text-xs text-slate-500">Updating chapter list from server…</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-1">
            <label className="block text-sm font-medium text-slate-700">
              Chapter
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                disabled={!chaptersList.length}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:opacity-60"
              >
                {chaptersList.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Topic
              <select
                value={topicChoice}
                onChange={(e) => setTopicChoice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:opacity-60"
                disabled={!chapter}
              >
                {topicOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Questions: {numQuestions}
            <input
              type="range"
              min={3}
              max={15}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="mt-2 w-full accent-usf-green"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Difficulty
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {difficulties.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-700">Question types</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={mc} onChange={(e) => setMc(e.target.checked)} />
                Multiple choice
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={tf} onChange={(e) => setTf(e.target.checked)} />
                True / false
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={sa} onChange={(e) => setSa(e.target.checked)} />
                Short answer
              </label>
            </div>
          </fieldset>

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-usf-green py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-usf-green-dark disabled:opacity-50"
          >
            {loading ? 'Generating…' : '✨ Generate quiz'}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-slate-500">
            Prefer a guided session first?{' '}
            <Link to="/learn" className="font-semibold text-usf-green hover:underline">
              Open Study Hub
            </Link>
          </p>
        </section>

        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-portal">
            <h2 className="text-lg font-bold text-usf-green">Preview</h2>
            {!questions && (
              <p className="mt-4 text-sm text-slate-600">Generate a quiz to see questions here.</p>
            )}
            {questions && (
              <div className="mt-4 space-y-6">
                {questions.map((q, idx) => {
                  const qt = q.type === 'tf' || q.type === 'sa' ? q.type : 'mc'
                  const graded = !!gradeResult
                  const outcome = graded
                    ? getQuestionOutcome(q, answers[idx], gradeResult?.items, idx)
                    : null
                  let cardClass =
                    'rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition-colors'
                  if (graded && outcome) {
                    if (outcome.correct === true) {
                      cardClass =
                        'rounded-xl border-2 border-emerald-400/90 bg-emerald-50/50 p-4 shadow-sm ring-1 ring-emerald-100'
                    } else if (outcome.correct === false) {
                      cardClass =
                        'rounded-xl border-2 border-red-400/90 bg-red-50/40 p-4 shadow-sm ring-1 ring-red-100'
                    } else {
                      cardClass =
                        'rounded-xl border-2 border-amber-300/90 bg-amber-50/40 p-4 shadow-sm ring-1 ring-amber-100'
                    }
                  }

                  const correctMc = String(q.correct || '')
                    .trim()
                    .toUpperCase()

                  return (
                    <div key={idx} className={cardClass}>
                      <div className="flex items-start gap-3">
                        {graded && outcome?.correct === true && (
                          <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-md shadow-emerald-200/50 ring-2 ring-white"
                            title="Correct"
                          >
                            <IconCheck className="h-5 w-5" />
                          </span>
                        )}
                        {graded && outcome?.correct === false && (
                          <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-md shadow-red-200/50 ring-2 ring-white"
                            title="Incorrect"
                          >
                            <IconX className="h-5 w-5" />
                          </span>
                        )}
                        {graded && outcome?.correct === null && (
                          <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 ring-2 ring-white"
                            title="Review in feedback"
                          >
                            <span className="text-sm font-bold">?</span>
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-usf-green">
                            Question {idx + 1} of {questions.length}
                            <span className="ml-2 font-normal text-slate-500">
                              {qt === 'mc'
                                ? 'Multiple choice'
                                : qt === 'tf'
                                  ? 'True / false'
                                  : 'Short answer'}
                            </span>
                          </p>
                          <p className="mt-2 font-medium text-slate-900">{q.question}</p>
                        </div>
                      </div>

                      {qt === 'mc' && q.options && (
                        <ul className="mt-3 space-y-2">
                          {Object.entries(q.options).map(([letter, label]) => {
                            const L = letter.toUpperCase()
                            const picked = String(answers[idx] || '').toUpperCase() === L
                            const isKey = L === correctMc
                            let rowClass =
                              'flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition'
                            if (graded) {
                              if (isKey) {
                                rowClass +=
                                  ' border-emerald-400 bg-emerald-50/90 ring-1 ring-emerald-200/80'
                              } else if (picked && !isKey) {
                                rowClass +=
                                  ' border-red-400 bg-red-50/90 ring-1 ring-red-200/80'
                              } else {
                                rowClass += ' border-slate-100 bg-white/60 text-slate-500'
                              }
                            } else if (picked) {
                              rowClass +=
                                ' border-usf-green bg-usf-green-light font-medium text-usf-green-dark'
                            } else {
                              rowClass += ' border-slate-200 bg-white hover:border-usf-green/40'
                            }
                            return (
                              <li key={letter}>
                                {graded ? (
                                  <div className={rowClass}>
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-800">
                                      {letter}
                                    </span>
                                    <span className="min-w-0 flex-1">{label}</span>
                                    {isKey && (
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-200/80 text-emerald-800">
                                        <IconCheck className="h-4 w-4" />
                                      </span>
                                    )}
                                    {picked && !isKey && (
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-200/80 text-red-800">
                                        <IconX className="h-4 w-4" />
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setAnswer(idx, letter)}
                                    className={rowClass}
                                  >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                                      {letter}
                                    </span>
                                    <span className="flex-1">{label}</span>
                                  </button>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}

                      {qt === 'tf' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            { v: 'true', label: 'True' },
                            { v: 'false', label: 'False' },
                          ].map(({ v, label }) => {
                            const picked = answers[idx] === v
                            const isKey = normTf(q.correct) === v
                            let rowClass =
                              'rounded-lg border px-4 py-2.5 text-sm font-medium transition'
                            if (graded) {
                              if (isKey) {
                                rowClass +=
                                  ' border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200'
                              } else if (picked && !isKey) {
                                rowClass += ' border-red-400 bg-red-50 ring-1 ring-red-200'
                              } else {
                                rowClass += ' border-slate-100 bg-white/60 text-slate-500'
                              }
                            } else if (picked) {
                              rowClass +=
                                ' border-usf-green bg-usf-green-light text-usf-green-dark'
                            } else {
                              rowClass += ' border-slate-200 bg-white hover:border-usf-green/40'
                            }
                            return graded ? (
                              <div
                                key={v}
                                className={`inline-flex items-center gap-2 ${rowClass}`}
                              >
                                {label}
                                {isKey && (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-200/80">
                                    <IconCheck className="h-4 w-4 text-emerald-800" />
                                  </span>
                                )}
                                {picked && !isKey && (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-200/80">
                                    <IconX className="h-4 w-4 text-red-800" />
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setAnswer(idx, v)}
                                className={rowClass}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {qt === 'sa' && (
                        <textarea
                          value={answers[idx] ?? ''}
                          onChange={(e) => setAnswer(idx, e.target.value)}
                          readOnly={graded}
                          rows={4}
                          placeholder="Type your answer…"
                          className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                            graded
                              ? outcome?.correct === true
                                ? 'border-emerald-400 bg-white ring-emerald-300'
                                : outcome?.correct === false
                                  ? 'border-red-400 bg-red-50/50 ring-red-200'
                                  : 'border-amber-300 bg-amber-50/30 ring-amber-200'
                              : 'border-slate-200 bg-white focus:border-usf-green focus:ring-usf-green'
                          }`}
                        />
                      )}

                      {graded && outcome?.correct === false && (
                        <div className="mt-3 rounded-lg border border-red-300/90 bg-red-50/90 px-3 py-2.5 text-sm text-red-950 shadow-sm">
                          <span className="font-semibold">Correct answer: </span>
                          <span>{outcome.correctLabel}</span>
                        </div>
                      )}
                      {graded && qt === 'sa' && outcome?.correct === null && (
                        <p className="mt-2 text-xs text-amber-900">
                          Short-answer scoring is included in the feedback summary below.
                        </p>
                      )}
                    </div>
                  )
                })}
                {!gradeResult ? (
                  <button
                    type="button"
                    onClick={submitGrade}
                    disabled={grading || !allAnswered}
                    className="w-full rounded-xl bg-usf-green py-3 text-sm font-semibold text-white transition hover:bg-usf-green-dark disabled:opacity-40"
                  >
                    {grading ? 'Grading…' : 'Submit for feedback'}
                  </button>
                ) : (
                  <p className="text-center text-sm text-slate-600">
                    Adjust sliders and tap <span className="font-semibold text-usf-green">Generate quiz</span> to
                    try another set.
                  </p>
                )}
              </div>
            )}

            {gradeResult && (
              <div className="mt-6 rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white p-5 shadow-sm ring-1 ring-emerald-100/60">
                <p className="text-lg font-bold text-usf-green">Score: {gradeResult.score}</p>
                <div className="mt-4 border-t border-emerald-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback</p>
                  <div className="mt-2 text-slate-800">
                    <AssistantMarkdown
                      content={gradeResult.feedback?.trim() || '_No feedback was returned._'}
                    />
                  </div>
                </div>
                {gradeResult.reviewTopics?.length > 0 && (
                  <div className="mt-4 border-t border-emerald-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Topics to review
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {gradeResult.reviewTopics.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-portal">
            <h2 className="text-lg font-bold text-usf-green">Recent quizzes</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {history.slice(0, 6).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{h.course}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{h.topic}</p>
                  </div>
                  <span className="rounded-full bg-usf-green-light px-3 py-1 text-xs font-bold text-usf-green">
                    {h.score}
                  </span>
                </li>
              ))}
              {history.length === 0 && <li className="py-4 text-slate-500">No attempts saved on this device yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </PageShell>
  )
}

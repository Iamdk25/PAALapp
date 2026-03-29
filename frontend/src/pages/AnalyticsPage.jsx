import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { PageShell } from '../components/PageShell'
import { useCourses } from '../hooks/useCourses'
import { postChat } from '../lib/api'
import { usePaalApi } from '../hooks/usePaalApi'
import { parseProgressPayload } from '../lib/parseAgent'
import { loadChats, loadQuizHistory } from '../lib/storage'
import { usePaalStorageScope } from '../providers/StorageScopeProvider.jsx'

export default function AnalyticsPage() {
  const { scopeId } = usePaalStorageScope()
  const { getToken } = usePaalApi()
  const { courses: catalogCourses } = useCourses()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [insight, setInsight] = useState(null)

  const quizzes = useMemo(() => loadQuizHistory(scopeId), [scopeId])
  const chats = useMemo(() => Object.values(loadChats(scopeId)), [scopeId])

  const scoreRatios = useMemo(() => {
    return quizzes
      .map((q) => {
        const m = String(q.score || '').match(/^(\d+)\s*\/\s*(\d+)/)
        if (!m) return null
        return Number(m[1]) / Number(m[2])
      })
      .filter((n) => n != null)
  }, [quizzes])

  const avg =
    scoreRatios.length > 0 ? scoreRatios.reduce((a, b) => a + b, 0) / scoreRatios.length : null

  const refresh = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const lines = []
      for (const c of chats.slice(0, 5)) {
        for (const m of (c.messages || []).slice(-4)) {
          lines.push({ role: m.role, content: m.content?.slice(0, 500) ?? '' })
        }
      }
      for (const q of quizzes.slice(0, 8)) {
        lines.push({
          role: 'user',
          content: `Quiz on ${q.topic}: scored ${q.score}.`,
        })
      }
      const raw = await postChat(
        {
          action: 'progress',
          topic: '',
          course: 'analytics',
          chat_history: lines.slice(-35),
        },
        getToken,
      )
      const parsed = parseProgressPayload(raw)
      setInsight(
        parsed ?? {
          overall_strength: 'See narrative',
          strengths: [],
          weaknesses: [],
          recommendations: [],
          encouragement: raw,
        },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load analytics')
      setInsight(null)
    } finally {
      setLoading(false)
    }
  }, [chats, quizzes, getToken])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <PageShell>
      <section className="border-b border-slate-200 bg-gradient-to-br from-usf-green-light to-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-3xl font-bold text-usf-green">Analytics</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Quiz history on this device plus recent Study Hub threads feed a progress snapshot from the analytics agent.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-xl bg-usf-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-usf-green-dark disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh insights'}
            </button>
            <Link
              to="/learn"
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Back to Study Hub
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-portal lg:col-span-2">
            <h2 className="text-lg font-bold text-usf-green">AI study summary</h2>
            {insight && (
              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Overall: </span>
                  <ReactMarkdown components={{ p: 'span' }}>{insight.overall_strength}</ReactMarkdown>
                </p>
                {insight.strengths?.length > 0 && (
                  <div>
                    <p className="font-semibold text-usf-green">Strengths</p>
                    <ul className="mt-1 list-disc pl-5">
                      {insight.strengths.map((s, idx) => (
                        <li key={idx}><ReactMarkdown components={{ p: 'span' }}>{s}</ReactMarkdown></li>
                      ))}
                    </ul>
                  </div>
                )}
                {insight.weaknesses?.length > 0 && (
                  <div>
                    <p className="font-semibold text-usf-green">Focus areas</p>
                    <ul className="mt-1 list-disc pl-5">
                      {insight.weaknesses.map((s, idx) => (
                        <li key={idx}><ReactMarkdown components={{ p: 'span' }}>{s}</ReactMarkdown></li>
                      ))}
                    </ul>
                  </div>
                )}
                {insight.recommendations?.length > 0 && (
                  <div>
                    <p className="font-semibold text-usf-green">Next steps</p>
                    <ul className="mt-1 list-disc pl-5">
                      {insight.recommendations.map((s, idx) => (
                        <li key={idx}><ReactMarkdown components={{ p: 'span' }}>{s}</ReactMarkdown></li>
                      ))}
                    </ul>
                  </div>
                )}
                {insight.encouragement && (
                  <div className="rounded-lg bg-slate-50 p-3 italic">
                    <ReactMarkdown components={{ p: 'span' }}>{insight.encouragement}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
            {!insight && !loading && !error && <p className="mt-4 text-sm text-slate-600">No insight yet.</p>}
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-portal">
              <h2 className="text-lg font-bold text-usf-green">Quiz performance</h2>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {avg === null ? '—' : `${Math.round(avg * 100)}%`}
              </p>
              <p className="text-xs text-slate-500">Approx. average from recorded scores on this browser.</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-usf-green transition-all"
                  style={{ width: avg === null ? '0%' : `${Math.min(100, Math.round(avg * 100))}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-portal">
              <h2 className="text-lg font-bold text-usf-green">Courses in catalog</h2>
              <p className="mt-2 text-2xl font-bold text-slate-900">{catalogCourses.length}</p>
              <p className="text-xs text-slate-500">Courses available in PAAL right now.</p>
            </div>
          </section>
        </div>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-portal">
          <h2 className="text-lg font-bold text-usf-green">Quiz history</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4">Course</th>
                  <th className="pb-2 pr-4">Topic</th>
                  <th className="pb-2 pr-4">Score</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-slate-500">
                      Take a quiz to populate this table.
                    </td>
                  </tr>
                )}
                {quizzes.map((q) => (
                  <tr key={q.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium text-slate-900">{q.course}</td>
                    <td className="max-w-xs truncate py-3 pr-4 text-slate-600" title={q.topic}>
                      {q.topic}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-usf-green">{q.score}</td>
                    <td className="py-3 text-slate-500">{new Date(q.at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  )
}

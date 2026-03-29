import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { useCourses } from '../hooks/useCourses'

export default function CoursesPage() {
  const { courses, loading, error, refetch } = useCourses()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return courses
    return courses.filter(
      (c) =>
        String(c.code).toLowerCase().includes(s) ||
        String(c.title).toLowerCase().includes(s) ||
        String(c.dept).toLowerCase().includes(s) ||
        String(c.pineconeCourse).toLowerCase().includes(s),
    )
  }, [q, courses])

  return (
    <PageShell>
      <section className="bg-usf-green py-12 text-center text-white sm:py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-bold sm:text-4xl">Browse USF courses</h1>
          <p className="mt-3 text-base text-white/90">
            Open a course to study with PAAL—explanations, notes, and practice built from your course materials.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl -mt-8 px-6 pb-16">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}{' '}
            <button type="button" onClick={() => refetch()} className="font-semibold text-usf-green underline">
              Retry
            </button>
          </div>
        )}
        {loading && <p className="mb-6 text-center text-slate-600">Loading courses…</p>}
        <div className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-portal-lg">
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by course code or name…"
            className="w-full rounded-xl border-0 bg-transparent py-4 pl-12 pr-4 text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search courses"
          />
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <article
              key={c.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-usf-green/40 hover:shadow-portal"
            >
              <p className="font-semibold tabular-nums tracking-wide text-usf-green">{c.code}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-slate-900">{c.title}</h2>
              {c.dept ? (
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">{c.dept}</p>
              ) : null}
              <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">{c.description}</p>
              <Link
                to={`/learn?course=${c.id}`}
                className="mt-6 block w-full rounded-xl bg-usf-green py-3 text-center text-sm font-semibold text-white transition hover:bg-usf-green-dark"
              >
                Start learning
              </Link>
            </article>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="mt-12 text-center text-slate-600">
            {courses.length === 0 ? 'No courses are available yet. Please check back soon.' : 'No courses match your search.'}
          </p>
        )}
      </section>
    </PageShell>
  )
}

import { Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { useCourses } from '../hooks/useCourses'

const features = [
  {
    title: 'Instant concept help',
    text: '24/7 tutor for any topic in your enrolled USF courses — no hunting for PDFs.',
  },
  {
    title: 'Auto-generated quizzes',
    text: 'Practice with questions aligned to what you are studying right now.',
  },
  {
    title: 'Smart study dashboard',
    text: 'See quiz trends, strengths, and what to review next — all in one place.',
  },
  {
    title: 'Adaptive learning',
    text: 'Explanations and follow-ups adjust to your level as you keep chatting.',
  },
  {
    title: 'Lightning fast',
    text: 'Promptless shortcuts and smart chips so you stay in flow.',
  },
  {
    title: 'Study history',
    text: 'Pick up any course thread, notes draft, or practice set where you left off.',
  },
]

export default function HomePage() {
  const { courses, loading, error } = useCourses()
  const featured = courses.slice(0, 4)

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-usf-green sm:text-5xl">
              Ace your USF classes with AI
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Your personalized, promptless study assistant — pick a course, a chapter, and a topic. PAAL teaches,
              quizzes, and summarizes with USF-first context.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/learn"
                className="inline-flex items-center justify-center rounded-xl bg-usf-green px-6 py-3 text-sm font-semibold text-white shadow-portal transition hover:bg-usf-green-dark"
              >
                Start learning
              </Link>
              <Link
                to="/courses"
                className="inline-flex items-center justify-center rounded-xl border-2 border-usf-green px-6 py-3 text-sm font-semibold text-usf-green transition hover:bg-usf-green-light"
              >
                Browse courses
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-usf-green-light to-white p-6 shadow-portal-lg">
            <div className="rounded-xl bg-white p-4 shadow-portal">
              <p className="text-xs font-semibold uppercase tracking-wide text-usf-green">PAAL assistant</p>
              <p className="mt-3 text-sm text-slate-700">
                I will walk you through your topic using <span className="font-medium text-slate-900">only your uploaded textbook</span>{' '}
                for the course you select. Tap a suggested question below or type your own.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-usf-green-light px-3 py-1 text-xs font-medium text-usf-green">
                  Show a worked example
                </span>
                <span className="rounded-full bg-usf-green-light px-3 py-1 text-xs font-medium text-usf-green">
                  Generate a practice quiz
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/80 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-usf-green sm:text-3xl">Everything you need to succeed</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600">
            Built for how USF students actually study — fast sessions, clear feedback, and zero prompt engineering.
          </p>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-portal"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-usf-green text-sm text-white">
                  ✓
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold text-usf-green sm:text-3xl">Find your course</h2>
        <p className="mt-2 text-slate-600">Jump into a course you&apos;re taking—PAAL uses your official materials to help you study.</p>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {loading && <p className="mt-8 text-center text-slate-500">Loading courses…</p>}
        {!loading && !featured.length && (
          <p className="mt-8 text-center text-sm text-slate-600">No courses to show yet. Please check back soon.</p>
        )}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((c) => (
            <Link
              key={c.id}
              to={`/learn?course=${c.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-usf-green hover:shadow-portal"
            >
              <p className="font-semibold tabular-nums text-usf-green">{c.code}</p>
              <p className="mt-1 font-semibold text-slate-900">{c.title}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-snug text-slate-600">{c.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/courses" className="text-sm font-semibold text-usf-green hover:underline">
            View all courses →
          </Link>
        </div>
      </section>

      <section className="bg-usf-green py-16 text-white">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Practice makes perfect</h2>
          <p className="mx-auto mt-2 max-w-xl text-white/90">
            Generate quizzes for any topic, get a score, and see exactly what to review before the exam.
          </p>
          <Link
            to="/quiz"
            className="mt-8 inline-flex rounded-xl bg-white px-8 py-3 text-sm font-semibold text-usf-green shadow-lg transition hover:bg-usf-green-light"
          >
            Open quiz generator
          </Link>
        </div>
      </section>
    </PageShell>
  )
}

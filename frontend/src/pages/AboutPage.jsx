import { PageShell } from '../components/PageShell'
import { Link } from 'react-router-dom'

const IconStudent = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
)
const IconAccess = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
)
const IconInnovation = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.2 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
)
const IconPrivacy = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
)

const values = [
  {
    title: 'Student-focused',
    text: 'Workflows mirror real study sessions — not generic chat demos.',
    icon: <IconStudent className="h-6 w-6" />,
  },
  {
    title: 'Accessible learning',
    text: 'Plain language, guided paths, and support for many learning styles.',
    icon: <IconAccess className="h-6 w-6" />,
  },
  {
    title: 'Innovation',
    text: 'Agents collaborate behind one simple experience tuned for freshmen.',
    icon: <IconInnovation className="h-6 w-6" />,
  },
  {
    title: 'Privacy first',
    text: 'Course context stays scoped to learning — review policies before sharing personal data.',
    icon: <IconPrivacy className="h-6 w-6" />,
  },
]

const differentiators = [
  {
    title: 'No complex prompts',
    text: 'PAAL stays promptless: chips and quick actions update as the tutor explains so you never stare at a blank box.',
    tone: 'bg-usf-green-dark text-white',
    icon: '★',
  },
  {
    title: 'USF course-specific',
    text: 'Study threads anchor to the course, chapter, and topic you select — not generic web answers.',
    tone: 'bg-usf-gold text-usf-green-dark',
    icon: '⚡',
  },
  {
    title: 'Built by students, for students',
    text: 'Designed around how Bulls actually prep: short bursts, quizzes, and printable notes.',
    tone: 'bg-usf-green-light text-usf-green',
    icon: '◎',
  },
  {
    title: 'Always improving',
    text: 'Progress and quiz analytics highlight what to study next as your semester evolves.',
    tone: 'bg-slate-200 text-slate-900',
    icon: '↻',
  },
]

export default function AboutPage() {
  return (
    <PageShell>
      <section className="bg-usf-green py-14 text-center text-white sm:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-bold sm:text-4xl">About PAAL</h1>
          <p className="mt-3 text-lg text-white/90">
            Empowering USF students with AI-powered learning tools that respect your time and your syllabus.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-usf-green">Our mission</h2>
        <p className="mt-4 text-left text-slate-600">
          PAAL bridges traditional coursework and modern AI assistance. We focus on USF-specific pathways — courses,
          chapters, and topics you actually take — so explanations, notes, and quizzes stay grounded in what your
          instructors expect.
        </p>
        <p className="mt-4 text-left text-slate-600">
          The goal is simple: make rigorous material accessible to every student, including those new to computer
          science or heavy STEM loads, without demanding technical prompt skills.
        </p>
        <div className="mt-10">
          <Link
            to="/learn"
            className="inline-flex rounded-xl bg-usf-green px-6 py-3 text-sm font-semibold text-white hover:bg-usf-green-dark"
          >
            Try the Study Hub
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/60 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-usf-green">Our values</h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <li key={v.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-usf-green text-white">
                  {v.icon}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-usf-green">Why PAAL is different</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {differentiators.map((d) => (
            <div key={d.title} className={`rounded-2xl p-8 shadow-portal ${d.tone}`}>
              <span className="text-2xl">{d.icon}</span>
              <h3 className="mt-4 text-xl font-bold">{d.title}</h3>
              <p className="mt-3 text-sm leading-relaxed opacity-95">{d.text}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  )
}

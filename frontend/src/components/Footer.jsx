import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-auto bg-usf-green text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold">PAAL</p>
          <p className="mt-2 text-sm text-white/85">
            Your AI-powered study partner at USF — personalized, promptless learning.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Quick links</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/" className="text-white/90 hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link to="/courses" className="text-white/90 hover:underline">
                Courses
              </Link>
            </li>
            <li>
              <Link to="/learn" className="text-white/90 hover:underline">
                Study Hub
              </Link>
            </li>
            <li>
              <Link to="/about" className="text-white/90 hover:underline">
                About
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/70">Contact</p>
          <p className="mt-3 text-sm text-white/85">
            University of South Florida
            <br />
            4202 E Fowler Ave, Tampa, FL
          </p>
          <p className="mt-2 text-sm">
            <a href="mailto:support@paal.app" className="text-usf-gold/95 underline-offset-2 hover:underline">
              support@paal.app
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-4 text-xs text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} PAAL · USF</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-white">Privacy</span>
            <span className="cursor-pointer hover:text-white">Terms</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

import { NavLink, Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { authDevBypass, clerkPublishableKey } from '../lib/authMode'

const linkBase =
  'rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-usf-green-light hover:text-usf-green'
const activeClass = 'bg-usf-green-light text-usf-green'

export function Navbar() {
  const showClerk = clerkPublishableKey && !authDevBypass

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="text-xl font-bold tracking-tight text-usf-green">
          PAAL
        </Link>

        <nav className="hidden flex-1 justify-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ''}`}>
            Home
          </NavLink>
          <NavLink to="/courses" className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ''}`}>
            Courses
          </NavLink>
          <NavLink to="/learn" className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ''}`}>
            Study Hub
          </NavLink>
          <NavLink to="/quiz" className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ''}`}>
            Quiz
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ''}`}>
            Analytics
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `${linkBase} ${isActive ? activeClass : ''}`}>
            About
          </NavLink>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {authDevBypass && (
            <span className="hidden max-w-[10rem] truncate text-[10px] text-amber-800 sm:inline">
              Dev: no Clerk key
            </span>
          )}
          {showClerk ? (
            <>
              <SignedOut>
                <Link
                  to="/sign-in"
                  className="rounded-lg border-2 border-usf-green px-4 py-2 text-sm font-semibold text-usf-green transition hover:bg-usf-green-light"
                >
                  Login
                </Link>
                <Link
                  to="/sign-up"
                  className="rounded-lg bg-usf-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-usf-green-dark"
                >
                  Sign up
                </Link>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          ) : !authDevBypass ? (
            <span className="text-xs text-red-600">Configure Clerk key</span>
          ) : (
            <span className="text-xs text-slate-500">Signed in (dev)</span>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden" aria-label="Mobile main">
        <NavLink to="/" end className={({ isActive }) => `${linkBase} whitespace-nowrap ${isActive ? activeClass : ''}`}>
          Home
        </NavLink>
        <NavLink to="/courses" className={({ isActive }) => `${linkBase} whitespace-nowrap ${isActive ? activeClass : ''}`}>
          Courses
        </NavLink>
        <NavLink to="/learn" className={({ isActive }) => `${linkBase} whitespace-nowrap ${isActive ? activeClass : ''}`}>
          Hub
        </NavLink>
        <NavLink to="/quiz" className={({ isActive }) => `${linkBase} whitespace-nowrap ${isActive ? activeClass : ''}`}>
          Quiz
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `${linkBase} whitespace-nowrap ${isActive ? activeClass : ''}`}>
          Stats
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `${linkBase} whitespace-nowrap ${isActive ? activeClass : ''}`}>
          About
        </NavLink>
      </nav>
    </header>
  )
}

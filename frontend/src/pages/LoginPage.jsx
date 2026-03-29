import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authDevBypass, clerkPublishableKey } from '../lib/authMode'
import { DEV_BEARER_KEY } from '../lib/paalApiConstants'

export default function LoginPage() {
  const navigate = useNavigate()
  const [devToken, setDevToken] = useState(() => sessionStorage.getItem(DEV_BEARER_KEY) || '')
  const showClerk = clerkPublishableKey && !authDevBypass

  const saveDevToken = () => {
    const v = devToken.trim()
    if (v) sessionStorage.setItem(DEV_BEARER_KEY, v)
    else sessionStorage.removeItem(DEV_BEARER_KEY)
  }

  const continueDev = () => {
    saveDevToken()
    navigate('/learn', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="bg-usf-green px-6 py-10 text-center text-white shadow-portal">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">PAAL</h1>
        <p className="mt-2 text-sm text-white/90">Connect to the tutor API with your account or a dev token.</p>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-portal">
          {showClerk && (
            <div className="space-y-4">
              <p className="text-center text-sm text-slate-600">
                Sign in with Clerk so the API can verify your session (<code className="text-xs">Authorization: Bearer</code>
                ) and attach chats to your user id.
              </p>
              <Link
                to="/sign-in"
                state={{ from: '/learn' }}
                className="flex w-full items-center justify-center rounded-xl bg-usf-green py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-usf-green-dark"
              >
                Sign in with Clerk
              </Link>
              <p className="text-center text-xs text-slate-500">
                New here?{' '}
                <Link to="/sign-up" state={{ from: '/learn' }} className="font-semibold text-usf-green hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          )}

          {authDevBypass && (
            <div className={showClerk ? 'mt-8 border-t border-slate-100 pt-8' : ''}>
              <p className="text-sm font-semibold text-usf-green">Local testing (no Clerk key)</p>
              <p className="mt-1 text-xs text-slate-600">
                When <code className="text-[11px]">CLERK_JWKS_URL</code> is unset on the API, any Bearer token works.
                Leave empty to use the default <code className="text-[11px]">local-dev-mock</code> token.
              </p>
              <label className="mt-4 block text-xs font-medium text-slate-700">
                Optional Bearer token (paste JWT to test real verification)
                <textarea
                  value={devToken}
                  onChange={(e) => setDevToken(e.target.value)}
                  rows={3}
                  placeholder="Token only — no 'Bearer ' prefix"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={continueDev}
                className="mt-4 w-full rounded-xl border-2 border-usf-green py-3 text-sm font-semibold text-usf-green transition hover:bg-usf-green-light"
              >
                Continue to Study Hub
              </button>
            </div>
          )}

          {!authDevBypass && !showClerk && (
            <p className="text-center text-sm text-slate-600">
              Add <code className="font-mono text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> to enable Clerk on this screen.
            </p>
          )}

          <p className="mt-8 text-center text-xs text-slate-500">
            <Link to="/" className="text-usf-green hover:underline">
              ← Back home
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

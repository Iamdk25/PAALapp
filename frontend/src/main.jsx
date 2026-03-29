import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'
import { PaalApiProvider } from './providers/PaalApiProvider.jsx'
import { authDevBypass, clerkPublishableKey } from './lib/authMode'

export function AppRoot() {
  const router = (
    <>
      {authDevBypass ? (
        <div
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950"
          role="status"
        >
          Development mode: Clerk is bypassed because{' '}
          <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> is missing. Protected routes still work locally.
        </div>
      ) : null}
      <BrowserRouter>
        <PaalApiProvider>
          <App />
        </PaalApiProvider>
      </BrowserRouter>
    </>
  )

  if (authDevBypass) return router
  if (clerkPublishableKey) {
    return <ClerkProvider publishableKey={clerkPublishableKey}>{router}</ClerkProvider>
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <p className="max-w-md text-slate-700">
        Add your Clerk publishable key to <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">.env</code>{' '}
        as{' '}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">VITE_CLERK_PUBLISHABLE_KEY</code>, then
        restart Vite.
      </p>
      <a href="https://dashboard.clerk.com" className="text-sm font-semibold text-usf-green hover:underline">
        Open Clerk dashboard
      </a>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)

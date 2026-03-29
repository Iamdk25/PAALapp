import { SignUp } from '@clerk/clerk-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { authDevBypass } from '../lib/authMode'

export default function SignUpPage() {
  const { state } = useLocation()
  const redirect = typeof state?.from === 'string' ? state.from : '/learn'

  if (authDevBypass) return <Navigate to="/learn" replace />

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link to="/" className="text-xl font-bold text-usf-green">
          PAAL
        </Link>
      </header>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
        <p className="mb-6 text-center text-sm text-slate-600">
          Create your PAAL account to sync progress across the Study Hub.
        </p>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl={redirect}
        />
      </div>
    </div>
  )
}

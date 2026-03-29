import { Navigate, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { authDevBypass } from '../lib/authMode'

function ClerkProtected({ children }) {
  const { pathname } = useLocation()
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace state={{ from: pathname }} />
      </SignedOut>
    </>
  )
}

export function ProtectedRoute({ children }) {
  if (authDevBypass) return children
  return <ClerkProtected>{children}</ClerkProtected>
}

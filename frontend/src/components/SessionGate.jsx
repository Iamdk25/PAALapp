import { PageShell } from './PageShell'
import { usePaalStorageScope } from '../providers/StorageScopeProvider.jsx'
import { authDevBypass } from '../lib/authMode'

/** Resolves Clerk user id for storage; remounts children when the signed-in user changes. */
export function SessionGate({ children }) {
  const { scopeId, isReady } = usePaalStorageScope()

  if (!authDevBypass && (!isReady || !scopeId)) {
    return (
      <PageShell hideFooter>
        <div className="flex min-h-[40vh] items-center justify-center px-6 py-16 text-slate-600">
          Loading your session…
        </div>
      </PageShell>
    )
  }

  const mountKey = authDevBypass ? '__dev_local__' : scopeId
  return <div key={mountKey}>{children}</div>
}

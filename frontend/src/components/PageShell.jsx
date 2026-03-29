import { Navbar } from './Navbar'
import { Footer } from './Footer'

/**
 * @param {object} props
 * @param {boolean} [props.hideFooter] - Fill the viewport under the nav (no page scroll); use for Study Hub / dashboards.
 */
export function PageShell({ children, className = '', hideFooter = false }) {
  return (
    <div
      className={`flex flex-col bg-white ${hideFooter ? 'h-screen min-h-0 overflow-hidden' : 'min-h-screen'} ${className}`}
    >
      <Navbar />
      <div
        className={`flex min-h-0 flex-1 flex-col ${hideFooter ? 'overflow-hidden' : ''}`}
      >
        {children}
      </div>
      {!hideFooter && <Footer />}
    </div>
  )
}

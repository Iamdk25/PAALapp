/** In local dev, allow browsing without Clerk when the env key is missing. */
export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? ''
export const authDevBypass = import.meta.env.DEV && !clerkPublishableKey

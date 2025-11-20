// Suppress browser extension runtime errors that don't affect functionality
// This is especially important for Vercel deployments where browser extensions
// may cause "runtime.lastError" messages

export function suppressRuntimeErrors() {
  if (typeof window === 'undefined') return
  
  // Suppress console errors from browser extensions
  const originalError = console.error
  const originalWarn = console.warn

  const shouldSuppress = (arg: unknown): boolean => {
    if (typeof arg === 'string') {
      return (
        arg.includes('runtime.lastError') ||
        arg.includes('runtime.LastError') ||
        arg.includes('The message port closed') ||
        arg.includes('message port closed') ||
        arg.includes('Extension context invalidated') ||
        arg.includes('message port closed before a response')
      )
    }
    if (arg instanceof Error) {
      return (
        arg.message?.includes('runtime.lastError') ||
        arg.message?.includes('message port closed') ||
        arg.message?.includes('Extension context invalidated') ||
        arg.name === 'ExtensionContextInvalidatedError'
      )
    }
    return false
  }

  console.error = (...args: unknown[]) => {
    // Check all arguments, not just the first one
    const shouldSkip = args.some(shouldSuppress)
    if (shouldSkip) {
      return // Suppress browser extension errors
    }
    originalError(...args)
  }

  console.warn = (...args: unknown[]) => {
    const shouldSkip = args.some(shouldSuppress)
    if (shouldSkip) {
      return // Suppress browser extension warnings
    }
    originalWarn(...args)
  }

  // Handle uncaught errors from browser extensions
  window.addEventListener('error', (event) => {
    if (
      event.message?.includes('runtime.lastError') ||
      event.message?.includes('message port closed') ||
      event.message?.includes('Extension context invalidated') ||
      event.error?.message?.includes('runtime.lastError')
    ) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }, true) // Use capture phase

  // Handle unhandled promise rejections from browser extensions
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    if (
      (typeof reason === 'string' && shouldSuppress(reason)) ||
      (reason instanceof Error && shouldSuppress(reason))
    ) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  })

  // Suppress Chrome runtime errors if Chrome APIs are available
  if (typeof window !== 'undefined') {
    const chromeAny = (window as unknown as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome
    if (chromeAny?.runtime) {
      try {
        // Chrome runtime API is available but read-only
        // We've already set up listeners above to catch these errors
      } catch {
        // Ignore errors in setup
      }
    }
  }
}

// Auto-initialize on import for client-side
if (typeof window !== 'undefined') {
  // Run immediately
  suppressRuntimeErrors()
  
  // Also run after DOM is ready as a fallback
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', suppressRuntimeErrors)
  }
}


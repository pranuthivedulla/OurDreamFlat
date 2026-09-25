'use client'

import { useState } from 'react'

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  // Built in the browser so it is right on localhost and on Vercel alike,
  // without needing a configured base URL.
  async function copy() {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Re-fetches the page on an interval so a status page left open on one phone
 * notices when someone else submits on another. Without this, whoever loaded
 * the page first keeps seeing the old count until they reload by hand.
 *
 * Polling rather than a realtime socket on purpose: a Supabase subscription
 * would need a key in the browser, and the whole privacy design rests on the
 * browser holding no key at all. This is three people refreshing a tiny page,
 * not a feed.
 */
export function AutoRefresh({ everyMs = 5000, stop = false }: { everyMs?: number; stop?: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (stop) return
    const id = setInterval(() => router.refresh(), everyMs)
    return () => clearInterval(id)
  }, [router, everyMs, stop])

  return null
}

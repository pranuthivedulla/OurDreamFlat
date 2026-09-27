'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

/**
 * Asks before spending money. A live search charges the account that owns the
 * Apify token, and this page is a public link, so the charge should never
 * happen on a single stray click by someone who does not know it costs
 * anything.
 */
export function LiveSearchButton({
  action,
  searchId,
}: {
  action: (formData: FormData) => Promise<void>
  searchId: string
}) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-primary">
        Search the internet · MagicBricks
      </button>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-line bg-field p-4">
      <p className="text-sm font-bold">Search MagicBricks for live Pune rentals?</p>
      <p className="mt-1 text-sm text-ink-soft">
        This pulls 15 current listings and charges about 4&ndash;5 US cents to the
        Apify account behind this app. It takes a minute or two. The demo run is free.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={action}>
          <input type="hidden" name="searchId" value={searchId} />
          <input type="hidden" name="source" value="magicbricks" />
          <Submit />
        </form>
        <button type="button" onClick={() => setConfirming(false)} className="btn-quiet">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Starting…' : 'Yes, search and charge'}
    </button>
  )
}

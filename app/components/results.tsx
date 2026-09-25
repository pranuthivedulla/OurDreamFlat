import { areaName } from '@/lib/areas'
import { personName } from '@/lib/constraints'
import type { Shortlist } from '@/lib/filter'

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

/**
 * Three flats, side by side as equals. Deliberately not numbered and not
 * scored on screen: the app shortlists, the three of them choose.
 */
export function Results({ result }: { result: Shortlist }) {
  if (result.shortlist.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <h2 className="text-lg font-medium">Nothing cleared all three sets of answers</h2>
        {result.shortfall && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            The single biggest blocker was <strong>{result.shortfall.reason}</strong>, which
            ruled out {result.shortfall.blocked}{' '}
            {result.shortfall.blocked === 1 ? 'flat' : 'flats'}. Relaxing just that would
            bring {result.shortfall.wouldQualify} back.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {result.shortlist.length === 1
            ? 'One flat to talk about'
            : `${result.shortlist.length} flats to talk about`}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Shown side by side, in no particular order of merit. Between you, you can
          cover {rupees(result.maxRent)} a month. The app does not pick &mdash; you three do.
        </p>
      </div>

      {result.shortfall && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Only {result.shortlist.length} cleared everything. The biggest blocker was{' '}
          <strong>{result.shortfall.reason}</strong> ({result.shortfall.blocked} flats).
          Relaxing that alone would bring {result.shortfall.wouldQualify} more.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {result.shortlist.map((verdict) => (
          <article
            key={verdict.listing.id}
            className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <header>
              <p className="text-lg font-semibold">
                {verdict.listing.area ? areaName(verdict.listing.area) : 'Area not identified'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {verdict.listing.rent === null
                  ? 'Rent not stated'
                  : `${rupees(verdict.listing.rent)} a month`}
                {verdict.listing.floor !== null && ` · floor ${verdict.listing.floor}`}
                {verdict.listing.bathrooms !== null && ` · ${verdict.listing.bathrooms} bath`}
              </p>
            </header>

            {verdict.flags.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {verdict.flags.map((flag) => (
                  <li key={flag}>⚠️ Confirm before visiting: {flag.toLowerCase()}</li>
                ))}
              </ul>
            )}

            <div className="space-y-3">
              {verdict.perPerson.map((view) => (
                <div key={view.person} className="text-sm">
                  <p className="font-medium">{personName(view.person)}</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="text-emerald-700 dark:text-emerald-400">Gets</span>{' '}
                    {view.gets.length > 0 ? view.gets.join(', ') : 'nothing she asked for'}.
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="text-red-700 dark:text-red-400">Gives up</span>{' '}
                    {view.givesUp.length > 0 ? view.givesUp.join(', ') : 'nothing she asked for'}.
                  </p>
                </div>
              ))}
            </div>

            {verdict.listing.url && (
              <a
                href={verdict.listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto text-sm font-medium underline underline-offset-4"
              >
                See the listing
              </a>
            )}
          </article>
        ))}
      </div>

      <p className="text-sm text-gray-500">
        {result.considered} flats looked at &middot; {result.dropped.length} dropped for
        breaking someone&rsquo;s dealbreaker or the shared rent ceiling &middot;{' '}
        {result.passedCount} cleared everything, and the {result.shortlist.length} that
        suit all three of you best are shown. Anything marked &ldquo;not stated&rdquo; was
        kept and flagged, never assumed.
      </p>
    </div>
  )
}

import { areaName } from '@/lib/areas'
import { SHORTLIST_SIZE, tally, type Tally, type Shortlist } from '@/lib/filter'

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
          Shown side by side, as equals, in no particular order of merit. Between you, you can
          cover {rupees(result.maxRent)} a month. The app does not pick &mdash; you three do.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Trade-offs are shown as counts, never names: you can see what a flat costs
          someone without learning who to feel bad about.
        </p>
      </div>

      {result.shortfall && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Only {result.shortlist.length} of a possible {SHORTLIST_SIZE} cleared everything. The biggest blocker was{' '}
          <strong>{result.shortfall.reason}</strong> ({result.shortfall.blocked} flats).
          Relaxing that alone would bring {result.shortfall.wouldQualify} more.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <TradeOffs {...tally(verdict)} />

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

/** How many of you, never which of you. */
function who(count: number, total: number): string {
  if (count === total) return 'All three'
  if (count === 1) return 'One of you'
  return `${count} of you`
}

function TradeOffs({ gets, givesUp }: { gets: Tally[]; givesUp: Tally[] }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-medium text-emerald-700 dark:text-emerald-400">Gets</p>
        {gets.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">Nothing anyone asked for.</p>
        ) : (
          <ul className="space-y-0.5 text-gray-600 dark:text-gray-400">
            {gets.map((item) => (
              <li key={item.text}>
                {who(item.count, item.total)} {item.count === 1 ? 'gets' : 'get'}{' '}
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="font-medium text-red-700 dark:text-red-400">Gives up</p>
        {givesUp.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">Nobody gives up anything they named.</p>
        ) : (
          <ul className="space-y-0.5 text-gray-600 dark:text-gray-400">
            {givesUp.map((item) => (
              <li key={item.text}>
                {who(item.count, item.total)} {item.count === 1 ? 'gives' : 'give'} up{' '}
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

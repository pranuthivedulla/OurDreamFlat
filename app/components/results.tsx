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
      <div className="">
        <h2 className="text-2xl font-extrabold tracking-tight">Nothing cleared all three sets of answers</h2>
        {result.shortfall && (
          <p className="mt-2 text-ink-soft">
            {result.shortfall.wouldQualify > 0 ? (
              <>
                Dropping <strong>{result.shortfall.reason}</strong> would bring back{' '}
                {result.shortfall.wouldQualify}{' '}
                {result.shortfall.wouldQualify === 1 ? 'flat' : 'flats'}.
              </>
            ) : (
              <>
                The most common blocker was <strong>{result.shortfall.reason}</strong> (
                {result.shortfall.blocked} flats), but every flat it stops also fails
                something else, so relaxing it alone changes nothing.
              </>
            )}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {result.shortlist.length} Shortlisted{' '}
          {result.shortlist.length === 1 ? 'Property' : 'Properties'}
        </h2>
        <p className="mt-2 text-ink-soft">
          Shown side by side, as equals, in no particular order of merit. Between you, you can
          cover {rupees(result.maxRent)} a month. The app does not pick &mdash; you three do.
        </p>
        <p className="mt-2 text-sm text-ink-faint">
          Trade-offs are shown as counts, never names: you can see what a flat costs
          someone without learning who to feel bad about.
        </p>
      </div>

      {result.shortfall && (
        <div className="rounded-2xl bg-warn-bg p-4 text-sm font-medium text-warn-ink">
          Only {result.shortlist.length} of a possible {SHORTLIST_SIZE} cleared everything.{' '}
          {result.shortfall.wouldQualify > 0 ? (
            <>
              Dropping <strong>{result.shortfall.reason}</strong>
              {result.shortfall.askedByCount > 1 &&
                ` — which ${
                  result.shortfall.askedByCount === 3 ? 'all three' : result.shortfall.askedByCount
                } of you asked for —`}{' '}
              would bring back {result.shortfall.wouldQualify}{' '}
              {result.shortfall.wouldQualify === 1 ? 'flat' : 'flats'}.
            </>
          ) : (
            <>
              The most common blocker was <strong>{result.shortfall.reason}</strong> (
              {result.shortfall.blocked} flats), but relaxing it alone changes nothing:
              every flat it stops also fails something else.
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.shortlist.map((verdict) => (
          <article
            key={verdict.listing.id}
            className="flex flex-col gap-4 rounded-2xl border border-line p-5"
          >
            <header>
              <p className="text-xl font-extrabold tracking-tight">
                {verdict.listing.area ? areaName(verdict.listing.area) : 'Area not identified'}
              </p>
              <p className="mt-1 text-sm font-medium text-ink-soft">
                {verdict.listing.rent === null
                  ? 'Rent not stated'
                  : `${rupees(verdict.listing.rent)} a month`}
                {verdict.listing.floor !== null && ` · floor ${verdict.listing.floor}`}
                {verdict.listing.bathrooms !== null && ` · ${verdict.listing.bathrooms} bath`}
              </p>
            </header>

            {verdict.flags.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-warn-bg p-3 text-xs font-medium text-warn-ink">
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
                className="mt-auto text-sm font-bold text-accent"
              >
                See the listing
              </a>
            )}
          </article>
        ))}
      </div>

      <p className="text-sm text-ink-faint">
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
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-wider text-positive">Gets</p>
        {gets.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing anyone asked for.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-ink-soft">
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
        <p className="text-sm font-extrabold uppercase tracking-wider text-negative">Gives up</p>
        {givesUp.length === 0 ? (
          <p className="text-sm text-ink-soft">Nobody gives up anything they named.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-ink-soft">
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

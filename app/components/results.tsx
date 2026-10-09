import { areaName } from '@/lib/areas'
import { SHORTLIST_SIZE, imageOf, tally, type Tally, type Shortlist } from '@/lib/filter'

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
            className="flex flex-col overflow-hidden rounded-2xl border border-line"
          >
            <Photo url={imageOf(verdict.listing)} area={verdict.listing.area} />

            <div className="flex flex-1 flex-col gap-4 p-5">
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

            {/* MagicBricks' feed carries no per-rental link: its id only ever
                resolves to the society page. Saying "see the listing" would
                promise something the click does not deliver. Demo flats have
                no real page at all, so they get no link. */}
            {verdict.listing.url && !verdict.listing.url.includes('/demo-') && (
              <a
                href={verdict.listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto text-sm font-bold text-accent"
              >
                Open the society on MagicBricks &rarr;
              </a>
            )}
            </div>
          </article>
        ))}
      </div>

      <p className="text-sm text-ink-faint">
        {result.considered} flats looked at &middot; {result.dropped.length} dropped for
        breaking someone&rsquo;s dealbreaker or the shared rent ceiling &middot;{' '}
        {result.passedCount} cleared everything, and the {result.shortlist.length} that
        suit all three of you best are shown. Anything marked &ldquo;not stated&rdquo; was
        kept and flagged, never assumed. MagicBricks publishes no direct link to an
        individual rental, so the link opens the society page &mdash; search the rent
        there to reach the flat itself.
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

/**
 * The listing photo. Demo flats carry Unsplash stock images and say so: those
 * flats do not exist, so presenting a photo as if it were the place would be a
 * small lie on a page whose whole point is not overstating what is known.
 */
function Photo({ url, area }: { url: string | null; area: string | null }) {
  if (!url) {
    return (
      <div className="flex h-40 items-center justify-center bg-field text-sm font-semibold text-ink-faint">
        No photo
      </div>
    )
  }

  const isStock = url.includes('images.unsplash.com')

  return (
    <div className="relative h-40 overflow-hidden bg-ink/5">
      {/* MagicBricks only serves 180x240 thumbnails -- stretching one across
          the card looks broken, so the photo stays sharp at its own size over
          a blurred fill of itself. Large stock images look the same either way. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
        style={{ backgroundImage: `url("${url}")` }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={area ? `A flat in ${areaName(area)}` : 'The flat'}
        className="relative mx-auto h-full w-auto max-w-full object-contain"
        loading="lazy"
      />
      {isStock && (
        <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Stock photo
        </span>
      )}
    </div>
  )
}

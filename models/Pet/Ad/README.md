# Ads (Kadesh Pet)

The "Publicidad" card of Kadesh Pet, on the web (kadesh-landing) and in the app
(kadesh-pet-mobile). Operaciones (kadesh-business → Kadesh Pet → Anuncios) creates and edits the
ads and reads the report.

## Lists

- **`Ad`** (`Ad.ts`): the ad. Admin only through the generated API (`createAd`, `updateAd`).
  - `kind` (`constants.ts`): `house` (Kadesh's own, fills the slot), `store_product`, `pet_place`,
    `animal` or `brand`. It decides the target: `storeProduct`, `petPlace`, `animal`, or `url` for
    `house` and `brand`. `Ad.hooks.ts` requires exactly the one that matches.
  - `placements`: where it shows (`animal_detail`, `vet_detail`, `blog`, `store`). Operaciones picks
    them per ad. `AD_SUGGESTED_PLACEMENTS_BY_KIND` only pre-ticks them and warns: the admin decides.
    A new screen that shows ads adds a value to `AD_PLACEMENT` (and to the copies in the fronts).
  - Live when `status = active` and today (Mexico City) is between `startDate` and `endDate`
    (either may be empty). The hourly cron `expireAds` moves past ones to `ended`.
  - `weight` (1–10) is its share of the rotation. House ads use 1.
  - `tone`: color of the card. A name (`orange`, `green`, `sky`, `violet`, `neutral`) that each
    front maps to its own classes, or a custom `#rrggbb` (stored in lowercase; `#abc` and `abcdef`
    are normalized). From a custom color each front derives the same shades: the button is the
    color with black or white text (whichever contrasts more), the card is the color at 12 % over
    white (15 % over the dark background) and the brand line is the color darkened (lightened in
    dark mode) until it reads at 4.5:1.
  - Zone: `geoScope = national`, or `radius` with `lat`, `lng` and `radiusKm`.
  - Payment is manual in v1: `priceCents`, `paymentStatus`, `paymentMethod`, `paymentNote`.
- **`AdDailyStat`** (`AdDailyStat/`): impressions and clicks per ad, day (Mexico City) and
  placement, unique on the three. Written only by `recordAdEvents`.

## Showing ads: no query per visit

- `activeAds` (public, `graphql/customs/queries/pet/activeAds.ts`) returns every live ad with what
  the card needs: texts, signed image (the ad's own, or the cover of its animal or product), `href`
  already built, placements, weight, `targetId` and zone. It comes from memory
  (`utils/pet/ads.ts`, `ACTIVE_ADS_CACHE_MS` = 5 min, at most `ACTIVE_ADS_MAX` = 100 ads) and the
  cache is cleared when an ad is saved.
- The web fetches it on the server with `revalidate: 300`; the app keeps it 30 min on the phone.
- Each client picks per screen:
  1. ads whose `placements` include the screen's placement;
  2. never the ad of the page being shown (`targetId` = the animal, product or clinic on screen);
  3. by zone: `radius` ads only within `radiusKm` of the screen's reference point (the animal's or
     clinic's location on its page; the visitor's approximate location on blog and store). Without
     a reference point, only `national` ads;
  4. weighted rotation; a matching zone ad weighs double. House ads show only when nothing else
     applies.

## Counting

- `recordAdEvents(events)` (public): `{ adId, placement, type: IMPRESSION | CLICK }`, up to 50 per
  call. An impression is the card at least half on screen for 1 s, once per ad per page view.
- Not counted: admins, known crawlers, ads not live, placements the ad does not have, and the same
  person (user id, or IP + browser) for the same ad, placement and event within 30 min
  (`AD_EVENT_DEDUPE_MS`, in process memory). 30 calls per IP every 5 min.
- One `INSERT … ON CONFLICT DO UPDATE` per batch into `AdDailyStat`. Nothing goes to `ActivityEvent`.
- "People" in the report means deduplicated impressions, not exact unique reach.

## Operaciones

- `adminAds(take, skip, status, kind, search, days)`: page of ads with impressions and clicks of the
  period (one aggregate for the page).
- `adminAdStats(days, adId)`: totals, previous period, series per day, by placement and top 10. Cached
  5 min per period and ad.
- `adminAdTargets(kind, search)`: picker of animals, products or clinics (20 rows), with the
  suggested center for a zone ad.

## Phase 2 (not built)

Self-serve: the advertiser creates the ad from their account (`pending_review`), the admin approves,
payment with a Stripe PaymentIntent (`metadata.kind = "ad_campaign"`, a new branch in
`webhooks/stripe.ts`), and `myAds` for the advertiser's report through `advertiserUser`.

# ARCHITECTURE
Verified against the repo on September 12, 2026 (commit 617cb3c). Lines marked (unverified) could not be confirmed from the code.

## Stack

- Static site. One file, `index.html` (3,713 lines, 215KB): inline CSS, six inline scripts, ten client-side pages switched by `data-page` (home, about, programs, athletes, leadership, news, join-us, support, pathways, pathways-finance) plus four forms (contact, sponsor, application, Pathways Finance join). Images in `assets/` (28 files).
- No framework, no build, no `package.json`, no `netlify.toml`. `_redirects` maps `/api/*` to Netlify functions and everything else to `index.html`.
- Hosting: Netlify, auto-deploy on push to main. The live page at www.bffsa.org matches commit 617cb3c exactly (ignoring trailing whitespace) as of September 12, 2026.
- `submit-application.js` at the repo root is a leftover; it is not in `netlify/functions/` so Netlify does not deploy it. Candidate for deletion.

## Bridge Pathways

- Two pages: `pathways` (overview, Finance card plus a Bridge to the Trades coming soon teaser) and `pathways-finance`. Both sit under the Programs tab; the router highlights Programs for any id starting with `pathways`. URLs are `/pathways` and `/pathways-finance`.
- The Finance join form posts to `save-to-airtable` with `_table: "event"` and `eventName: "Bridge Pathways Finance, Season One"`, so entries land in Event Registrations and the Mailing List. No function change. Dry run tested with a stubbed network only; not verified against the live base.

## Netlify functions

- `netlify/functions/save-to-airtable.js`: writes to Airtable base `app8fDCTTFMfNghmw` with `typecast: true`. Tables: Event Registrations `tbljHSZNvGUwZO5Xu` (default), Contacts `tbltno6crGDeiUOvq` (sponsors live here too), Mailing List `tblsJQhjHLG4SQ16o` (one row per person). The page posts `_table` of `event`, `sponsor`, or `application` (`index.html` lines 2114, 3201, 3308). Env var: `AIRTABLE_TOKEN`.
- `netlify/functions/create-checkout.js`: bundled Stripe SDK (9,098 lines, esbuild output). Creates a Checkout session with inline `price_data` and `allow_promotion_codes` using `STRIPE_SECRET_KEY`. Called from the page as `/api/create-checkout` for Bridge Invitational sponsorship tiers (single, foursome, bronze, silver, gold, platinum).

## Integrations

- Stripe donation link `https://buy.stripe.com/9B69AT6fYdsP98Ganv3sI01` appears 32 times across the page.
- Mailchimp and Zapier are not referenced in code; they operate outside the repo. (unverified)

## Deploy

Claude Code commits locally; Dave pushes (or says "push"). Netlify builds from main. Drag-and-drop still works but bypasses git; avoid it.

## Verification

`node --check` on each extracted inline script (six blocks), div balance (691 open and close), zero em dashes, 390 and desktop screenshots, link check.

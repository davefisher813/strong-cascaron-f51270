# CURRENT STATE
Last Updated: September 12, 2026. Rewritten from `git log`, the file tree, and a comparison with the live site.

## PRIORITIES

1. Confirm one real test application lands in Airtable Student Applications after the September 12 deploy.
2. Maintenance only unless Dave opens a project.

## ACTIVE

Site
Status: Stable at www.bffsa.org. Main (617cb3c, September 9, 2026) is in sync with origin and matches the live page. Eight pages, three Airtable forms, Stripe donation link, Bridge Invitational sponsorship checkout. Latest change: student applications routed to their own Airtable table (September 12, 2026).

Checks run on the untouched file (September 12, 2026): five inline scripts pass `node --check`; 605 div opens and 605 closes; zero em dashes.

## WAITING

Nothing recorded.

## ISSUES

- Student application routing shipped September 12, 2026: `save-to-airtable.js` now writes `_table: "application"` to Student Applications `tblSl803SSFkQN08q` with real field names and adds the applicant to the Mailing List. Dry-run tested with a stubbed network only; Airtable field names were not verified against the base. If a submission returns an error, check the field names in that table first.
- Same commit fixed event registrations returning 502 even when the Airtable write succeeded.
- `_to_delete/_app-form-insert.html` is an untracked duplicate of the application form already in `index.html`. Safe to delete.
- `submit-application.js` at the repo root is dead (not deployed as a function).
- The application form uses one `type="date"` input (`#af-dob`, line 2960). Fine on the website; the no-date-input rule belongs to the app.
- The street address (54 Clifford Ave) does not appear on the site. Add only if asked.

## RECENT DECISIONS

9/12 Repo doc standard adopted. See DECISIONS.md.

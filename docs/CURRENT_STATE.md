# CURRENT STATE
Last Updated: September 12, 2026. Rewritten from `git log`, the file tree, and a comparison with the live site.

## PRIORITIES

1. Decide what to do with the uncommitted work in the tree (see ISSUES).
2. Maintenance only unless Dave opens a project.

## ACTIVE

Site
Status: Stable at www.bffsa.org. Main (617cb3c, September 9, 2026) is in sync with origin and matches the live page. Eight pages, three Airtable forms, Stripe donation link, Bridge Invitational sponsorship checkout.

Checks run on the untouched file (September 12, 2026): five inline scripts pass `node --check`; 605 div opens and 605 closes; zero em dashes.

## WAITING

Nothing recorded.

## ISSUES

- Uncommitted work left by an earlier session: `netlify/functions/save-to-airtable.js` has 54 new lines routing `_table: "application"` to Student Applications `tblSl803SSFkQN08q` with real field names, and an untracked `_to_delete/_app-form-insert.html` (281 lines). The page already posts `_table: 'application'` (line 3201), so until that function change is committed and deployed, applications fall to the default Event Registrations table. Dave decides: commit it, or discard it.
- `submit-application.js` at the repo root is dead (not deployed as a function).
- The application form uses one `type="date"` input (`#af-dob`, line 2960). Fine on the website; the no-date-input rule belongs to the app.
- The street address (54 Clifford Ave) does not appear on the site. Add only if asked.

## RECENT DECISIONS

9/12 Repo doc standard adopted. See DECISIONS.md.

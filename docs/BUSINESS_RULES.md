# BUSINESS RULES

## Compliance

- IRS earmarking: donations are to BFFSA at its discretion. No page may offer donor-directed gifts to a named individual. Sponsorship language reflects this.
- Child safeguarding: no named minors on the site without Shawna's review.
- Public financials: gross only. Net event revenue is board-only.
- Bridge to the Trades: BFFSA does not screen, interview, fund gear, or employ anyone; no money moves between BFFSA and RB Plumbing; participant financial help goes through the scholarship process separately. Copy must not imply otherwise.

## Facts that must stay correct

- Main Board: Shawna Hamilton Doster (Chair), Byron Valverde (Vice Chair), Wei Chang (Treasurer), Linda Fisher (Secretary). Lear Beyer is no longer on the board.
- College Advisory Board: Kevin Valdovinos (Chair), DJ Peoples, Harby Valeta.
- Bridge Rising Leaders Scholarship: one-time $1,500; first recipient Jose Ulloa.
- Address: 54 Clifford Ave, Stamford, CT 06905.
- Platform app is app.bffsa.org; there is no other app site.
- Names on the site today: the four board members above, the College Advisory Board, and Jose Ulloa. Lear Beyer does not appear. The street address does not appear.

## Forms

All forms write to Airtable through `netlify/functions/save-to-airtable.js` (`_table` of `event`, `sponsor`, or `application`). Do not add a second backend. Note the uncommitted application routing in CURRENT_STATE.

## Approval

Structural changes to reviewed sections need Dave's explicit approval. Decisions belonging to Shawna, Rob, or partners stay with them.

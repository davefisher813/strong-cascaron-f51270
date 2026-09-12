# DESIGN SYSTEM
Values read from the `:root` block and typography rules in `index.html` on September 12, 2026.

## Fonts

- Headings: Cormorant Garamond (serif), weights 400 to 700 with italics.
- Body: DM Sans (sans), weights 300 to 500. Not Barlow.
- Base font size 16px; smooth scrolling; antialiased.

## Colors

| Token | Value | Use |
|---|---|---|
| --black | #0d0d0d | page background |
| --dark | #161616 | alternate section background |
| --card-bg | #1c1c1c | cards |
| --border | rgba(255,255,255,0.08) | hairlines |
| --border-mid | rgba(255,255,255,0.14) | stronger hairlines |
| --grey | #7a7a7a | de-emphasized text |
| --light-grey | #b8b8b8 | eyebrows, secondary text |
| --white | #ffffff | body text |
| --red | #cc0000 | accent, buttons, required marks |
| --red-bright | #ff0000 | hover and emphasis |
| --red-muted | rgba(204,0,0,0.15) | tints |

There is no gold token on the website. The app uses different reds (`#c8180c`); do not copy values between the two repos.

## Spacing and layout

- `--max-w 1080px`, `--pad-x 4rem` desktop and `--pad-x-sm 1.5rem` mobile, `--section-y` and `--section-y-sm` for vertical rhythm.
- Breakpoints: main `max-width: 860px` (15 blocks) with `min-width: 861px` for desktop-only rules; finer ones at 640, 620, 580, 520, 500. `prefers-reduced-motion` is respected.
- Typography classes: `.t-eyebrow`, `.t-h1`, `.t-h2`, `.t-body`. Athlete rows use `.ath-row`, `.ath-name`, `.ath-school`, `.ath-tag`, `.ath-badge`.

## Copy rules

- "We" and "us". Never "I".
- No em dashes (zero in the file today). No hyphenated compound words in copy.
- Plain English. Lead with value to the reader.

## Layout rules

- Mobile-first; verify at 390 width before desktop.
- Do not restructure sections Shawna has reviewed without Dave's approval.
- Preserve existing page order and navigation unless asked. The site was consolidated from 11 pages to 8 on September 8, 2026.

## Assets

Board orientation PPTX in Drive is the reliable source for leadership bios and program details. Print and digital materials (business cards, name tags, vCards) exist in Drive; reuse their treatment. (unverified)

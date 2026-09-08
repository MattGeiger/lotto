# In-App Help, Release Notes & About

**Status:** Shipped

These three staff-facing features were adapted from the FEED project
(`williamtemple-feed`) and rebuilt for LOTTO's Next.js App Router. All content is
**English-only**, matching the Staff page.

## Entry points (Login and Admin)

The shared sign-in footer (`src/components/staff-links-footer.tsx`) and the
authenticated Admin footer render the staff-facing controls:

- **Version number** → `ReleaseNotesDialog` (`src/components/release-notes-dialog.tsx`).
- **About** → `AboutDialog` (`src/components/about-dialog.tsx`).
- **Help** → a link to the `/help` route.

The server routes read `docs/release-notes.md` from disk at build/request time
and pass it to the release-notes modal.

## Release Notes

- **Content:** `docs/release-notes.md` — plain-language, per-version summaries,
  newest first (`## Version X.Y.Z — Month D, YYYY` + bullets). This is separate
  from the technical `CHANGELOG.md` / `docs/RELEASES.md`; keep a short, friendly
  entry here when you cut a release.
- **Rendering:** `MarkdownGuideContent` (shared markdown renderer) inside a
  scrollable dialog.

## About

- Product/credits card in `src/components/about-dialog.tsx`, matching FEED's
  format: the Temple Consulting logo, title, tagline, "Made by / Made for / Made
  with", the current version, the license (**AGPL-3.0-or-later**, per the repo
  `LICENSE`), and a **Source Code on GitHub** button, plus a short open-source /
  profile-aware "Made for" link and branding disclaimer (code is AGPL; bundled
  agency branding is not — see `TRADEMARKS.md`). Like FEED, the `DialogContent` is made transparent
  (`border-0 bg-transparent p-0 shadow-none`) so the inner `Card` is the visible
  surface (no card-in-a-card). LOTTO's `DialogContent` has no built-in close
  button, so both this and the release-notes modal add an explicit `DialogClose`
  (X, top-right).
- **Logo theming:** two SVG variants in `public/` — `temple-logo-light.svg`
  (black) and `temple-logo-dark.svg` (white) — swapped with `dark:hidden` /
  `hidden dark:block`, so the logo tracks the theme selector (the `.dark` class
  covers both dark and dark hi-viz). The adaptive `Temple_Icon_System.svg` from
  FEED is intentionally not used because its in-SVG `prefers-color-scheme` keys
  off the OS, not LOTTO's theme toggle.

## Searchable Help

Routed pages, statically generated:

- `src/app/help/page.tsx` — index: a card grid of guides.
- `src/app/help/[slug]/page.tsx` — detail: table of contents (mobile
  collapsible + desktop sticky with scroll-spy), the rendered guide, and
  previous/next navigation. `generateStaticParams` prerenders one page per
  guide.

Both pages open with `HelpTopBar` (`src/components/help/help-top-bar.tsx`), a
sticky banner carrying the Back control, the search box, and the theme switcher,
with the guide's catalog position added on detail pages. It stays pinned while
the content scrolls behind it under a translucent blur, so navigation, search,
and appearance are reachable from anywhere in a long guide.

The banner's glass treatment is LOTTO's existing one, lifted verbatim from the
desktop table of contents in `guide-toc.tsx` — which is itself the pattern FEED
uses for its sticky Analytics banner. Keep the two in step rather than
introducing a second recipe. The `supports-[backdrop-filter]` guard decides what
old WebKit gets, which is what keeps this safe on the iPadOS 15 floor.

Two offsets are tied to the banner's ~5rem height and must move with it: the
desktop table of contents sticks at `top-24` (with its `ScrollArea` sized
`calc(100vh-13rem)`), and guide headings carry `scroll-mt-24` so a deep link
does not land underneath the banner. The banner itself wraps to two rows on a
phone and one row from `sm` up, using flex order rather than `display: contents`,
which is unreliable for assistive technology on the iPadOS 15 floor.

For authenticated staff, the Help index's upper-left **Back** control returns
to `/admin`. It must not target the retired `/staff` landing route.

### Authoring content

Guides are markdown files in `docs/user-guides/`, named `NN-slug.md` (the numeric
prefix sets order; the slug becomes the URL: `/help/slug`). Structure:

```markdown
# Guide Title              (becomes the page title)

Intro paragraph.          (becomes the card description + first text)

## Section Heading         (H2/H3 become TOC entries + search sections, with ids)

1. Step one.
2. Step two.

[Link to another guide](02-staff-controls.md)   (rewritten to /help/staff-controls)
```

Screenshots belong under `public/help-screenshots/`. Prefer WebP for its smaller
static-transfer footprint. Every light image must have a matching `-dark`
sibling with the same extension because the renderer swaps them automatically
with the active theme. Use descriptive alt text that explains the workflow or
state, not generic text such as "screenshot."

Use images when they replace spatial explanation: identifying controls on a
screen, showing a multi-part card, distinguishing visual states, or orienting a
reader before a procedure. Keep essential instructions, warnings, and control
names in text so Help remains searchable and accessible. Do not add screenshots
to syntax/reference sections when a live text example is clearer.

### How a screenshot is sized

**A Help screenshot renders at 1× its captured CSS size, capped by the guide
column:** `renderedWidth = min(captureWidth, columnWidth)`. The column is about
815 CSS pixels on a desktop viewport, so a 1280-wide desktop capture is scaled
down to fit while a 375-point phone capture is shown at exactly the size a phone
shows it. Nothing is ever scaled *up*.

That rule exists because the renderer previously had no capture geometry to work
from and simply let every image fill the column. A phone capture therefore
appeared at more than twice life size — a single screenshot ran nearly two
viewport-heights tall — while desktop captures appeared at about two-thirds of
theirs, a 3.4× inconsistency between two images stacked in the same guide.

Two things make the rule enforceable rather than aspirational:

- **Capture at 2× device scale.** Phone surfaces use a 375 × 812 CSS-pixel,
  2× mobile viewport matching an iPhone portrait screen, producing a repeatable
  750 × 1624 asset without browser chrome. That is a clean retina asset for a
  375-point slot; the earlier 3× capture was over-provisioned for a box it was
  never going to fill. Administrative and large-format screenshots retain their
  task-appropriate desktop proportions. (Most of the desktop back-catalogue is
  still 1× and is a pending re-capture, which is why the manifest records the
  scale per asset rather than assuming one.)
- **`src/lib/help-screenshot-manifest.ts` carries the geometry.** It is a
  generated file — `npm run screenshots` rewrites it from `HELP_SHOT_BASES` plus
  the dimensions of the stored assets, on every run including a bounded
  `SCREENSHOT_NAMES` one, so a partial refresh cannot leave it half-stale. Do
  not edit it by hand. `MarkdownGuideContent` looks each image up there and
  emits intrinsic `width`/`height` plus a max-width in CSS pixels; images with
  no manifest entry fall back to filling the column.

The intrinsic `width`/`height` also give the browser an aspect ratio to reserve
space with, so lazily loaded screenshots no longer shift the article as they
arrive.

Two mechanical notes for anyone touching this:

- The renderer pairs the max-width with `w-full`, and that is load-bearing. A
  bare `max-width` does not let an image shrink *below* its intrinsic size, so a
  750-pixel phone capture would overflow the column horizontally on a narrow
  screen.
- `SCREENSHOT_NAMES` matches README shots too. Several README captures share a
  base name with a Help capture (`client-ticket`, `arcade`, `display-board`,
  `inventory`), so a bounded Help refresh also rewrites those `docs/screenshots/`
  PNGs. Check `git status` afterwards and revert what you did not mean to touch.

`npm run screenshots` regenerates both README and Help assets from the running
app. Set `SCREENSHOT_NAMES` to a comma-separated list for a bounded refresh,
for example:

```bash
SCREENSHOT_NAMES=staff-dashboard,staff-dashboard-dark npm run screenshots
```

The asset-integrity test fails when a guide references a missing PNG/WebP Help
image, when its dark-mode partner is absent, when a referenced image has no
manifest entry, when the manifest's recorded dimensions no longer match the
stored asset, or when a phone capture is not a 375-point surface at 2×.

The Help catalog intentionally combines announcement workflow and Markdown
formatting in one **Announcements & Formatting** guide so staff can move from
writing to formatting without switching pages.

### Search

Section-level, no external dependency. The index (one entry per H2/H3 section) is
built server-side and passed to the client `HelpSearch` component, which scores
matches (section title > guide title > content), shows up to 8 results with a
180-char snippet, highlights terms, and links to
`/help/<slug>?q=<query>#<section-id>`. On arrival, `HighlightOnArrival` marks the
query terms in the article and scrolls to the section.

## Key files

| Concern | File |
| --- | --- |
| Pure parser + search index + link rewrite (tested) | `src/lib/user-guides.ts` |
| Server-only filesystem loader | `src/lib/user-guides.server.ts` |
| Markdown renderer (react-markdown + remark-gfm) | `src/components/help/markdown-guide.tsx` |
| Sticky banner (Back + search + theme) | `src/components/help/help-top-bar.tsx` |
| Search box + results | `src/components/help/help-search.tsx` |
| TOC + scroll-spy | `src/components/help/guide-toc.tsx`, `guide-toc-scroll-spy.tsx` |
| Arrival highlight | `src/components/help/highlight-on-arrival.tsx` |
| Article wrapper | `src/components/help/guide-article.tsx` |
| Routes | `src/app/help/page.tsx`, `src/app/help/[slug]/page.tsx` |
| Release notes / About modals | `src/components/release-notes-dialog.tsx`, `src/components/about-dialog.tsx` |
| Generated capture geometry (do not hand-edit) | `src/lib/help-screenshot-manifest.ts` |
| Capture automation + manifest writer | `scripts/screenshots.mjs` |
| Content | `docs/release-notes.md`, `docs/user-guides/NN-*.md` |

## Tests

- `tests/user-guides.test.ts` — filename parse, guide build/sort, TOC id
  de-duplication, section search entries, markdown link rewriting.
- `tests/help-search.test.tsx` — ranking, deep-link hrefs, highlighting, the
  2-character minimum, empty state, and clear.
- `tests/help-screenshot-assets.test.ts` — referenced screenshot and dark-mode
  partner integrity, manifest completeness, manifest-versus-asset dimension
  drift, the 375-point/2× phone capture contract, production-only wording, and
  the combined announcement / formatting guide boundary.

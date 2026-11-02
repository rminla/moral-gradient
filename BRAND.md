# Direction A, "Signal" (branch design-a-bold)

> Exploration branch. Overrides the type, colour and chart sections of the brand notes below wherever they conflict.

- **Type:** Archivo, using its expanded width for display at bold, tight sizes. JetBrains Mono covers every label, number and button, uppercase with 0.08em tracking.
- **Colour:** white, ink #0c0c0d and a single signal red, #ff3d1f, used only for what models *do*. What they *say* is grey (#6c6f75).
- **Layout:** a 1200px framed column. Hairline rails run the full page height. Sections are bordered cells with crop-mark corners, and some sections are full-bleed black. The nav is segmented cells ending in a black Donate cell.
- **Charts:** square cells. A bar is 20 cells at 5% each. In the hero exhibit, one square is one run, and outlined red squares are runs where the model didn't act. The funding meter uses one square per $1.
- **Motion:** headline rise, cells popping in one after another, and a blinking dot on Donate. All of it respects prefers-reduced-motion.
- **Mark — "Where it lands":** a stepped scale from words (ink → grey) to deeds (light red → signal red), with an ink pointer marking where a model actually lands: off-centre, one step short of full red. It reuses the site's cell language (charts, funding meter). Two drawings, both in `components/Brand.tsx` (`MARK_FULL`, `MARK_SMALL`; `Mark` picks by size):
  - **Full** (48-unit grid, five cells with 1-unit gaps, triangular pointer over the 4th cell): anything larger than 32px, share images (`lib/og.tsx` `OgMark`), `app/apple-icon.png`.
  - **Small / favicon** (16-unit grid): 32px and below, nav (24px), footer, `app/icon.svg`. Four gapless cells (ink, grey, light red, red) and a pointer stepped in whole units over the 3rd cell; every edge sits on the pixel grid, so it is crisp at 16/32px. `icon.svg` switches ink → white and grey → light grey under `prefers-color-scheme: dark`.
  - Never reorder the cells, centre the pointer, or put the mark on red. Clear space = one cell width on all sides. Replaced the 3×3 run block and, briefly, the "Tipping point" seesaw (Nov 2026).

## Mission and audience (Nov 2026)

- **Stated goal:** raise awareness of, and conversation about, AI alignment and safety among regular people. The project should interest academics, and even more so everyone else.
- **One-line pitch (hero subhead):** "A free, open record of what AI models do when a choice has moral weight, next to what they say is right. Written for everyone, so anyone can follow it, try it and talk about it."
- **Home:** the primary button is "Try a dilemma yourself" (`/try`), the secondary "See the results". A "Why we built this" section states the mission, with Try · Learn · Talk · Follow doors. The data exhibit still follows the hero directly.
- **Try it:** both answers get identical buttons, so neither looks expected. Model answers to a dilemma are *say*, so they are grey; red stays for what models do. People are shown in ink.
- **Voice for everyone:** short sentences, no jargon without a gloss (see the `/learn` glossary), invite discussion ("Talk about it") rather than conclude. Still never a right answer.

# Moral Gradient — brand notes

**Idea.** Stated values are cheap; behaviour is the test. Moral Gradient tracks what AI models **do** (as agents with tools, under social pressure, and when their own interest pulls the other way) next to what they *say* is right. The identity is a scale between those two poles, and the emphasis is always on the **do** end. It should read like a data-journalism desk or a university lab, not an AI startup.

**Hierarchy of claims (shown as the "alignment ladder" on home and about).** Level 1 Says (stated values vs human baselines) → Level 2 Does (acts on them with tools) → Level 3 Under pressure → Level 4 When it benefits. Levels 3 and 4 are the headline safety questions and are always visually heavier (ink blocks, "Safety question" tag). Component: `components/Alignment.tsx` (`WhyItMatters`, `AlignmentLadder`).

**Hero rule.** (Superseded in part: the Signal home has a headline, subhead and two buttons, see Mission above; the exhibit follows directly.) The home page leads with data, not a headline: Exhibit 01 is the say-vs-do finding drawn large (situation on the left, three big bars with counts like `0/20`, the "does" row in vermilion and largest), then a one-line takeaway. No headline + subhead + two-button hero.

## Mark & wordmark
- **Mark:** superseded, see "Where it lands" in Direction A above. Component: `components/Brand.tsx` (`Mark`, `Wordmark`). Favicon: `app/icon.svg`.
- **Wordmark:** "Moral *Gradient*" in Newsreader, the second word italic. Never set it in all caps, never on a gradient background.
- **Signature divider:** `GradientRule` — the same seven steps as a full-width strip with "← what it says / what it does →" labels. Use at most once per page.

## Colour
| Token | Hex | Use |
|---|---|---|
| `paper` | `#ffffff` | page background (clean white) |
| `panel` | `#f4f6f8` | cool light neutral for boxed content, bar tracks, the statement band |
| `ink` | `#12161b` | text, rules, primary buttons, safety-question blocks |
| `rule` | `#dde2e8` | hairlines |
| `vermilion` | `#c23b1e` | the one accent and the **do** colour: "Actually does", gaps, donate, progress, Say-vs-Do pillar |
| `prussian` | `#1d4e6e` | the **say** colour: "Says it's right", Under-pressure pillar |
| `prussian-2` | `#6f93a8` | "Tells another agent to" (a softer form of saying) |
| `brass` | `#8f6a12` | Self-interest pillar |
| `moss` | `#3d6b45` | "real new information" reference, positive status |
| `highlight` | `#fbe37d` | highlighter-pen annotations only (example data, small-n caveats) |
| scale | `#1d4e6e #4f7a93 #9db6c2 #e6eaef #e8b4a2 #d6735a #c23b1e` | mark, dividers, share images |

Rules: no beige/newsprint, no dark mode hero; one accent per view; no gradients other than the stepped scale; no purple, no glow, no shadows, no rounded cards. Corners are square; structure comes from rules (2px ink top rule for sections, hairlines inside).

## Type
- **Newsreader** (serif, optical sizes) — headlines, body copy, figure captions. Italic for emphasis and the wordmark.
- **IBM Plex Sans** — UI, labels, kickers (11px, uppercase, +0.12em tracking).
- **IBM Plex Mono** — every number (`.num` utility: tabular figures).
Loaded with `next/font/google` in `app/layout.tsx`. Static TTFs for share images live in `assets/fonts/` (OFL).

## Charts
**Plain language, always.** Never label a series "Judges" or bare "Says/Does". Use what happened: "Says it's right to waive (in principle)", "Says another agent should waive", "Actually waived, acting with tools". Every chart states its unit in a caption (e.g. "% of 20 runs that sided with waiving the $35 fee") and, where there is a finding, a one-line takeaway. Findings carry `axis` and `takeaway` fields (adapter: `scripts/build_site_bundle.py`; older bundles are relabelled in `lib/bundle.ts`). The "does" row is the emphasised one (vermilion, bold label).
Data-journalism conventions: lollipops (2px stem + dot) on a 0/50/100% hairline grid, values labelled directly at the end, dashed line for the control/reference, captions in serif italic, annotations (brackets, "−100 pt gap") in vermilion. `components/Bars.tsx` (`HBar`, `Axis`, `Triptych`, `Figure`).

## Share images
Site card: "What AI models say is right. / What they actually *do*." (say line in grey, *do* in vermilion italic). `app/opengraph-image.tsx` (site) and `app/f/[id]/opengraph-image.tsx` (each finding): paper background, scale strip on top, wordmark + pillar kicker, serif headline, mono stat in the pillar colour, lollipop chart, footer with the descriptive-only line and the domain (from `NEXT_PUBLIC_SITE_URL`, i.e. moralgradient.org in production).

## Voice
Plain, precise, descriptive, modest. Lead with what models *do*. Explain why it matters (words are easy to train; behaviour under pressure and against self-interest is the safety question; tracking across releases shows whether alignment improves or models just get better at saying the right thing) without overclaiming. We report what models chose, never what they should have chosen. Caveats are visible (highlighter tags), not hidden in footnotes.

# Moral Gradient — brand notes

**Idea.** A model's moral behaviour isn't a score; it's a position on a scale between two poles (what it *says* ↔ what it *does*, first answer ↔ answer under pressure, no stake ↔ a stake). The identity is that scale. It should read like a data-journalism desk or a university lab, not an AI startup.

## Mark & wordmark
- **Mark:** a seven-step diverging scale (Prussian → paper → Vermilion) with a thin ink pointer that sits *off-centre*, one step toward the warm pole: "where the model actually lands." Component: `components/Brand.tsx` (`Mark`, `Wordmark`). Favicon: `app/icon.svg`.
- **Wordmark:** "Moral *Gradient*" in Newsreader, the second word italic. Never set it in all caps, never on a gradient background.
- **Signature divider:** `GradientRule` — the same seven steps as a full-width strip with "← what it says / what it does →" labels. Use at most once per page.

## Colour
| Token | Hex | Use |
|---|---|---|
| `paper` | `#f3eee4` | page background (warm newsprint) |
| `panel` | `#faf7f0` | boxed content (ledger, forms) |
| `ink` | `#1a1916` | text, rules, primary buttons |
| `vermilion` | `#c23b1e` | the one accent: donate, progress, "Does", gaps, Say-vs-Do pillar |
| `prussian` | `#1d4e6e` | cool pole: "Says", Under-pressure pillar |
| `brass` | `#a07a22` | "Judges", Self-interest pillar |
| `moss` | `#3d6b45` | "real new information" reference, positive status |
| `highlight` | `#f3e08a` | highlighter-pen annotations only (example data, small-n caveats) |
| scale | `#1d4e6e #4f7a93 #9db6c2 #e9e2d3 #e8b4a2 #d6735a #c23b1e` | mark, dividers, share images |

Rules: one accent per view; no gradients other than the stepped scale; no purple, no glow, no shadows, no rounded cards. Corners are square; structure comes from rules (2px ink top rule for sections, hairlines inside).

## Type
- **Newsreader** (serif, optical sizes) — headlines, body copy, figure captions. Italic for emphasis and the wordmark.
- **IBM Plex Sans** — UI, labels, kickers (11px, uppercase, +0.12em tracking).
- **IBM Plex Mono** — every number (`.num` utility: tabular figures).
Loaded with `next/font/google` in `app/layout.tsx`. Static TTFs for share images live in `assets/fonts/` (OFL).

## Charts
Data-journalism conventions: lollipops (2px stem + dot) on a 0/50/100% hairline grid, values labelled directly at the end, dashed line for the control/reference, captions in serif italic, annotations (brackets, "−100 pt gap") in vermilion. `components/Bars.tsx` (`HBar`, `Axis`, `Triptych`, `Figure`).

## Share images
`app/opengraph-image.tsx` (site) and `app/f/[id]/opengraph-image.tsx` (each finding): paper background, scale strip on top, wordmark + pillar kicker, serif headline, mono stat in the pillar colour, lollipop chart, footer with the descriptive-only line and the domain (from `NEXT_PUBLIC_SITE_URL`, i.e. moralgradient.org in production).

## Voice
Plain, precise, descriptive. We report what models chose, never what they should have chosen. Caveats are visible (highlighter tags), not hidden in footnotes.

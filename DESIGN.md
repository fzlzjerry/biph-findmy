---
name: BIPH FindMy
description: Campus lost & found drawn as a guide map; every item carries the colour of the zone it turned up in.
colors:
  ink: "#2c2e2a"
  cream: "#f5f1e4"
  card-white: "#ffffff"
  ink-reverse: "#fffdf6"
  sun: "#f5e211"
  sun-deep: "#ebd800"
  coral: "#ff705d"
  coral-deep: "#ff5f49"
  zone-sports: "#8ed462"
  zone-building-a: "#7cc4ff"
  zone-building-b: "#9fe3d6"
  zone-dining: "#ff8a78"
  zone-building-c: "#ebc1ff"
  zone-boarding: "#ffc58a"
  zone-entrance: "#f5e211"
  zone-other: "#dcd6c4"
  sand: "#ebe5d3"
  muted-sand: "#efe9d9"
  muted-ink: "#5f5c51"
  hairline: "#e2dbc7"
  field-stroke: "#d6cdb4"
  destructive: "#c4321f"
  success: "#2f7a35"
  chart-found: "#2ba0ff"
  chart-returned: "#5fb83a"
typography:
  display:
    fontFamily: "Work Sans Variable, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Work Sans Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Work Sans Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.03em"
  map-label:
    fontFamily: "Work Sans Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(1.125rem, 2vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  item-title:
    fontFamily: "Work Sans Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Work Sans Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1rem"
    fontWeight: 450
    lineHeight: 1.5
  label:
    fontFamily: "Work Sans Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
rounded:
  card: "20px"
  field: "22.4px"
  panel: "24px"
  alert: "28.8px"
  sheet: "32px"
  full: "9999px"
spacing:
  gutter-sm: "16px"
  gutter-md: "24px"
  card-pad: "24px"
  card-pad-sm: "16px"
  list-gap: "12px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-reverse}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-sun:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-sun-hover:
    backgroundColor: "{colors.sun-deep}"
  button-coral:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-coral-hover:
    backgroundColor: "{colors.coral-deep}"
  button-outline:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.sand}"
  button-hero:
    rounded: "{rounded.full}"
    padding: "0 12px 0 28px"
    height: "56px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  item-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    typography: "{typography.item-title}"
    rounded: "{rounded.card}"
    padding: "14px 16px 14px 14px"
  match-card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.panel}"
    padding: "24px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "4px 14px"
    height: "44px"
  search-capsule:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.full}"
    height: "56px"
  nav-link-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-reverse}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  map-count-capsule:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  map-count-capsule-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    height: "24px"
---

# Design System: BIPH FindMy

## Overview

**Creative North Star: "The Campus Guide Map"**

The campus is the interface. Lost things belong to a place, so the school's eight zones are drawn as flat, swelling lobes of colour on a cream ground that reads as water, and every item, step marker and avatar borrows its zone's colour. The map is navigation as well as picture: a lobe grows with the number of open items in it, and choosing one swells it while the rest recede.

Everything else stays quiet so the zone colours can speak. Content sits on borderless white cards with a whisper of shadow; text is one warm near-black ink; controls are full capsules. Hierarchy comes from size contrast in a single grotesk (bold, tightly tracked display against a 450-weight body), not from extra colours, outlines or badge stacks. The register is a friendly printed park map, not a SaaS dashboard: warm, legible, bilingual, and plain about evidence.

Density flexes by audience on the same ground: students get large type, one big call to action per screen and roomy cards; desk staff get dense white panels and tables on the same cream.

**Key Characteristics:**
- Cream ground, white borderless cards, one ink for text and primary controls.
- Eight flat zone colours, used as fills only (lobes, item thumbnails, step discs), never as text.
- Everything you press is a capsule; round shapes (discs, dots, pills) recur everywhere.
- One bundled variable grotesk for Latin, system CJK faces for Chinese; tight negative tracking on Latin display only.
- Match strength is a fixed four-dot ramp; reasons are one plain line of checks and minuses.

## Colors

A warm, sunlit paper palette: cream and ink as the constants, two saturated action colours, and eight soft-bright zone fills.

### Primary
- **Map Ink** (#2c2e2a): all body text, the default capsule button, active nav pill, selected map count, the four-dot meter, focus rings, the footer slab. Never pure black.
- **Signpost Sun** (#f5e211): the "I lost something" call to action and "This is mine" confirmation; also text selection. Ink text on it, never white. Hover deepens to Sun Deep (#ebd800).

### Secondary
- **Found Coral** (#ff705d): the "I found something" call to action, paired with Sun as the two report capsules. Ink text on it. Hover deepens to Coral Deep (#ff5f49). Also the "lost" series in charts.

### Tertiary (zone fills)
Each campus zone owns one flat fill. They appear as map lobes, the circular thumbnail behind a photo-less item's category icon, numbered step discs and the avatar fallback. All carry ink text/icons.
- **Field Green** (#8ed462): sports.
- **Sky Block** (#7cc4ff): Building A.
- **Library Mint** (#9fe3d6): Building B.
- **Canteen Coral** (#ff8a78): dining.
- **Stage Lilac** (#ebc1ff): Building C.
- **Dorm Apricot** (#ffc58a): boarding.
- **Gate Yellow** (#f5e211): entrance; deliberately the same hue as Signpost Sun.
- **Sandbar** (#dcd6c4): other / unknown zone; the fallback for any item without a zone.

### Neutral
- **Cream Water** (#f5f1e4): page background, header backdrop (at 80-92% with blur), ring offset.
- **Card White** (#ffffff): cards, panels, popovers, inputs, outline capsules, map count capsules.
- **Ink Reverse** (#fffdf6): text on ink surfaces.
- **Sand** (#ebe5d3): secondary buttons, hover fill for outline capsules and nav items, grey badge tint.
- **Muted Sand** (#efe9d9): ghost-button hover, quiet wells.
- **Muted Ink** (#5f5c51): secondary text and metadata (5.6:1 on cream, 6.6:1 on white).
- **Hairline** (#e2dbc7): the default divider and separator stroke.
- **Field Stroke** (#d6cdb4): input, textarea and select outlines at rest.
- **Alarm Red** (#c4321f): destructive actions, shown as a 10% tint capsule with red text; invalid fields.
- **Return Green** (#2f7a35): success and the check marks in match reasons.
- **Chart Found** (#2ba0ff) and **Chart Returned** (#5fb83a): admin stats series, alongside Found Coral for "lost".

Status badges use soft tint pairs that each clear 4.5:1: blue (#d8ecff / #0d4677), amber (#fbf1a6 / #5c4b00), violet (#f1ddff / #5a2780), green (#d9f2c8 / #285a17), red (#ffe1dc / #8a1f10), grey (Sand / Muted Ink).

### Named Rules
**The Zone Owns The Colour Rule.** A zone colour always means that zone. Item thumbnails, map lobes and filters must agree; never use a zone fill decoratively for something that is not located there (the How-it-works step discs are the one sanctioned exception and use sports, Building A, entrance in order).

**The Ink On Colour Rule.** Every coloured surface (sun, coral, all eight zones) carries ink text and ink icons. White text on these fills fails contrast and is not used.

**The Two Capsules Rule.** As control fills, sun and coral are reserved for the two report actions and the "This is mine" confirmation. Every other control is ink, white or sand.

## Typography

**Display Font:** Work Sans Variable (bundled via @fontsource, served same-origin)
**Body Font:** Work Sans Variable, falling back to PingFang SC / Hiragino Sans GB / Microsoft YaHei / Noto Sans SC for Chinese
**Label/Mono Font:** ui-monospace stack, for codes only

**Character:** One friendly geometric grotesk does everything; personality comes from weight 700 at large sizes with tight tracking, against a slightly heavier-than-normal 450 body that holds up next to CJK glyphs.

### Hierarchy
- **Display** (700, clamp(2.5rem, 5vw, 4.25rem), 0.98, -0.045em): the home hero question only.
- **Headline** (700, 2.25rem rising to 2.75rem from 640px, 1.02, -0.04em): page titles via the page header.
- **Title** (700, 1.5rem, -0.03em): section headings ("Recently found", "Possible matches").
- **Map Label** (700, clamp(0.9375rem, 4.4cqi, 1.875rem), 0.95, -0.04em): zone names on the large map, sized by the map's own width so they keep their proportion to the lobes; clamp(0.75rem, 3.7cqi, 1.125rem) on the compact map. The gate and "other" lobes are smaller and step their names down.
- **Item Title** (600, 1.0625rem, snug): item card headings, clamped to two lines and wrapped with `text-wrap: pretty` (balanced wrapping leaves card titles narrow and splits CJK words); strong match titles step up to 1.25rem.
- **Body** (450, 1rem, 1.5): running text; lead paragraphs at 1.0625-1.125rem with max 46-60ch.
- **Label** (600, 0.875rem): buttons, nav, form labels, meta emphasis. Metadata runs at 0.875rem 450 in Muted Ink, joined by middle dots (the `dot-list` utility: a wrapped line never starts or ends with a dot). In Chinese, "optional" marks take full-width brackets: 颜色（选填）.

### Named Rules
**The Latin-Only Tracking Rule.** Negative letter-spacing applies to Latin only. Under `:lang(zh)` all headings and display text reset to 0 tracking; tight tracking crushes CJK.

**The Size Not Colour Rule.** Rank information by size and weight. Do not add colour, caps or rules to signal hierarchy.

**The Tabular Count Rule.** Counts, times and table cells use tabular numerals.

## Layout

A centred page container (max 80rem) with 1rem side gutters below 640px and 1.5rem above, both respecting safe-area insets. The header is a sticky 4.5rem bar on a translucent cream with backdrop blur; primary nav appears from 1280px, the two report capsules from 768px, and a right-side sheet menu replaces nav below 1280px. "Admin" stays active on its sub-pages.

Home splits at 1024px into a map column (~1.1fr, left) and a hero column (1fr, right); below it stacks hero first, map second. Browse puts the compact map, category select and colour swatches in a white side panel beside a two-column item list. Item lists are a grid of one, two (from 768px) and three (from 1280px) columns with a 12px gap; the home "Recently found" grid shows nine items in three columns and drops the ninth on two-column widths so no card sits alone. The item page stacks photo, facts, next step on small screens; from 1024px the facts card (description and marks inside it) takes the main column and the photo and next step (claim, claim status, owner tools) sit in a 22-24rem column beside it, the step sticky. Sections are separated by spacing, not rules: 64px between sections; cards pad 24px (16px small). The footer is an ink slab with a 5rem gap above it.

## Elevation & Depth

Essentially flat, tonal: white cards lift off cream by value contrast, with a barely-there 1-2px shadow to stop them looking pasted. Real lift is a response to hover only.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px rgb(44 46 42 / 0.06)`): cards, item cards, language toggle, tab list.
- **Control rest** (`box-shadow: 0 1px 2px rgb(44 46 42 / 0.08)`): outline capsules and the search capsule on cream.
- **Capsule lip** (`box-shadow: 0 1px 0 rgb(44 46 42 / 0.12)`): a one-pixel ink lip under sun and coral capsules.
- **Card lift** (`box-shadow: 0 8px 24px -12px rgb(44 46 42 / 0.35)`): item card hover, paired with a 2px upward move.

### Named Rules
**The Flat Until Touched Rule.** Surfaces rest at the card-rest shadow or none; the deeper lift appears only on hover of a link card. Never use borders to separate a card from the cream.

## Shapes

Round is the house shape. Every pressable control is a full capsule (buttons, nav links, tabs, badges, search bar, language toggle); thumbnails, step markers, avatars, colour swatches and meter dots are circles. Containers use generous soft corners scaled to their size: 20px cards, ~22px fields, 24px match cards and dialogs, ~29px alerts, 32px feature panels. The only free-form geometry is the map lobe: a smooth seven-point closed curve, deterministic per zone, slightly wider than tall. The logo repeats it: two lobes meeting at a coastline with a sun pin.

## Components

### Buttons
Soft, confident capsules that press in.
- **Shape:** full capsule (9999px); 40px default, 32px small, 48px large, 56px on the home hero.
- **Primary (ink):** ink fill, Ink Reverse text, 600 weight, 16px side padding; hover drops to 85% ink.
- **Sun / Coral:** the two report actions and "This is mine". Ink text, one-pixel lip shadow, hover to the deep tone.
- **Outline:** white capsule with control-rest shadow and no visible border; hover fills Sand.
- **Ghost / Secondary / Destructive:** transparent with Muted Sand hover; Sand fill; 10% red tint with red text.
- **Hero chip:** hero capsules carry a 28px round ink chip with a cream arrow on their trailing edge (padding 28px left, 12px right); on hover the chip slides 4px right with the swell ease.
- **States:** 200ms expo-out on colour/shadow/transform; press scales to 0.97; focus is a 2px ink outline offset 2px; disabled at 50% opacity. An active nav-linked report capsule gets a 2px ink ring offset on cream. A selected state always wins over hover: selected tabs, pressed toggles and the current page are styled with `aria-selected:` / `aria-pressed:` / `aria-[current=page]:`, which follow `hover:` in the stylesheet (the `:where()`-based `data-*` variants have zero specificity and lose to hover). Destructive capsules darken their text on hover instead of deepening the tint, so they stay above 4.5:1. Unselected tabs use Muted Foreground (6.6:1 on white), not a 60% ink tint, which fell to 3.0:1.

### Chips and Badges
- **Style:** 24px capsules, 12px semibold, transparent border, soft tint pairs (see Colors); icon 12px leading.
- **Match strength** is never a badge: it is always the four-dot meter followed by the band word (match cards, claim review, About example).
- **Zone count capsule (map):** white at 95% with bold tabular count; turns ink with cream text when its lobe is selected.

### Cards / Containers
- **Corner Style:** 20px cards; 24px match cards; 32px feature panels.
- **Background:** Card White on Cream Water.
- **Shadow Strategy:** card rest; item cards lift on hover (see Elevation).
- **Border:** none.
- **Internal Padding:** 24px default, 16px small; item cards 14px with 16px right.

### Item Card
A horizontal row: a 64px circle holding the photo or, without one, the category line icon (stroke 1.6, ink) on the item's zone fill; then a two-line title, place and relative time in Muted Ink joined by a middle dot, and a small line of colour dots and category. A status badge appears only once the item is settled.

### Match Card
Larger for strong matches (96px thumbnail, 1.25rem title, 24px padding) and smaller for possible/weak ones (64px, 1rem, 16px). Header line: the four-dot meter then the band word. Reasons follow as one plain wrapping line; weak matches fold reasons behind a "Reasons (n)" disclosure. Actions sit below: sun "This is mine", outline "Not mine", ghost undo.

### Probability Meter
Four 10px dots, lit in ink, unlit at 15% ink. The dots always agree with the band word beside them: strong lights four, weak one, and possible two or three (split at the middle of the possible range). Band thresholds come from `/api/meta` (currently strong 0.7, possible 0.15). The exact percentage lives only in the accessible value and tooltip; it is never drawn.

### Match Reasons
One line at 0.9375rem, relaxed leading. Supporting reasons get a 14px green check; evidence against is red text with a minus and sorts last. Items are separated by a faint middle dot that never dangles at a line end (`dot-list`).

### Inputs / Fields
- **Style:** 44px white field, 1px Field Stroke outline, ~22px radius, 14px side padding.
- **Focus:** stroke turns ink plus a 2px ink ring at 15%.
- **Error / Disabled:** red stroke with a 3px 20% red ring; 50% opacity.
- **Search capsule:** the hero and browse search drop the stroke and become a white full capsule (56px / 48px) with control-rest shadow and an ink "Search" capsule docked inside the trailing edge.

### Navigation
Wordmark (lobe logo plus "FindMy" in 700 at -0.045em) on the left; nav links are 40px capsules in 600 ink that fill white on hover and ink when active. Right side: sun and coral report capsules, the 中文/EN segmented toggle (white capsule track, ink pressed segment), then account. Mobile uses a right sheet with 44px capsule links in the same active treatment.

### Campus Map (signature)
A 10:7 SVG of eight zone lobes on the cream ground, with real buttons laid over each lobe's label. Lobe scale is 0.6 + 0.55 x sqrt(count / max), so busier zones read bigger. Hover or focus or selection adds 0.07 scale and drops every other lobe to 42% opacity, over 400ms on the swell ease (cubic-bezier(0.34, 1.3, 0.64, 1)); reduced motion removes the transition. Large map shows name plus a white count capsule; the compact strip (browse filter) shows name and an inline count. The SVG frame is padded (viewBox −56 −12 1144 800.8) so even the busiest lobe at full swell stays inside it and never runs under neighbouring controls or a card edge; labels sit at the lobe centres.

### Evaluation Charts
The About page draws the Data Science Club's results itself, in both languages (numbers in `frontend/src/lib/evalResults.ts`, copied from `docs/eval_results.json`; recopy when the report is regenerated). Method bars are ink with a 20% ink tail for "in the top 3", the method FindMy runs in full ink and bold; the look-alike curves are ink solid, ink dashed and light-ink dotted lines over hairline gridlines, explained by a swatch legend. No raster or library charts on student pages.

## Do's and Don'ts

### Do:
- **Do** colour photo-less items by their zone fill behind an ink category icon, so lists stay legible as a map.
- **Do** keep every pressable thing a full capsule and every marker a circle.
- **Do** put ink text on sun, coral and all zone fills.
- **Do** show match strength with the four-dot ramp and explain it with the plain reason line.
- **Do** reset letter-spacing to 0 for Chinese headings.
- **Do** keep motion to the two named eases: swell (cubic-bezier(0.34, 1.3, 0.64, 1)) for the map and hero chip, expo-out (cubic-bezier(0.16, 1, 0.3, 1)) at 200ms for controls, and honour reduced motion.
- **Do** bundle every font and asset from the app's own origin.

### Don't:
- **Don't** draw percentage bars or print match percentages; a match is evidence, not proof.
- **Don't** put borders around cards or stack several badges on one item.
- **Don't** use sun or coral as a button or badge fill for anything except the report actions and "This is mine" (sun also appears as text selection, the logo pin and the entrance zone).
- **Don't** use a zone colour for something that is not in that zone, or as text colour.
- **Don't** add mascots, sonar or decorative illustration beyond the lobe map and lobe logo.
- **Don't** add uppercase tracked labels above headings; the heading carries its own weight.
- **Don't** load web fonts or assets from a CDN.

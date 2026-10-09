# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students at BASIS International School Park Lane Harbour (BIPH, Huizhou)** who lost something on campus or picked something up. Mostly on a laptop or iPad (confirmed 2026-10-09), sometimes a phone. Bilingual: English and 中文, often mixed in one description.
- **Front-desk staff / admins** who log handed-in items in bulk (Quick add), review claims, and watch stats on a desktop.

## Product Purpose

Campus lost & found. A student describes an item once in free text; the matcher compares it against every report from the other side (lost ↔ found) and shows ranked matches with the reasons it thinks they match. The student claims, then collects the item at the front desk with their student ID. Success = items go home to their owners, and the front desk spends less time on it.

## Positioning

Not a bulletin board: an explainable matcher built by the school's own Data Science Club (NLP over bilingual descriptions, distinguishing marks weighted heavily). Every match says *why* (same type, colour, place, brand, specific marks), and the student decides.

## Operating Context

- Built and run by students: Data Science Club (matcher, taxonomy, eval) × Sea Dragon Coding Club (platform). Q1 club output.
- School is in mainland China: browser talks only to our own origin; no external CDNs, fonts or scripts; strict same-origin CSP. Fonts must be bundled.
- Login: school email (basischina.com) one-time code. Names/emails never shown publicly.
- Physical handoff happens at the front desk; the app never replaces that.
- Campus places are a fixed list (areas → places: gym, cafeteria, library, school bus, dorm…).

## Capabilities and Constraints

Routes: home, browse (found items / lost reports, filters by category, colour, area, place), report lost / report found (describe, details, where, when, photos; live analysis chips), item page (matches with reasons, "This is mine" / "Not mine", claim), my items, admin (items, claims, stats), quick add (desk bulk entry), about / how matching works. Bilingual EN/中文 UI with toggle. React + Vite + Tailwind v4 + shadcn/ui (radix) components vendored in `frontend/src/components/ui`. Most items have no photo; category icons stand in.

## Brand Commitments

- Name: **BIPH FindMy** / 失物招领.
- User rejected the first custom design (saturated indigo, IBM Plex, angry dragon mascot, sonar dots) as "太猎奇" (too weird), then rejected the stock shadcn redesign as "没品味" — too template-like, messy hierarchy, cold. Wants a bold redesign that has taste and warmth without novelty for its own sake. No mascots.

## Evidence on Hand

Real matcher with eval numbers (docs/, matcher/): reports with a distinguishing mark were matched first 62% of the time vs 40% without. Production DB is empty; demo seed data exists for development only — never present it as real.

## Product Principles

1. Explain every match; the student decides, the app never claims ownership for them.
2. Fast for the desk, calm for the student: one clear next step per screen.
3. Bilingual by default; mixed EN/中文 text must look right.
4. Privacy first: no trackers, no public names.
5. Works on school Wi-Fi in mainland China (same-origin, small bundles).

## Accessibility & Inclusion

WCAG AA contrast; keyboard reachable; CJK and Latin typography both first-class.

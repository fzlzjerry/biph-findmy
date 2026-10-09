---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: []
---

# Surface: BIPH FindMy web app (all routes)

Mode: Operate. Users: BIPH students on laptop/iPad; front-desk admins on desktop. Code-led build (no image generation). User picked direction D "导览地图 Guide Map" from a Claude Design canvas of four mockups (https://claude.ai/artifact/MNwvqWsDJZeo7gv4cW4AQM).

## Direction contract

THESIS: The campus is the interface. Lost things belong to a place, so the eight campus zones are drawn as flat, swelling lobes of colour and every item carries its zone's colour. Refuses the default grey SaaS grid of identical photo-less cards with badge soup.

OWN-WORLD: Cream water ground #F5F1E4, ink #2C2E2A, white cards at 20px radius with no borders. Eight flat zone colours (sports green #8ED462, academic sky #7CC4FF, library mint #9FE3D6, dining coral #FF8A78, arts lilac #EBC1FF, boarding apricot #FFC58A, entrance yellow #F5E211, other sand #DCD6C4). One grotesk (Work Sans, bundled) at medium + bold; display tight (-0.04em, 0.95 leading). Controls are capsules: yellow primary, coral for "found", white secondary, with a round ink chip riding the trailing edge.

STORY: A student sees where things turn up on campus, taps their zone or describes the item, sees ranked matches with plain reasons, and claims. Desk staff log and review fast in dense white panels on the same cream.

FIRST VIEWPORT: Pill top bar (wordmark, Browse / My reports / How it works, language, two action capsules). Home: left ~55% the campus guide map, eight lobes sized by open-item count, each with its name and a white count capsule; right a big headline "Lost something at school?", the describe-search field, and recent finds as zone-coloured rows. Browse: map strip as zone filter above list.

FORM: Challenger "zoo and gardens guide map" (aww2-zoo-gardens-guide-map), user-chosen over assigned candidate 3 (museum catalogue); seed 2d9ddc9e. Signature move: the campus lobe map as navigation/filter; a selected lobe swells (0.4s overshoot) and the rest recede. Raises kept: match strength as a fixed 4-dot ramp, no percentage bars or badge soup; hierarchy by size contrast.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

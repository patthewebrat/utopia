# UTOPIA Remake — Art Direction

**Status:** authoritative visual spec for all renderer / sprite / UI work.
**Author:** Art direction pass, 2026-06.
**Sources studied:** original screenshots (`screenshots/lemon_screen_01/04/05/06/07.png`), decoded VGA tile sheets (`sprites/tiles/{gn,ice,volc,sand,fog,crys}_vga/_sheet.png`), adviser photos and invention pictures (`sprites/ui/`). These are *inspiration and palette references only*. **No extracted sprite may ever be copied, traced, or scaled into the app.** Every asset is drawn procedurally with Canvas 2D.

---

## 1. Overall style — "Holographic Frontier Colony"

The 1991 original is dense, dithered, neon-on-dark: a brown/grey raised colony slab floating over a black void, buildings as riotous magenta/cyan/gold clusters, a chunky icon rail on the right. We keep the *spirit* — a luminous human foothold on a hostile alien world, surrounded by darkness — and rebuild it with a modern hand:

- **Clean vector-like geometry.** Buildings and units are built from a small number of crisp filled paths (rounded boxes, prisms, cylinders, domes) — no noise textures on structures, no pixel dithering. Every silhouette must read at 0.5x zoom as a flat-colour blob of the right shape.
- **Soft gradients + rim light.** Each face of a structure gets a 2-stop linear gradient (light from upper-left, world light direction fixed at NW). Every building receives a 1–1.5 px rim-light stroke on its lit edges in the biome's ambient tint, and a soft elliptical contact shadow (`rgba(0,0,0,0.35)`, blur via radial gradient) on the ground.
- **Holographic accents.** Player tech glows: thin emissive strips, blinking nav lights, scanline shimmer on shields/ghosts. Emissive elements are drawn with `globalCompositeOperation: 'lighter'` and a low-alpha outer halo.
- **Hostile world, warm colony.** Terrain is desaturated and moody; the colony reads as the bright, saturated thing on top of it. Contrast between "alive colony" and "dead planet" is the core image of the game.
- **High-DPI aware.** All art authored as draw functions, rasterised at 2x logical resolution; canvas backing store scaled by `devicePixelRatio`. Nothing may depend on hand-placed single pixels.

Style keywords: **holographic frontier, vector-isometric, rim-lit, dark-console UI, neon-on-basalt.**

## 2. Geometry & rendering contract (engineers: honour exactly)

| Constant | Value |
|---|---|
| Projection | 2:1 isometric (diamond), no rotation |
| Logical tile | **64 × 32 px at zoom 1.0** |
| Tile diamond | half-width 32, half-height 16 |
| Max structure height | 96 px above tile top (3 tile-heights) at zoom 1.0 |
| Sprite authoring | Canvas2D draw functions → offscreen sprite canvases rendered at **2x** (retina master), drawn with `drawImage` scaled to zoom |
| Zoom range | **0.25x – 4x**, smooth; mip-select: use 1x raster below zoom 0.75, 2x raster above |
| Sprite canvas budget | per-sprite canvas ≤ 256×320 logical px; atlas optional later |
| Animation tick | **8 ticks/second** global animation clock (`animFrame = floor(t*8)`); all blinking/rotation phases derive from it plus a per-instance hash offset so lights don't blink in unison |
| Particles | immediate-mode (no sprites), drawn after structures, capped at 600 live particles |
| Draw order | terrain → deposits/overlays → shadows → structures+units back-to-front (y-sorted) → particles → selection/cursor → DOM UI |
| Anti-aliasing | leave canvas AA on; align tile vertices to half-pixels at zoom 1 |

A building occupies one tile footprint (as in the original). Sprites are anchored at the **bottom-centre of the tile diamond**.

## 3. Palettes

All hexes are masters; shading = HSL lighten/darken of these, never new hues per asset.

### 3.1 Global UI palette — "dark sci-fi console"

| Token | Hex | Use |
|---|---|---|
| `ui.bg` | `#070B0E` | page / void background |
| `ui.panel` | `#0D141A` @ 88% alpha | glass-dark panel fill |
| `ui.panelEdge` | `#12303A` | inner panel bevel |
| `ui.border` | `#1FB6C9` | 1px cyan panel borders, active outlines |
| `ui.cyan` | `#37E0F2` | primary accent, data values, selection |
| `ui.cyanDim` | `#1A7E8C` | inactive icons, gridlines |
| `ui.amber` | `#FFB347` | money, secondary accent, hover |
| `ui.amberDeep` | `#D97B1F` | pressed amber / fuel |
| `ui.text` | `#D8E6EA` | body text |
| `ui.textDim` | `#7E949C` | labels, units |
| `ui.warn` | `#FF4D4D` | warnings, damage, negative deltas |
| `ui.warnDark` | `#8C1A1A` | warning panel fill |
| `ui.ok` | `#5CE08A` | positive deltas, valid placement |
| `ui.violet` | `#A07BE8` | research / tech accents |

### 3.2 Faction colours

| Token | Hex | Use |
|---|---|---|
| `player.primary` | `#19B8A6` (teal) | player hulls, turret housings |
| `player.secondary` | `#E8F4F2` (white) | panels, trim, launch pad markings |
| `player.glow` | `#5FF2DC` | engines, lights, shields |
| `enemy.primary` | `#C8102E` (crimson) | enemy hulls |
| `enemy.secondary` | `#141014` (near-black) | enemy panels, underbellies |
| `enemy.glow` | `#FF3B30` | enemy engines, weapon charge |

Player language = horizontal, rounded, white-and-teal, soft glow. Enemy language = **angular, swept-back, blade-like crimson/black**, hard specular edges, red slit lights. The two must be distinguishable in monochrome by silhouette alone.

### 3.3 Biome palettes (sampled-from / inspired-by the VGA sheets, then modernised: lifted shadows, controlled saturation)

Each biome defines: `groundA/groundB` (base gradient), `groundDeep` (crevices), `feature1/feature2` (rocks/flora), `accent` (rare pop colour), `ambient` (rim-light tint applied to all sprites in that biome).

**Desert / Sand** (ref `sand_vga`: grey dunes, green scrub, gold spires)
`groundA #C9A86B · groundB #A8854C · groundDeep #6E5430 · feature1 #8C8C84 (grey rock) · feature2 #5C7A4A (scrub) · accent #E8C84A (gold spire crystal) · ambient #FFE2B0`

**Ice** (ref `ice_vga`: lavender ice, tan earth breaks)
`groundA #C7D9EE · groundB #93AECF · groundDeep #4E6B96 · feature1 #E9F4FF (ice shards) · feature2 #8A7458 (exposed earth) · accent #6FE3E8 (glacial teal) · ambient #DCEBFF`

**Volcanic** (ref `volc_vga`: red lava over green-black rock)
`groundA #3A3034 · groundB #241D22 · groundDeep #120D10 · feature1 #57414A (basalt) · feature2 #FF5A1F (lava, emissive) · accent #FFC93C (lava core / sparks) · ambient #FF8A5C`

**Green-Moss** (ref `gn_vga`: deep greens, magenta blooms)
`groundA #4E7A3C · groundB #33572B · groundDeep #1C331B · feature1 #6E9C50 (moss mounds) · feature2 #2E4630 (dark canopy) · accent #D957A8 (alien blooms) · ambient #C8E8A8`

**Fog / Grey-Rock** (ref `fog_vga`: charcoal ground, amber fungus, bone-white quills)
`groundA #4A4A50 · groundB #303036 · groundDeep #1A1A1E · feature1 #6A6A72 (slate slabs) · feature2 #C2C2B8 (quill growths) · accent #E08A2E (fungal amber, faint emissive) · ambient #9AA0AA` — plus a drifting low-alpha fog layer (`#B8C0C8` @ 6–10%, two scrolling sine-warped bands).

**Crystal** (ref `crys_vga`: red plains, rose/teal crystal monoliths)
`groundA #8C3038 · groundB #5E1F28 · groundDeep #38121A · feature1 #E8A0B4 (rose crystal, translucent) · feature2 #1F6E6A (teal crystal) · accent #B47BE8 (violet refraction) · ambient #F0B0C0` — crystals get a slow internal shimmer (gradient offset animated on the 8 Hz clock / 16).

(Extension biomes — mars, metal, gothic, tree, vine — reuse this token schema later.)

## 4. Per-building visual spec

Common rules: footprint 1 tile; base = a slim biome-neutral foundation plinth (`#2A3238`, 4 px tall) so buildings sit consistently on any terrain; player trim teal/white; all "lights" blink on the 8 Hz clock with per-instance offset; upgraded variants (Morgro, Solar Generator, Plasma, HDX, Long-Distance) must be readable as the same family with a visible "more" — never a different silhouette family.

1. **Living Quarters** — Three stepped white residential blocks rising left-to-right (like a tiny ziggurat of habitats), connected by a teal skybridge. Warm amber window grids (`#FFB347`) on dark faces; a rooftop antenna with a slow green blink. Cozy, the only building with *warm* windows everywhere — reads "home".
2. **Hydroponics** — Low wide barrel-vault greenhouse: translucent cyan-glass arch (alpha 0.6) over rows of glowing green crop strips (`#5CE08A`). White end-caps with a small water tank. Crop strips pulse very slowly (4 s cycle) like grow-lights. **Morgro variant:** glass tint shifts lime, a second half-height vault stacks on top, and a small bubbling algae cylinder (animated rising dots) sits at one end.
3. **Life Support** — Squat white cylinder with a ring of six intake louvres and a large rooftop turbine fan that rotates continuously (8 frames). Two cyan O₂ gauge strips on the drum. A faint upward shimmer of intake particles when powered.
4. **Space Moss Converter** — Built only on moss: a low teal tripod frame straddling a patch of glowing moss, with three drill-syphon tubes pulsing green light upward into a small collector sphere. The moss under it stays visible — the building is deliberately "open-frame".
5. **Power Station** — The colony's industrial heart: dark slate block with two slim cooling stacks and a glowing amber reactor window on the front face. Stacks emit a faint heat-ripple particle; reactor window flickers subtly. Tallest non-military civic silhouette after Living Quarters.
6. **Solar Panel** — A single large photovoltaic wing (deep blue-violet `#2A2E6E` with cyan cell gridlines) tilted toward the light on a thin white mast. Specular sweep animates across the panel every ~6 s. **Solar Generator variant:** twin wings in a V, plus a small glowing capacitor pod at the mast base — clearly "double".
7. **Flux Pod** — Iconic and unmissable (it defines build radius): a levitating teal-glass orb held above a tripod claw base, with three energy rings orbiting it. The orb **pulses** (scale 1.0→1.06, glow alpha 0.5→0.9, 2 s cycle). On hover/placement, its 12-tile radius draws as a faint cyan iso-diamond outline.
8. **Hospital** — White cross-plan block (literally a plus-shape footprint massing) with a red-cross-free modern emblem: a cyan caduceus-like double helix on the roof and a green "heartbeat" LED strip that animates an EKG blip around the parapet. Soft, rounded corners — the friendliest geometry in the set.
9. **Laboratory** — A white dome observatory with a violet (`#A07BE8`) glass oculus slice, plus a small side wing with chalkboard-dark windows. A slow violet scanning beam sweeps inside the oculus. Research = violet, everywhere in the game.
10. **Mine** — Angled gantry headframe over a dark pit cut into the tile, with a conveyor arm dumping ore sparks (tiny amber particles, intermittent) into a side hopper. Wheel at the gantry top rotates when manned. Dirty, mechanical, browns and gunmetal.
11. **Chemical Plant** — Cluster of three fat fractionating columns (white, amber hazard banding) joined by looping pipes, one short flare stack with a tiny animated orange flame. A round sump glows faint green. The "plumbing" building — all cylinders and pipe runs.
12. **Arms Lab** — Low hardened bunker, dark gunmetal with chamfered blast-resistant edges, a recessed red-lit entry slot, and four missile-like test cylinders racked diagonally on the roof. A slow red status light chases along the rack. Aggressive but squat.
13. **Workshop** — Sawtooth-roof factory shed (two teeth), teal doors, with a small yard crane arm that swings 30° back and forth while manned, and a pallet of white crates outside. Sparks flicker behind the skylights intermittently.
14. **Store** — A tidy stack of white shipping containers (3-2-1 pyramid) with teal end-doors and a small barcode-like ID panel per container. A tiny roof drone-pad dot blinks when the store is near capacity (amber) or full (red).
15. **Fuel Tank** — Single fat horizontal cylinder on cradles, white with a broad amber band and a vertical sight-glass showing the actual fill level (animated to stored fuel %). **Compressed variant:** same cylinder but ribbed with reinforcement rings and a second small sphere tank welded to one end; band turns deep-amber.
16. **Command Centre** — The crown jewel and prime enemy target: a stepped white tetra-pyramid with a teal command deck band near the top and a rotating slim comms vane on the apex. **Active** state: apex beacon breathes white, deck band lit. **Inactive:** all lights off, grey deck. Must read as "the important one" instantly.
17. **Security HQ** — Dark navy block with a white stripe wrap (police livery feel), barred slit windows, a short watchtower at one corner with a slowly rotating blue-white searchlight cone. The only blue-strobe in the colony.
18. **Sports Complex** — Open elliptical micro-stadium: white ring wall, glowing green pitch inset into the tile, four floodlight masts. During an **event**, floodlights turn on, the pitch animates with moving dot-crowds, and two tiny holo-fireworks pop per cycle. Otherwise dark and quiet.
19. **Radar** — White drum base with a classic lattice **parabolic dish that rotates continuously** (12-frame yaw cycle, ~4 s per revolution) on an A-frame mount, red aircraft light on the dish tip. **Long Distance variant:** the dish doubles in diameter, gains a boom-mounted feed horn, and a second small dome sits beside the drum; sweep slows to 6 s (feels heavier, farther-seeing).
20. **Laser Turret** — Low armoured turret ring with a twin-barrel laser on a yoke; idle = slow scanning rotation, target = snaps to bearing and barrels glow cyan-white before each shot (charge flash, then beam). 12 facing frames. **Plasma Gun variant:** single fatter barrel with three glowing toroid coils that light in sequence when charging; bolt is a teal plasma ball instead of a beam.
21. **Missile Launcher** — A single visible missile (white, teal nose) erect on a skeletal launch cradle with a fold-back gantry and a small blast deflector. Idle: a red "armed" lamp blinks at the cradle base. On fire: gantry folds, exhaust flash, smoke ring, tile left scorched-empty. **HDX variant:** black missile, red fins, sleeker needle nose, twin cable masts — meaner.
22. **Tank Construction Yard** — Open-sided assembly hall: heavy portal frame, overhead gantry crane that tracks back and forth over a **visible partial tank hull** that gains parts as the build progresses (3 stages: chassis → turretless hull → complete). Welding sparks flicker while manned. Doors face the SE tile edge where the tank emerges.
23. **Ship Construction Yard** — Larger sibling: a drydock cradle between two tower gantries with cross-bracing, holding a visible ship hull under construction (stage art per ship size). Blue welding arcs, hanging cables, an amber warning beacon on each tower. Reads "shipyard" from any zoom.
24. **Launch Pad** — Flat octagonal pad flush with the tile: dark surface, white perimeter ring, a big white "H-less" target roundel in player white, four corner lamps that chase green during landing/take-off and burn amber while refuelling. Scorch marks accumulate (drawn decal) after launches. Tanks may drive across it — keep it flat.
25. **Matter Transporter** — Two facing teal pylon horns (a tuning-fork arch) over a glowing pad; between the horns, a vertical shimmering energy curtain (animated alpha noise bands). When refuelling a ship in flight, a particle stream rises from the curtain and arcs offscreen toward the ship. Distinctly "energy tech", no moving mechanical parts.
26. **Tank Teleport** — Flat glowing glyph-pad: a teal iso-diamond inset with concentric animated chevrons that flow inward, and four corner posts with violet tips. On use: chevrons accelerate, a vertical light column flashes, tank vanishes/appears. Pairs visually with Matter Transporter (energy family) but flat like Launch Pad.
27. **Land Mine** — Nearly invisible by design (to the enemy, not the player): for the player it renders as a subtle dark disc with three low prongs and a tiny slow red blink (1 blink / 3 s); under fog/zoom-out it collapses to just the blink. Detonation = sharp white flash + dirt fountain particles.
28. **Scaffold** — Universal construction state: a teal wireframe holo-box outlining the future building's bounding volume (dashed edges, slowly rising scanline), surrounded by a real scaffold frame of grey poles and two tiny crane arms; build progress fills the holo-box bottom-up with the final sprite revealed behind a rising clip line. Dust puffs while active.
29. **Wreckage** — Collapsed dark rubble mound using the destroyed building's palette desaturated to 20%, two bent structural ribs sticking out, occasional grey smoke wisps (first 30 s after destruction) and a heat-ember glow that fades. Always uglier than terrain — it should nag the player to demolish it.

## 5. Units

**Tank** — Compact wedge hull in player teal with white turret, twin track units, short cannon; 8 facing directions; idle engine shimmer; muzzle flash + recoil nudge on fire. **Hover Tank variant:** tracks replaced by a skirted hover plenum with a cyan ground-effect glow ellipse and two rear thrust nacelles; hovers with a ±1 px bob (sine on anim clock); slightly taller silhouette.

**Ships (player)** — One family language: white hull, teal stripe, glowing engines; size and wing-count scale with class so the five are tellable apart at a glance:
- *Explorer:* small smooth teardrop, no weapons, big sensor canopy bubble, single engine.
- *Fighter:* slim dart, two swept winglets, twin small engines.
- *Assault Craft:* broader gull-wing body, chin cannon pod, twin engines + belly thruster.
- *Cruiser:* elongated hull with mid-spine fin, four engines, two turret bumps.
- *Warship:* the brick — wide hammerhead prow, layered armour plates, six engines, visible missile cells. Largest sprite (≈2 tiles long visually, 1-tile logic).
- *Fusion Cruiser:* Cruiser hull with the rear third replaced by a glowing white-blue toroidal fusion ring (slow rotation, never "refuel-amber"); no fuel hatch markings.

Flight: ships get an altitude offset + scaled soft shadow on the ground tile; engines emit additive glow quads, brighter on take-off/hover.

**Enemy craft** — Angular crimson/black: swept scythe wings, split twin tails, red slit canopy, black underside; engine glow is harsh red with hard-edged core. Enemy ground vehicles are low black wedges with crimson chevrons. All enemy lights are red; no white trim ever. Their motion style is darting/aggressive (faster turn snap) vs. the player's smooth easing.

**Projectiles** — Laser: 2 px white-core cyan beam, 80 ms life, additive. Plasma: 6 px teal ball + trailing glow. Missile: white/black dart with 12-particle smoke trail and flame dot. Enemy bolts: red, slightly jagged flicker.

**Explosions (procedural particle spec)** — No sprite sheets. Stage 1 (0–100 ms): white flash circle, additive, radius = damage-scaled. Stage 2 (0–600 ms): 12–24 ember particles, amber→red→dark, gravity-arced, additive. Stage 3 (200–1500 ms): 4–8 smoke puffs, grey, alpha-fade, slight rise. Building deaths add: 6 debris chunks (dark quads, tumble + bounce) and a ground scorch decal that fades over 60 s. Screen does **not** shake above zoom 2 (readability).

**Green bacteria cloud** — A drifting blob of 10–14 overlapping soft radial-gradient circles (`#7CE85C` core → transparent, alpha ≤ 0.35, additive off), boiling slowly (per-circle radius/offset sine), with a few rising spore dots. Sickly, organic, clearly *not* a faction colour — the only pure-green hazard in the game.

## 6. Terrain

- **Ground tiles:** each biome renders its diamond as `groundA→groundB` gradient plus 3–5 procedural low-contrast splats (`groundDeep`) seeded by tile coordinates (deterministic, no per-frame noise). Adjacent-tile variation comes from the seed, never from extra art.
- **Raised colony slab:** the whole 99×75 map (4-tile border) sits on a slab as in the original — visible chamfered cliff faces on the south/east map edges, drawn in `groundDeep` with strata lines, over the void (`ui.bg`) with a faint atmospheric glow line where slab meets void. This is the strongest nostalgia callback; keep it.
- **Features:** rocks = 2–3 stacked faceted polygons in `feature1` with rim light; ice shards = tall translucent prisms (alpha 0.85) with internal gradient; moss = soft rounded mounds in `feature1` with `accent` bloom dots; volcanic lava cracks = emissive `feature2` veins drawn in the tile, gently pulsing; crystal monoliths = translucent prisms with animated refraction band.
- **Deposit overlay glyphs** (toggleable map-knowledge layer, only where surveyed/detected): ore = amber hex-nut glyph; fuel = amber-deep droplet-in-circle; both drawn flat on the tile at 40% alpha with a thin dark outline, pulsing once when first revealed. Detector inventions simply reveal all glyphs.
- **Water/oil shimmer:** liquid tiles use a two-band specular sweep (light band translating across the diamond on a 5 s loop) plus 2–3 glint dots; oil variant tints the sweep iridescent (subtle violet/green dual gradient).

## 7. UI (DOM/CSS, not canvas)

Layout (fullscreen):
- **Top status strip** (40 px, full width): left = date (`DD/MM/2090+`) and game-speed/pause; centre = funds in amber with last-month delta arrow; right = **QoL %** as a slim radial dial + percentage (the win metric gets pride of place).
- **Right icon rail** (56 px wide, slim, modern homage to the original's panel): vertical stack of square icon buttons — Build, Demolish, Repair, Map, Industry, Finance, Spy, Advisers, Markers, Save/Options. Active tool = cyan filled; hover = amber outline; disabled = `ui.cyanDim` at 40%.
- **Bottom-left message log:** 3 visible lines, glass-dark, newest line types on; severity colour-codes the leading icon (info cyan / event amber / combat red). Click expands to scrollable history.

**Panel styling:** `ui.panel` glass-dark with `backdrop-filter: blur(8px)`, **1px `ui.border` cyan borders**, 6 px corner radius, 1 px inner `ui.panelEdge` bevel. Headers in small-caps tracking-wide `ui.textDim`. All numeric data in **JetBrains Mono, fallback ui-monospace/SF Mono/monospace**; prose in system-ui. Panels open with a 120 ms scale-fade; opening any panel pauses the sim (per game rules) and dims the world canvas to 60% + desaturate filter.

**Warning icons** (inline SVG, 20×20, stroke-based 1.5 px, drawn-not-imported): power = bulb outline with filament flash (animates `stroke-dasharray`); food = wheat-sprig in a crossed circle when starving; O₂ = "O₂" ligature in a bubble with rising dot; event runner = small running-figure glyph (homage to the original's event sprite) that animates legs when an event is live. Warnings pulse amber, critical pulses red at 1 Hz.

**Build palette:** modal grid (3 pages like the original, or one scrollable grid), each cell = building sprite render (the actual canvas draw at fixed zoom) on a dark tile, name beneath, **cost in amber mono** (e.g. `8 200 GR`). Unaffordable = 40% desaturated with red cost. Invented upgrades replace the base entry's art in place, with a small violet "NEW" pip for one game month.

**Advisers:** six **procedural vector portraits** (layered flat shapes, rim-lit, on dark portrait cards with cyan frame — inspired by the original photo cards, zero tracing):
- *Senior Psychiatrist* — older woman, silver asymmetric bob, violet high-collar tunic, calm half-smile, small neural-lace temple implant.
- *Colony Administrator* — heavyset man, warm brown skin, amber-tinted data monocle, teal utility vest over white shirt, clipboard tablet.
- *Finance Consultant* — slight, sharp-featured androgynous figure, slick black hair, amber pinstripe collar, gold ear cuff, faint smirk.
- *Civil Engineer* — broad woman in a white hard-hat with teal stripe, hi-vis amber shoulder yokes, smudge of regolith on one cheek.
- *Head of Research* — wiry man, untidy grey-streaked afro, violet lab coat, AR goggles pushed up, one eyebrow perpetually raised.
- *Supreme Commander* — square-jawed veteran woman, close crop, gunmetal uniform with teal rank bars, thin facial scar, steady stare.
Each portrait gets one idle micro-animation (blink, monocle glint) at most.

**Markers 1–8:** numbered map pins as small iso-diamond flags on thin posts, white numeral on teal disc; enemy-sighting auto-markers use amber. In the Map screen they render as the same disc without the post.

**Build cursor ghost:** the building sprite at 50% alpha tinted `ui.ok` green when placement is valid (in Flux-Pod range, terrain clear) with the tile diamond outlined green; invalid = tinted `ui.warn` red + small reason tag ("BUILD CLOSER TO FLUX POD"). Flux radius rings of all pods fade in while the ghost is active.

## 8. Title screen

- **Wordmark:** "UTOPIA" in a custom heavy extended geometric sans, drawn as canvas paths: letterforms carved like monolithic slabs (nod to the original's stone logo) but rendered as dark basalt blocks with a cyan holo-edge scan that travels the contour every 6 s; subtitle "THE CREATION OF A NATION" in letter-spaced mono beneath, amber.
- **Backdrop:** animated three-layer parallax starfield (200/120/60 stars, varying alpha/speed) over a slow-rotating gradient planet limb at the bottom of frame (biome-tinted, picks a random biome palette per boot) with a thin atmosphere glow arc.
- **Mascot nod:** the original's purple insectoid alien appears only as an **original silhouette** — a new, differently-proportioned quadrupedal alien profile (long neck, twin antennae, raised foreleg) perched atop the final "A", backlit in violet rim light against the planet. Silhouette only, never detailed, never traced.
- Menu items (New Colony / Load Colony / Options) as glass-dark buttons, cyan border, amber hover; the four original MP3 tracks offered as the optional music layer with an on/off toggle right on this screen.

---
*Any visual question not covered here: derive from the tokens in §3 and the style rules in §1; do not invent new hues or new animation clocks.*

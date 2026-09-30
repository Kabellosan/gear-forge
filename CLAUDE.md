# Gear Forge — context for Claude

Foundry VTT module for Captain's Dragonbane campaign. Tag tables for rolling up weapons, shields and armour with a story, and a Forge window: drop a base item → roll tags (d100 weapon / d20 shield / d20 armour) → reroll or hide single tags → create a Dragonbane item with stats, price and description adjusted. Optional fal.ai painting. Sister module to Face Forge (`~/face-forge`) and Terrain Forge (`~/terrain-forge`), same release flow.

## Design decisions (and why)

- **The vault note is the source of truth for the tags.** `build.mjs` parses `50 TTRPG Sanctum/63 TTRPG Systems/Dragonbane/Dragonbane - Arms & Armour Tags (Homebrew).md` into the compendium packs. Change a tag in the note, never in the packs. Keep its row formats: weapon `| 01 | **Name** | what | rule |` under band headings carrying `(+1)`; shield/armour `| 1 | **Name** | ± | rule |`.
- **Ids are hashed from names**, so rebuilds keep links; renaming a tag changes its id. `tests/lib.test.mjs` fails if an `EFFECTS` key no longer matches a tag name.
- **Painting is off by default and only happens on a click** (Captain: don't burn dollars on random loot). Rolling never calls fal.ai; the Paint button only renders when the *Paint gear* setting is on, and shows its cost.
- **Repaint the base item's own icon.** The Dragonbane core module's item icons share one frame and parchment, so a GPT Image 1.5 `/edit` of the base icon keeps the look for about 6¢ (1 input image). No icon (typed base name, or an SVG placeholder) → style references from a secret gist / world folder, else text-only with `DEFAULT_STYLE`.
- **The prompt gets each tag's *what it is* (or its name), never the Dragonbane rule**, so rules text doesn't end up painted.
- **Only simple, unambiguous tags change stats** (`EFFECTS` in lib.mjs: STR, Durability, damage step, system features like long/subtle/toppling/thrown/noparry/mounted, armour rating and bonuses). Everything else goes into the description for the GM to run.
- **Hidden tags** (eye toggle) go to `gmDescription`, visible ones to `itemDescription`; chat cards show visible tags only.
- **No copyrighted art in this repo.** Captain's reference icons (from the purchased Dragonbane module) live in `private/refs/` (gitignored); for Foundry they go in a secret gist or world folder.
- **fal key falls back to Face Forge's, then Terrain Forge's.** GM-only, no socket relay (players never forge).

## Dragonbane data (system 4.1.1, github.com/pafvel/dragonbane)

Item types: `weapon` (shields are weapons with feature `shield`), `armor`, `helmet`. Weapon system: `grip.value` (grip1h/grip2h), `str`, `range`, `damage` ("2D8"), `durability`, `features[]` (bludgeoning, piercing, slashing, long, mounted, noDamageBonus, noparry, subtle, thrown, toppling, shield, unarmed, enchanted1–3, penetrating1–3). Armor: `rating`, `banes` (string), `bonuses[]` (damage types). All gear: `cost` (string, e.g. "12 silver"), `weight`, `itemDescription`, `gmDescription` (HTML).

## Layout

- `build.mjs` – vault note → `packs/` (tables, rules journal, macro) + `module.json`. Needs the vault, so it runs on the server, not in CI; `packs/` is committed.
- `scripts/lib.mjs` – pure logic (effects, price, descriptions, prompt, request, cost). No Foundry globals.
- `scripts/main.mjs` – Foundry glue: settings, entry points, Forge window, fal call, item creation.
- `tests/` – `cd tests && node lib.test.mjs && node smoke.test.mjs` (run `npm run build` first so the name check has tables).

## Release flow

1. Edit the vault note and/or code. `npm run build`, then run the tests.
2. Bump `VERSION` in build.mjs and build again (it writes module.json with the matching download URL).
3. Push to main. `.github/workflows/release.yml` zips module.json, README, scripts, styles, packs and publishes the release.
4. Captain updates the module in Sqyre and restarts the world.

## Environment

Foundry v14 on Sqyre (installs by manifest URL only; zip needs module.json at the root). Dragonbane system 4.1.1.

## Open threads (as of v1.1.0)

- Nothing run on real Foundry yet: the Forge window, drop handling, `table.roll()` in v14, and the sidebar/context/sheet entry points are mock-tested only.
- Repainting 64–128 px icons: unknown how well GPT keeps the frame from such small inputs (they're upscaled to 512 before sending). If it drifts, composite a blank frame instead (like Face Forge's ring).
- Shield/armour tags have no *what it is* column in the note, so their prompts use tag names. Add a looks column if their art comes out muddy.

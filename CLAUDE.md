# Gear Forge — context for Claude

Foundry VTT module for Captain's Dragonbane campaign. Tag tables for rolling up weapons, shields and armour with a story, and a Forge window: drop a base item → roll tags (d100 weapon / d20 shield / d20 armour) → reroll or hide single tags → create a Dragonbane item with stats, price and description adjusted. Optional fal.ai painting. Sister module to Face Forge (`~/face-forge`) and Terrain Forge (`~/terrain-forge`), same release flow.

## Design decisions (and why)

- **Choice, not power; RAW first** (Captain, 2026-09-30): "make weapons cool and custom and afford choice for the players… not a power-fantasy", and "balanced towards RAW Dragonbane". Printed features/materials/spells replace our copies; custom tags stay at RAW mundane strength (+1 ≈ half of Mastercrafted); sidegrades preferred. The Rulebook and Book of Magic (Beta 3) are on the server in `~/cloud-lab/resources/dragonbane/` (grep the `.txt`). A balance pass is still owed.
- **Price** is anchored on RAW Mastercrafted (+2 = ×10, so ×√10 per point: 3, 10, 30, 100), capped at ×100; flaws ×½ / ×¼ / ×⅒ for −3 or worse (ours, Captain 2026-10-03). The asking price counts visible tags only (a seller doesn't discount a flaw nobody found); the GM line also shows the true worth with hidden tags.
- **Bought gear should be better about half the time** (Captain, 2026-10-03): the d100 has a *Demanding* band (34–49, +1): a two-point upgrade paid for with STR +3 or *Requires AGL 13* (our homebrew mirror of the STR rule; no AGL field on the sheet, so text only). Flaws are 81–00 (20%). Each published version of the vault note is kept in project files `gear-forge/backup/`.
- **Every weapon, shield and armour starts from a standard item with book stats** (Captain, 2026-10-04: no damage numbers showed, because a typed base name had no stats). A typed name resolves to the closest standard item (`matchBase`); a blank one rolls a random one (Roll, or the shuffle button). `baseCatalogue` reads Dragonbane Item compendiums, items inside Dragonbane Adventure compendiums (the core set ships its gear as one Adventure pack), and world items not forged here; only items with stats count (`hasStats`). An unknown name keeps the old text-only path and says so in the status line. No book stat table ships in this repo.
- **Tag count is random by default**: weighted 1–10, mostly about three (`TAG_COUNT_WEIGHTS`, Captain 2026-10-03); the GM can pick a fixed number. **Magic = Unique** (Rulebook p.73): no price, `supply: "unique"`.
- **Magic comes only from the Book of Magic**: d20 weapon/shield and d12 armour enchantments (rank-weighted), d12 drawbacks. Enchanted (01–03) and Cursed (00) roll into them automatically; **every drawback rolls one enchantment** (BoM's printed trade). Follow-up tags carry `parent`; rerolling or removing a tag takes its children with it.

- **Magic items have their own table and note** (Captain, 2026-10-04: "I kinda liked that chime which foretells of danger. It shouldn't be part of a weapon though. Just a chime."). `Dragonbane - Magic Items (Homebrew).md` (same vault folder) → the d100 *Magic Items* table and journal. Bands: 01–06 relic (≈ BoM rank 4–5; 01 points at the BoM's Legendary Artifacts), 07–25 wonder (rank 2–3, usually WP), 26–85 charm (rank 1: one boon or one small trick), 86–99 fickle (power + catch), 00 Cursed (drawback pays for another roll here). Rows are whole items (`wonder: true`, `band`), so they're magic and Unique. In the Forge the kind is `trinket` ("Magic item"): one item per roll, *Another power* adds a second, no Enchant button, created as Dragonbane type `item`; any `item`-type gear can be dropped as a base. The Omen Chime and Dowsing Hazel are the weapon tags cut in v1.4.0 for being magic.
- **The vault note is the source of truth for the tags.** `build.mjs` parses `50 TTRPG Sanctum/63 TTRPG Systems/Dragonbane/Dragonbane - Arms & Armour Tags (Homebrew).md` into the compendium packs. Change a tag in the note, never in the packs. Keep its row formats: weapon `| 01 | **Name** | what | rule |` under band headings carrying `(+1)`; shield/armour `| 1 | **Name** | ± | rule |`.
- **Ids are hashed from names**, so rebuilds keep links; renaming a tag changes its id. `tests/lib.test.mjs` fails if an `EFFECTS` key no longer matches a tag name.
- **Painting is off by default and only happens on a click** (Captain: don't burn dollars on random loot). Rolling never calls fal.ai; the Paint button only renders when the *Paint gear* setting is on, and shows its cost.
- **Repaint the base item's own icon.** The Dragonbane core module's item icons share one frame and parchment, so a GPT Image 1.5 `/edit` of the base icon keeps the look for about 6¢ (1 input image). No icon (typed base name, or an SVG placeholder) → style references from a secret gist / world folder if set, else **paint into a borrowed icon**: `pickIcon` takes a same-kind icon from any Dragonbane compendium plus the core set's gear folder `modules/dragonbane-coreset/assets/icons/gear` (read where Foundry installed it, kind from the file name via `kindFromFile`; 64 px webp: armor, axe, bow, hammer, helmet, shield, shield-crested, sword, dagger-poison…) (closest name to the typed base), and the prompt says replace the object, keep frame and style (still 1 input). Text-only with `DEFAULT_STYLE` is the last resort. Captain, 2026-10-03: text-only came out "too realistic"; every prompt now says hand-painted, not a photograph or 3D render, and `DEFAULT_STYLE` describes the core set icons as seen 2026-10-03: pale cream parchment, fine ink outlines, washed-out greys/browns/rust, dark teal Celtic knotwork border.
- **Names and descriptions are suggested, never applied** (Captain, 2026-10-03: "a bot could look at the tags and come up with a name or a small description"). *Suggest* calls fal.ai's `openrouter/router` (an OpenRouter LLM proxy) with the same fal key, so no second provider or key; default model Claude Haiku 4.5, changeable in *Writing model*. One request returns three options; a click fills the Name and Description fields. Only visible tags go in (hidden flaws must not leak into player text) and never the rules. The description lands in `itemDescription` above the Forged list and on the chat card. Painting reads the name and description too (Captain: "a fully fledged custom piece of gear with name and image"), so Suggest → pick → Paint gives matching text and art; the name goes in with "do not write the name on it". A picked name/description is dropped on a new roll or base unless the GM edited it.
- **Suggestions must fit the Vale** (Captain, 2026-10-03: no "Pulsar Raygun" from ranged tags). `WRITE_SETTING` in lib.mjs is an original setting guide (tone, peoples, medieval tech, how ranged and magic features read, folk naming patterns with invented examples; no Free League prose, the repo is public). The *Writing direction* setting appends campaign notes. The guide describes naming patterns without example names (the model copied "Mudwhistle", "Grandmother's Cleaver" verbatim on the first live test). `ANACHRONISM` drops any option with sci-fi/modern words before the GM sees it; widen that list rather than loosen the guide.
- **The prompt gets each tag's *what it is* (or its name), never the Dragonbane rule**, so rules text doesn't end up painted.
- **Only simple, unambiguous tags change stats** (`EFFECTS` in lib.mjs: STR, Durability, damage step, system features like long/subtle/toppling/thrown/noparry/mounted, armour rating and bonuses). Everything else goes into the description for the GM to run.
- **The window stays compact** (Captain, 2026-10-03: it "no longer really fits"). Picture (112 px; the base icon dimmed until painted) sits beside Name + Description; suggestions fold away once one is picked; the window re-fits its height on every render.
- **Hidden tags** (eye toggle) go to `gmDescription`, visible ones to `itemDescription`; chat cards show visible tags only.
- **The price is GM-only** (Captain, 2026-10-03): a highlighted Price line opens `gmDescription` and the Forge window shows it as a tag; the player description, chat card and the sheet's `system.cost` (left blank) never show it.
- **No copyrighted art in this repo.** Captain's reference icons (from the purchased Dragonbane module) live in `private/refs/` (gitignored); for Foundry they go in a secret gist or world folder.
- **fal key falls back to Face Forge's, then Terrain Forge's.** GM-only, no socket relay (players never forge).

## Dragonbane data (system 4.1.1, github.com/pafvel/dragonbane)

Item types: `weapon` (shields are weapons with feature `shield`), `armor`, `helmet`. Weapon system: `grip.value` (grip1h/grip2h), `str`, `range`, `damage` ("2D8"), `durability`, `features[]` (bludgeoning, piercing, slashing, long, mounted, noDamageBonus, noparry, subtle, thrown, toppling, shield, unarmed, enchanted1–3, penetrating1–3). Armor: `rating`, `banes` (string), `bonuses[]` (damage types). All gear: `cost` (string, e.g. "12 silver"), `weight`, `itemDescription`, `gmDescription` (HTML).

## Layout

- `build.mjs` – vault notes → `packs/` (`GEAR_FORGE_NOTE=<path>` / `GEAR_FORGE_MAGIC_NOTE=<path>` build from other copies) (7 tables, 2 journals, macro) + `module.json`. First cells like `73–74` are ranges (result weight = size). Needs the vault, so it runs on the server, not in CI; `packs/` is committed.
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

## Open threads (as of v1.7.0)

- v1.7.1 magic items: checked against the Rulebook (p.58, p.101) and BoM β3 ch.1 + ch.12 (p.116–129) on 2026-10-04. Enchanted items are passive/no WP/must be worn; MAGIC SEAL items cost WP. Mock-tested only in Foundry. Pre-book draft and each version are in project files `gear-forge/backup/` (Captain loves the original items: keep them).

- Suggest and text-only painting ran live on 2026-10-03 (v1.3.1). Borrowed-icon painting (v1.3.2) and the compendium index (pack `packageName` matching /dragonbane/) are not yet confirmed live.
- Otherwise mock-tested only: the Forge window, drop handling, `table.roll()` in v14, and the sidebar/context/sheet entry points are mock-tested only.
- Repainting 64–128 px icons: unknown how well GPT keeps the frame from such small inputs (they're upscaled to 512 before sending). If it drifts, composite a blank frame instead (like Face Forge's ring).
- Shield/armour tags have no *what it is* column in the note, so their prompts use tag names. Add a looks column if their art comes out muddy.

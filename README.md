# Gear Forge

A Foundry VTT module (v13–v14) for rolling up weapons, shields and armour with a story, and standalone magic items.

- **The Forge** (Items sidebar → *Gear Forge*, or right-click a weapon, shield or armour): drop a base item, type its name or leave it blank for a random standard one (it keeps its book damage, STR and armour), roll tags (a weighted 1–10, usually about three, or pick a number), reroll or hide any of them, and create the item with its stats, price and description adjusted.
- **Weapon Tags (d100)**: low is good, as in Dragonbane: 01 best (Enchanted), 00 worst (Cursed); 01–80 virtues (34–49 Demanding: better, with a STR or AGL requirement), 81–00 flaws. **Shield Tags (d20)** and **Armour Tags (d20)**: 1–15 virtues, 16–20 flaws.
- **Balanced toward Dragonbane RAW**: printed features first, price anchored on Mastercrafted (×10), and magic only from the *Book of Magic*: enchantment and drawback tables, with each drawback paying for an enchantment. Magic items are Unique, with no price.
- **Magic Items (d100)**: standalone magic items that aren't weapons or armour: 01–06 relics (01 a printed Legendary Artifact), 07–25 wonders, 26–85 charms, 86–99 fickle (a real power with a real catch), 00 cursed (a Book of Magic drawback that pays for a second power). Pick *Magic item* in the Forge to roll one, or drop any piece of gear on it to make that thing magic. Every item is Unique.
- **Rules journals**: how to use the tags, pricing, and the Dragonbane ground rules they lean on; and the magic item table with its design notes.
- **Forge a finished item**: one click picks a base (the typed one, or a random standard one), rolls the tags, takes the first suggested name and description, paints it when *Paint gear* is on, and creates the item. The button shows the cost.
- **Optional painting** with fal.ai, **off by default**. Turn on *Paint gear* in the module settings to get a Paint button (a few cents per image, only when you click it). It repaints the base item's own icon with the rolled tags, so the result matches your item art. With no item dropped, it paints into a matching Dragonbane compendium icon instead, so the frame and style still match.
- **Suggest a name and description.** Next to the Name field, *Suggest* asks a language model (through fal.ai, same key as painting) for three names with a one- or two-sentence description written from the visible tags. Click one to fill the Name and Description fields, then edit freely; nothing changes until you click. Hidden tags never reach the model, so a secret flaw can't leak into the text players read. Well under 1¢ a click; pick another model in *Writing model*. Paint after picking and the painting follows the name and description, so text and art match. A built-in Dragonbane setting guide keeps the writing medieval and folk-tale (bows and slings, never guns or lasers), anything off-setting is dropped before you see it, and *Writing direction* lets you add your own campaign notes.

Written for **Dragonbane**. Every tag has a system-free *what it is* half, so it travels to other games.

## Install

Foundry → *Add-on Modules* → *Install Module* → **Manifest URL**:

```
https://github.com/Kabellosan/gear-forge/releases/latest/download/module.json
```

## Build

The tables come from two Obsidian notes in the Ikairos vault (*Arms & Armour Tags* and *Magic Items*; `GEAR_FORGE_NOTE` / `GEAR_FORGE_MAGIC_NOTE` point the build at other copies). Edit the notes, bump `VERSION` in `build.mjs`, then:

```
npm install
npm run build
cd tests && node lib.test.mjs && node smoke.test.mjs
```

Push to main; a GitHub Action publishes the release.

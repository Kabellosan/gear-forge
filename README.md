# Gear Forge

A Foundry VTT module (v13–v14) for rolling up weapons, shields and armour with a story.

- **The Forge** (Items sidebar → *Gear Forge*, or right-click a weapon, shield or armour): drop a base item, roll two or three tags, reroll or hide any of them, and create the item with its stats, price and description adjusted.
- **Weapon Tags (d100)**: 01–75 virtues, 76–00 flaws. **Shield Tags (d20)** and **Armour Tags (d20)**: same 75/25 split.
- **Balanced toward Dragonbane RAW**: printed features first, price anchored on Mastercrafted (×10), and magic only from the *Book of Magic*: enchantment and drawback tables, with each drawback paying for an enchantment. Magic items are Unique, with no price.
- **Rules journal**: how to use it, pricing, and the Dragonbane ground rules the tags lean on.
- **Optional painting** with fal.ai, **off by default**. Turn on *Paint gear* in the module settings to get a Paint button (a few cents per image, only when you click it). It repaints the base item's own icon with the rolled tags, so the result matches your item art.

Written for **Dragonbane**. Every tag has a system-free *what it is* half, so it travels to other games.

## Install

Foundry → *Add-on Modules* → *Install Module* → **Manifest URL**:

```
https://github.com/Kabellosan/gear-forge/releases/latest/download/module.json
```

## Build

The tags come from an Obsidian note in the Ikairos vault. Edit the note, bump `VERSION` in `build.mjs`, then:

```
npm install
npm run build
cd tests && node lib.test.mjs && node smoke.test.mjs
```

Push to main; a GitHub Action publishes the release.

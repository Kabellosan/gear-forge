# Gear Forge

A Foundry VTT module (v13–v14) for rolling up weapons, shields and armour with a story.

- **Weapon Tags (d100)** — 01–75 virtues, 76–00 flaws. Roll two or three times; the tags are prompts, the fiction wins.
- **Shield Tags (d20)** and **Armour Tags (d20)** — same 75/25 split.
- **Rules journal** — how to use it, pricing, and the Dragonbane ground rules the tags lean on.
- **Forge Gear macro** — rolls on a table and whispers tags, net points and price multiplier to the GM.

Written for **Dragonbane**. Every tag has a system-free *what it is* half, so it travels to other games.

## Install

Foundry → *Add-on Modules* → *Install Module* → **Manifest URL**:

```
https://raw.githubusercontent.com/Kabellosan/gear-forge/main/module.json
```

## Build

The source of truth is an Obsidian note in the Ikairos vault
(`50 TTRPG Sanctum/63 TTRPG Systems/Dragonbane/Dragonbane - Arms & Armour Tags (Homebrew).md`).
Edit the note, bump `VERSION` in `build.mjs`, then:

```
npm install
npm run build   # → module.json + releases/gear-forge-<version>.zip
```

Document ids are hashed from names, so rebuilds keep links intact. Renaming a tag changes its id.

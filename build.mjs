// Builds the "Gear Forge" Foundry module from the vault note.
// The vault note is the single source of truth: edit the note, re-run `npm run build`.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { marked } from "marked";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const MODULE_ID = "gear-forge";
const REPO = "Kabellosan/gear-forge";
const VERSION = "1.2.1";
const NOTE = "/home/captain/cloud-lab/obsidian-data/vault/Ikairos-Server/Capt. Kabel Pairate Vault/"
  + "50 TTRPG Sanctum/63 TTRPG Systems/Dragonbane/Dragonbane - Arms & Armour Tags (Homebrew).md";
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, "dist", "_src");
const STATS = { coreVersion: "14.0", systemId: null, systemVersion: null };

// Stable 16-char ids, so rebuilding never breaks links a world has made to these documents.
const ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const id = key => [...crypto.createHash("sha256").update(key).digest()].slice(0, 16)
  .map(b => ID_CHARS[b % ID_CHARS.length]).join("");

const md = fs.readFileSync(NOTE, "utf8");
const plainText = s => String(s ?? "").replace(/\*\*|\*|`/g, "").replace(/\s*📜\s*/g, " ").trim();
const inline = s => marked.parseInline(s.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1"));

/* ---------------- Tables ---------------- */

// Weapon rows:      | 01 | **Name** 📜 | What it is | Dragonbane |   — points from the band heading "(+1)".
// Shield/armour:    | 1 | **Name** | ± | Dragonbane |
// Enchantments:     | 1–2 | **Name** | Rank | Dragonbane |
// Drawbacks:        | 1 | **Name** | Dragonbane |
// A first cell like "73–74" covers a range of results.
function parseSection(startHeading, endHeading) {
  const start = md.indexOf(startHeading);
  const end = endHeading ? md.indexOf(endHeading, start) : md.length;
  if ( start < 0 || end < 0 ) throw new Error(`Section not found: ${startHeading}`);
  return md.slice(start, end).split("\n");
}
const cells = line => line.split("|").slice(1, -1).map(c => c.trim());
const pts = s => Number(s.replace("−", "-").replace("+", ""));
const signed = n => n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
const ROW = /^\| (\d+)(?:–(\d+))? \| \*\*/;
const range = (line) => {
  const [, a, b] = line.match(ROW);
  const lo = a === "00" ? 100 : Number(a);
  return [lo, b ? (b === "00" ? 100 : Number(b)) : lo];
};

// Tags that send the Forge to another table: { table, times, drawback }.
const SPECIAL = {
  "Enchanted": { enchant: 1 },
  "Twice Enchanted": { enchant: 2 },
  "Cursed": { drawback: 1 },
  "Doubly cursed": { drawback: 2 }
};

function weaponRows() {
  let bandPoints = 0;
  const rows = [];
  for ( const line of parseSection("## ⚔️", "## ✨") ) {
    if ( line.startsWith("### ") ) { const m = line.match(/\(([+−-]?\d)\)/); bandPoints = m ? pts(m[1]) : 0; continue; }
    if ( !ROW.test(line) ) continue;
    const [, tag, what, rule] = cells(line);
    rows.push({ range: range(line), tag, points: bandPoints, what, rule });
  }
  return rows;
}

function d20Rows(startHeading, endHeading) {
  return parseSection(startHeading, endHeading).filter(l => ROW.test(l)).map(line => {
    const [, tag, points, rule] = cells(line);
    return { range: range(line), tag, points: pts(points), what: null, rule };
  });
}

function magicRows(startHeading, endHeading, { ranked }) {
  return parseSection(startHeading, endHeading).filter(l => ROW.test(l)).map(line => {
    const c = cells(line);
    return ranked
      ? { range: range(line), tag: c[1], points: 0, rank: Number(c[2]), what: null, rule: c[3], magic: true }
      : { range: range(line), tag: c[1], points: 0, what: null, rule: c[2], magic: true, drawback: true };
  });
}

function buildTable(key, name, formula, rows, description, img) {
  const tableId = id(`table:${key}`);
  const size = Number(formula.slice(2));
  const covered = rows.flatMap(r => Array.from({ length: r.range[1] - r.range[0] + 1 }, (_, i) => r.range[0] + i));
  if ( covered.length !== size || covered.some((n, i) => n !== i + 1) ) {
    throw new Error(`${name}: rows must cover 1–${size} exactly once, got ${covered.join(",")}`);
  }
  return {
    _id: tableId, _key: `!tables!${tableId}`, name, img, description, formula,
    replacement: true, displayRoll: true, folder: null, sort: 0, ownership: { default: 0 },
    flags: { [MODULE_ID]: { kind: key } }, _stats: STATS,
    results: rows.map(r => {
      const label = r.tag.replace(/\*\*/g, "");
      const plain = label.replace(/\s*📜\s*/, "").trim();
      const printed = label.includes("📜") ? " 📜 <em>printed</em>" : "";
      const what = r.what ? `${inline(r.what)} ` : "";
      const head = r.magic ? (r.rank ? `(rank ${r.rank})` : "(drawback)") : `(${signed(r.points)})`;
      const resultId = id(`result:${key}:${r.range[0]}`);
      const flags = { tag: plain, points: r.points, what: plainText(r.what), rule: plainText(r.rule) };
      if ( r.magic ) Object.assign(flags, { magic: true, rank: r.rank ?? null, drawback: !!r.drawback });
      if ( SPECIAL[plain] ) flags.special = SPECIAL[plain];
      return {
        _id: resultId, _key: `!tables.results!${tableId}.${resultId}`, type: "text", weight: r.range[1] - r.range[0] + 1,
        range: r.range, drawn: false, documentUuid: null,
        img: r.drawback || r.points < 0 ? "icons/svg/skull.svg" : r.magic ? "icons/svg/aura.svg" : "icons/svg/sword.svg",
        name: plain,
        description: `<p>${head}${printed} — ${what}<em>Dragonbane:</em> ${inline(r.rule)}</p>`,
        flags: { [MODULE_ID]: flags }, _stats: STATS
      };
    })
  };
}

const tables = [
  buildTable("weapon", "Weapon Tags (d100)", "1d100", weaponRows(),
    "01–75 virtues, 76–00 flaws. Roll two or three times; the tags are prompts, the fiction wins.",
    "icons/weapons/swords/sword-guard-steel.webp"),
  buildTable("shield", "Shield Tags (d20)", "1d20", d20Rows("## 🛡️", "## 🥋"),
    "1–15 virtues, 16–20 flaws.", "icons/equipment/shield/heater-steel-worn.webp"),
  buildTable("armour", "Armour Tags (d20)", "1d20", d20Rows("## 🥋", "## ❓"),
    "1–15 virtues, 16–20 flaws. Applies to the book's armour and helmets.",
    "icons/equipment/chest/breastplate-banded-steel.webp"),
  buildTable("weapon-enchantments", "Enchantments — Weapons & Shields (d20)", "1d20",
    magicRows("## ✨ d20 Enchantments", "## ✨ d12 Enchantments", { ranked: true }),
    "Book of Magic (Beta 3) enchanting spells, weighted by rank.", "icons/magic/symbols/runes-star-blue.webp"),
  buildTable("armour-enchantments", "Enchantments — Armour (d12)", "1d12",
    magicRows("## ✨ d12 Enchantments", "## 💀", { ranked: true }),
    "Book of Magic (Beta 3) enchanting spells for armour and helmets, weighted by rank.", "icons/magic/defensive/shield-barrier-blue.webp"),
  buildTable("drawbacks", "Drawbacks (d12)", "1d12", magicRows("## 💀", "## 🛡️", { ranked: false }),
    "Book of Magic (Beta 3) drawbacks. Each pays for one enchantment.", "icons/magic/unholy/strike-body-explode-disintegrate.webp")
];
const tableUuid = t => `Compendium.${MODULE_ID}.tag-tables.RollTable.${t._id}`;

/* ---------------- Journal ---------------- */

// One page per "## " section of the note. The callouts and provenance at the top become the first page.
const sections = md.split(/^## /m);
const intro = sections.shift().replace(/^# .*\n/, "")
  .replace(/^> \[!\w+\] (.*)$/m, "> **$1**");
const toHtml = text => marked.parse(text.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1"));
const tableLinks = "\n\n**Roll tables:** " + tables.map(t => `@UUID[${tableUuid(t)}]{${t.name}}`).join(" · ")
  + `\n\n**The Forge:** the *Gear Forge* button in the Items sidebar (or right-click a weapon, shield or armour). Drop a base item, roll tags, reroll or hide any of them, and create the item. Painting is off until the GM turns it on in the module settings.`;

const journalId = id("journal:rules");
const pages = [{ name: "About", body: intro + tableLinks }]
  .concat(sections.map(s => {
    const [heading, ...rest] = s.split("\n");
    return { name: heading.trim(), body: rest.join("\n") };
  }))
  .map((p, i) => ({
    _id: id(`page:${p.name}`), _key: `!journal.pages!${journalId}.${id(`page:${p.name}`)}`, name: p.name, type: "text", sort: (i + 1) * 100000,
    title: { show: true, level: 1 }, text: { format: 1, content: toHtml(p.body.replace(/\n---\s*$/, "")) },
    ownership: { default: -1 }, flags: {}, _stats: STATS
  }));

const journal = {
  _id: journalId, _key: `!journal!${journalId}`, name: "Arms & Armour Tags", folder: null, sort: 0,
  ownership: { default: 2 }, flags: {}, _stats: STATS, pages
};

/* ---------------- Macro ---------------- */

const tableIds = Object.fromEntries(tables.map((t, i) => [["weapon", "shield", "armour"][i], t._id]));
const macroCommand = fs.readFileSync(path.join(ROOT, "forge-gear.js"), "utf8")
  .replace("__MODULE_ID__", MODULE_ID).replace("__TABLE_IDS__", JSON.stringify(tableIds));
const macroId = id("macro:forge");
const macro = {
  _id: macroId, _key: `!macros!${macroId}`, name: "Forge Gear", type: "script", scope: "global",
  img: "icons/tools/smithing/anvil.webp", command: macroCommand, folder: null, sort: 0,
  ownership: { default: 0 }, flags: {}, _stats: STATS
};

/* ---------------- Write & compile ---------------- */

fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, "packs"), { recursive: true, force: true });
const packs = [
  { name: "tag-tables", label: "Gear Forge — Tables", type: "RollTable", docs: tables, ownership: { PLAYER: "NONE", ASSISTANT: "OWNER" } },
  { name: "tag-rules", label: "Gear Forge — Rules", type: "JournalEntry", docs: [journal], ownership: { PLAYER: "OBSERVER", ASSISTANT: "OWNER" } },
  { name: "tag-macros", label: "Gear Forge — Macros", type: "Macro", docs: [macro], ownership: { PLAYER: "NONE", ASSISTANT: "OWNER" } }
];
for ( const pack of packs ) {
  const src = path.join(SRC, pack.name);
  fs.mkdirSync(src, { recursive: true });
  for ( const doc of pack.docs ) fs.writeFileSync(path.join(src, `${doc._id}.json`), JSON.stringify(doc, null, 2));
  await compilePack(src, path.join(ROOT, "packs", pack.name));
}

const manifest = {
  id: MODULE_ID,
  title: "Gear Forge",
  description: "A d100 weapon tag table plus d20 shield and armour tables, for rolling up gear with a story. "
    + "Written for Dragonbane; the 'what it is' half of every tag works in any system.",
  version: VERSION,
  authors: [{ name: "Captain Kabello" }],
  url: `https://github.com/${REPO}`,
  manifest: `https://github.com/${REPO}/releases/latest/download/module.json`,
  download: `https://github.com/${REPO}/releases/download/v${VERSION}/module.zip`,
  compatibility: { minimum: "13", verified: "14" },
  esmodules: ["scripts/main.mjs"],
  styles: ["styles/gear-forge.css"],
  packs: packs.map(p => ({ name: p.name, label: p.label, path: `packs/${p.name}`, type: p.type, ownership: p.ownership })),
  packFolders: [{ name: "Gear Forge", sorting: "m", color: "#5a3a1a", packs: packs.map(p => p.name) }]
};
// module.json lives at the repo root; pushing a new version to main publishes a release (see .github/workflows).
fs.writeFileSync(path.join(ROOT, "module.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Built ${MODULE_ID} ${VERSION}: ${tables.map(t => `${t.name} (${t.results.length})`).join(", ")}, `
  + `${pages.length} journal pages, 1 macro`);

import fs from "node:fs";
import path from "node:path";
import * as L from "../scripts/lib.mjs";

const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };
const has = (s, part, what) => { if (!String(s).includes(part)) throw new Error(`${what}: "${s}" lacks "${part}"`); };
const lacks = (s, part, what) => { if (String(s).includes(part)) throw new Error(`${what}: "${s}" should not contain "${part}"`); };

// Kinds: shields are weapons with the shield feature; helmets roll on armour.
eq(L.kindOf({ type: "weapon", system: { features: ["slashing"] } }), "weapon", "weapon");
eq(L.kindOf({ type: "weapon", system: { features: ["shield"] } }), "shield", "shield");
eq([L.kindOf({ type: "armor" }), L.kindOf({ type: "helmet" }), L.kindOf({ type: "spell" })], ["armour", "armour", null], "armour kinds");
eq(L.kindOf({ type: "item" }), "trinket", "any other gear can become a magic item");
eq([L.tableFor("weapon"), L.tableFor("trinket"), L.enchantTableFor("armour"), L.enchantTableFor("shield"), L.enchantTableFor("trinket")],
  ["weapon", "magic-items", "armour-enchantments", "weapon-enchantments", "magic-items"], "tables per kind");

// Magic items: named after their power, labelled by band, painted from their look.
{
  const chime = { name: "Omen Chime", magic: true, wonder: true, band: "Charm", what: "A small brass bell on a cord that hums before danger.", rule: "Boon on Awareness." };
  eq([L.tagHead(chime), L.tagHead({ magic: true, rank: 2 }), L.tagHead({ magic: true, drawback: true }), L.tagHead({ points: -1 })],
    ["charm", "rank 2", "drawback", "−1"], "tag heads");
  eq(L.suggestName("", [chime]), "Omen Chime", "a magic item with no base is its power");
  eq(L.suggestName("Lantern", [chime]), "Lantern (Omen Chime)", "a base item keeps its name");
  eq(L.priceLabel([chime], ""), "Unique · no market price", "magic items are unique");
  const art = L.artPrompt({ baseName: "Omen Chime", tags: [chime], editing: false });
  has(art, "small brass bell", "painted from its look"); has(art, "glimmer of old magic", "a hint of magic"); lacks(art, "Awareness", "rules stay out");
  lacks(art, "runes", "not weapon runes");
  has(L.writePrompt({ kind: "magic item", baseName: "Omen Chime", tags: [chime] }).prompt, "- Omen Chime (magic power): A small brass bell", "writing sees the look");
}

// Damage steps.
eq([L.stepDamage("D8"), L.stepDamage("2D6"), L.stepDamage("D12"), L.stepDamage("2D10+2"), L.stepDamage("fist")],
  ["D10", "2D8", "D12+1", "2D12+2", "fist"], "damage steps");
eq([L.stepDamage("D8", -1), L.stepDamage("2D6", -1), L.stepDamage("D4", -1)], ["D6", "2D4", "D4"], "steps down stop at D4");

// Effects on a Dragonbane longsword.
const sword = { str: 13, durability: 15, damage: "2D8", grip: { value: "grip1h" }, features: ["piercing", "slashing"] }; // the book's longsword
eq(L.applyEffects(sword, [{ name: "Sturdy" }, { name: "Subtle" }, { name: "Ergonomic Grip" }]),
  { str: 10, durability: 18, features: ["piercing", "slashing", "subtle"] }, "sturdy subtle ergonomic");
eq(L.applyEffects(sword, [{ name: "Mastercrafted" }]), { str: 10, durability: 18 }, "RAW mastercrafted");
eq(L.applyEffects(sword, [{ name: "Parrying Guard" }]), { durability: 21, damage: "2D6" }, "parrying guard sidegrade");
eq(L.applyEffects(sword, [{ name: "Heavy Head" }]), { str: 16, durability: 12, damage: "2D10" }, "heavy head sidegrade");
eq(L.applyEffects(sword, [{ name: "Pole-Mounted" }]), { grip: { value: "grip2h" }, features: ["piercing", "slashing", "long"] }, "pole-mounted");
eq(L.applyEffects(sword, [{ name: "Broad Blade" }]), { durability: 18, features: ["slashing"] }, "broad blade");
eq(L.applyEffects(sword, [{ name: "Blunted Edge" }]), { features: ["piercing", "bludgeoning"] }, "blunted edge swaps slashing");
eq(L.applyEffects(sword, [{ name: "Dragon Glass" }]), { durability: 8 }, "dragon glass halves, rounding up");
eq(L.applyEffects(sword, [{ name: "Chain-Linked" }, { name: "Claimed" }]), { features: ["piercing", "slashing", "toppling", "noparry"] }, "chain-linked = flail");
eq(L.applyEffects(sword, [{ name: "Enchanted Weapon" }, { name: "Unbreakable" }]), { durability: 24, features: ["piercing", "slashing", "enchanted1"] }, "BoM spells");
eq(L.applyEffects({ features: ["bludgeoning"], durability: 12 }, [{ name: "Spiked Head" }]), { features: ["piercing"] }, "spiked head");
eq(L.applyEffects({ durability: 0, features: [] }, [{ name: "Sturdy" }]), {}, "no durability (flail) stays none");
eq(L.applyEffects(sword, [{ name: "Long" }, { name: "Long" }]), { features: ["piercing", "slashing", "long"] }, "no duplicate feature");
eq(L.applyEffects({ durability: 3 }, [{ name: "Fragile" }]), { durability: 1 }, "durability floor");
eq(L.applyEffects({ str: 0 }, [{ name: "Ergonomic Grip" }]), {}, "str floor, unchanged");
eq(L.applyEffects({ rating: 4, bonuses: [] }, [{ name: "Epic Armor" }, { name: "Padded Under-Layer" }, { name: "Muffled" }]),
  { bonuses: ["bludgeoning"] }, "armour: +1 and −1 cancel, bonus added");
eq(L.applyEffects({}, [{ name: "Sturdy" }]), {}, "no system data, no changes");

// Price.
eq([1, 2, 3, 4, 5, 6, 0, -1, -2, -3, -6].map(L.priceMultiplier), [3, 10, 30, 100, 100, 100, 1, 0.5, 0.25, 0.1, 0.1], "multipliers (RAW Mastercrafted = +2 = ×10, capped at ×100, ×⅒ for scrap)");
eq(L.scaleCost("12 silver", 0.1), "12 copper", "a tenth of the price");
eq([0.5, 0.25, 0.1, 3].map(L.multText), ["×½", "×¼", "×⅒", "×3"], "multiplier text");
{ const seq = [0, 0.099, 0.1, 0.5, 0.999]; let i = 0;
  eq(seq.map(() => L.rollTagCount(() => seq[i++])), [1, 1, 2, 3, 10], "weighted tag count"); }
{ const c = Array(11).fill(0); for (let i = 0; i < 1000; i++) c[L.rollTagCount((() => i / 1000))]++;
  eq([c[1], c[3], c[10]], [100, 300, 10], "tag count weights 10/30/1 per hundred"); }
eq([L.scaleCost("25 gold", 10), L.scaleCost("5 silver", 3), L.scaleCost("3 silver", 0.25), L.scaleCost("?", 2)],
  ["250 gold", "15 silver", "8 copper", null], "scaled cost");
eq(L.netPoints([{ points: 1 }, { points: 2, magic: true }, { points: -1 }]), 0, "magic tags don't count toward net");
eq([L.isUnique([{ points: 1 }]), L.isUnique([{ magic: true }])], [false, true], "magic = unique");

// Stat line: what the sheet would show, after the tags.
const statSword = { str: 10, durability: 12, damage: "2D8", grip: { value: "grip1h" }, features: ["slashing"] };
eq(L.statLine(statSword), "Damage 2D8 · STR 10 · Durability 12 · 1H · slashing", "stat line");
eq(L.statLine(statSword, [{ name: "Heavy Head" }, { name: "Long" }]), "Damage 2D10 · STR 13 · Durability 9 · 1H · slashing, long", "stat line after tags");
eq(L.statLine({ rating: 3, banes: "Sneaking", bonuses: ["slashing"] }), "Armour 3 · +2 vs slashing · bane: Sneaking", "armour stat line");
eq(L.statLine(undefined), "", "no stats");

// Descriptions: hidden tags go to the GM half.
const tags = [
  { name: "Sturdy", points: 1, what: "Thick spine.", rule: "Durability +3." },
  { name: "Accursed", points: -3, what: "It wants blood.", rule: "WIL roll.", hidden: true }
];
const d = L.describeTags(tags, { baseCost: "12 silver", priced: true });
has(d.visible, "Sturdy", "visible tag"); lacks(d.visible, "Accursed", "hidden tag stays hidden");
has(d.hidden, "Accursed", "gm sees hidden"); has(d.hidden, "Net −2", "net in gm half");
eq(L.suggestName("Longsword", tags), "Longsword (Sturdy)", "name");
eq(L.suggestName("Club", [tags[1]]), "Club", "no virtue, no suffix");
eq(L.suggestName("Axe", [...tags, { name: "Bane Weapon", magic: true, rank: 2 }]), "Axe (Bane Weapon)", "enchantment names it");
has(L.describeTags([{ name: "Keen Edge", magic: true, rank: 1 }]).hidden, "Unique", "unique footer");
eq(L.priceLabel([{ points: 2 }], "12 silver"), "12 gold", "price label scales the cost");
eq(L.priceLabel([{ points: 1 }], ""), "×3 book price", "no base cost, multiplier shown");
eq(L.priceLabel([{ magic: true }], "12 silver"), "Unique · no market price", "magic is unique");
has(d.hidden, "Price:</strong> 36 silver <em>(really worth 3 silver, counting hidden tags)", "asks for the visible tags, GM sees the true worth");
lacks(d.visible, "Price", "players don't see the price");
lacks(L.describeTags([tags[0]], { baseCost: "12 silver", priced: true }).hidden, "really worth", "no hidden flaws, one price");
eq(L.pricing(tags, "12 silver").asking.net, 1, "asking net ignores hidden tags");
has(L.tagHTML({ name: "Keen Edge", magic: true, rank: 1 }), "rank 1", "rank shown");

// Art prompt: looks, never rules; edit keeps the frame.
const edit = L.artPrompt({ baseName: "Longsword", tags, editing: true });
has(edit, "Thick spine", "look in prompt"); lacks(edit, "Durability", "rules stay out");
has(edit, "same frame", "edit keeps frame");
has(L.artPrompt({ baseName: "Longsword", tags, editing: false, style: "" }), "teal Celtic knotwork border", "default style");
has(L.artPrompt({ baseName: "Shield", tags: [{ name: "Hooked Rim" }], editing: false }), "Hooked Rim", "name when no look");
{
  const told = L.artPrompt({ baseName: "Longsword", tags, editing: true, name: "Greyfang", description: "A long blade,\n notched by old wars." });
  has(told, 'It is known as "Greyfang" (do not write the name on it). How it is described: A long blade, notched by old wars.', "written name and description go in");
  lacks(L.artPrompt({ baseName: "Longsword", tags, editing: false, name: "Longsword", description: "Plain." }), "known as", "no name line when it's just the base name");
  lacks(L.artPrompt({ baseName: "Longsword", tags, editing: true, name: "Greyfang" }), "Greyfang", "name alone adds nothing");
}
{
  const icons = [{ name: "Chainmail", img: "a/chainmail.webp", kind: "armour" }, { name: "Leather Armor", img: "a/leather.webp", kind: "armour" },
    { name: "Hand Axe", img: "a/axe.webp", kind: "weapon" }, { name: "Battle Axe", img: "icons/svg/axe.svg", kind: "weapon" }, { name: "Dagger", img: "a/dagger.webp", kind: "weapon" }];
  eq(L.pickIcon(icons, "armour", "rusty chainmail shirt").name, "Chainmail", "closest name wins");
  eq(L.pickIcon(icons, "weapon", "battle axe", () => 0).name, "Hand Axe", "SVG placeholders skipped; shared word wins");
  eq(L.pickIcon(icons, "weapon", "", () => 0.99).name, "Dagger", "no name: any of the kind");
  eq(L.pickIcon(icons, "shield", "buckler"), null, "nothing of the kind");
  const borrowed = L.artPrompt({ baseName: "Fishing hook", tags, editing: false, borrowed: true });
  has(borrowed, "Paint a new item into this icon: a Fishing hook: Thick spine", "borrowed icon prompt");
  has(borrowed, "Replace the object completely", "replace the borrowed object");
  for (const p of [borrowed, L.artPrompt({ baseName: "Axe", tags, editing: true }), L.artPrompt({ baseName: "Axe", tags, editing: false })]) has(p, "not a photograph", "never photographic");
  lacks(L.writePrompt({ kind: "weapon", baseName: "Axe", tags: [] }).system_prompt, "Mudwhistle", "no example names to copy");
}
eq(["x/axe.webp", "x/shield-crested.webp", "x/armor.webp", "x/helmet.webp", "x/dagger-poison.webp", "x/ring-gold.webp", "x/bag-gold.webp"].map(L.kindFromFile),
  ["weapon", "shield", "armour", "armour", "weapon", "trinket", "trinket"], "core set icon kinds from file names");
const magicPrompt = L.artPrompt({ baseName: "Axe", tags: [{ name: "Enchanted", what: "Something was bound", special: { enchant: 1 } }, { name: "Keen Edge", magic: true }, { name: "Death Wish", magic: true, drawback: true }], editing: true });
has(magicPrompt, "magical runes", "magic shows as runes"); lacks(magicPrompt, "Death Wish", "drawbacks not painted"); lacks(magicPrompt, "Something was bound", "pointer tags not painted");
eq([L.usableIcon("icons/svg/sword.svg"), L.usableIcon("modules/x/longsword.webp"), L.usableIcon("")], [false, true, false], "usable icon");

// Requests and cost.
const r = L.imageRequest({ prompt: "x", images: ["a"], quality: "low" });
eq([r.num_images, r.quality, r.image_urls.length, r.input_fidelity], [1, "low", 1, "high"], "edit request");
eq("image_urls" in L.imageRequest({ prompt: "x" }), false, "text request has no images");
eq(L.estimateCost("medium", 1).toFixed(3), "0.058", "cost with base icon");

// Every tag with an effect exists in the built tables (catches renames in the vault note).
const src = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "_src", "tag-tables");
if (fs.existsSync(src)) {
  const names = new Set(fs.readdirSync(src).flatMap((f) => JSON.parse(fs.readFileSync(path.join(src, f))).results.map((x) => x.name)));
  for (const n of Object.keys(L.EFFECTS)) if (!names.has(n)) throw new Error(`EFFECTS names "${n}", which no table has`);
}

// Writing: visible tags with their looks, never the rules; hidden flaws stay out.
{
  const tags = [
    { name: "Sturdy", points: 1, what: "Thick spine.", rule: "Durability +3." },
    { name: "Clumsy", points: -3, what: "In your way.", rule: "Bane on Evade.", hidden: true },
    { name: "Enchanted", points: 0, what: "Something was bound into it.", special: { enchant: 1 } },
    { name: "Keen Edge", magic: true, rank: 1, what: "", rule: "Armour one step lower." }
  ];
  const ask = L.writePrompt({ kind: "weapon", baseName: "Longsword", tags });
  has(ask.prompt, "Longsword (weapon)", "base item in the prompt");
  has(ask.prompt, "- Sturdy (feature): Thick spine\n- Keen Edge (enchantment)", "visible tags with looks");
  for (const bad of ["Clumsy", "In your way", "Durability", "Armour one step", "Enchanted ("]) lacks(ask.prompt, bad, "no hidden tags, rules or roll-on markers");
  has(ask.system_prompt, "JSON", "asks for JSON");
  eq(L.writeRequest({ ...ask, model: " " }).model, L.WRITE_MODEL, "default writing model");
  eq(L.writeRequest({ ...ask, model: "google/gemini-2.5-flash" }).model, "google/gemini-2.5-flash", "chosen writing model");
}
// Setting guardrails: medieval tech, the GM's notes on top, off-setting answers dropped.
{
  const ask = L.writePrompt({ kind: "weapon", baseName: "Shortbow", tags: [], style: " Names in the Vale are Frisian-sounding. " });
  for (const part of ["Dragonbane", "bows, crossbows, slings", "no gunpowder", "Campaign notes from the GM: Names in the Vale are Frisian-sounding.", "JSON only"]) has(ask.system_prompt, part, "setting guide");
  lacks(L.writePrompt({ kind: "weapon", baseName: "Shortbow", tags: [] }).system_prompt, "Campaign notes", "no empty campaign notes");
  has(ask.prompt, "never a firearm", "ranged features stay bows");
  eq([{ name: "Pulsar Raygun", description: "Hums." }, { name: "Old Thorn", description: "A yew crossbow, its trigger worn smooth." }, { name: "The Cannon", description: "" },
    { name: "Siege Splinter", description: "Steel and horn from a broken siege engine." }, { name: "Stormbow", description: "Arrows crackle with plasma." }].map(L.fitsSetting),
    [false, true, false, true, false], "off-setting words only");
}
eq(L.parseSuggestions('Sure!\n```json\n{"options":[{"name":" Greyfang ","description":"Old."},{"name":"","description":""}]}\n```'),
  [{ name: "Greyfang", description: "Old." }], "suggestions out of a fenced answer");
eq(L.parseSuggestions('{"name":"Solo","description":"One."}'), [{ name: "Solo", description: "One." }], "a single object");
eq([L.parseSuggestions("no json here"), L.parseSuggestions("{broken")], [[], []], "junk gives nothing");
eq(L.flavourHTML("A <b>blade</b>.\n\nSecond."), "<p>A &lt;b&gt;blade&lt;/b&gt;.</p><p>Second.</p>", "description as escaped paragraphs");
eq(L.flavourHTML("  "), "", "empty description adds nothing");


// A base with book stats: a typed name finds it, a blank one rolls a random one.
{
  const std = [
    { name: "Longsword", type: "weapon", system: { damage: "2D8" } },
    { name: "Short Sword", type: "weapon", system: { damage: "D10" } },
    { name: "Small Shield", type: "weapon", system: { features: ["shield"], durability: 15 } },
    { name: "Chainmail", type: "armor", system: { rating: 4 } },
    { name: "Stick", type: "weapon", system: {} }
  ];
  eq(L.matchBase(std, "weapon", "long sword")?.name, "Longsword", "base Longsword");
  eq(L.matchBase(std, "weapon", "shortsword")?.name, "Short Sword", "base Short Sword");
  eq(L.matchBase(std, "weapon", "pitchfork"), null, "base null");
  eq(L.matchBase(std, "weapon", "stick"), null, "base null");
  eq(L.matchBase(std, "shield", "")?.name, "Small Shield", "base Small Shield");
  eq(L.matchBase(std, "armour", "chain mail")?.name, "Chainmail", "base Chainmail");
  eq(L.matchBase(std, "weapon", "", () => 0.99)?.name, "Short Sword", "base Short Sword");
  eq(L.hasStats({ name: "Rope", type: "item", system: {} }), false, "gear has no book stats");
}

console.log("lib tests passed");

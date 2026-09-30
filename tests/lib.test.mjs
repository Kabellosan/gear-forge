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
eq([1, 2, 3, 4, 5, 0, -1, -2, -6].map(L.priceMultiplier), [3, 10, 30, 100, 300, 1, 0.5, 0.25, 0.25], "multipliers (RAW Mastercrafted = +2 = ×10)");
eq([L.scaleCost("25 gold", 10), L.scaleCost("5 silver", 3), L.scaleCost("3 silver", 0.25), L.scaleCost("?", 2)],
  ["250 gold", "15 silver", "8 copper", null], "scaled cost");
eq(L.netPoints([{ points: 1 }, { points: 2, magic: true }, { points: -1 }]), 0, "magic tags don't count toward net");
eq([L.isUnique([{ points: 1 }]), L.isUnique([{ magic: true }])], [false, true], "magic = unique");

// Descriptions: hidden tags go to the GM half.
const tags = [
  { name: "Sturdy", points: 1, what: "Thick spine.", rule: "Durability +3." },
  { name: "Accursed", points: -3, what: "It wants blood.", rule: "WIL roll.", hidden: true }
];
const d = L.describeTags(tags, { multiplier: 0.5, price: "6 silver (×0.5)" });
has(d.visible, "Sturdy", "visible tag"); lacks(d.visible, "Accursed", "hidden tag stays hidden");
has(d.hidden, "Accursed", "gm sees hidden"); has(d.hidden, "Net −2", "net in gm half");
eq(L.suggestName("Longsword", tags), "Longsword (Sturdy)", "name");
eq(L.suggestName("Club", [tags[1]]), "Club", "no virtue, no suffix");
eq(L.suggestName("Axe", [...tags, { name: "Bane Weapon", magic: true, rank: 2 }]), "Axe (Bane Weapon)", "enchantment names it");
has(L.describeTags([{ name: "Keen Edge", magic: true, rank: 1 }]).hidden, "Unique", "unique footer");
has(L.tagHTML({ name: "Keen Edge", magic: true, rank: 1 }), "rank 1", "rank shown");

// Art prompt: looks, never rules; edit keeps the frame.
const edit = L.artPrompt({ baseName: "Longsword", tags, editing: true });
has(edit, "Thick spine", "look in prompt"); lacks(edit, "Durability", "rules stay out");
has(edit, "same frame", "edit keeps frame");
has(L.artPrompt({ baseName: "Longsword", tags, editing: false, style: "" }), "teal ornamental frame", "default style");
has(L.artPrompt({ baseName: "Shield", tags: [{ name: "Hooked Rim" }], editing: false }), "Hooked Rim", "name when no look");
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

console.log("lib tests passed");

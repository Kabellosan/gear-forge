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

// Effects on a Dragonbane longsword.
const sword = { str: 10, durability: 12, damage: "2D8", features: ["slashing", "piercing"] };
eq(L.applyEffects(sword, [{ name: "Sturdy" }, { name: "Subtle" }, { name: "Ergonomic Grip" }]),
  { str: 7, durability: 15, features: ["slashing", "piercing", "subtle"] }, "sturdy subtle ergonomic");
eq(L.applyEffects(sword, [{ name: "Masterpiece of the Age" }]), { durability: 15, damage: "2D10" }, "masterpiece");
eq(L.applyEffects(sword, [{ name: "Unwieldy" }, { name: "Claimed" }]), { features: ["slashing", "piercing", "noparry"] }, "unwieldy");
eq(L.applyEffects(sword, [{ name: "Long" }, { name: "Long" }]), { features: ["slashing", "piercing", "long"] }, "no duplicate feature");
eq(L.applyEffects({ durability: 3 }, [{ name: "Fragile" }]), { durability: 1 }, "durability floor");
eq(L.applyEffects({ str: 0 }, [{ name: "Ergonomic Grip" }]), {}, "str floor, unchanged");
eq(L.applyEffects({ rating: 4, bonuses: [] }, [{ name: "Master-Forged" }, { name: "Padded Under-Layer" }]),
  { rating: 5, bonuses: ["bludgeoning"] }, "armour");
eq(L.applyEffects({}, [{ name: "Sturdy" }]), {}, "no system data, no changes");

// Price.
eq([L.priceMultiplier(0), L.priceMultiplier(2), L.priceMultiplier(-2), L.priceMultiplier(-6)], [1, 3, 0.5, 0.25], "multipliers");
eq([L.scaleCost("12 silver", 3), L.scaleCost("5 gold", 0.5), L.scaleCost("3 silver", 0.25), L.scaleCost("?", 2)],
  ["36 silver", "25 silver", "8 copper", null], "scaled cost");
eq(L.scaleCost("10 silver", 2), "2 gold", "rounds up to gold");

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

// Art prompt: looks, never rules; edit keeps the frame.
const edit = L.artPrompt({ baseName: "Longsword", tags, editing: true });
has(edit, "Thick spine", "look in prompt"); lacks(edit, "Durability", "rules stay out");
has(edit, "same frame", "edit keeps frame");
has(L.artPrompt({ baseName: "Longsword", tags, editing: false, style: "" }), "teal ornamental frame", "default style");
has(L.artPrompt({ baseName: "Shield", tags: [{ name: "Rawhide Face" }], editing: false }), "Rawhide Face", "name when no look");
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

// Pure logic for Gear Forge: tag effects, price, descriptions, art prompts.
// No Foundry globals, so the tests can run in plain Node.

export const MOD = "gear-forge";
export const EDIT_MODEL = "fal-ai/gpt-image-1.5/edit";
export const TEXT_MODEL = "fal-ai/gpt-image-1.5";
export const MAX_REFS = 4;

/** Which table a Dragonbane item rolls on. Shields are weapons with the "shield" feature. */
export function kindOf(item) {
  if (!item) return null;
  if (item.type === "armor" || item.type === "helmet") return "armour";
  if (item.type === "weapon") return (item.system?.features ?? []).includes("shield") ? "shield" : "weapon";
  return null;
}

/**
 * Tags that change a Dragonbane item's stats, not just its description.
 * Everything else lives in the description only: the GM applies it at the table.
 * feature/unfeature add or remove system features; swap replaces one damage type with another.
 */
export const EFFECTS = {
  // Weapons
  "Sturdy": { durability: +3 },
  "Ergonomic Grip": { str: -3 },
  "Mastercrafted": { str: -3, durability: +3 },
  "Subtle": { feature: ["subtle"] },
  "Toppling": { feature: ["toppling"] },
  "Long": { feature: ["long"] },
  "Can Be Thrown": { feature: ["thrown"] },
  "Parrying Guard": { durability: +6, damageStep: -1 },
  "Light Build": { str: -3, damageStep: -1 },
  "Heavy Head": { damageStep: +1, str: +3, durability: -3 },
  "Pole-Mounted": { feature: ["long"], grip: "grip2h" },
  "Short Haft": { unfeature: ["long"], grip: "grip1h" },
  "Throwing Balance": { feature: ["thrown"], damageStep: -1 },
  "Chain-Linked": { feature: ["toppling", "noparry"] },
  "Blunted Edge": { swap: ["slashing", "bludgeoning"] },
  "Broad Blade": { unfeature: ["piercing"], durability: +3 },
  "Spiked Head": { swap: ["bludgeoning", "piercing"] },
  "Dragon Glass": { halveDurability: true },
  "No Damage Bonus": { feature: ["noDamageBonus"] },
  "Fragile": { durability: -3 },
  "Demanding": { str: +3 },
  "Cannot Parry": { feature: ["noparry"] },
  "Saddle-Only": { feature: ["mounted"] },
  // Shields
  "Hooked Rim": { feature: ["toppling"] },
  "Reinforced Boss": { durability: +3 },
  "Light Frame": { str: -3 },
  "Shield Spike": { swap: ["bludgeoning", "piercing"] },
  "Splintery": { durability: -3 },
  // Armour
  "Articulated": { rating: -1 },
  "Muffled": { rating: -1 },
  "Padded Under-Layer": { bonus: "bludgeoning" },
  // Enchantments (Book of Magic, power level 1)
  "Unbreakable": { durability: +9 },
  "Enchanted Weapon": { feature: ["enchanted1"] },
  "Epic Armor": { rating: +1 }
};

const DIE_STEPS = [4, 6, 8, 10, 12];

/** "D8" → "D10", "2D6" → "2D8", "D12" → "D12+1"; steps down stop at D4. Unparseable → unchanged. */
export function stepDamage(damage, steps = 1) {
  const m = String(damage ?? "").trim().match(/^(\d*)\s*[dD](\d+)(.*)$/);
  if (!m) return damage;
  const [, count, sides, rest] = m;
  const i = DIE_STEPS.indexOf(Number(sides));
  if (i < 0) return damage;
  const j = Math.max(0, i + steps);
  if (j < DIE_STEPS.length) return `${count}D${DIE_STEPS[j]}${rest}`;
  return `${count}D12${rest}+${j - DIE_STEPS.length + 1}`;
}

/**
 * The system-data changes for a base item's `system` and a list of tags ({ name }).
 * Returns a partial `system` object with only the changed fields.
 */
export function applyEffects(system = {}, tags = []) {
  const out = {};
  const features = new Set(system.features ?? []);
  const bonuses = new Set(system.bonuses ?? []);
  let { str, durability, rating, damage } = system;
  let grip = system.grip?.value;
  for (const tag of tags) {
    const fx = EFFECTS[tag.name];
    if (!fx) continue;
    if (fx.str && typeof str === "number") str = Math.max(0, str + fx.str);
    if (fx.durability && typeof durability === "number" && durability > 0) durability = Math.max(1, durability + fx.durability);
    if (fx.halveDurability && typeof durability === "number") durability = Math.ceil(durability / 2);
    if (fx.rating && typeof rating === "number") rating = Math.max(0, rating + fx.rating);
    if (fx.damageStep && damage) damage = stepDamage(damage, fx.damageStep);
    if (fx.grip && grip !== undefined) grip = fx.grip;
    if (system.features) {
      for (const f of fx.feature ?? []) features.add(f);
      for (const f of fx.unfeature ?? []) features.delete(f);
      if (fx.swap && features.has(fx.swap[0])) { features.delete(fx.swap[0]); features.add(fx.swap[1]); }
    }
    if (fx.bonus && system.bonuses) bonuses.add(fx.bonus);
  }
  if (str !== system.str) out.str = str;
  if (durability !== system.durability) out.durability = durability;
  if (rating !== system.rating) out.rating = rating;
  if (damage !== system.damage) out.damage = damage;
  if (grip !== system.grip?.value) out.grip = { value: grip };
  const same = (a, b) => a.size === b.length && b.every((x) => a.has(x));
  if (system.features && !same(features, system.features)) out.features = [...features];
  if (system.bonuses && !same(bonuses, system.bonuses)) out.bonuses = [...bonuses];
  return out;
}

/** Points count only for mundane tags; magic makes an item Unique instead. */
export const netPoints = (tags) => tags.reduce((sum, t) => sum + (t.magic ? 0 : (t.points ?? 0)), 0);
export const isUnique = (tags) => tags.some((t) => t.magic);

/**
 * Price multiplier, anchored on RAW Mastercrafted (two improvements, ×10): ×√10 per point,
 * rounded to 3, 10, 30, 100… Flaws: ×½ for −1, ×¼ below that (no printed rule).
 */
export function priceMultiplier(net) {
  if (net > 0) return (net % 2 ? 3 : 1) * 10 ** Math.floor(net / 2);
  if (net === 0) return 1;
  return net === -1 ? 0.5 : 0.25;
}

const COIN = { gold: 100, gc: 100, silver: 10, sc: 10, copper: 1, cc: 1 };

/** "12 silver" × 3 → "36 silver". Unparseable costs come back null (the multiplier is shown instead). */
export function scaleCost(cost, multiplier) {
  const m = String(cost ?? "").trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)/i);
  const unit = m && COIN[m[2].toLowerCase()];
  if (!unit) return null;
  const copper = Math.max(1, Math.round(Number(m[1].replace(",", ".")) * unit * multiplier));
  if (copper >= 100 && copper % 100 === 0) return `${copper / 100} gold`;
  if (copper >= 10 && copper % 10 === 0) return `${copper / 10} silver`;
  return `${copper} copper`;
}

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function stripHTML(s) {
  return String(s ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export function slugify(s) {
  return String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "gear";
}

/** One tag as a list item: name, points, what it is, the Dragonbane rule. */
export function tagHTML(tag) {
  const what = tag.what ? ` — ${escapeHTML(tag.what)}` : "";
  const rule = tag.rule ? ` <em>Dragonbane:</em> ${escapeHTML(tag.rule)}` : "";
  const head = tag.magic ? (tag.drawback ? "drawback" : tag.rank ? `rank ${tag.rank}` : "magic") : signed(tag.points ?? 0);
  return `<li><strong>${escapeHTML(tag.name)}</strong> (${head})${what}${rule}</li>`;
}

/**
 * The HTML added to the item: visible tags for everyone, hidden ones (flaws the heroes
 * haven't found yet) for the GM. Returns { visible, hidden }; either may be "".
 */
export function describeTags(tags, { multiplier, price } = {}) {
  const shown = tags.filter((t) => !t.hidden);
  const secret = tags.filter((t) => t.hidden);
  const footer = isUnique(tags) ? "<p><em>Magical · Unique: no market price.</em></p>"
    : multiplier === undefined ? "" : `<p><em>Net ${signed(netPoints(tags))} · ${price ?? `×${multiplier} book price`}</em></p>`;
  return {
    visible: shown.length ? `<h3>Forged</h3><ul>${shown.map(tagHTML).join("")}</ul>` : "",
    hidden: (secret.length ? `<h3>Hidden tags</h3><ul>${secret.map(tagHTML).join("")}</ul>` : "") + footer
  };
}

/** A default name: an enchantment, else the strongest virtue, in brackets after the base item's name. */
export function suggestName(baseName, tags) {
  const spell = tags.find((t) => t.magic && !t.drawback && !t.hidden && !t.special);
  if (spell) return `${baseName} (${spell.name})`;
  const best = [...tags].filter((t) => (t.points ?? 0) > 0 && !t.special && !t.hidden).sort((a, b) => b.points - a.points)[0];
  return best ? `${baseName} (${best.name})` : baseName;
}

export const DEFAULT_STYLE =
  "A Dragonbane item icon: a single object lying diagonally across a square of aged, stained parchment, " +
  "inside a dark teal ornamental frame. Hand-painted storybook illustration: confident ink linework, loose watercolour and gouache washes, " +
  "slightly stylised shapes, muted earthy colours. No text, no hands, no background scene.";

const NOT_PHOTO = "Hand-painted illustration, not a photograph or 3D render.";

/**
 * What the image model sees: the base item and each tag's *visible* description (or its name), never the rules.
 * A written description (Suggest, or the GM's own) leads, so the painting matches the text players read.
 */
export function artPrompt({ baseName, tags, style, editing, borrowed, name, description }) {
  const looks = tags.filter((t) => !t.special && !t.drawback && !t.magic).map((t) => t.what || t.name)
    .filter(Boolean).map((w) => w.replace(/\.$/, ""))
    .concat(tags.some((t) => t.magic && !t.drawback) ? ["faint magical runes glowing along it"] : [])
    .join("; ");
  const item = String(baseName ?? "").trim() || "weapon";
  const told = String(description ?? "").replace(/\s+/g, " ").trim();
  const known = String(name ?? "").trim();
  const story = told ? `${known && known !== item ? `It is known as "${known}" (do not write the name on it). ` : ""}How it is described: ${told}` : "";
  if (borrowed) {
    return [
      `Paint a new item into this icon: a ${item}${looks ? `: ${looks}` : ""}.`,
      story,
      "Replace the object completely, but keep the exact same frame, parchment, composition, lighting and painting style as the original icon.",
      NOT_PHOTO,
      "One object only, no text."
    ].filter(Boolean).join(" ");
  }
  if (editing) {
    return [
      `Repaint this item icon as a variant of the ${item}${looks ? `: ${looks}` : ""}.`,
      story,
      "Keep the exact same frame, parchment, composition, lighting and painting style as the original icon.",
      NOT_PHOTO,
      "One object only, no text."
    ].filter(Boolean).join(" ");
  }
  return [
    `Paint a ${item}${looks ? `: ${looks}` : ""}.`,
    story,
    (style ?? "").trim() || DEFAULT_STYLE,
    "Match the painting style of any reference images, but do not copy their objects.",
    NOT_PHOTO,
    "One object only, no text."
  ].filter(Boolean).join(" ");
}

/**
 * With no base icon, borrow one from the Dragonbane compendiums to paint into: the same kind,
 * preferring the one whose name shares the most words with the typed base name.
 * icons: [{ name, img, kind }]. Returns one of them, or null.
 */
export function pickIcon(icons, kind, baseName = "", rand = Math.random) {
  const pool = (icons ?? []).filter((i) => i.kind === kind && usableIcon(i.img));
  if (!pool.length) return null;
  const words = new Set(String(baseName).toLowerCase().match(/[a-z]{3,}/g) ?? []);
  const score = (i) => (String(i.name).toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => words.has(w)).length;
  const best = Math.max(...pool.map(score));
  const top = pool.filter((i) => score(i) === best);
  return top[Math.floor(rand() * top.length)];
}

/** Can the base item's own icon be repainted? System SVG placeholders can't. */
export const usableIcon = (img) => !!img && /\.(webp|png|jpe?g)$/i.test(img) && !/^icons\/svg\//.test(img);

/** Request body for fal.ai: an edit (with images) or a plain generation. */
export function imageRequest({ prompt, images = [], quality = "medium" }) {
  const body = { prompt, image_size: "1024x1024", quality, num_images: 1, output_format: "png", sync_mode: true };
  if (images.length) Object.assign(body, { image_urls: images, input_fidelity: "high" });
  return body;
}

/** Rough cost in dollars: one output image plus each input image (~3k tokens at high fidelity). */
export function estimateCost(quality, inputImages = 0) {
  const perImage = { low: 0.009, medium: 0.034, high: 0.133 }[quality] ?? 0.034;
  return perImage + inputImages * 0.024;
}

export const IMAGE_EXT = /\.(webp|png|jpe?g)$/i;

/** The gist id from a gist page link, an API link, or a bare id. */
export function gistId(link) {
  const m = String(link ?? "").trim().match(/(?:gist\.github\.com\/(?:[^/]+\/)?|api\.github\.com\/gists\/|^)([0-9a-f]{20,40})(?:[/?#.]|$)/i);
  return m ? m[1] : null;
}

/** Pick at most `max` references; with more, a random selection each time. */
export function pickRefs(paths, max = MAX_REFS, rand = Math.random) {
  const list = [...new Set(paths)];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, max).sort();
}

/* Writing: a name and a short description from the tags (fal.ai's OpenRouter LLM endpoint). */

export const WRITE_ENDPOINT = "openrouter/router";
export const WRITE_MODEL = "anthropic/claude-haiku-4.5";

/**
 * The setting guardrails. Original text (no Free League prose: this repo is public).
 * The GM's *Writing direction* setting is appended for campaign specifics.
 */
export const WRITE_SETTING = [
  "You name and describe gear for Dragonbane: a gritty, folk-tale fantasy world with a dry sense of humour, rooted in Nordic folklore.",
  "The Misty Vale is a wild, ruined land of forests, marshes and old fallen kingdoms. Its peoples are humans, elves, dwarves, halflings, wolfkin and mallards (proud duck-folk).",
  "Technology is medieval: iron, steel, bronze, wood, bone, horn, leather, wool and stone, made by smiths, bowyers and fletchers. Ranged weapons are bows, crossbows, slings and things that are thrown.",
  "There is no gunpowder, clockwork, electricity or machinery, and nothing science-fiction, modern or industrial. Magic is rare, old and costly: runes, spirits, elemental and mind magic, curses and bargains with demons.",
  "Names sound folk-made, not marketed: a nickname earned in use, an owner's or maker's name in the possessive, or a plain descriptive \"the X's Y\". Invent fresh names that come from this item's own features; no brand-like or epic-superlative names.",
  "Descriptions read like an item card in a rulebook: concrete and sensory, with a hint of history, who made it or who lost it. Never state rules, numbers, dice or game mechanics; those are printed separately."
].join(" ");

const WRITE_FORMAT = "Answer with JSON only: {\"options\":[{\"name\":\"…\",\"description\":\"…\"}, …]}.";

/** Words that don't belong in the Vale. A suggestion using one is dropped. */
export const ANACHRONISM = /\b(guns?|gunpowder|pistols?|rifles?|muskets?|cannons?|blasters?|lasers?|ray ?guns?|raygun|pulsar|plasma|photon|ion|quantum|atomic|nuclear|cyber\w*|robot\w*|mech|android|electric\w*|batter(y|ies)|circuit\w*|motor\w*|turbo|rocket\w*|missile\w*|bullets?|cartridges?|trigger-happy|grenades?|sci-?fi|neon|chrome|titanium|aluminium|aluminum|plastic|digital|tech|futuristic)\b/i;

export const fitsSetting = (o) => !ANACHRONISM.test(`${o?.name ?? ""} ${o?.description ?? ""}`);

/**
 * The prompt for name/description suggestions. Only tags the players can see go in:
 * a hidden flaw must not leak into the description they'll read.
 */
export function writePrompt({ kind, baseName, tags, count = 3, style = "" }) {
  const lines = tags.filter((t) => !t.hidden && !t.special).map((t) => {
    const label = t.magic ? (t.drawback ? "curse" : "enchantment") : (t.points ?? 0) < 0 ? "flaw" : "feature";
    return `- ${t.name} (${label})${t.what ? `: ${t.what.replace(/\.$/, "")}` : ""}`;
  });
  const item = String(baseName ?? "").trim() || kind || "weapon";
  return {
    system_prompt: [WRITE_SETTING, String(style ?? "").trim() && `Campaign notes from the GM: ${String(style).trim()}`, WRITE_FORMAT].filter(Boolean).join("\n\n"),
    prompt: [
      `Base item: ${item} (${kind}).`,
      "Read each feature as it would exist in this world: a ranged or magical feature is a bow, crossbow, sling, throwing weapon, rune or spirit, never a firearm or device.",
      lines.length ? `What sets this one apart:\n${lines.join("\n")}` : "Nothing special sets it apart.",
      `Give ${count} different options. Each name is 1–4 words: an evocative name, a maker's mark, or "the X of Y"; not just the base item's name. ` +
      "Each description is 1–2 sentences, under 45 words, and works the features into what the item looks and feels like."
    ].join("\n\n")
  };
}

/** Request body for fal.ai's OpenRouter endpoint. */
export function writeRequest({ prompt, system_prompt, model }) {
  return { prompt, system_prompt, model: (model ?? "").trim() || WRITE_MODEL, temperature: 1, max_tokens: 600 };
}

/** The options out of the model's answer: tolerates code fences and chatter around the JSON. */
export function parseSuggestions(output) {
  const text = String(output ?? "");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let data;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  const list = Array.isArray(data) ? data : Array.isArray(data?.options) ? data.options : [data];
  return list.map((o) => ({ name: String(o?.name ?? "").trim(), description: String(o?.description ?? "").trim() }))
    .filter((o) => o.name || o.description).slice(0, 5);
}

/** The written description as HTML for the item: plain paragraphs, escaped. */
export function flavourHTML(text) {
  return String(text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escapeHTML(p)}</p>`).join("");
}

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
 */
export const EFFECTS = {
  "Ergonomic Grip": { str: -3 },
  "Demanding": { str: +3 },
  "Sturdy": { durability: +3 },
  "Fragile": { durability: -3 },
  "Reinforced Boss": { durability: +3 },
  "Splintery": { durability: -3 },
  "Masterpiece of the Age": { durability: +3, damageStep: 1 },
  "Subtle": { feature: "subtle" },
  "Toppling": { feature: "toppling" },
  "Throwable": { feature: "thrown" },
  "Returning Flight": { feature: "thrown" },
  "Long": { feature: "long" },
  "Unwieldy": { feature: "noparry" },
  "Saddle-Only": { feature: "mounted" },
  "Padded Under-Layer": { bonus: "bludgeoning" },
  "Master-Forged": { rating: +1 }
};

const DIE_STEPS = [4, 6, 8, 10, 12];

/** "D8" → "D10", "2D6" → "2D8", "D12" → "D12+1". Anything unparseable is returned unchanged. */
export function stepDamage(damage, steps = 1) {
  const m = String(damage ?? "").trim().match(/^(\d*)\s*[dD](\d+)(.*)$/);
  if (!m) return damage;
  const [, count, sides, rest] = m;
  const i = DIE_STEPS.indexOf(Number(sides));
  if (i < 0) return damage;
  const j = i + steps;
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
  let str = system.str, durability = system.durability, rating = system.rating, damage = system.damage;
  for (const tag of tags) {
    const fx = EFFECTS[tag.name];
    if (!fx) continue;
    if (fx.str && typeof str === "number") str = Math.max(0, str + fx.str);
    if (fx.durability && typeof durability === "number") durability = Math.max(1, durability + fx.durability);
    if (fx.rating && typeof rating === "number") rating += fx.rating;
    if (fx.damageStep && damage) damage = stepDamage(damage, fx.damageStep);
    if (fx.feature && system.features) features.add(fx.feature);
    if (fx.bonus && system.bonuses) bonuses.add(fx.bonus);
  }
  if (str !== system.str) out.str = str;
  if (durability !== system.durability) out.durability = durability;
  if (rating !== system.rating) out.rating = rating;
  if (damage !== system.damage) out.damage = damage;
  if (system.features && features.size !== system.features.length) out.features = [...features];
  if (system.bonuses && bonuses.size !== system.bonuses.length) out.bonuses = [...bonuses];
  return out;
}

export const netPoints = (tags) => tags.reduce((sum, t) => sum + (t.points ?? 0), 0);

/** The price multiplier for a net score: +n → ×(1+n); −n → ×(1 − ¼n), never below ¼. */
export function priceMultiplier(net) {
  return net >= 0 ? 1 + net : Math.max(0.25, 1 - 0.25 * Math.abs(net));
}

const COIN = { gold: 100, gc: 100, silver: 10, sc: 10, copper: 1, cc: 1 };

/** "12 silver" × 1.5 → "18 silver". Unparseable costs come back unchanged (the multiplier is shown instead). */
export function scaleCost(cost, multiplier) {
  const m = String(cost ?? "").trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)/i);
  const unit = m && COIN[m[2].toLowerCase()];
  if (!unit) return null;
  const copper = Math.round(Number(m[1].replace(",", ".")) * unit * multiplier);
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
  return `<li><strong>${escapeHTML(tag.name)}</strong> (${signed(tag.points ?? 0)})${what}${rule}</li>`;
}

/**
 * The HTML added to the item: visible tags for everyone, hidden ones (flaws the heroes
 * haven't found yet) for the GM. Returns { visible, hidden }; either may be "".
 */
export function describeTags(tags, { multiplier, price } = {}) {
  const shown = tags.filter((t) => !t.hidden);
  const secret = tags.filter((t) => t.hidden);
  const footer = multiplier === undefined ? "" : `<p><em>Net ${signed(netPoints(tags))} · ${price ?? `×${multiplier} book price`}</em></p>`;
  return {
    visible: shown.length ? `<h3>Forged</h3><ul>${shown.map(tagHTML).join("")}</ul>` : "",
    hidden: (secret.length ? `<h3>Hidden tags</h3><ul>${secret.map(tagHTML).join("")}</ul>` : "") + footer
  };
}

/** A default name: the strongest virtue's name in front of the base item's name. */
export function suggestName(baseName, tags) {
  const best = [...tags].filter((t) => (t.points ?? 0) > 0).sort((a, b) => b.points - a.points)[0];
  return best ? `${baseName} (${best.name})` : baseName;
}

export const DEFAULT_STYLE =
  "A Dragonbane item icon: a single painted object lying diagonally across a square of aged, stained parchment, " +
  "inside a dark teal ornamental frame. Painterly, realistic materials with soft lighting and gentle shadows. " +
  "No text, no hands, no background scene.";

/** What the image model sees: the base item and each tag's *visible* description (or its name), never the rules. */
export function artPrompt({ baseName, tags, style, editing }) {
  const looks = tags.map((t) => t.what || t.name).filter(Boolean).map((w) => w.replace(/\.$/, "")).join("; ");
  const item = String(baseName ?? "").trim() || "weapon";
  if (editing) {
    return [
      `Repaint this item icon as a variant of the ${item}${looks ? `: ${looks}` : ""}.`,
      "Keep the exact same frame, parchment, composition, lighting and painting style as the original icon.",
      "One object only, no text."
    ].join(" ");
  }
  return [
    `Paint a ${item}${looks ? `: ${looks}` : ""}.`,
    (style ?? "").trim() || DEFAULT_STYLE,
    "Match the painting style of any reference images, but do not copy their objects.",
    "One object only, no text."
  ].join(" ");
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

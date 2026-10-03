import * as L from "./lib.mjs";

const MOD = L.MOD;
const log = (...a) => console.log("Gear Forge |", ...a);
const ApplicationV2 = foundry.applications.api.ApplicationV2;
const KINDS = { weapon: "Weapon", shield: "Shield", armour: "Armour" };

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

Hooks.once("init", () => {
  game.settings.register(MOD, "paint", {
    name: "Paint gear with fal.ai",
    hint: "Off by default. When on, the Forge gets a Paint button (a few cents per image, only when you click it). Rolling tags never costs anything.",
    scope: "world", config: true, restricted: true, type: Boolean, default: false
  });
  game.settings.register(MOD, "quality", {
    name: "Image quality",
    hint: "Low ≈ 1¢ (rough), Medium ≈ 3¢, High ≈ 13¢, plus about 2¢ per image sent along as a reference.",
    scope: "world", config: true, restricted: true, type: String,
    choices: { low: "Low", medium: "Medium", high: "High" }, default: "medium"
  });
  game.settings.register(MOD, "falKey", {
    name: "fal.ai API key",
    hint: "Leave empty to use Face Forge's or Terrain Forge's key. Players could read a key saved here from the browser console.",
    scope: "world", config: true, restricted: true, type: String, default: ""
  });
  game.settings.register(MOD, "endpoint", {
    name: "Image endpoint",
    hint: "Leave as https://fal.run unless you run your own proxy.",
    scope: "world", config: true, restricted: true, type: String, default: "https://fal.run"
  });
  game.settings.register(MOD, "writeModel", {
    name: "Writing model",
    hint: "Suggests names and descriptions from the tags, through fal.ai's OpenRouter endpoint (same key). Any OpenRouter model id; empty = Claude Haiku 4.5, well under 1¢ a click.",
    scope: "world", config: true, restricted: true, type: String, default: ""
  });
  game.settings.register(MOD, "writeStyle", {
    name: "Writing direction",
    hint: "Optional campaign notes for Suggest: places, peoples, naming habits, tone. Added on top of the built-in Dragonbane setting guide.",
    scope: "world", config: true, restricted: true, type: String, default: ""
  });
  game.settings.register(MOD, "styleLink", {
    name: "Private style link",
    hint: "Optional: a secret GitHub gist of item icons in the look you want. Used when the base item has no icon to repaint. Keeps campaign art out of the public module.",
    scope: "world", config: true, restricted: true, type: String, default: ""
  });
  game.settings.register(MOD, "styleFolder", {
    name: "Style reference folder",
    hint: "Or a folder in your world with item icons in the look you want. Up to 4 go with each painting that has no base icon.",
    scope: "world", config: true, restricted: true, type: String, default: "", filePicker: "folder"
  });
  game.settings.register(MOD, "style", {
    name: "Art direction",
    hint: "Used when there's no base icon to repaint. Leave empty for the built-in Dragonbane item-icon look.",
    scope: "world", config: true, restricted: true, type: String, default: ""
  });
});

Hooks.once("ready", () => {
  game.modules.get(MOD).api = { open: (item) => GearForgeApp.open(item) };
  log("ready — open with game.modules.get('gear-forge').api.open(item?)");
});

/* ------------------------------------------------------------------ */
/*  Entry points (GM only)                                             */
/* ------------------------------------------------------------------ */

Hooks.on("renderItemDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".gf-open")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gf-open";
  btn.innerHTML = `<i class="fa-solid fa-hammer"></i> Gear Forge`;
  btn.addEventListener("click", () => GearForgeApp.open());
  (root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root).append(btn);
});

function itemFromLi(li) {
  const el = li instanceof HTMLElement ? li : li?.[0];
  const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
  return id ? game.items.get(id) : null;
}
const contextOption = {
  name: "Gear Forge", label: "Gear Forge",
  icon: '<i class="fa-solid fa-hammer"></i>',
  condition: (li) => game.user.isGM && !!L.kindOf(itemFromLi(li)),
  callback: (li) => GearForgeApp.open(itemFromLi(li))
};
Hooks.on("getItemContextOptions", (app, options) => options.push(contextOption));          // v13+
Hooks.on("getItemDirectoryEntryContext", (html, options) => options.push(contextOption)); // v12

Hooks.on("getHeaderControlsItemSheetV2", (app, controls) => {
  if (!game.user.isGM || !L.kindOf(app.document)) return;
  controls.push({ icon: "fa-solid fa-hammer", label: "Gear Forge", action: "gearForge", onClick: () => GearForgeApp.open(app.document) });
});
Hooks.on("getItemSheetHeaderButtons", (app, buttons) => {
  if (!game.user.isGM || !L.kindOf(app.item)) return;
  buttons.unshift({ label: "Gear Forge", class: "gear-forge-open", icon: "fa-solid fa-hammer", onclick: () => GearForgeApp.open(app.item) });
});

function reportError(what, err) {
  console.error("Gear Forge |", what, err);
  ui.notifications?.error(`Gear Forge: ${what}. ${err?.message ?? err}`);
}

/* ------------------------------------------------------------------ */
/*  Tag tables                                                         */
/* ------------------------------------------------------------------ */

let tableCache = null;
async function tagTable(kind) {
  if (!tableCache) {
    const pack = game.packs.get(`${MOD}.tag-tables`);
    if (!pack) throw new Error("the tag tables compendium is missing");
    tableCache = Object.fromEntries((await pack.getDocuments()).map((t) => [t.getFlag?.(MOD, "kind") ?? t.flags?.[MOD]?.kind, t]));
  }
  const table = tableCache[kind];
  if (!table) throw new Error(`no tag table for ${kind}`);
  return table;
}

const enchantTable = (kind) => (kind === "armour" ? "armour-enchantments" : "weapon-enchantments");

async function rollTag(tableKind, parent = null) {
  const table = await tagTable(tableKind);
  const { roll, results } = await table.roll();
  const r = results[0];
  const f = r.flags?.[MOD] ?? {};
  return {
    id: foundry.utils.randomID(), parent, roll: roll.total,
    name: f.tag ?? r.name, points: f.points ?? 0, what: f.what ?? "", rule: f.rule ?? L.stripHTML(r.description),
    magic: !!f.magic, rank: f.rank ?? null, drawback: !!f.drawback, special: f.special ?? null, hidden: false
  };
}

/**
 * Roll one tag and everything it sends you to: Enchanted rolls enchantments, Cursed rolls
 * drawbacks, and every drawback pays for one enchantment (Book of Magic's printed trade).
 */
async function rollExpanded(tableKind, itemKind, parent = null, depth = 0) {
  const tag = await rollTag(tableKind, parent);
  const out = [tag];
  if (depth > 4) return out;
  for (let i = 0; i < (tag.special?.enchant ?? 0); i++) out.push(...await rollExpanded(enchantTable(itemKind), itemKind, tag.id, depth + 1));
  for (let i = 0; i < (tag.special?.drawback ?? 0); i++) out.push(...await rollExpanded("drawbacks", itemKind, tag.id, depth + 1));
  if (tag.drawback && !tag.special) out.push(...await rollExpanded(enchantTable(itemKind), itemKind, tag.id, depth + 1));
  return out;
}

/** A tag and all tags it caused, as a set of ids. */
function family(tags, id) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tags) if (t.parent && ids.has(t.parent) && !ids.has(t.id)) { ids.add(t.id); grew = true; }
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/*  Painting (GM's browser)                                            */
/* ------------------------------------------------------------------ */

function filePicker() {
  return foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
}

function falKey() {
  const own = game.settings.get(MOD, "falKey").trim();
  if (own) return own;
  for (const mod of ["face-forge", "terrain-forge"]) {
    try { const k = (game.settings.get(mod, "falKey") ?? "").trim(); if (k) return k; } catch { /* module not installed */ }
  }
  return "";
}

async function ensureDir(path) {
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) {
    try { await filePicker().createDirectory("data", parts.slice(0, i).join("/")); } catch { /* already exists */ }
  }
}

function blobToDataURI(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** A blob typed by its file name: gists serve everything as text/plain. */
function typed(blob, name) {
  const ext = String(name).split(/[?#]/)[0].split(".").pop().toLowerCase();
  const type = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" }[ext];
  return type ? new Blob([blob], { type }) : blob;
}

async function fetchBlob(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`could not load ${url} (${r.status})`);
  return typed(await r.blob(), url);
}

/** Icons are tiny (64–128 px); the model sees them better upscaled. */
async function iconDataURI(url, size = 512) {
  const bmp = await createImageBitmap(await fetchBlob(url));
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, size, size);
  bmp.close?.();
  return c.toDataURL("image/png");
}

let gistCache = null;
async function styleRefUrls() {
  const urls = [];
  const link = game.settings.get(MOD, "styleLink").trim();
  if (link) {
    if (gistCache?.link === link && Date.now() - gistCache.at < 10 * 60 * 1000) urls.push(...gistCache.urls);
    else {
      const id = L.gistId(link);
      if (!id) throw new Error("The private style link isn't a gist link.");
      const res = await fetch(`https://api.github.com/gists/${id}`, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`could not read the private style gist (${res.status})`);
      const found = Object.values((await res.json())?.files ?? {}).filter((f) => L.IMAGE_EXT.test(f.filename)).map((f) => f.raw_url);
      gistCache = { link, at: Date.now(), urls: found };
      urls.push(...found);
    }
  }
  const folder = game.settings.get(MOD, "styleFolder").trim();
  if (folder) {
    const res = await filePicker().browse("data", folder);
    urls.push(...(res?.files ?? []).filter((f) => L.IMAGE_EXT.test(f)));
  }
  return L.pickRefs(urls);
}

const hasStyleRefs = () => !!(game.settings.get(MOD, "styleLink").trim() || game.settings.get(MOD, "styleFolder").trim());

/** Item icons from the Dragonbane system and its modules (the core module's share one frame and parchment). */
let iconIndex = null;
async function compendiumIcons() {
  if (iconIndex) return iconIndex;
  const out = [];
  for (const pack of game.packs?.values?.() ?? []) {
    if (pack.documentName !== "Item") continue;
    const pkg = `${pack.metadata?.packageName ?? ""} ${pack.metadata?.id ?? pack.collection ?? ""}`;
    if (!/dragonbane/i.test(pkg)) continue;
    try {
      const index = await pack.getIndex({ fields: ["img", "type", "system.features"] });
      for (const e of index) {
        const kind = L.kindOf(e);
        if (kind && L.usableIcon(e.img)) out.push({ name: e.name, img: e.img, kind });
      }
    } catch (err) { log("could not index", pack.collection, err); }
  }
  try {
    const res = await filePicker().browse("data", L.CORESET_ICONS);
    for (const img of res?.files ?? []) {
      const kind = L.kindFromFile(img);
      if (kind && L.usableIcon(img) && !out.some((o) => o.img === img)) out.push({ name: img.split("/").pop().replace(/\.\w+$/, "").replace(/-/g, " "), img, kind });
    }
  } catch { /* core set not installed */ }
  log(`${out.length} Dragonbane icons to paint into`);
  return (iconIndex = out);
}

/** How many images go along with a painting: the base icon, the style references, or a borrowed icon. */
function inputCount(base) {
  if (L.usableIcon(base?.img)) return 1;
  return hasStyleRefs() ? L.MAX_REFS : 1;
}

async function falPost(model, body) {
  const key = falKey();
  if (!key) throw new Error("No fal.ai API key. Add one in Configure Settings → Gear Forge (or Face Forge / Terrain Forge).");
  const endpoint = game.settings.get(MOD, "endpoint").replace(/\/+$/, "");
  const res = await fetch(`${endpoint}/${model}`, {
    method: "POST",
    headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new Error(`fal.ai rejected the key (${res.status}).`);
    throw new Error(`fal.ai error ${res.status}: ${text}`);
  }
  return res.json();
}

async function callFal(model, body) {
  const url = (await falPost(model, body))?.images?.[0]?.url;
  if (!url) throw new Error("fal.ai returned no image.");
  return (await fetch(url)).blob();
}

async function webp(blob, size = 512) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(bmp, 0, 0, size, size);
  bmp.close?.();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode the image"))), "image/webp", 0.9));
}

/** Paint the gear and upload it. Returns the image path. */
async function paint({ base, kind, baseName, tags, name, description }) {
  // Best: repaint the base item's own icon. Else the configured style references.
  // Else paint into a Dragonbane compendium icon of the same kind, so frame and style still match.
  const editing = L.usableIcon(base?.img);
  let images = editing ? [await iconDataURI(base.img)]
    : await Promise.all((await styleRefUrls()).map(async (u) => iconDataURI(u)));
  let borrowed = null;
  if (!images.length) {
    borrowed = L.pickIcon(await compendiumIcons(), kind, baseName);
    if (borrowed) { log("painting into", borrowed.name, borrowed.img); images = [await iconDataURI(borrowed.img)]; }
  }
  const prompt = L.artPrompt({ baseName, tags, editing, borrowed: !!borrowed, name, description, style: game.settings.get(MOD, "style") });
  log("painting:", prompt);
  const body = L.imageRequest({ prompt, images, quality: game.settings.get(MOD, "quality") });
  const blob = await callFal(images.length ? L.EDIT_MODEL : L.TEXT_MODEL, body);
  const dir = `worlds/${game.world.id}/gear-forge`;
  await ensureDir(dir);
  const file = new File([await webp(blob)], `${L.slugify(name)}-${Date.now()}.webp`, { type: "image/webp" });
  const up = await filePicker().upload("data", dir, file, {}, { notify: false });
  return up?.path ?? `${dir}/${file.name}`;
}

/** Ask the writing model for name/description options. Hidden tags stay out of the prompt. */
async function suggest({ kind, baseName, tags }) {
  const ask = L.writePrompt({ kind: KINDS[kind].toLowerCase(), baseName, tags, style: game.settings.get(MOD, "writeStyle") });
  log("writing:", ask.prompt);
  const res = await falPost(L.WRITE_ENDPOINT, L.writeRequest({ ...ask, model: game.settings.get(MOD, "writeModel") }));
  if (res?.error) throw new Error(`the writing model failed: ${res.error}`);
  const options = L.parseSuggestions(res?.output);
  if (!options.length) throw new Error("the writing model's answer had no suggestions in it");
  const fitting = options.filter(L.fitsSetting);
  if (fitting.length < options.length) log("dropped off-setting suggestions:", options.filter((o) => !L.fitsSetting(o)));
  if (!fitting.length) throw new Error("none of the suggestions fit the setting; click Suggest again");
  return fitting;
}

/* ------------------------------------------------------------------ */
/*  Making the item                                                    */
/* ------------------------------------------------------------------ */

async function gearFolder() {
  return game.folders.find((f) => f.type === "Item" && f.name === "Gear Forge")
    ?? Folder.create({ name: "Gear Forge", type: "Item", color: "#5a3a1a" });
}

function appendHTML(existing, extra) {
  return [existing, extra].filter(Boolean).join("");
}

async function createItem(s) {
  const tags = s.tags;
  const mult = L.priceMultiplier(L.netPoints(tags));
  const unique = L.isUnique(tags);
  const data = s.base ? foundry.utils.deepClone(s.base) : {
    name: s.baseName || KINDS[s.kind],
    type: s.kind === "armour" ? "armor" : "weapon",
    system: s.kind === "shield" ? { features: ["shield"] } : {}
  };
  delete data._id;
  delete data._stats;
  delete data.ownership;
  data.name = s.name || L.suggestName(data.name, tags);
  data.folder = (await gearFolder()).id;
  if (s.image) data.img = s.image;
  data.system = data.system ?? {};
  Object.assign(data.system, L.applyEffects(data.system, tags));
  const price = unique ? null : L.scaleCost(data.system.cost, mult);
  if (price) data.system.cost = price;
  if (unique && game.system.id === "dragonbane") Object.assign(data.system, { cost: "", supply: "unique" });
  const text = L.describeTags(tags, { multiplier: mult, price: price ? `${price} (×${mult})` : undefined });
  text.visible = L.flavourHTML(s.description) + text.visible;
  if ("itemDescription" in data.system || game.system.id === "dragonbane") {
    data.system.itemDescription = appendHTML(data.system.itemDescription, text.visible);
    data.system.gmDescription = appendHTML(data.system.gmDescription, text.hidden);
  } else if (typeof data.system.description === "string") {
    data.system.description = appendHTML(data.system.description, text.visible + text.hidden);
  } else if (data.system.description && typeof data.system.description === "object") {
    data.system.description.value = appendHTML(data.system.description.value, text.visible + text.hidden);
  }
  foundry.utils.setProperty(data, `flags.${MOD}`, { tags, base: s.baseUuid ?? null });
  return Item.create(data);
}

async function postCard(s) {
  const img = s.image ?? s.base?.img;
  const shown = s.tags.filter((t) => !t.hidden);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ alias: "The Forge" }),
    content: `<div class="gear-forge-card">
      ${img ? `<img src="${img}" alt="">` : ""}
      <h3>${L.escapeHTML(s.name || s.base?.name || s.baseName || "Forged gear")}</h3>
      ${L.flavourHTML(s.description)}
      ${shown.length ? `<ul>${shown.map(L.tagHTML).join("")}</ul>` : ""}
    </div>`
  });
}

/* ------------------------------------------------------------------ */
/*  Dialog                                                             */
/* ------------------------------------------------------------------ */

class GearForgeApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "gear-forge",
    tag: "div",
    classes: ["gear-forge"],
    window: { title: "Gear Forge", icon: "fa-solid fa-hammer", resizable: true },
    position: { width: 620, height: "auto" },
    actions: {
      roll: GearForgeApp.onRoll,
      add: GearForgeApp.onAdd,
      enchant: GearForgeApp.onEnchant,
      curse: GearForgeApp.onCurse,
      reroll: GearForgeApp.onReroll,
      remove: GearForgeApp.onRemove,
      hide: GearForgeApp.onHide,
      clearBase: GearForgeApp.onClearBase,
      paint: GearForgeApp.onPaint,
      suggest: GearForgeApp.onSuggest,
      pick: GearForgeApp.onPick,
      post: GearForgeApp.onPost,
      create: GearForgeApp.onCreate
    }
  };

  static instance = null;

  static async open(item = null) {
    if (!game.user.isGM) return ui.notifications.warn("Gear Forge is for the GM.");
    const app = GearForgeApp.instance ??= new GearForgeApp();
    if (item) app.setBase(item);
    return app.render({ force: true });
  }

  constructor() {
    super();
    this.gf = { base: null, baseUuid: null, baseName: "", kind: "weapon", count: 3, tags: [], name: "", nameEdited: false, description: "", suggestions: [], picked: null, image: null, busy: false, status: "" };
  }

  setBase(item) {
    const kind = L.kindOf(item);
    if (!kind) return ui.notifications.warn("Gear Forge: drop a weapon, shield or armour.");
    const s = this.gf;
    if (kind !== s.kind) s.tags = [];
    Object.assign(s, { base: item.toObject(), baseUuid: item.uuid, baseName: item.name, kind, image: null });
    this.forgetWriting();
    this.autoName();
  }

  /** New tags or a new base: drop the suggestions, and a picked name/description the GM didn't change since. */
  forgetWriting() {
    const s = this.gf;
    if (s.picked?.name && s.name === s.picked.name) { s.nameEdited = false; s.name = ""; }
    if (s.picked?.description && s.description === s.picked.description) s.description = "";
    Object.assign(s, { suggestions: [], picked: null });
  }

  autoName() {
    const s = this.gf;
    if (!s.nameEdited) s.name = s.tags.length ? L.suggestName(s.baseName || KINDS[s.kind], s.tags) : "";
  }

  async _renderHTML() {
    const s = this.gf;
    const net = L.netPoints(s.tags);
    const mult = L.priceMultiplier(net);
    const unique = L.isUnique(s.tags);
    const price = L.scaleCost(s.base?.system?.cost, mult);
    const painting = game.settings.get(MOD, "paint");
    const cost = L.estimateCost(game.settings.get(MOD, "quality"), inputCount(s.base));

    const base = s.base
      ? `<div class="gf-drop has-base">
           <img src="${s.base.img}" alt="">
           <span><strong>${L.escapeHTML(s.base.name)}</strong><br><small>${KINDS[s.kind]}${s.base.system?.damage ? ` · ${L.escapeHTML(s.base.system.damage)}` : ""}${s.base.system?.cost ? ` · ${L.escapeHTML(s.base.system.cost)}` : ""}</small></span>
           <a data-action="clearBase" title="Clear"><i class="fa-solid fa-xmark"></i></a>
         </div>`
      : `<div class="gf-drop"><i class="fa-solid fa-hand-holding"></i> Drop a weapon, shield or armour here — or name one:</div>
         <div class="gf-row">
           <select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === s.kind ? "selected" : ""}>${v}</option>`).join("")}</select>
           <input type="text" name="baseName" value="${L.escapeHTML(s.baseName)}" placeholder="longsword, hand axe, chainmail…">
         </div>`;

    const tags = s.tags.map((t, i) => `
      <li class="${t.points < 0 || t.drawback ? "is-flaw" : ""} ${t.magic && !t.drawback ? "is-magic" : ""} ${t.parent ? "is-child" : ""} ${t.hidden ? "is-hidden" : ""}">
        <span class="gf-num">${t.roll}</span>
        <span class="gf-tag"><strong>${L.escapeHTML(t.name)}</strong> (${t.magic ? (t.drawback ? "drawback" : `rank ${t.rank}`) : L.signed(t.points)})
          <small>${L.escapeHTML(t.what)} <em>${L.escapeHTML(t.rule)}</em></small></span>
        <a data-action="hide" data-index="${i}" title="${t.hidden ? "Hidden: only the GM sees it on the item" : "Visible to players"}"><i class="fa-solid ${t.hidden ? "fa-eye-slash" : "fa-eye"}"></i></a>
        <a data-action="reroll" data-index="${i}" title="Reroll"><i class="fa-solid fa-dice"></i></a>
        <a data-action="remove" data-index="${i}" title="Remove"><i class="fa-solid fa-trash"></i></a>
      </li>`).join("");

    const art = s.busy === "paint"
      ? `<div class="gf-art gf-wait"><i class="fa-solid fa-paintbrush fa-beat-fade"></i></div>`
      : s.image ? `<div class="gf-art"><img src="${s.image}" alt=""></div>` : "";

    const suggestions = s.suggestions.length ? `<ul class="gf-suggestions">${s.suggestions.map((o, i) => `
      <li><a data-action="pick" data-index="${i}" title="Use this name and description (you can still edit both)">
        <strong>${L.escapeHTML(o.name)}</strong> <span>${L.escapeHTML(o.description)}</span></a></li>`).join("")}</ul>` : "";

    return `
      ${base}
      <div class="gf-row">
        <label class="gf-count">Tags <input type="number" name="count" value="${s.count}" min="1" max="6"></label>
        <button type="button" data-action="roll" ${s.busy ? "disabled" : ""}><i class="fa-solid fa-dice-d20"></i> ${s.tags.length ? "Roll all again" : "Roll tags"}</button>
        <button type="button" data-action="add" ${s.busy ? "disabled" : ""}><i class="fa-solid fa-plus"></i> One more</button>
        <button type="button" data-action="enchant" ${s.busy ? "disabled" : ""} title="Roll a Book of Magic enchantment"><i class="fa-solid fa-wand-sparkles"></i> Enchant</button>
        <button type="button" data-action="curse" ${s.busy ? "disabled" : ""} title="Roll a drawback; it pays for one enchantment"><i class="fa-solid fa-skull"></i> Curse</button>
      </div>
      ${s.tags.length ? `<ul class="gf-tags">${tags}</ul>
        <p class="gf-summary">${unique ? `<strong>Magical · Unique</strong>: no market price` : `Net <strong>${L.signed(net)}</strong> · ${price ? `<strong>${price}</strong> (×${mult})` : `×${mult} book price`}`}</p>
        <div class="gf-row gf-name">
          <label>Name<input type="text" name="name" value="${L.escapeHTML(s.name)}"></label>
          <button type="button" data-action="suggest" ${s.busy ? "disabled" : ""} title="Suggest names and descriptions from the visible tags (well under 1¢)"><i class="fa-solid fa-feather${s.busy === "suggest" ? " fa-beat-fade" : ""}"></i> ${s.suggestions.length ? "Suggest more" : "Suggest"}</button>
        </div>
        ${suggestions}
        <label>Description<textarea name="description" rows="3" placeholder="Optional: goes on the item above the tags. Write your own or click Suggest.">${L.escapeHTML(s.description)}</textarea></label>
        ${art}` : ""}
      <footer class="gf-footer">
        <span class="gf-status">${L.escapeHTML(s.status)}</span>
        ${painting && s.tags.length ? `<button type="button" data-action="paint" ${s.busy ? "disabled" : ""}><i class="fa-solid fa-paintbrush"></i> ${s.image ? "Paint again" : "Paint it"} · ~$${cost.toFixed(2)}</button>` : ""}
        ${s.tags.length ? `<button type="button" data-action="post" ${s.busy ? "disabled" : ""}><i class="fa-solid fa-comment"></i> Post</button>
        <button type="button" data-action="create" ${s.busy ? "disabled" : ""}><i class="fa-solid fa-check"></i> Create item</button>` : ""}
      </footer>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    content.querySelectorAll("input, select, textarea").forEach((el) => el.addEventListener("change", () => {
      const s = this.gf;
      if (el.name === "count") s.count = Math.clamp(Number(el.value) || 3, 1, 6);
      else if (el.name === "name") { s.name = el.value; s.nameEdited = !!el.value; }
      else if (el.name === "description") s.description = el.value;
      else if (el.name === "kind") { if (el.value !== s.kind) s.tags = []; s.kind = el.value; this.autoName(); this.render(); }
      else if (el.name === "baseName") { s.baseName = el.value; this.autoName(); this.render(); }
    }));
    if (content.dataset.gfDrop) return;
    content.dataset.gfDrop = "1";
    content.addEventListener("dragover", (e) => e.preventDefault());
    content.addEventListener("drop", (e) => this.onDrop(e));
  }

  async onDrop(event) {
    event.preventDefault();
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    const data = TE.getDragEventData(event);
    if (data?.type !== "Item" || !data.uuid) return;
    const item = await fromUuid(data.uuid);
    if (!item) return;
    this.setBase(item);
    this.render();
  }

  async withBusy(kind, fn) {
    this.gf.busy = kind;
    await this.render();
    try { await fn(); }
    finally { this.gf.busy = false; if (this.rendered) await this.render(); }
  }

  static async onRoll() {
    const s = this.gf;
    await this.withBusy("roll", async () => {
      try {
        const tags = [];
        for (let i = 0; i < s.count; i++) tags.push(...await rollExpanded(s.kind, s.kind));
        Object.assign(s, { tags, image: null, status: "" });
        this.forgetWriting();
        this.autoName();
      } catch (err) { reportError("could not roll tags", err); }
    });
  }

  static async onAdd() {
    const s = this.gf;
    try { s.tags.push(...await rollExpanded(s.kind, s.kind)); this.autoName(); this.render(); }
    catch (err) { reportError("could not roll a tag", err); }
  }

  static async onEnchant() {
    const s = this.gf;
    try { s.tags.push(...await rollExpanded(enchantTable(s.kind), s.kind)); this.autoName(); this.render(); }
    catch (err) { reportError("could not enchant", err); }
  }

  static async onCurse() {
    const s = this.gf;
    try { s.tags.push(...await rollExpanded("drawbacks", s.kind)); this.autoName(); this.render(); }
    catch (err) { reportError("could not curse", err); }
  }

  static async onReroll(event, target) {
    const s = this.gf;
    try {
      const old = s.tags[Number(target.dataset.index)];
      const tableKind = old.drawback ? "drawbacks" : old.magic ? enchantTable(s.kind) : s.kind;
      const fresh = await rollExpanded(tableKind, s.kind, old.parent);
      const gone = family(s.tags, old.id);
      const at = s.tags.findIndex((t) => t.id === old.id);
      const kept = s.tags.filter((t) => !gone.has(t.id));
      kept.splice(Math.min(at, kept.length), 0, ...fresh);
      s.tags = kept;
      this.autoName(); this.render();
    } catch (err) { reportError("could not reroll", err); }
  }

  static onRemove(event, target) {
    const gone = family(this.gf.tags, this.gf.tags[Number(target.dataset.index)].id);
    this.gf.tags = this.gf.tags.filter((t) => !gone.has(t.id));
    this.autoName();
    this.render();
  }

  static onHide(event, target) {
    const t = this.gf.tags[Number(target.dataset.index)];
    t.hidden = !t.hidden;
    this.render();
  }

  static onClearBase() {
    Object.assign(this.gf, { base: null, baseUuid: null, baseName: "", image: null });
    this.forgetWriting();
    this.autoName();
    this.render();
  }

  static async onPaint() {
    const s = this.gf;
    if (!game.settings.get(MOD, "paint")) return;
    s.status = "Painting… (20–60 seconds)";
    await this.withBusy("paint", async () => {
      try {
        s.image = await paint({ base: s.base, kind: s.kind, baseName: s.baseName || KINDS[s.kind], tags: s.tags, name: s.name || s.baseName || "gear", description: s.description });
        s.status = "";
      } catch (err) {
        reportError("could not paint", err);
        s.status = "Painting failed. See the error above.";
      }
    });
  }

  static async onSuggest() {
    const s = this.gf;
    s.status = "Writing…";
    await this.withBusy("suggest", async () => {
      try {
        s.suggestions = await suggest({ kind: s.kind, baseName: s.baseName || s.base?.name || KINDS[s.kind], tags: s.tags });
        s.status = "Click a suggestion to use it.";
      } catch (err) {
        reportError("could not suggest a name", err);
        s.status = "Suggesting failed. See the error above.";
      }
    });
  }

  static onPick(event, target) {
    const s = this.gf;
    const o = s.suggestions[Number(target.dataset.index)];
    if (!o) return;
    if (o.name) Object.assign(s, { name: o.name, nameEdited: true });
    if (o.description) s.description = o.description;
    s.picked = o;
    s.status = "";
    return this.render();
  }

  static async onPost() {
    try { await postCard(this.gf); } catch (err) { reportError("could not post", err); }
  }

  static async onCreate() {
    try {
      const item = await createItem(this.gf);
      ui.notifications.info(`Gear Forge: created ${item.name}.`);
      item.sheet?.render(true);
    } catch (err) { reportError("could not create the item", err); }
  }

  async close(options) {
    GearForgeApp.instance = null;
    return super.close(options);
  }
}

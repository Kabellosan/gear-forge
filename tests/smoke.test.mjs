// Minimal Foundry + browser mock: open the Forge, drop a longsword, roll and reroll tags,
// check the paint button stays away while painting is off, then paint and create the item.
const hooks = {};
globalThis.Hooks = { once: (n, f) => (hooks[n] ??= []).push(f), on: (n, f) => (hooks[n] ??= []).push(f) };
const fire = (n, ...a) => (hooks[n] ?? []).forEach((f) => f(...a));
const errors = [];
globalThis.ui = { notifications: { info: () => {}, warn: (m) => errors.push(m), error: (m) => errors.push(m) } };
Math.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const content = () => ({ dataset: {}, set innerHTML(v) { this.v = v; }, querySelectorAll: () => [], addEventListener() {} });
class ApplicationV2 {
  #s = 0;
  #content = content();
  constructor(o = {}) { this.options = { ...this.constructor.DEFAULT_OPTIONS, ...o }; }
  get state() { return this.#s; }
  get rendered() { return this.#s === 2; }
  async render() { const html = await this._renderHTML(); this._replaceHTML(html, this.#content); this.#s = 2; this.lastHTML = html; return this; }
  async close() { this.#s = 0; }
}
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const setProperty = (o, key, v) => { const p = key.split("."); let t = o; p.slice(0, -1).forEach((k) => (t = t[k] ??= {})); t[p.at(-1)] = v; };
globalThis.foundry = { applications: { api: { ApplicationV2 } }, utils: { deepClone, setProperty } };

// Browser bits used for image work.
globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (cb, type) => cb(new Blob(["img"], { type })), toDataURL: () => "data:image/png;base64,AAAA" }) };
globalThis.createImageBitmap = async () => ({ close() {} });
globalThis.File = class extends Blob { constructor(parts, name, o) { super(parts, o); this.name = name; } };
const uploads = [];
globalThis.foundry.applications.apps = { FilePicker: { implementation: {
  browse: async () => ({ files: [] }),
  createDirectory: async () => {},
  upload: async (src, dir, file) => { uploads.push(`${dir}/${file.name}`); return { path: `${dir}/${file.name}` }; }
} } };

// fal.ai: records the request.
let falCalls = 0, falBody = null, falModel = null;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith("https://fal.run/")) {
    falCalls++; falModel = url.slice("https://fal.run/".length); falBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ images: [{ url: "data:image/png;base64,1" }] }) };
  }
  return { ok: true, blob: async () => new Blob(["x"], { type: "image/webp" }) };
};

// Tag tables: a fixed sequence of results, like rolls on the real compendium.
const tag = (name, points, what, rule) => ({ name, description: `<p>${rule}</p>`, flags: { "gear-forge": { tag: name, points, what, rule } } });
const sequence = [
  tag("Sturdy", 1, "Thick spine.", "Durability +3."),
  tag("Subtle", 1, "Quiet.", "+1 damage die on a sneak attack."),
  tag("Accursed", -3, "It wants blood.", "WIL roll."),
  tag("Long", 2, "A long haft.", "Melee up to 4 m.")
];
let rolls = 0;
const table = (kind) => ({ flags: { "gear-forge": { kind } }, roll: async () => { const r = sequence[rolls++ % sequence.length]; return { roll: { total: rolls }, results: [r] }; } });
const settings = { "gear-forge.paint": false, "gear-forge.quality": "medium", "gear-forge.falKey": "", "gear-forge.endpoint": "https://fal.run",
  "gear-forge.styleLink": "", "gear-forge.styleFolder": "", "gear-forge.style": "", "face-forge.falKey": "ff-key" };
const created = [];
const longsword = {
  uuid: "Compendium.dragonbane-core.items.Item.ls", name: "Longsword", type: "weapon", img: "modules/dragonbane-core/icons/longsword.webp",
  toObject() { return { _id: "ls", name: "Longsword", type: "weapon", img: this.img, system: { str: 10, durability: 12, damage: "2D8", cost: "12 silver", features: ["slashing"], itemDescription: "<p>Book text.</p>", gmDescription: "" } }; }
};
globalThis.game = {
  user: { isGM: true }, world: { id: "vale" }, system: { id: "dragonbane" },
  modules: new Map([["gear-forge", {}]]),
  packs: new Map([["gear-forge.tag-tables", { getDocuments: async () => ["weapon", "shield", "armour"].map(table) }]]),
  settings: { register() {}, get: (m, k) => { const v = settings[`${m}.${k}`]; if (v === undefined) throw new Error(`no setting ${m}.${k}`); return v; } },
  folders: { find: () => null }
};
globalThis.Folder = { create: async (d) => ({ id: "folder1", ...d }) };
globalThis.Item = { create: async (d) => { created.push(d); return { ...d, sheet: { render() {} } }; } };
const posted = [];
globalThis.ChatMessage = { create: async (d) => posted.push(d), getSpeaker: (o) => o };

await import("../scripts/main.mjs");
fire("init"); fire("ready");
const api = game.modules.get("gear-forge").api;
const check = (ok, what) => { if (!ok) throw new Error(what); };

// Open with a base item and roll three tags.
const app = await api.open(longsword);
check(app.lastHTML.includes("Longsword") && app.lastHTML.includes("2D8"), "base item shown");
await app.constructor.onRoll.call(app);
check(app.gf.tags.map((t) => t.name).join() === "Sturdy,Subtle,Accursed", "three tags rolled");
check(app.lastHTML.includes("Net <strong>−1</strong>") && app.lastHTML.includes("9 silver"), "net and price shown");
check(app.gf.name === "Longsword (Sturdy)", "suggested name");

// Painting is off: no button, and calling it does nothing.
check(!app.lastHTML.includes('data-action="paint"'), "no paint button while painting is off");
await app.constructor.onPaint.call(app);
check(falCalls === 0, "no fal.ai call while painting is off");

// Reroll the curse away, hide nothing, then paint (on) with Face Forge's key.
await app.constructor.onReroll.call(app, null, { dataset: { index: "2" } });
check(app.gf.tags[2].name === "Long", "rerolled");
settings["gear-forge.paint"] = true;
await app.render();
check(app.lastHTML.includes('data-action="paint"') && app.lastHTML.includes("~$0.06"), "paint button with cost");
await app.constructor.onPaint.call(app);
check(falCalls === 1 && falModel === "fal-ai/gpt-image-1.5/edit", "one edit call");
check(falBody.image_urls.length === 1 && falBody.num_images === 1, "base icon sent, one image");
check(falBody.prompt.includes("Longsword") && falBody.prompt.includes("Thick spine") && !falBody.prompt.includes("Durability"), "prompt has looks, not rules");
check(app.gf.image?.startsWith("worlds/vale/gear-forge/") && uploads.length === 1, "image uploaded");

// Hide one tag, create the item.
app.gf.tags[1].hidden = true;
await app.constructor.onCreate.call(app);
const item = created[0];
check(item.img === app.gf.image && item.folder === "folder1", "item uses the painting, in the Gear Forge folder");
check(item.system.durability === 15 && item.system.features.includes("long") && item.system.features.includes("subtle"), "effects applied, hidden ones too");
check(item.system.cost === "6 gold", `price scaled (got ${item.system.cost})`);
check(item.system.itemDescription.startsWith("<p>Book text.</p>") && item.system.itemDescription.includes("Sturdy") && !item.system.itemDescription.includes("Subtle"), "visible tags for players");
check(item.system.gmDescription.includes("Subtle"), "hidden tag for the GM");
check(!("_id" in item) && item.flags["gear-forge"].tags.length === 3, "fresh item with tag flags");

// Post: hidden tags stay off the chat card.
await app.constructor.onPost.call(app);
check(posted[0].content.includes("Sturdy") && !posted[0].content.includes("Subtle"), "chat card hides hidden tags");

// Without a base: named armour, no icon → text-only painting.
app.constructor.onClearBase.call(app);
app.gf.kind = "armour"; app.gf.baseName = "chainmail";
await app.constructor.onRoll.call(app);
await app.constructor.onPaint.call(app);
check(falModel === "fal-ai/gpt-image-1.5" && !("image_urls" in falBody), "text-only painting without an icon");
await app.constructor.onCreate.call(app);
check(created[1].type === "armor" && created[1].name.startsWith("chainmail"), "armour created from a name");

check(errors.length === 0, `no errors: ${errors.join(" | ")}`);
console.log("smoke test passed");

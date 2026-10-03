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
let idn = 0;
const setProperty = (o, key, v) => { const p = key.split("."); let t = o; p.slice(0, -1).forEach((k) => (t = t[k] ??= {})); t[p.at(-1)] = v; };
globalThis.foundry = { applications: { api: { ApplicationV2 } }, utils: { deepClone, setProperty, randomID: () => `id${++idn}` } };

// Browser bits used for image work.
globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (cb, type) => cb(new Blob(["img"], { type })), toDataURL: () => "data:image/png;base64,AAAA" }) };
globalThis.createImageBitmap = async () => ({ close() {} });
globalThis.File = class extends Blob { constructor(parts, name, o) { super(parts, o); this.name = name; } };
const uploads = [];
globalThis.foundry.applications.apps = { FilePicker: { implementation: {
  browse: async (src, dir) => ({ files: dir === "modules/dragonbane-coreset/assets/icons/gear"
    ? ["axe", "bow", "shield-crested", "helmet", "ring-gold"].map((n) => `${dir}/${n}.webp`) : [] }),
  createDirectory: async () => {},
  upload: async (src, dir, file) => { uploads.push(`${dir}/${file.name}`); return { path: `${dir}/${file.name}` }; }
} } };

// fal.ai: records the request.
let falCalls = 0, falBody = null, falModel = null;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith("https://fal.run/")) {
    falCalls++; falModel = url.slice("https://fal.run/".length); falBody = JSON.parse(opts.body);
    if (falModel === "openrouter/router") return { ok: true, json: async () => ({ output: '```json\n{"options":[{"name":"Pulsar Raygun","description":"It hums."},{"name":"Greyfang","description":"A long blade with a thick spine, notched by old wars."},{"name":"Widow\'s Reach","description":"Its haft is wrapped in faded red cord."}]}\n```' }) };
    return { ok: true, json: async () => ({ images: [{ url: "data:image/png;base64,1" }] }) };
  }
  return { ok: true, blob: async () => new Blob(["x"], { type: "image/webp" }) };
};

// Tag tables: a fixed sequence of results, like rolls on the real compendium.
const tag = (name, points, what, rule, extra = {}) => ({ name, description: `<p>${rule}</p>`, flags: { "gear-forge": { tag: name, points, what, rule, ...extra } } });
const sequences = {
  weapon: [
    tag("Sturdy", 1, "Thick spine.", "Durability +3."),
    tag("Subtle", 1, "Quiet.", "+1 damage die on a sneak attack."),
    tag("Clumsy", -3, "In your way.", "Bane on Evade."),
    tag("Long", 1, "A long haft.", "Hits up to 4 m away."),
    tag("Enchanted", 0, "Something was bound into it.", "Roll on Enchantments.", { special: { enchant: 1 } })
  ],
  "weapon-enchantments": [tag("Keen Edge", 0, "", "Armour one step lower.", { magic: true, rank: 1 }), tag("Unbreakable", 0, "", "Durability +9.", { magic: true, rank: 1 })],
  "armour-enchantments": [tag("Supple Armor", 0, "", "No bane on Evade.", { magic: true, rank: 1 })],
  drawbacks: [tag("Death Wish", 0, "", "Sickly.", { magic: true, drawback: true })],
  shield: [tag("Hooked Rim", 1, "", "Toppling.")],
  armour: [tag("Gorget", 1, "", "No double damage.")]
};
const counters = {};
let rolls = 0;
const table = (kind) => ({ flags: { "gear-forge": { kind } }, roll: async () => {
  const seq = sequences[kind]; const i = counters[kind] = (counters[kind] ?? -1) + 1; rolls++;
  return { roll: { total: rolls }, results: [seq[i % seq.length]] };
} });
const settings = { "gear-forge.paint": false, "gear-forge.quality": "medium", "gear-forge.falKey": "", "gear-forge.endpoint": "https://fal.run",
  "gear-forge.styleLink": "", "gear-forge.styleFolder": "", "gear-forge.style": "", "gear-forge.writeModel": "", "gear-forge.writeStyle": "", "face-forge.falKey": "ff-key" };
const created = [];
const longsword = {
  uuid: "Compendium.dragonbane-core.items.Item.ls", name: "Longsword", type: "weapon", img: "modules/dragonbane-core/icons/longsword.webp",
  toObject() { return { _id: "ls", name: "Longsword", type: "weapon", img: this.img, system: { str: 10, durability: 12, damage: "2D8", cost: "12 silver", features: ["slashing"], itemDescription: "<p>Book text.</p>", gmDescription: "" } }; }
};
globalThis.game = {
  user: { isGM: true }, world: { id: "vale" }, system: { id: "dragonbane" },
  modules: new Map([["gear-forge", {}]]),
  packs: new Map([
    ["gear-forge.tag-tables", { getDocuments: async () => Object.keys(sequences).map(table) }],
    ["dragonbane-core.items", { documentName: "Item", collection: "dragonbane-core.items", metadata: { packageName: "dragonbane-core" }, getIndex: async () => [
      { name: "Chainmail", type: "armor", img: "modules/dragonbane-core/art/chainmail.webp" },
      { name: "Leather Armor", type: "armor", img: "modules/dragonbane-core/art/leather.webp" },
      { name: "Dagger", type: "weapon", img: "modules/dragonbane-core/art/dagger.webp", system: { features: ["piercing"] } }
    ] }]
  ]),
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
check(app.gf.tags.map((t) => t.name).join() === "Sturdy,Subtle,Clumsy", "three tags rolled");
check(app.lastHTML.includes("Net −1") && app.lastHTML.includes("6 silver"), "net and price shown (×½)");
check(app.gf.name === "Longsword (Sturdy)", "suggested name");

// Painting is off: no button, and calling it does nothing.
check(!app.lastHTML.includes('data-action="paint"'), "no paint button while painting is off");
await app.constructor.onPaint.call(app);
check(falCalls === 0, "no fal.ai call while painting is off");

// Reroll the curse away, hide nothing, then paint (on) with Face Forge's key.
await app.constructor.onReroll.call(app, null, { dataset: { index: "2" } });
check(app.gf.tags[2].name === "Long", "rerolled");
check(app.lastHTML.includes("Net +3") && app.lastHTML.includes("36 gold"), "+3 = ×30");
settings["gear-forge.paint"] = true;
await app.render();
check(app.lastHTML.includes('data-action="paint"') && app.lastHTML.includes("~$0.06"), "paint button with cost");
await app.constructor.onPaint.call(app);
check(falCalls === 1 && falModel === "fal-ai/gpt-image-1.5/edit", "one edit call");
check(falBody.image_urls.length === 1 && falBody.num_images === 1, "base icon sent, one image");
check(falBody.prompt.includes("Longsword") && falBody.prompt.includes("Thick spine") && !falBody.prompt.includes("Durability"), "prompt has looks, not rules");
check(app.gf.image?.startsWith("worlds/vale/gear-forge/") && uploads.length === 1, "image uploaded");

// Suggest a name: one call, hidden tags and rules stay out; picking fills name and description.
app.gf.tags[1].hidden = true;
await app.constructor.onSuggest.call(app);
check(falCalls === 2 && falModel === "openrouter/router" && falBody.model === "anthropic/claude-haiku-4.5", "one writing call");
check(falBody.prompt.includes("Thick spine") && !falBody.prompt.includes("Subtle") && !falBody.prompt.includes("Durability"), "writing prompt: visible looks only, no rules");
check(app.gf.suggestions.length === 2 && app.lastHTML.includes("Greyfang") && app.gf.name === "Longsword (Sturdy)", "suggestions shown (off-setting one dropped), nothing applied yet");
check(falBody.system_prompt.includes("no gunpowder"), "setting guide sent");
await app.constructor.onPick.call(app, null, { dataset: { index: "0" } });
check(app.gf.name === "Greyfang" && app.gf.description.startsWith("A long blade") && app.lastHTML.includes("notched by old wars.</textarea>"), "picked suggestion fills name and description");
check(app.gf.suggestions.length === 0 && !app.lastHTML.includes("gf-suggestions") && app.lastHTML.includes('class="gf-result"'), "suggestions fold away after a pick");
app.gf.tags[1].hidden = false;
await app.constructor.onPaint.call(app);
check(falCalls === 3 && falBody.prompt.includes('"Greyfang"') && falBody.prompt.includes("notched by old wars"), "painting follows the picked name and description");

// Hide one tag, create the item.
app.gf.tags[1].hidden = true;
await app.constructor.onCreate.call(app);
const item = created[0];
check(item.name === "Greyfang" && item.system.itemDescription.includes("<p>A long blade with a thick spine, notched by old wars.</p><h3>Forged"), "written name and description on the item");
check(item.system.gmDescription.startsWith('<p class="gf-price"><strong>Price:</strong> 36 gold</p>') && !item.system.itemDescription.includes("Price"), "price is GM-only");
check(item.img === app.gf.image && item.folder === "folder1", "item uses the painting, in the Gear Forge folder");
check(item.system.durability === 15 && item.system.features.includes("long") && item.system.features.includes("subtle"), "effects applied, hidden ones too");
check(item.system.cost === "", `cost field left blank for players (got ${item.system.cost})`);
check(item.system.itemDescription.startsWith("<p>Book text.</p>") && item.system.itemDescription.includes("Sturdy") && !item.system.itemDescription.includes("Subtle"), "visible tags for players");
check(item.system.gmDescription.includes("Subtle"), "hidden tag for the GM");
check(!("_id" in item) && item.flags["gear-forge"].tags.length === 3, "fresh item with tag flags");

// Post: hidden tags stay off the chat card.
await app.constructor.onPost.call(app);
check(posted[0].content.includes("notched by old wars"), "chat card has the description");
check(!posted[0].content.includes("Price") && !posted[0].content.includes("36 gold"), "chat card keeps the price from players");
check(posted[0].content.includes("Sturdy") && !posted[0].content.includes("Subtle"), "chat card hides hidden tags");

// Magic: "Enchanted" rolls its enchantment; Curse rolls a drawback that pays for another.
await app.constructor.onAdd.call(app);
const names = () => app.gf.tags.map((t) => t.name).join();
check(names() === "Sturdy,Subtle,Long,Enchanted,Keen Edge", `Enchanted rolled a spell: ${names()}`);
check(app.gf.tags[4].parent === app.gf.tags[3].id && app.lastHTML.includes(">Unique</span>"), "spell is the child; price is Unique");
await app.constructor.onCurse.call(app);
check(names().endsWith("Death Wish,Unbreakable"), `drawback paid for an enchantment: ${names()}`);
await app.constructor.onReroll.call(app, null, { dataset: { index: "3" } });
check(!names().includes("Keen Edge") && !names().includes("Enchanted,Keen"), `rerolling Enchanted drops its spell: ${names()}`);
await app.constructor.onRemove.call(app, null, { dataset: { index: String(app.gf.tags.findIndex((t) => t.name === "Death Wish")) } });
check(!names().includes("Death Wish") && !names().includes("Unbreakable"), `removing the drawback removes what it paid for: ${names()}`);
await app.constructor.onEnchant.call(app);
await app.constructor.onCreate.call(app);
const magicItem = created.at(-1);
check(magicItem.system.supply === "unique" && magicItem.system.cost === "", "enchanted item is Unique, no price");
check(magicItem.system.gmDescription.includes("Unique"), "unique noted for the GM");

// Without a base: named armour, no icon → text-only painting.
app.constructor.onClearBase.call(app);
app.gf.kind = "armour"; app.gf.baseName = "chainmail";
await app.constructor.onRoll.call(app);
await app.constructor.onPaint.call(app);
check(falModel === "fal-ai/gpt-image-1.5/edit" && falBody.image_urls.length === 1 && falBody.prompt.startsWith("Paint a new item into this icon: a chainmail"), "no base icon: paints into the matching compendium icon");
app.gf.baseName = "helmet with a crest";
await app.constructor.onPaint.call(app);
check(falBody.image_urls.length === 1, "core set folder icons join the pool");
await app.constructor.onCreate.call(app);
check(created.at(-1).type === "armor" && created.at(-1).name.startsWith("chainmail"), "armour created from a name");
await app.constructor.onEnchant.call(app);
check(app.gf.tags.at(-1).name === "Supple Armor", "armour enchants from the armour table");

check(errors.length === 0, `no errors: ${errors.join(" | ")}`);
console.log("smoke test passed");

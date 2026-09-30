// Forge Gear — roll tags on the Arms & Armour tables and whisper the result to the GM.
const MODULE_ID = "__MODULE_ID__";
const TABLE_IDS = __TABLE_IDS__;
const pack = game.packs.get(`${MODULE_ID}.tag-tables`);

const choice = await foundry.applications.api.DialogV2.prompt({
  window: { title: "Forge Gear" },
  content: `
    <div class="form-group"><label>Table</label>
      <select name="table">
        <option value="weapon">Weapon (d100)</option>
        <option value="shield">Shield (d20)</option>
        <option value="armour">Armour (d20)</option>
      </select></div>
    <div class="form-group"><label>Tags</label>
      <input type="number" name="count" value="3" min="1" max="6"></div>`,
  ok: {
    label: "Roll",
    callback: (event, button) => ({
      table: button.form.elements.table.value,
      count: Math.clamp(Number(button.form.elements.count.value) || 3, 1, 6)
    })
  },
  rejectClose: false
});
if ( !choice ) return;

const table = await pack.getDocument(TABLE_IDS[choice.table]);
const rolls = [];
for ( let i = 0; i < choice.count; i++ ) {
  const { roll, results } = await table.draw({ displayChat: false });
  rolls.push({ total: roll.total, result: results[0] });
}

const net = rolls.reduce((sum, r) => sum + (r.result.flags[MODULE_ID]?.points ?? 0), 0);
const multiplier = net >= 0 ? 1 + net : Math.max(0.25, 1 - 0.25 * Math.abs(net));
const signed = n => n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
const pad = n => choice.table === "weapon" ? String(n % 100).padStart(2, "0") : String(n);

const lines = rolls.map(r => `<li><strong>${pad(r.total)}</strong> · <strong>${r.result.name}</strong> ${r.result.description}</li>`);
await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ alias: "The Forge" }),
  whisper: game.users.filter(u => u.isGM).map(u => u.id),
  content: `<h3>${table.name}</h3><ul>${lines.join("")}</ul>
    <p><strong>Net ${signed(net)}</strong> · price ×${multiplier} book price</p>
    <p><em>A flaw that doesn't bite this weapon is a reroll.</em></p>`
});

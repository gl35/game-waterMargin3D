// ── Pickup definitions ──
// Items drop from enemies (small chance) and from breakable barrels/crates.
// Picking up applies the effect instantly. KoV signature pickups: food
// (whole roast meat → big heal), wine (steady tipsy heal), scroll (atk up),
// gold (score).
export const ITEMS = {
  meat:   { id: 'meat',   name: 'Roast Meat',  color: '#caa45c', heal: 0.40 },
  bun:    { id: 'bun',    name: 'Steamed Bun', color: '#f4d9a8', heal: 0.18 },
  wine:   { id: 'wine',   name: 'Rice Wine',   color: '#dcb3a4', heal: 0.25, dot: { heal: 0.30, dur: 6 } },
  scroll: { id: 'scroll', name: 'Battle Scroll', color: '#d0a8ff', buff: { atk: 0.4, atkSpeed: 0.2, dur: 12 } },
  gold:   { id: 'gold',   name: 'Gold Ingot',   color: '#ffd95a', score: 200 },
  weapon: { id: 'weapon', name: 'Heavenly Blade', color: '#ffc080', buff: { atk: 0.6, dur: 18 } },
};

export const ITEM_KEYS = Object.keys(ITEMS);

// Drop tables — weighted random pick. `nothing` weight skews most kills to
// drop no item (KoV-like density).
const TABLES = {
  trash:  [['nothing', 86], ['bun', 8], ['gold', 4], ['wine', 2]],
  tough:  [['nothing', 70], ['meat', 12], ['gold', 10], ['wine', 6], ['scroll', 2]],
  elite:  [['nothing', 45], ['meat', 25], ['scroll', 15], ['gold', 10], ['weapon', 5]],
  boss:   [['meat', 40], ['weapon', 30], ['scroll', 20], ['gold', 10]],
  barrel: [['nothing', 35], ['bun', 25], ['gold', 20], ['wine', 12], ['meat', 6], ['scroll', 2]],
};

export function rollDrop(table) {
  const t = TABLES[table] || TABLES.trash;
  let total = 0;
  for (const [, w] of t) total += w;
  let r = Math.random() * total;
  for (const [key, w] of t) {
    r -= w;
    if (r <= 0) return key === 'nothing' ? null : key;
  }
  return null;
}

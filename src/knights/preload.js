// ── Curated sprite preload for the Knights shell ──
// Only the character art the side-scroller actually draws. The full 70+ NPC
// sheet is NOT preloaded, so we don't jam the main thread with image-decode +
// pixel-scan filters on first paint.
import { getSprite } from '../scene2d/sprites.js';

const REQUIRED = [
  // Heroes
  'npc/songjiang', 'npc/linchong', 'npc/wusong',
  'npc/huarong', 'npc/husanniang', 'npc/likui',
  // Enemies
  'enemy/raider', 'enemy/scout', 'enemy/archer',
  'enemy/berserker', 'enemy/guard',
  'enemy/captain', 'enemy/warlord',
  // Mission actors: caged villagers, Shi Xiu, Gongsun Sheng's stand-in
  'npc/baisheng', 'npc/shixiu', 'npc/wuyong',
];

export function preloadKnightsSprites() {
  for (const name of REQUIRED) getSprite(name);
}

// ── Sprite loader: progressively loads PNG assets from /sprites/ ──
//
// Pipeline per asset:
//   1. Load PNG into HTMLImage
//   2. Draw to offscreen canvas
//   3. (Optional) color-key transparency (e.g. strip magenta background)
//   4. (Optional) slice into named sub-regions for sprite sheets
//   5. (Default) auto-trim transparent borders so sprite anchor is tight
//   6. Cache the result canvas under the sprite name
//
// drawSprite(name, ...) auto-scales using TARGET_HEIGHT so any source
// resolution renders at a sensible in-game size.

const REGISTRY = new Map();        // name → HTMLCanvasElement (post-processed)
const FAILED = new Set();
const LOADING = new Set();         // names currently fetching

// ── Single-PNG manifest: name → public path (+ optional processing) ──
export const SPRITE_MANIFEST = {
  'hero/idle':        { path: '/sprites/hero2_idle.png' },
  // Drop a PNG of YOUR hero on horseback at this path and the renderer
  // prefers it over the hero+horse composite. Until then, composite is used.
  'hero/mounted':     { path: '/sprites/hero_mounted.png' },
  'npc/linchong':     { path: '/sprites/linchong.png' },
  // Standalone single-file NPCs (override the leaders sheet where present)
  'npc/wuyong':       { path: '/sprites/npc_智多星-吴用.png' },
  'npc/chaogai':      { path: '/sprites/npc_托塔天王 晁盖.png' },
  'npc/huarong':      { path: '/sprites/npc_小李广-花荣.png' },
  'npc/likui':        { path: '/sprites/npc_黑旋风-李逵.png' },
  'npc/lujunyi':      { path: '/sprites/npc_玉麒麟-卢俊义.png' },
  'npc/guansheng':    { path: '/sprites/npc_大刀-关胜.png' },
  'npc/huyanzhuo':    { path: '/sprites/npc_双鞭-呼延灼.png' },
  'npc/andaoquan':    { path: '/sprites/npc_神医-安道全.png' },
  'npc/shiqian':      { path: '/sprites/npc_鼓上蚤-时迁.png' },
  'npc/linchongwife': { path: '/sprites/npc_林娘子.png' },
  // Expanded roster — original prose dialog, sprites are user-supplied AI art
  'npc/husanniang':   { path: '/sprites/npc_一丈青-扈三娘.png' },
  'npc/wusong':       { path: '/sprites/npc_武松.png' },
  'npc/yanqing':      { path: '/sprites/npc_浪子-燕青.png' },
  'npc/daizong':      { path: '/sprites/npc_神行太保-戴宗.png' },
  'npc/ruanxiaowu':   { path: '/sprites/npc_短命二郎-阮小五.png' },
  'npc/lijun':        { path: '/sprites/npc_混江龙-李俊.png' },
  'npc/qinming':      { path: '/sprites/npc_天猛星 霹雳火 秦明.png' },
  'npc/dongping':     { path: '/sprites/npc_双枪将-董平.png' },
  'npc/sunerniang':   { path: '/sprites/npc_母夜叉-孙二娘.png' },
  'npc/zhutong':      { path: '/sprites/npc_美髯公-朱仝.png' },
  'npc/xuning':       { path: '/sprites/npc_金枪手-徐宁.png' },
  'npc/liutang':      { path: '/sprites/npc_赤发鬼-刘唐.png' },
  'npc/zhangshun':    { path: '/sprites/npc_浪里白条-张顺.png' },
  'npc/shixiu':       { path: '/sprites/npc_拼命三郎-石秀.png' },
  'npc/baisheng':     { path: '/sprites/npc_白日鼠-白胜.png' },
  // ── Rest of the 108 roster ──
  'npc/taozongwang':  { path: '/sprites/npc_九尾龟-陶宗旺.png' },
  'npc/songwan':      { path: '/sprites/npc_云里金刚-宋万.png' },
  'npc/xiebao':       { path: '/sprites/npc_双尾蝎-解宝.png' },
  'npc/xiaorang':     { path: '/sprites/npc_圣手书生-萧让.png' },
  'npc/shantinggui':  { path: '/sprites/npc_圣水将军-单廷珲.png' },
  'npc/weidingguo':   { path: '/sprites/npc_地猛星 神火将军 魏定国.png' },
  'npc/pengqi':       { path: '/sprites/npc_天目将-彭玘.png' },
  'npc/sunxin':       { path: '/sprites/npc_小尉迟-孙新.png' },
  'npc/zhoutong':     { path: '/sprites/npc_小霸王-周通.png' },
  'npc/suochao':      { path: '/sprites/npc_急先锋-索超.png' },
  'npc/liying':       { path: '/sprites/npc_扑天雕-李应.png' },
  'npc/lizhong':      { path: '/sprites/npc_打虎将-李忠.png' },
  'npc/leiheng':      { path: '/sprites/npc_插翅虎-雷横.png' },
  'npc/oupeng':       { path: '/sprites/npc_摩云金翅-欧鹏.png' },
  'npc/duqian':       { path: '/sprites/npc_摸着天-杜迁.png' },
  'npc/caozheng':     { path: '/sprites/npc_操刀鬼-曹正.png' },
  'npc/zhugui':       { path: '/sprites/npc_旱地忽律-朱贵.png' },
  'npc/gudasao':      { path: '/sprites/npc_母大虫-顾大嫂.png' },
  'npc/kongming':     { path: '/sprites/npc_毛头星-孔明.png' },
  'npc/zhangqing_a':  { path: '/sprites/npc_没羽箭-张清.png' },
  'npc/muhong':       { path: '/sprites/npc_没遮拦-穆弘.png' },
  'npc/jiaoting':     { path: '/sprites/npc_没面目-焦挺.png' },
  'npc/wangdingliu':  { path: '/sprites/npc_活闪婆-王定六.png' },
  'npc/fanrui':       { path: '/sprites/npc_混世魔王-樊瑞.png' },
  'npc/dengfei':      { path: '/sprites/npc_火眼狻猊-邓飞.png' },
  'npc/kongliang':    { path: '/sprites/npc_独火星-孔亮.png' },
  'npc/zourun':       { path: '/sprites/npc_独角龙-邹润.png' },
  'npc/mengkang':     { path: '/sprites/npc_玉幡竿-孟康.png' },
  'npc/jindajian':    { path: '/sprites/npc_玉臂将-金大坚.png' },
  'npc/yangxiong':    { path: '/sprites/npc_病关索-杨雄.png' },
  'npc/xueyong':      { path: '/sprites/npc_病大虫-薛永.png' },
  'npc/sunli':        { path: '/sprites/npc_病尉迟-孙立.png' },
  'npc/yangchun':     { path: '/sprites/npc_白花蛇-杨春.png' },
  'npc/zhengtianshou':{ path: '/sprites/npc_白面郎君-郑天寿.png' },
  'npc/hantao':       { path: '/sprites/npc_百胜将-韩滔.png' },
  'npc/wangying':     { path: '/sprites/npc_矮脚虎王英.png' },
  'npc/shiyong':      { path: '/sprites/npc_石将军-石勇.png' },
  'npc/zhuwu':        { path: '/sprites/npc_神机军师-朱武.png' },
  'npc/jiangjing':    { path: '/sprites/npc_神算子-蒋敬.png' },
  'npc/ruanxiaoer':   { path: '/sprites/npc_立地太岁-阮小二.png' },
  'npc/xiaomianhu':   { path: '/sprites/npc_笑面虎.png' },
  'npc/huangfuduan':  { path: '/sprites/npc_紫髯伯-皇甫端.png' },
  'npc/tongmeng':     { path: '/sprites/npc_翻江蜃-童猛.png' },
  'npc/zhangheng':    { path: '/sprites/npc_船火儿-张横.png' },
  'npc/gongwang':     { path: '/sprites/npc_花项虎-龚旺.png' },
  'npc/zhangqing_g':  { path: '/sprites/npc_菜园子-张青.png' },
  'npc/guosheng':     { path: '/sprites/npc_赛仁贵-郭盛.png' },
  'npc/chenda':       { path: '/sprites/npc_跳涧虎-陈达.png' },
  'npc/lingzhen':     { path: '/sprites/npc_轰天雷-凌振.png' },
  'npc/houjian':      { path: '/sprites/npc_通臂猿-侯健.png' },
  'npc/lehe':         { path: '/sprites/npc_铁叫子-乐和.png' },
  'npc/songqing':     { path: '/sprites/npc_铁扇子-宋清.png' },
  'npc/malin':        { path: '/sprites/npc_铁笛仙-马麟.png' },
  'npc/caifu':        { path: '/sprites/npc_铁胳膊-蔡服.png' },
  'npc/peixuan':      { path: '/sprites/npc_铁面孔目-裴宣.png' },
  'npc/huangxin':     { path: '/sprites/npc_镇三山-黄信.png' },
  'npc/yubaosi':      { path: '/sprites/npc_险道神-郁保四.png' },
  'npc/duxing':       { path: '/sprites/npc_鬼脸儿-杜兴.png' },
  'npc/haosiwen':     { path: '/sprites/Npc_井木犴-郝思文.png' },

  'enemy/raider':     { path: '/sprites/enemy_raider.png' },
  'enemy/scout':      { path: '/sprites/enemy_scout.png' },
  'enemy/captain':    { path: '/sprites/enemy_captain.png' },
  'enemy/berserker':  { path: '/sprites/enemy_berserker.png' },
  'enemy/guard':      { path: '/sprites/enemy_guard.png' },
  'enemy/archer':     { path: '/sprites/enemy_archer.png' },
  'enemy/warlord':    { path: '/sprites/enemy_warlord.png' },

  'deco/pine':        { path: '/sprites/deco_pine.png' },
  'deco/azalea':      { path: '/sprites/deco_azalea.png' },
  'deco/bamboo':      { path: '/sprites/deco_bamboo.png' },
  'deco/rock':        { path: '/sprites/deco_rock.png' },
  'deco/burnt_tree':  { path: '/sprites/deco_burnt_tree.png' },
  'deco/campfire':    { path: '/sprites/deco_campfire.png' },

  'world/fortress':   { path: '/sprites/world_fortress.png' },
  'world/horse':      { path: '/sprites/world_horse.png' },

  'bg/sky_ch1':       { path: '/sprites/bg_sky_ch1.png',       autoTrim: false, autoStrip: false, softenHalos: false, killChecker: false, floodFillBg: false, stripNeutral: true },
  'bg/mountains_ch1': { path: '/sprites/bg_mountains_ch1.png', autoTrim: false, autoStrip: false, softenHalos: false, killChecker: false, floodFillBg: false, stripNeutral: true },
  'bg/ground_ch1':    { path: '/sprites/bg_ground_ch1.png',    autoTrim: false, autoStrip: false, softenHalos: false, killChecker: false, floodFillBg: false, stripNeutral: true },
  'bg/sky_ch2':       { path: '/sprites/bg_sky_ch2.png',       autoTrim: false, autoStrip: false, softenHalos: false, killChecker: false, floodFillBg: false, stripNeutral: true },
  'bg/mountains_ch2': { path: '/sprites/bg_mountains_ch2.png', autoTrim: false, autoStrip: false, softenHalos: false, killChecker: false, floodFillBg: false, stripNeutral: true },
  'bg/ground_ch2':    { path: '/sprites/bg_ground_ch2.png',    autoTrim: false, autoStrip: false, softenHalos: false, killChecker: false, floodFillBg: false, stripNeutral: true },

  'fx/petal':         { path: '/sprites/fx_petal.png' },
  'fx/ember':         { path: '/sprites/fx_ember.png' },
};

// ── Sheet manifest ──
const SHEET_MANIFEST = {
  'sheet/leaders': {
    path: '/sprites/npc_songjiang_and_liangshang_leaders.png',
    colorKey: { r: 255, g: 0, b: 255, tolerance: 110 },
    autoTrim: true,
    // killChecker now uses spatial pattern detection — safe to leave on default
    regions: {
      'npc/songjiang': { x: 0.00, y: 0.00, w: 0.34, h: 0.50 },
      'npc/wuyong':    { x: 0.66, y: 0.00, w: 0.34, h: 0.50 },
      'npc/tonkey':    { x: 0.00, y: 0.50, w: 0.50, h: 0.50 },
      'npc/villager':  { x: 0.50, y: 0.50, w: 0.50, h: 0.50 },
    },
  },
  'sheet/hero_walk_attack': {
    path: '/sprites/hero_walk1_2_attack.png',
    colorKey: { r: 180, g: 180, b: 180, tolerance: 20, fadeBand: 10 },
    autoTrim: true,
    // killChecker now uses spatial pattern detection — safe to leave on default
    regions: {
      'hero/walk1':  { x: 0.00, y: 0.00, w: 0.50, h: 0.50 },
      'hero/walk2':  { x: 0.50, y: 0.00, w: 0.50, h: 0.50 },
      'hero/attack': { x: 0.00, y: 0.50, w: 1.00, h: 0.50 },
    },
  },
};

// ── Target render height per sprite (so AI-output sizes don't blow up) ──
// Used to compute a scale factor at draw time. Override `scale` to multiply.
const TARGET_HEIGHT = {
  // Bumped 2-2.5× so painted detail reads at game scale
  'hero/idle': 160, 'hero/walk1': 160, 'hero/walk2': 160, 'hero/attack': 160,
  'hero/mounted': 210,
  'npc/songjiang': 150, 'npc/linchong': 150, 'npc/wuyong': 150,
  'npc/tonkey': 150, 'npc/villager': 150,
  'npc/chaogai': 150, 'npc/huarong': 150, 'npc/likui': 160,
  'npc/lujunyi': 155, 'npc/guansheng': 160, 'npc/huyanzhuo': 155,
  'npc/andaoquan': 145, 'npc/shiqian': 140, 'npc/linchongwife': 145,
  'npc/husanniang': 145, 'npc/wusong': 160, 'npc/yanqing': 148,
  'npc/daizong': 150, 'npc/ruanxiaowu': 144, 'npc/lijun': 152,
  'npc/qinming': 160, 'npc/dongping': 152, 'npc/sunerniang': 148,
  'npc/zhutong': 158, 'npc/xuning': 152, 'npc/liutang': 150,
  'npc/zhangshun': 148, 'npc/shixiu': 148, 'npc/baisheng': 140,
  'enemy/raider': 140, 'enemy/scout': 130, 'enemy/captain': 190,
  'enemy/berserker': 155, 'enemy/guard': 150, 'enemy/archer': 135,
  'enemy/warlord': 230,
  'enemy/cultist': 140, 'enemy/shade': 130, 'enemy/sorcerer': 240,
  'deco/pine': 200, 'deco/azalea': 70, 'deco/bamboo': 170,
  'deco/rock': 54, 'deco/burnt_tree': 185, 'deco/campfire': 60,
  'world/fortress': 360, 'world/horse': 130,
  'fx/petal': 8, 'fx/ember': 8,
  // Backgrounds use natural height (no target override)
};

// ── Region → sheet lookup (built at module load) ──
const REGION_TO_SHEET = new Map();
for (const [sheetName, sheet] of Object.entries(SHEET_MANIFEST)) {
  for (const regionName of Object.keys(sheet.regions)) {
    REGION_TO_SHEET.set(regionName, sheetName);
  }
}

// ── Image processing primitives ──
// Color-key with smooth fade band — anti-aliased edges become semi-transparent
// instead of leaving a hard fringe.
function applyColorKey(ctx, w, h, key) {
  if (!key) return;
  const { r, g, b, tolerance = 40, fadeBand = 70 } = key;
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const dr = px[i] - r;
    const dg = px[i + 1] - g;
    const db = px[i + 2] - b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < tolerance) {
      px[i + 3] = 0;
    } else if (dist < tolerance + fadeBand) {
      const f = (dist - tolerance) / fadeBand;
      px[i + 3] = Math.round(px[i + 3] * f);
    }
  }
  ctx.putImageData(data, 0, 0);
}

// Auto-detect background color from corners. If corners share a near-uniform
// color (suggesting a solid background), key it out with a smooth fade.
function autoStripBackground(canvas) {
  const w = canvas.width, h = canvas.height;
  if (w < 6 || h < 6) return;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const samples = [
    [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
    [Math.floor(w / 2), 2], [Math.floor(w / 2), h - 3],
    [2, Math.floor(h / 2)], [w - 3, Math.floor(h / 2)],
  ];
  // Average opaque samples
  let r = 0, g = 0, b = 0, n = 0;
  for (const [cx, cy] of samples) {
    const i = (cy * w + cx) * 4;
    if (px[i + 3] > 200) {
      r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
    }
  }
  if (n < 4) return; // Not enough opaque corners — likely already transparent
  r = r / n; g = g / n; b = b / n;

  // Reject if the "background" sample is dark (likely picked up the subject)
  const brightness = (r + g + b) / 3;
  if (brightness < 130) return;

  // Verify corners are reasonably similar (otherwise it's not a flat BG)
  let maxDist = 0;
  for (const [cx, cy] of samples) {
    const i = (cy * w + cx) * 4;
    if (px[i + 3] < 200) continue;
    const dr = px[i] - r, dg = px[i + 1] - g, db = px[i + 2] - b;
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    if (d > maxDist) maxDist = d;
  }
  if (maxDist > 150) return; // Corners disagree too much — not a uniform BG

  // Apply soft color-key to that color. Wider tolerance to catch the halo
  // pixels right around the figure that AI generators leave behind.
  applyColorKey(ctx, w, h, { r, g, b, tolerance: 75, fadeBand: 120 });
}

// Some AI image generators render the "transparent background" as actual
// alternating gray/white checker pixels (the visualization, not real alpha).
// Spatial detector: a checker pixel is neutral + bright AND has a neutral
// neighbor at typical checker-tile offsets (4/8/16 px) with strongly
// different brightness. Solid figure pixels (uniform white robes etc.) have
// matching neighbors, so they survive — only the alternating pattern dies.
function killCheckerPattern(canvas) {
  const w = canvas.width, h = canvas.height;
  if (w < 24 || h < 24) return;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const offsets = [4, 8, 12, 16];
  const idx = (x, y) => (y * w + x) * 4;

  // Stricter neutral check (variance ≤ 8) AND brighter floor (lum ≥ 195) —
  // figure features like skin (chromatic), robe shadow (variance > 12), and
  // armor metal (variance > 8) won't match. Only pure white/grey checker pixels do.
  const isNeutralLight = (i) => {
    if (px[i + 3] < 200) return false;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 8) return false;
    const lum = (r + g + b) / 3;
    return lum > 195 && lum < 260;
  };

  const kill = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (!isNeutralLight(i)) continue;
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      // Require TWO contrasting neutral neighbors to confirm spatial pattern
      // (instead of one). One match could be coincidence; two is signature.
      let contrastHits = 0;
      for (const off of offsets) {
        for (const [dx, dy] of [[off, 0], [0, off], [off, off], [-off, off]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = idx(nx, ny);
          if (!isNeutralLight(ni)) continue;
          const nlum = (px[ni] + px[ni + 1] + px[ni + 2]) / 3;
          if (Math.abs(lum - nlum) > 35) contrastHits++;
          if (contrastHits >= 2) break;
        }
        if (contrastHits >= 2) break;
      }
      if (contrastHits >= 2) kill[y * w + x] = 1;
    }
  }
  for (let i = 0; i < kill.length; i++) if (kill[i]) px[i * 4 + 3] = 0;
  ctx.putImageData(data, 0, 0);
}

// Tight neutral-pixel stripper — kills only PERFECTLY FLAT neutral pixels
// (max-min ≤ 5, brightness > 180). AI-generator transparency checker is
// perfectly uniform grey or white, so it matches. Painted watercolor —
// even pale "grey" clouds — has slight tonal variance per pixel, so it
// survives. Use this for backgrounds where the full flood-fill is too
// aggressive but you still want to nuke baked-in checker patterns.
function stripNeutralPixels(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 24) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 5) continue;  // any color cast → keep
    if ((r + g + b) < 540) continue;                           // not light enough → keep
    px[i + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
}

// Edge-seeded flood fill: erases ONLY background pixels that are connected
// to the image boundary. Interior figure pixels are physically unreachable
// from the edge, so they're protected.
//
// The "background-pixel" test is structural, not color-matched: any pixel
// that is NEUTRAL (max-min < 28 — i.e., no chromatic cast) AND LIGHT
// (brightness > 160) is treated as background. This catches:
//   - AI-generator transparency-checker pattern (BOTH the light-grey and
//     near-white shades qualify — no per-color seed needed)
//   - Solid bright/grey backgrounds
//   - Halo bleed at the figure outline (the partially-bright halo passes
//     the test too)
//
// Figure pixels are typically chromatic (skin, robes, armor have hue) or
// darker than 160, so the BFS frontier dies at the silhouette.
function floodFillBg(canvas) {
  const w = canvas.width, h = canvas.height;
  if (w < 4 || h < 4) return;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;

  // Neutral-light test for "background pixel". The flood walks through any
  // connected pixel that satisfies this. Thresholds widened to catch
  // darker checker (~130 brightness, found on some enemy sprites) and
  // slightly-tinted checker (variance up to 30).
  //
  // Chromatic test still excludes typical figure pixels: skin, painted
  // robes/armor (all have hue). Will FAIL on pure-grey figure pixels
  // (e.g. plain dark stone) that touch the edge — opt out per-sprite.
  const isBg = (i) => {
    const a = px[i + 3];
    if (a < 24) return false;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 30) return false;  // chromatic → figure
    return (r + g + b) > 390;                                       // brightness > 130
  };

  const n = w * h;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;

  // Seed from every edge pixel that qualifies as background.
  // (More robust than 8 sample points — handles asymmetric backgrounds.)
  const seedEdge = (x, y) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    if (!isBg(idx * 4)) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };
  for (let x = 0; x < w; x++) { seedEdge(x, 0); seedEdge(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { seedEdge(0, y); seedEdge(w - 1, y); }
  if (tail === 0) return;                  // no neutral-light edges → already clean

  // Safety: full-canvas textures (sky, mist, paper) have neutral-LIGHT
  // pixels everywhere. Distinguish them from figure-on-checker by sampling
  // 64 interior points: a figure shows up as samples that are chromatic OR
  // dark (grey armor, black hair, outlines). If almost no sample is
  // figure-like, this is a texture and we bail.
  //
  // (Chromatic-only counting wrongly bailed on grey-clad figures like the
  // steel-armored halberdier — his whole checker stayed opaque.)
  let figureHits = 0;
  for (let gy = 1; gy <= 8; gy++) {
    for (let gx = 1; gx <= 8; gx++) {
      const px_ = Math.floor((gx * w) / 9);
      const py_ = Math.floor((gy * h) / 9);
      const ii = (py_ * w + px_) * 4;
      if (px[ii + 3] < 24) continue;
      const r = px[ii], g = px[ii + 1], b = px[ii + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) > 30 || r + g + b <= 390) {
        figureHits++;
      }
    }
  }
  if (figureHits < 2) return;               // no figure detected → texture; bail

  // While erasing, learn the checker's two tones (16-level RGB buckets)
  // so a second pass can recognise ENCLOSED checker pockets — regions the
  // edge-seeded flood can't reach (e.g. inside a drawn bow + string).
  const hist = new Uint32Array(4096);
  const histR = new Uint32Array(4096), histG = new Uint32Array(4096), histB = new Uint32Array(4096);
  let erased = 0;
  while (head < tail) {
    const idx = queue[head++];
    const i = idx * 4;
    const bk = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    hist[bk]++; histR[bk] += px[i]; histG[bk] += px[i + 1]; histB[bk] += px[i + 2];
    erased++;
    px[i + 3] = 0;                          // erase
    const x = idx % w, y = (idx - x) / w;
    if (x > 0) {
      const nb = idx - 1;
      if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; queue[tail++] = nb; }
    }
    if (x < w - 1) {
      const nb = idx + 1;
      if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; queue[tail++] = nb; }
    }
    if (y > 0) {
      const nb = idx - w;
      if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; queue[tail++] = nb; }
    }
    if (y < h - 1) {
      const nb = idx + w;
      if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; queue[tail++] = nb; }
    }
  }

  // ── Enclosed checker pockets ──
  // Only when the flood proved a real checker exists (erased a lot).
  // Find remaining connected neutral-light regions; erase a region only if
  // it shows BOTH learned checker tones in meaningful share. A flat white
  // sleeve / blade glint is single-tone and survives; a checker pocket
  // (alternating tiles) cannot avoid containing both.
  if (erased > n * 0.05) {
    let b1 = -1, b2 = -1;
    for (let k = 0; k < 4096; k++) {
      if (b1 < 0 || hist[k] > hist[b1]) { b2 = b1; b1 = k; }
      else if (b2 < 0 || hist[k] > hist[b2]) { b2 = k; }
    }
    const t1r = histR[b1] / hist[b1], t1g = histG[b1] / hist[b1], t1b = histB[b1] / hist[b1];
    const has2 = b2 >= 0 && hist[b2] > 0;
    const t2r = has2 ? histR[b2] / hist[b2] : t1r;
    const t2g = has2 ? histG[b2] / hist[b2] : t1g;
    const t2b = has2 ? histB[b2] / hist[b2] : t1b;
    const TOL = 16;
    const toneOf = (i) => {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      if (Math.abs(r - t1r) <= TOL && Math.abs(g - t1g) <= TOL && Math.abs(b - t1b) <= TOL) return 1;
      if (Math.abs(r - t2r) <= TOL && Math.abs(g - t2g) <= TOL && Math.abs(b - t2b) <= TOL) return 2;
      return 0;
    };
    const comp = new Int32Array(n);
    for (let start = 0; start < n; start++) {
      if (visited[start] || !isBg(start * 4)) continue;
      // flood this neutral-light component
      let cHead = 0, cTail = 0;
      comp[cTail++] = start;
      visited[start] = 1;
      let c1 = 0, c2 = 0;
      while (cHead < cTail) {
        const idx = comp[cHead++];
        const t = toneOf(idx * 4);
        if (t === 1) c1++; else if (t === 2) c2++;
        const x = idx % w, y = (idx - x) / w;
        if (x > 0)     { const nb = idx - 1; if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; comp[cTail++] = nb; } }
        if (x < w - 1) { const nb = idx + 1; if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; comp[cTail++] = nb; } }
        if (y > 0)     { const nb = idx - w; if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; comp[cTail++] = nb; } }
        if (y < h - 1) { const nb = idx + w; if (!visited[nb] && isBg(nb * 4)) { visited[nb] = 1; comp[cTail++] = nb; } }
      }
      const toneTotal = c1 + c2;
      const minShare = toneTotal > 0 ? Math.min(c1, c2) / toneTotal : 0;
      if (cTail >= 220 && toneTotal >= cTail * 0.5 && minShare >= 0.16) {
        for (let k = 0; k < cTail; k++) px[comp[k] * 4 + 3] = 0;
      }
    }
  }

  // Halo cleanup: anti-aliased fringe pixels at the figure outline often
  // sit JUST outside the chromatic threshold — they got a tiny bit of
  // background-grey blended in but stayed too colorful for isBg. After the
  // main flood, dilate transparency by 1px into neighbours that are
  // "near-neutral" (max-min ≤ 40) AND brighter than mid-grey AND already
  // touching transparency. One pass is enough — over-iterating eats figure.
  const isHalo = (i) => {
    const a = px[i + 3];
    if (a < 24) return false;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 40) return false;
    return (r + g + b) > 420;                                       // brightness > 140
  };
  const haloErase = new Uint8Array(n);
  for (let idx = 0; idx < n; idx++) {
    if (px[idx * 4 + 3] !== 0) continue;
    const x = idx % w, y = (idx - x) / w;
    if (x > 0)     { const nb = idx - 1; if (px[nb * 4 + 3] > 0 && isHalo(nb * 4)) haloErase[nb] = 1; }
    if (x < w - 1) { const nb = idx + 1; if (px[nb * 4 + 3] > 0 && isHalo(nb * 4)) haloErase[nb] = 1; }
    if (y > 0)     { const nb = idx - w; if (px[nb * 4 + 3] > 0 && isHalo(nb * 4)) haloErase[nb] = 1; }
    if (y < h - 1) { const nb = idx + w; if (px[nb * 4 + 3] > 0 && isHalo(nb * 4)) haloErase[nb] = 1; }
  }
  for (let idx = 0; idx < n; idx++) if (haloErase[idx]) px[idx * 4 + 3] = 0;

  ctx.putImageData(img, 0, 0);
}

// Kill bright halos: any pixel that borders transparency AND is close to a
// bright background color gets its alpha reduced. Removes diffusion-model
// fringes that color-key alone misses.
function softenEdgeHalos(canvas) {
  const w = canvas.width, h = canvas.height;
  if (w < 4 || h < 4) return;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const newAlpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) newAlpha[i] = px[i * 4 + 3];

  const isTransparent = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return px[(y * w + x) * 4 + 3] < 24;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;
      const a = px[idx + 3];
      if (a < 100) continue;
      const adjacentTransparent =
        isTransparent(x - 1, y) || isTransparent(x + 1, y) ||
        isTransparent(x, y - 1) || isTransparent(x, y + 1);
      if (!adjacentTransparent) continue;
      const r = px[idx], g = px[idx + 1], b = px[idx + 2];
      // Only nuke pixels that are NEAR-NEUTRAL and bright — those are the
      // AI's diffusion halo. Skin tones, ivory robes, painted shading all
      // have RGB variance and stay intact.
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      if (maxC - minC > 14) continue;
      const brightness = (r + g + b) / 3;
      if (brightness > 220) newAlpha[i] = 0;
      else if (brightness > 195) newAlpha[i] = Math.round(a * 0.35);
      else if (brightness > 170) newAlpha[i] = Math.round(a * 0.65);
    }
  }
  for (let i = 0; i < w * h; i++) px[i * 4 + 3] = newAlpha[i];
  ctx.putImageData(data, 0, 0);
}

function trimAlpha(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const px = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = px[(y * w + x) * 4 + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return canvas; // fully transparent — keep
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  if (tw === w && th === h) return canvas; // already tight
  const trimmed = document.createElement('canvas');
  trimmed.width = tw;
  trimmed.height = th;
  trimmed.getContext('2d').drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);
  return trimmed;
}

function imageToCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

// ── Single-sprite loader ──
// Default pipeline: optional color-key → flood-fill background → trim.
// floodFillBg is the new default for stripping AI-generator transparency-
// checker patterns. It's safe — only edge-connected pixels get erased, so
// interior figure pixels (robes, armor, skin) are physically unreachable.
// The old killCheckerPattern / autoStripBackground / softenEdgeHalos remain
// available as opt-in escape hatches via the manifest.
function loadSingleSprite(name, entry) {
  if (LOADING.has(name) || REGISTRY.has(name) || FAILED.has(name)) return;
  LOADING.add(name);
  const img = new Image();
  img.onerror = () => { LOADING.delete(name); FAILED.add(name); };
  img.onload = () => {
    LOADING.delete(name);
    let canvas = imageToCanvas(img);
    if (entry.colorKey)              applyColorKey(canvas.getContext('2d'), canvas.width, canvas.height, entry.colorKey);
    if (entry.stripNeutral === true) stripNeutralPixels(canvas);
    if (entry.floodFillBg !== false) floodFillBg(canvas);
    if (entry.killChecker === true)  killCheckerPattern(canvas);
    if (entry.autoStrip === true)    autoStripBackground(canvas);
    if (entry.softenHalos === true)  softenEdgeHalos(canvas);
    if (entry.autoTrim !== false)    canvas = trimAlpha(canvas);
    REGISTRY.set(name, canvas);
  };
  img.src = entry.path;
}

// ── Sheet loader: load → color-key → slice → trim each region ──
function loadSheet(sheetName) {
  const sheet = SHEET_MANIFEST[sheetName];
  if (!sheet || LOADING.has(sheetName)) return;
  LOADING.add(sheetName);
  const img = new Image();
  img.onerror = () => {
    LOADING.delete(sheetName);
    for (const r of Object.keys(sheet.regions)) FAILED.add(r);
  };
  img.onload = () => {
    LOADING.delete(sheetName);
    const sheetCanvas = imageToCanvas(img);
    const sheetCtx = sheetCanvas.getContext('2d');
    if (sheet.colorKey) applyColorKey(sheetCtx, sheetCanvas.width, sheetCanvas.height, sheet.colorKey);
    for (const [regionName, region] of Object.entries(sheet.regions)) {
      const rx = Math.floor(region.x * sheetCanvas.width);
      const ry = Math.floor(region.y * sheetCanvas.height);
      const rw = Math.floor(region.w * sheetCanvas.width);
      const rh = Math.floor(region.h * sheetCanvas.height);
      let sub = document.createElement('canvas');
      sub.width = rw;
      sub.height = rh;
      sub.getContext('2d').drawImage(sheetCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
      if (sheet.floodFillBg !== false) floodFillBg(sub);
      if (sheet.killChecker === true)  killCheckerPattern(sub);
      if (sheet.autoStrip === true)    autoStripBackground(sub);
      if (sheet.softenHalos === true)  softenEdgeHalos(sub);
      if (sheet.autoTrim !== false)    sub = trimAlpha(sub);
      REGISTRY.set(regionName, sub);
    }
  };
  img.src = sheet.path;
}

// ── Public API ──
export function getSprite(name) {
  if (FAILED.has(name)) return null;
  const cached = REGISTRY.get(name);
  if (cached) return cached;
  // Lazy-kick the right loader
  const entry = SPRITE_MANIFEST[name];
  if (entry) { loadSingleSprite(name, entry); return null; }
  const sheetName = REGION_TO_SHEET.get(name);
  if (sheetName) { loadSheet(sheetName); return null; }
  return null;
}

export function preloadAllSprites() {
  for (const [name, entry] of Object.entries(SPRITE_MANIFEST)) loadSingleSprite(name, entry);
  for (const sheetName of Object.keys(SHEET_MANIFEST)) loadSheet(sheetName);
}

// Draw a sprite. `scale` multiplies the auto-computed target-height scale.
// `anchorY`: 'bottom' (default) puts feet at sy. 'center' centers on sy.
export function drawSprite(ctx, name, sx, sy, options = {}) {
  const sprite = getSprite(name);
  if (!sprite) return false;
  const { scale = 1, flip = false, anchorY = 'bottom', alpha = 1 } = options;
  const iw = sprite.width;
  const ih = sprite.height;
  const target = TARGET_HEIGHT[name];
  const baseScale = target ? target / ih : 1;
  const finalScale = baseScale * scale;
  const w = iw * finalScale;
  const h = ih * finalScale;
  const dy = anchorY === 'bottom' ? sy - h : anchorY === 'center' ? sy - h / 2 : sy;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.translate(sx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -w / 2, dy, w, h);
  } else {
    ctx.drawImage(sprite, sx - w / 2, dy, w, h);
  }
  ctx.restore();
  return true;
}

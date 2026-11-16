const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  const out = await p.evaluate(async () => {
    const m = await import('/src/scene2d/sprites.js');
    const names = ['npc/songjiang','npc/linchong','npc/wusong','npc/huarong','npc/husanniang','npc/likui',
      'enemy/raider','enemy/scout','enemy/archer','enemy/berserker','enemy/guard','enemy/captain','enemy/warlord'];
    names.forEach(n => m.getSprite(n));
    await new Promise(r => setTimeout(r, 9000));
    return names.map(n => { const s = m.getSprite(n); const r = m.getRigInfo(n);
      return `${n} ${s ? s.width + 'x' + s.height : 'none'} ${r ? JSON.stringify({ legs: r.legs, splitX: +r.splitX.toFixed(2), hipU: +r.hipU.toFixed(2) }) : ''}`; });
  });
  console.log(out.join('\n'));
  await b.close();
})();

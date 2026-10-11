const B = require('./body_model.js');
for (let sc = 0; sc < B.SCENARIOS.length; sc++) {
  const t0 = Date.now(); const b = new B.Body({ scenario: sc }); b.run(12000); if (sc === 0 || sc === 5) { b.eat(); } b.run(12000);
  const s = b.hist[b.hist.length - 1], st = {}; for (const x of b.hist.slice(-600)) st[x.status] = (st[x.status] || 0) + 1;
  const gmax = Math.max(...b.hist.map((x) => x.glucose));
  console.log(`${sc} ${B.SCENARIOS[sc].name}: ${JSON.stringify(st)} HR ${s.hr} P ${s.pressure} G ${s.glucose} (max ${gmax}) read ${s.gread} ins ${s.insulin} neph ${s.nephrons} gfr ${s.gfr} renin ${s.renin} brain ${s.hbrain}/${s.pbrain}/${s.kbrain} [${Date.now() - t0} ms]`);
  console.log('    ' + b.findings.map((f) => f.text).join('; '));
}

// NeuroBit64-Body: the three organ chips and three NeuroBit64-S brain chips running together,
// the connections between the organs, and the anomaly detector of the Body Monitor app.
// The chips are the bit-exact models of the Verilog designs. The connections between the organs
// (pressure from the heart to the kidney, a glucose balance for the pancreas) are simple rules of
// this app, not parts of the chips and not validated physiology.
// Copyright (c) 2026 Asif Mehmood.  SPDX-License-Identifier: Apache-2.0
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./nb64_common.js'), require('./nb64_cardio_model.js'), require('./nb64_pancreas_model.js'), require('./nb64_kidney_model.js'));
  else root.NB64Body = factory(root.NB64, root.NB64Cardio, root.NB64Pancreas, root.NB64Kidney);
})(typeof self !== 'undefined' ? self : this, function (C, Cardio, Pancreas, Kidney) {
  'use strict';
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  // scenario = the condition pins of the three chips
  const SCENARIOS = [
    { name: 'Healthy', heart: 0, pancreas: 0, kidney: 0 },
    { name: 'Tachycardia', heart: 1, pancreas: 0, kidney: 0 },
    { name: 'Irregular heart rhythm', heart: 3, pancreas: 0, kidney: 0 },
    { name: 'Heart conduction block', heart: 4, pancreas: 0, kidney: 0 },
    { name: 'Beta-cell loss (diabetes-like)', heart: 0, pancreas: 4, kidney: 0 },
    { name: 'Weak beta-cell response', heart: 0, pancreas: 5, kidney: 0 },
    { name: 'Early nephron loss (25 %)', heart: 0, pancreas: 0, kidney: 1 },
    { name: 'Advanced nephron loss (75 %)', heart: 0, pancreas: 0, kidney: 3 },
    { name: 'Sympathetic overdrive (stress)', heart: 1, pancreas: 7, kidney: 6 },
    { name: 'Diabetes-like with early kidney loss', heart: 0, pancreas: 4, kidney: 1 },
  ];
  // reference ranges of the healthy model (measured with this model; see README)
  const RANGES = {
    hr: [60, 100, 'heart rate', 'beats/min'], apd: [250, 450, 'action potential duration', 'ms'], dibi: [0, 100, 'beat-to-beat change', 'ms'],
    glucose: [70, 180, 'blood glucose', 'mg/dL'], gerr: [-40, 40, 'glucose read from the cells minus glucose', 'mg/dL'],
    nephrons: [875, 1000, 'working nephrons', ''], gfr: [60, 125, 'total filtration', '%'], renin: [0, 80, 'renin level', '%'], pressure: [70, 140, 'kidney perfusion pressure', 'mmHg'],
  };

  class Body {
    constructor(o) {
      o = o || {};
      this.scenario = o.scenario | 0; this.coupled = o.coupled !== false;
      const sc = SCENARIOS[this.scenario];
      const mk = (M, cond) => { const nb = new C.NeuroBit64S({ lif: 1, leak: 2, tsel: 4 }); const chip = new M.Chip({ cond, link: 1, nb, keepFrames: false, raster: !!o.raster, onFrame: (p) => this.onPayload(p) }); return { chip, nb, last: null, words0: 0, ones0: 0, act: 0 }; };
      this.heart = mk(Cardio, sc.heart); this.pancreas = mk(Pancreas, sc.pancreas); this.kidney = mk(Kidney, sc.kidney);
      this.G = 100; this.meal = 0; this.P = 100; this.t = 0;
      this.hist = []; this.findings = []; this.status = 'starting'; this.score = 0; this.log = []; this.onUpdate = o.onUpdate || null;
      this.external = { 1: false, 2: false, 3: false };          // true when the reports of that organ come from hardware
      this.send = { 2: null, 3: null };                          // functions that write an input value to hardware
      if (this.coupled) { this.pancreas.chip.setInput(100); this.pancreas.chip.gin = 100; this.kidney.chip.setInput(100); this.kidney.chip.pin = 100; }
    }
    eat() { this.meal = 45; this.note('meal: glucose is added for one second'); }
    note(s) { this.log.unshift({ t: this.t, text: s }); if (this.log.length > 40) this.log.pop(); }

    tick() {
      if (!this.external[1]) this.heart.chip.tick();
      if (!this.external[2]) this.pancreas.chip.tick();
      if (!this.external[3]) this.kidney.chip.tick();
      this.t++;
      if ((this.t & 15) === 0) this.frame();
    }
    onPayload(p) { const d = C.decodePayload(p); const o = d.organ === 1 ? this.heart : d.organ === 2 ? this.pancreas : d.organ === 3 ? this.kidney : null; if (o) o.last = d; }

    // once per 16 ms: the connections between the organs, then the anomaly detector
    frame() {
      const h = this.heart.last, p = this.pancreas.last, k = this.kidney.last;
      if (!h || !p || !k) return;
      for (const o of [this.heart, this.pancreas, this.kidney]) { o.act = o.nb.ones - o.ones0; o.ones0 = o.nb.ones; }   // brain-chip spikes in this frame
      const pause = (h.flags >> 5) & 1, ibi = pause ? 2500 : h.m1, hr = ibi ? 60000 / ibi : 0;
      if (this.coupled) {
        // heart -> kidney: perfusion pressure follows the heart rate; high glucose adds a little
        let P = hr >= 79 ? 100 + (hr - 79) * 0.4 : 100 - (79 - hr) * 0.9;
        if (!ibi) P = 100;
        if (this.G > 180) P += (this.G - 180) / 4;
        this.P += (clamp(P, 40, 200) - this.P) * 0.05;
        const Pi = Math.round(this.P);
        if (this.external[3]) { if (this.send[3]) this.send[3](Pi); } else this.kidney.chip.setInput(Pi);
        // glucose balance: liver output, meal, uptake, insulin lowers it, glucagon raises it
        const ins = p.m3 / 255, glg = Math.min(1, p.countB / 270);
        const meal = this.meal > 0 ? 2.5 : 0; if (this.meal > 0) this.meal--;
        this.G = clamp(this.G + 0.9 + meal - 0.002 * this.G - 2.63 * ins + 0.8 * glg, 20, 500);
        const Gi = Math.round(this.G);
        if (this.external[2]) { if (this.send[2]) this.send[2](Gi); } else this.pancreas.chip.setInput(Gi);
      }
      const s = { t: this.t, hr: Math.round(hr), ibi: h.m1, apd: h.m2, dibi: h.m3, hsig: h.signal, hflags: h.flags, hbrain: h.brain, hup: h.countA,
        glucose: p.m1, gread: p.m2, gerr: p.m2 - p.m1, insulin: Math.round(p.m3 / 2.55), pbeta: p.countA, palpha: p.countB, pflags: p.flags, pbrain: p.brain, psig: p.signal,
        nephrons: k.m1, gfr: k.m2 & 255, pressure: k.m2 >> 8, renin: Math.round(k.m3 / 2.55), kfilt: k.countA, kflags: k.flags, kbrain: k.brain, ksig: k.signal,
        bh: this.heart.act, bp: this.pancreas.act, bk: this.kidney.act };
      this.detect(s);
      this.hist.push(s); if (this.hist.length > 900) this.hist.shift();
      if (this.onUpdate) this.onUpdate(s);
    }

    detect(s) {
      const f = [], warm = this.t > 4000;                         // the chips need about 4 s after reset
      const add = (level, organ, text) => f.push({ level, organ, text });
      if (warm) {
        // 1. flags raised by the chips themselves
        Cardio.FLAGS.slice(0, 7).forEach((n, i) => { if ((s.hflags >> i) & 1) add(2, 'heart', 'heart chip: ' + n); });
        Pancreas.FLAGS.slice(0, 5).forEach((n, i) => { if (n && (s.pflags >> i) & 1) add(i < 2 ? 1 : 2, 'pancreas', 'pancreas chip: ' + n); });
        Kidney.FLAGS.slice(0, 7).forEach((n, i) => { if ((s.kflags >> i) & 1) add(i === 6 ? 2 : i === 5 || i === 3 ? 1 : 2, 'kidney', 'kidney chip: ' + n); });
        // 2. values outside the range of the healthy model
        let worst = 0;
        for (const key of Object.keys(RANGES)) {
          const [lo, hi, name, unit] = RANGES[key], v = s[key]; if (key === 'hr' && !v) continue;
          const span = hi - lo, z = v < lo ? (lo - v) / span : v > hi ? (v - hi) / span : 0; worst = Math.max(worst, z);
          if (z > 0) add(z > 0.25 ? 2 : 1, key === 'hr' || key === 'apd' || key === 'dibi' ? 'heart' : key.startsWith('g') ? 'pancreas' : 'kidney', `${name} ${v} ${unit} is ${v < lo ? 'below' : 'above'} the healthy range ${lo}-${hi}`);
        }
        this.score = Math.min(1, worst);
        // 3. patterns across organs
        if (s.hr && s.hr < 60 && s.pressure < 80) add(2, 'body', 'slow heart with low kidney perfusion (heart-kidney pattern)');
        if (s.glucose > 180 && s.insulin < 30) add(2, 'body', 'high glucose with a weak insulin answer (diabetes-like pattern)');
        if (s.glucose > 180 && (s.kflags & 2)) add(2, 'body', 'high glucose together with kidney hyperfiltration');
        const symp = ((s.hflags & 1) ? 1 : 0) + ((s.pflags >> 4) & 1) + ((s.kflags >> 4) & 1);
        if (symp >= 2) add(2, 'body', 'strong sympathetic drive in ' + symp + ' organs (stress pattern)');
      }
      const lvl = f.reduce((a, x) => Math.max(a, x.level), 0);
      const status = !warm ? 'starting' : lvl === 2 ? 'abnormal' : lvl === 1 ? 'watch' : 'normal';
      // event log: a finding is written when it appears, and again only after it was absent for 5 s
      this.seen = this.seen || {};
      for (const x of f) { const k = x.text.replace(/ -?\d+(\.\d+)? /g, ' # '); if (!(k in this.seen) || this.t - this.seen[k] > 5000) this.note(x.text); this.seen[k] = this.t; }
      if (warm && status === 'normal' && this.status !== 'normal' && this.status !== 'starting' && this.t - (this.lastOk || 0) > 5000) { this.note('all signals back in the healthy range'); this.lastOk = this.t; }
      this.status = status; this.findings = f; s.status = status; s.score = this.score; s.nfind = f.length;
    }
    run(ticks) { for (let i = 0; i < ticks; i++) this.tick(); return this; }
  }
  return { Body, SCENARIOS, RANGES };
});

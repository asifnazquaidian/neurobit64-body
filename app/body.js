// NeuroBit64 Body Monitor: user interface for body_model.js
// Copyright (c) 2026 Asif Mehmood.  SPDX-License-Identifier: Apache-2.0
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id), B = window.NB64Body, R = B.RANGES;
  const S = { body: null, running: false, raf: 0, t0: 0, conns: [] };
  $('scenario').innerHTML = B.SCENARIOS.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');

  function fit(c) { const r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1; if (c.width !== Math.round(r.width * k)) { c.width = Math.round(r.width * k); c.height = Math.round(+c.getAttribute('height') * k); } return k; }
  function chart(c, series, cols, lo, hi, band) {
    const k = fit(c), g = c.getContext('2d'), W = c.width, H = c.height, pl = 34 * k, n = 900;
    g.clearRect(0, 0, W, H);
    const Y = (v) => (H - 4 * k) * (1 - (v - lo) / (hi - lo || 1)) + 2 * k;
    if (band) { g.fillStyle = '#e8f6ee'; g.fillRect(pl, Y(Math.min(hi, band[1])), W - pl, Y(Math.max(lo, band[0])) - Y(Math.min(hi, band[1]))); }
    g.font = `${10 * k}px system-ui`; g.fillStyle = '#5b6777'; g.fillText(String(Math.round(hi)), 2, 11 * k); g.fillText(String(Math.round(lo)), 2, H - 3 * k);
    series.forEach((s, i) => { g.strokeStyle = cols[i]; g.lineWidth = 1.5 * k; g.beginPath(); s.forEach((v, j) => { const x = pl + (W - pl) * j / (n - 1), y = Y(Math.max(lo, Math.min(hi, v))); if (j) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); });
  }
  const kv = (rows) => rows.map(([l, v, key]) => { const out = key && R[key] && (v < R[key][0] || v > R[key][1]); return `<span>${l}</span><b class="${out ? 'out' : ''}">${v}</b>`; }).join('');
  function badge(el, findings, organ, warm) {
    const mine = findings.filter((f) => f.organ === organ), lvl = mine.reduce((a, f) => Math.max(a, f.level), 0);
    el.textContent = !warm ? 'starting' : lvl === 2 ? 'abnormal' : lvl === 1 ? 'watch' : 'normal'; el.className = lvl === 2 ? 'bad' : lvl === 1 ? 'warn' : '';
  }

  function render() {
    const b = S.body; if (!b || !b.hist.length) return;
    const h = b.hist, s = h[h.length - 1], warm = b.status !== 'starting';
    $('banner').className = 'card ' + b.status;
    $('statusText').textContent = { starting: 'Starting (the chips need about 4 s)…', normal: 'Normal: all signals inside the healthy range', watch: 'Watch: a signal is at the edge of the healthy range', abnormal: 'Abnormal behaviour detected' }[b.status];
    $('findings').innerHTML = b.findings.map((f) => `<li class="l${f.level}">${f.text}</li>`).join('');
    badge($('hBadge'), b.findings, 'heart', warm); badge($('pBadge'), b.findings, 'pancreas', warm); badge($('kBadge'), b.findings, 'kidney', warm);
    const body = b.findings.filter((f) => f.organ === 'body').length; $('bBadge').textContent = !warm ? 'starting' : body ? body + ' pattern' + (body > 1 ? 's' : '') : 'linked'; $('bBadge').className = body ? 'bad' : '';
    $('bKv').innerHTML = kv([['spikes, heart centre', s.bh], ['spikes, pancreas centre', s.bp], ['spikes, kidney centre', s.bk], ['drive to heart / pancreas / kidney', `${s.hbrain} / ${s.pbrain} / ${s.kbrain}`]]);
    $('hKv').innerHTML = kv([['heart rate (beats/min)', s.hr, 'hr'], ['beat interval (ms)', s.ibi], ['action potential (ms)', s.apd, 'apd'], ['beat-to-beat change (ms)', s.dibi, 'dibi']]);
    $('pKv').innerHTML = kv([['glucose (mg/dL)', s.glucose, 'glucose'], ['read from the cells (mg/dL)', s.gread], ['insulin level (%)', s.insulin], ['beta / alpha spikes', `${s.pbeta} / ${s.palpha}`]]);
    $('kKv').innerHTML = kv([['working nephrons', s.nephrons, 'nephrons'], ['total filtration (%)', s.gfr, 'gfr'], ['perfusion pressure (mmHg)', s.pressure, 'pressure'], ['renin level (%)', s.renin, 'renin']]);
    chart($('cB'), [h.map((x) => x.bh), h.map((x) => x.bp), h.map((x) => x.bk)], ['#c62828', '#b26a00', '#0b6bcb'], 0, Math.max(40, ...h.map((x) => Math.max(x.bh, x.bp, x.bk))));
    chart($('cH'), [h.map((x) => x.hsig)], ['#c62828'], -80, 20);
    chart($('cP'), [h.map((x) => x.gread), h.map((x) => x.glucose)], ['#e0b46a', '#7a4a00'], 40, Math.max(220, ...h.map((x) => x.glucose)), R.glucose);
    chart($('cK'), [h.map((x) => x.renin), h.map((x) => x.gfr)], ['#8fc0ee', '#0b4f96'], 0, 200, R.gfr);
    chart($('cS'), [h.map((x) => x.score * 100)], ['#c62828'], 0, 100);
    $('dHeart').textContent = `${s.hr} beats/min`; $('dPanc').textContent = `glucose ${s.glucose} mg/dL`; $('dKid').textContent = `${s.nephrons} nephrons, ${s.gfr} %`;
    $('dBrain').textContent = `${s.bh + s.bp + s.bk} spikes / 16 ms`;
    $('lH').textContent = `drive ${s.hbrain}`; $('lP').textContent = `drive ${s.pbrain}`; $('lK').textContent = `drive ${s.kbrain}`;
    $('lHK').textContent = `heart rate sets the kidney perfusion pressure: ${s.pressure} mmHg`;
    $('log').innerHTML = b.log.map((e) => `<li><time>${(e.t / 1000).toFixed(1)} s</time>${e.text}</li>`).join('');
    $('speed').textContent = S.rate ? `model time x ${S.rate.toFixed(2)}` : '';
  }

  function run() {
    $('msg').textContent = '';
    S.body = new B.Body({ scenario: +$('scenario').value });
    for (const c of S.conns) attach(c);
    S.running = true; S.t0 = performance.now(); S.done = 0; S.rate = 0;
    $('run').disabled = true; $('stop').disabled = false; $('meal').disabled = false; $('state').textContent = 'running'; $('state').style.background = '#dff5ea';
    const loop = () => {
      if (!S.running) return;
      const t = performance.now(), want = Math.floor(t - S.t0); let n = Math.min(want - S.done, 64);
      const a = performance.now(); for (let i = 0; i < n; i++) S.body.tick(); S.done += n;
      if (want - S.done > 200) S.t0 = t - S.done;                          // slower than real time: do not try to catch up
      S.wall = (S.wall || t); if (t - S.wall > 2000) { S.rate = (S.body.t - (S.tk || 0)) / (t - S.wall); S.wall = t; S.tk = S.body.t; }
      void a; render(); S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
  }
  function stop() { S.running = false; cancelAnimationFrame(S.raf); $('run').disabled = false; $('stop').disabled = true; $('meal').disabled = true; $('state').textContent = 'stopped'; $('state').style.background = ''; }

  // ---------- reports of a real chip instead of the simulated one
  function attach(c) {
    const b = S.body; if (!b) return;
    c.parser = new NB64.FrameParser((p) => { const organ = p[1] >> 4; if (organ >= 1 && organ <= 3) { b.external[organ] = true; if (organ > 1) b.send[organ] = (v) => c.tx([organ === 2 ? 0x47 : 0x50, v & 255, v >> 8]); b.onPayload(p); } });
  }
  async function connect() {
    $('msg').textContent = '';
    try {
      const c = { tx: () => {}, parser: null };
      if (navigator.serial && confirm('OK = USB serial port, Cancel = Bluetooth serial module')) {
        const port = await navigator.serial.requestPort(); await port.open({ baudRate: 115200 });
        const w = port.writable.getWriter(); c.tx = (bytes) => w.write(new Uint8Array(bytes)); const rd = port.readable.getReader();
        (async () => { try { for (;;) { const { value, done } = await rd.read(); if (done) break; if (c.parser) c.parser.push(value); } } catch (e) { /* closed */ } })();
      } else {
        if (!navigator.bluetooth) throw new Error('This browser has neither Web Serial nor Web Bluetooth. Use Chrome or Edge.');
        const HM = 0xffe0, NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
        const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [HM] }, { services: [NUS] }], optionalServices: [HM, NUS] });
        const gatt = await dev.gatt.connect(); let rx, tx;
        try { const s = await gatt.getPrimaryService(HM); rx = tx = await s.getCharacteristic(0xffe1); }
        catch (e) { const s = await gatt.getPrimaryService(NUS); rx = await s.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e'); tx = await s.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e'); }
        rx.addEventListener('characteristicvaluechanged', (e) => { if (c.parser) c.parser.push(new Uint8Array(e.target.value.buffer)); });
        await rx.startNotifications(); c.tx = (bytes) => tx.writeValueWithoutResponse(new Uint8Array(bytes));
      }
      S.conns.push(c); attach(c); $('msg').textContent = `${S.conns.length} hardware connection(s). The organ whose reports arrive replaces the simulated chip.`;
    } catch (e) { $('msg').textContent = e.message || String(e); }
  }

  $('run').addEventListener('click', run); $('stop').addEventListener('click', stop);
  $('meal').addEventListener('click', () => S.body && S.body.eat());
  $('hw').addEventListener('click', connect);
  $('scenario').addEventListener('change', () => { if (S.running) { stop(); run(); } });
  window.addEventListener('resize', render);
  window.NB64BodyUI = { S, run, stop };
  // Links can choose the scenario and start it:  ?scenario=0..9  &meal=1  &run=0
  // The six simulated chips start by themselves unless run=0.
  const Q = new URLSearchParams(location.search), qs = parseInt(Q.get('scenario'), 10);
  if (qs >= 0 && qs < B.SCENARIOS.length) $('scenario').value = String(qs);
  if (Q.get('run') !== '0') { run(); if (Q.get('meal') === '1') setTimeout(() => S.body && S.body.eat(), 6000); }
})();

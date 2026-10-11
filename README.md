# NeuroBit64-Body: brain, heart, pancreas and kidney chips together

A web app that runs the whole NeuroBit64 family at once and looks for abnormal behaviour:

- three [NeuroBit64-S](https://github.com/asifnazquaidian/neurobit64) brain chips (192 neurons), one wired to each organ chip through the 3-wire brain link;
- [NeuroBit64-Cardio](https://github.com/asifnazquaidian/neurobit64-cardio), [NeuroBit64-Pancreas](https://github.com/asifnazquaidian/neurobit64-pancreas) and [NeuroBit64-Kidney](https://github.com/asifnazquaidian/neurobit64-kidney), 1000 cells each.

**No chip has been fabricated.** The six chips in the app are the integer software models that were compared bit by bit with the Verilog designs. Open `app/index.html`, or publish the `app` folder as a static site.

## What is connected to what

| Connection | Where it is made | Status |
|---|---|---|
| Brain chip and organ chip (activity bytes one way, sympathetic and parasympathetic drive the other way) | in the chips (`nb64_link.v`) | verified against Verilog in the organ-chip repositories |
| Heart to kidney: the kidney perfusion pressure follows the heart rate (100 mmHg at 79 beats/min, lower for a slow heart, slightly higher for a fast one) and is written to the kidney chip through its `uart_rx` input | rule in the app | assumption of this app, not validated |
| Pancreas: a glucose balance (liver output, meals, uptake, insulin level of the chip lowers it, alpha-cell activity raises it); the result is written to the pancreas chip through its `uart_rx` input | rule in the app | assumption of this app, not validated |
| High glucose (above 180 mg/dL) adds a little to the kidney pressure | rule in the app | assumption of this app, not validated |

## The anomaly detector

Every 16 ms the app has one report from each chip. It combines three things:

1. the flags raised by the chips themselves (for example blocked activation, beta cells do not answer, early-loss pattern);
2. nine values compared with the range of the healthy model (heart rate 60-100 beats/min, action potential 250-450 ms, beat-to-beat change below 100 ms, glucose 70-180 mg/dL, read-out error within 40 mg/dL, at least 875 working nephrons, filtration 60-125 %, renin below 80 %, pressure 70-140 mmHg);
3. four patterns across organs: slow heart with low kidney perfusion, high glucose with a weak insulin answer, high glucose with hyperfiltration, strong sympathetic drive in two or more organs.

The result is Normal, Watch or Abnormal, with the list of findings, an anomaly score and an event log. The ranges are those of this model; they are not clinical limits.

## Scenarios

Healthy, tachycardia, irregular rhythm, conduction block, beta-cell loss, weak beta-cell response, early and advanced nephron loss, sympathetic overdrive, and beta-cell loss with early nephron loss. "Give a meal" adds glucose for one second.

Checked with `node app/test_body.js` (24 s of model time per scenario) and by a click-through test in headless Edge: the healthy scenario stays Normal, also after a meal; each fault scenario is reported as Abnormal with the expected findings; conduction block also produces the heart-kidney pattern because the kidney pressure falls to about 66 mmHg.

"Connect a chip" lets the reports of a real chip (serial port or Bluetooth serial module) replace a simulated one. This path has never been tried with hardware.

## Files

`app/index.html`, `app/body.js` (interface), `app/body_model.js` (the six chips, the connections, the detector), `app/nb64_*_model.js` and `app/nb64_common.js` (the chip models, copies of those in the organ-chip repositories), `app/test_body.js`.

Copyright (c) 2026 Asif Mehmood. Apache License 2.0. AI tools were used where applicable, for convenience. Research model, not a medical device.

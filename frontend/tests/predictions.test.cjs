const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real handlers without a browser, storage, or AMD API calls.
const source = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(
  ['predictionKey', 'cachePrediction', 'runWhatIfSimulation', 'scanFleet', 'analyze']
    .map(name => functions.get(name)).join('\n'),
  { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
).outputText;
const machine = { id: 'MC-104', air: 304.2, process: 317.9, speed: 1170, torque: 64, wear: 211 };
const expected = { machine_id: 'MC-104', air_temperature: 304.2, process_temperature: 317.9,
  rotational_speed: 1170, torque: 64, tool_wear: 211 };

function harness(fetch) {
  const state = { predictions: {} };
  const context = { selected: { ...machine }, fleetMachines: [{ ...machine }],
    selectedKey: { current: JSON.stringify(Object.values(machine)) },
    whatIfInputs: { air: 304.2, process: 317.9, speed: 1170, torque: 45, wear: 100 },
    predictionUrl: '/api/prediction', causalUrl: '/api/causal', fetch,
    setPredictions: update => { state.predictions = update(state.predictions); },
  };
  for (const name of ['WhatIfLoading', 'WhatIfError', 'WhatIfResult', 'FleetLoading', 'FleetError',
    'FleetResults', 'Loading', 'Error', 'Causal', 'AgentReport', 'AgentError']) {
    context['set' + name] = value => { state[name] = value; };
  }
  vm.createContext(context);
  vm.runInContext(code, context);
  context.selectedKey.current = context.predictionKey(context.selected);
  return { context, state };
}
const response = value => ({ ok: true, status: 200, json: async () => value });
const baseline = { risk_score: 0.78, risk_level: 'high', mode: 'trained_random_forest' };
const hypothetical = { ...baseline, risk_score: 0.105, risk_level: 'low' };

test('scan, individual analysis, and simulation baseline send identical model inputs', async () => {
  const requests = [];
  const { context, state } = harness(async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, method: options.method, body });
    return response(url.includes('/causal/') ? { machine_id: machine.id, hypotheses: [] }
      : body.torque === 45 ? hypothetical : baseline);
  });
  const original = JSON.stringify(context.selected);
  await context.scanFleet();
  await context.analyze();
  await context.runWhatIfSimulation();
  const predictions = requests.filter(r => r.url === '/api/prediction/predict');
  assert.equal(predictions.length, 4);
  for (const request of predictions.slice(0, 3)) {
    assert.equal(request.method, 'POST');
    assert.deepEqual(request.body, expected);
  }
  assert.deepEqual(predictions[3].body, { ...expected, torque: 45, tool_wear: 100 });
  assert.equal(JSON.stringify(context.selected), original);
  assert.equal(state.WhatIfResult.baseline.risk_score, 0.78);
  assert.equal(state.WhatIfResult.simulated.risk_score, 0.105);
  assert.equal(state.predictions[context.predictionKey(machine)].risk_score, 0.78);
  assert.equal(state.WhatIfLoading, false);
});

test('prediction cache keys invalidate changed readings and separate machine IDs', () => {
  const { context, state } = harness();
  context.cachePrediction(machine, baseline);
  assert.equal(state.predictions[context.predictionKey({ ...machine })], baseline);
  for (const field of ['air', 'process', 'speed', 'torque', 'wear']) {
    assert.equal(state.predictions[context.predictionKey({ ...machine, [field]: machine[field] + 1 })], undefined);
  }
  assert.equal(state.predictions[context.predictionKey({ ...machine, id: 'OTHER' })], undefined);
});

test('late simulation responses cannot populate another selected machine', async () => {
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const { context, state } = harness(async () => { await pending; return response(baseline); });
  const request = context.runWhatIfSimulation();
  context.selectedKey.current = 'another machine';
  resolve();
  await request;
  assert.equal(state.WhatIfResult, null);
  assert.equal(state.predictions[context.predictionKey(machine)], baseline);
});

test('real API errors remain visible instead of creating successful simulations', async () => {
  const { context, state } = harness(async () => ({ ok: false, status: 500 }));
  await context.runWhatIfSimulation();
  assert.match(state.WhatIfError, /baseline 500, simulation 500/);
  assert.equal(state.WhatIfResult, null);
  assert.equal(Object.keys(state.predictions).length, 0);
});

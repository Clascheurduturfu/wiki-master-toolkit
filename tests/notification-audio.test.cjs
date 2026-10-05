const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

test('notification audio waits for real activation and never resumes from background notifications', async () => {
  const listeners = new Map();
  let count = 1;
  let soundEnabled = true;
  let observerCallback;
  let created = 0;
  let resumed = 0;
  let notes = 0;
  let audio;
  const bell = { querySelector: () => ({ textContent: String(count) }) };
  const document = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    querySelector: selector => selector === 'button[aria-label="Notifications"]' ? bell : null,
    querySelectorAll: () => [],
    documentElement: { classList: { toggle() {} } }
  };
  class AudioContext {
    constructor() { created += 1; audio = this; this.state = 'suspended'; this.currentTime = 0; }
    async resume() { resumed += 1; this.state = 'running'; }
    createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() { notes += 1; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  const window = { AudioContext, navigator: { userActivation: { isActive: false } } };
  const sandbox = { window, document, console, MutationObserver: class {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'features', 'extra-tools.js'), 'utf8'), sandbox);
  const feature = window.__wmAverageFeatures.extraTools.create({
    settings: { isEnabled: key => key === 'notificationSound' && soundEnabled },
    core: { isPullsPage: () => false }
  });
  feature.render();
  count += 1; observerCallback();
  assert.equal(created, 0, 'unattended notifications must not create audio');
  listeners.get('click')({ isTrusted: false });
  assert.equal(created, 0, 'extension-generated clicks must not unlock audio');
  listeners.get('keydown')({ isTrusted: true });
  assert.equal(created, 0, 'non-activating keys must not unlock audio');
  window.navigator.userActivation.isActive = true;
  soundEnabled = false;
  listeners.get('click')({ isTrusted: true });
  assert.equal(created, 0, 'disabled sounds must stay disabled');
  soundEnabled = true;
  listeners.get('click')({ isTrusted: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(created, 1);
  assert.equal(resumed, 1);
  assert.equal(notes, 0, 'unlocking must not replay missed notifications');
  count += 1; observerCallback();
  assert.equal(notes, 2, 'new notifications should chime after activation');
  audio.state = 'suspended';
  window.navigator.userActivation.isActive = false;
  count += 1; observerCallback();
  assert.equal(resumed, 1, 'background updates must never try to resume audio');
  assert.equal(notes, 2);
  window.navigator.userActivation.isActive = true;
  listeners.get('keydown')({ isTrusted: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resumed, 2, 'a later real gesture may restore suspended audio');
});

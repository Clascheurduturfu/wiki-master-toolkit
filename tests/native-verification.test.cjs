const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const created = [], events = [], classes = new Set();
  class Element extends EventTarget {
    constructor(tag) { super(); this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    click() { this.dispatchEvent(new Event('click')); }
  }
  const body = new Element('body');
  body.classList = { add: value => classes.add(value), remove: value => classes.delete(value) };
  const document = { body, createElement(tag) {
    assert.notEqual(tag, 'script', 'verification must never create a script loader');
    const node = new Element(tag); created.push(node); return node;
  } };
  const window = new EventTarget();
  window.addEventListener('wm-average-pack-verification-result', event => events.push(event.detail));
  const context = vm.createContext({ window, document, CustomEvent });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../features/pack-verification.js'), 'utf8'), context);
  const service = window.__wmAverageFeatures.packVerification.create();
  return { service, events, classes, body,
    send: detail => window.dispatchEvent(new CustomEvent('wm-average-pack-verification-needed', { detail })),
    button: role => created.find(node => node.dataset.role === role) };
}

test('native verification keeps the batch paused until an explicit user decision, without scripts or network APIs', () => {
  const p = fixture();
  p.send({ requestId: 'batch-7', openedPacks: 4 });
  assert.equal(p.service.isWaiting(), true);
  assert.equal(p.events.length, 0);
  assert.equal(p.body.children.length, 1);
  assert.ok(p.classes.has('wm-native-verification-active'), 'Toolkit overlays must leave native controls accessible');
  p.send({ requestId: 'duplicate', openedPacks: 4 });
  assert.equal(p.body.children.length, 1);
  p.button('resume').click();
  assert.equal(p.service.isWaiting(), false);
  assert.equal(p.body.children.length, 0);
  assert.equal(p.classes.size, 0);
  assert.equal(p.events[0].requestId, 'batch-7');
  assert.equal(p.events[0].ok, true);
  p.button('cancel').click();
  assert.equal(p.events.length, 1, 'old controls must not resume or cancel another batch');
});

test('cancelling native verification cleans up and permits a later challenge', () => {
  const p = fixture();
  p.send(null);
  assert.equal(p.service.isWaiting(), false);
  p.send({ requestId: 'first', openedPacks: 2 });
  p.button('cancel').click();
  assert.equal(p.events[0].ok, false);
  assert.equal(p.classes.size, 0);
  p.send({ requestId: 'next', openedPacks: 0 });
  assert.equal(p.service.isWaiting(), true);
  assert.equal(p.body.children.length, 1);
});

test('packaged content scripts exist and contain no remote script-loader APIs', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.0.1');
  assert.equal(manifest.version_name, '1.0.1 RC1');
  for (const group of manifest.content_scripts) {
    for (const file of [...group.js, ...group.css || []]) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      if (file.endsWith('.js')) {
        assert.doesNotMatch(source, /createElement\(\s*['"]script['"]|\bimportScripts\s*\(|\beval\s*\(|new\s+Function\s*\(/, file);
      }
    }
  }
});

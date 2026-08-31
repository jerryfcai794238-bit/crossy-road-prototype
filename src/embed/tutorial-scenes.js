import { SCENE_TYPES, TutorialScene } from '../tutorial/TutorialScene.js';

const mountedScenes = new WeakMap();

function createNoopHandle(container, type) {
  return {
    container,
    type,
    supported: false,
    start() { return this; },
    stop() { return this; },
    resize() { return this; },
    renderStatic() { return this; },
    dispose() { mountedScenes.delete(container); return this; }
  };
}

function assertType(type) {
  if (!SCENE_TYPES.includes(type)) throw new Error(`Unsupported tutorial scene type: ${type}`);
}

export function isSupported() { return TutorialScene.isSupported(); }

export function mount(container, { type, autoplay = true } = {}) {
  if (!container || typeof container.appendChild !== 'function') throw new TypeError('CrossyRoadTutorialScenes.mount requires a DOM container.');
  assertType(type);
  const existing = mountedScenes.get(container);
  if (existing) return existing;
  if (!isSupported()) {
    const noop = createNoopHandle(container, type);
    mountedScenes.set(container, noop);
    return noop;
  }
  try {
    const instance = new TutorialScene(container, { type, autoplay });
    const dispose = instance.dispose.bind(instance);
    instance.dispose = () => {
      dispose();
      mountedScenes.delete(container);
      return instance;
    };
    mountedScenes.set(container, instance);
    return instance;
  } catch (error) {
    const noop = createNoopHandle(container, type);
    mountedScenes.set(container, noop);
    return noop;
  }
}

export function mountAll(root = document, { selector = '[data-tutorial-scene]', autoplay = true } = {}) {
  const instances = Array.from(root.querySelectorAll(selector)).map((container) => mount(container, { type: container.dataset.tutorialScene, autoplay }));
  return {
    instances,
    startAll() { instances.forEach((instance) => instance.start()); return this; },
    stopAll({ reset = true } = {}) { instances.forEach((instance) => instance.stop({ reset })); return this; },
    dispose() { instances.forEach((instance) => instance.dispose()); return this; }
  };
}

export { SCENE_TYPES };

import { TutorialScene } from '../tutorial/TutorialScene.js';

/** Keeps UIManager's card-specific API while sharing the embeddable scene core. */
export class TutorialSceneRenderer {
  constructor() {
    this.scenes = new Map();
    this.activeType = null;
    this.reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.supported = TutorialScene.isSupported();
  }

  setActive(type) {
    this.stop();
    this.activeType = type;
    if (!this.supported || !type) return;
    const scene = this.ensureScene(type);
    if (!scene) return;
    scene.reset();
    scene.resize();
    scene.renderStatic();
    scene.start();
  }

  stop() {
    if (this.activeType && this.scenes.has(this.activeType)) {
      this.scenes.get(this.activeType).stop({ reset: true });
    }
    this.activeType = null;
  }

  dispose() {
    this.stop();
    this.scenes.forEach((scene) => scene.dispose());
    this.scenes.clear();
  }

  ensureScene(type) {
    if (this.scenes.has(type)) return this.scenes.get(type);
    const host = document.querySelector(`[data-tutorial-scene="${type}"]`);
    if (!host) return null;
    try {
      const scene = new TutorialScene(host, { type, autoplay: false, reducedMotion: this.reducedMotion });
      this.scenes.set(type, scene);
      return scene;
    } catch (error) {
      this.supported = false;
      return null;
    }
  }
}

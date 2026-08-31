import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { AI_CHARACTER_VARIANTS, createChicken } from '../graphics/VoxelModels.js';

export const SCENE_TYPES = Object.freeze(['move', 'push', 'respawn']);

const STEP_DURATION = 1.25;
const LOOP_DURATION = 4.8;

function clamp01(value) { return Math.max(0, Math.min(1, value)); }

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function getReducedMotionPreference() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Self-contained tutorial voxel scene: it receives a host and never queries the document. */
export class TutorialScene {
  static isSupported() {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
      && typeof window.WebGLRenderingContext !== 'undefined';
  }

  constructor(container, { type, autoplay = true, reducedMotion = getReducedMotionPreference() } = {}) {
    if (!container || typeof container.appendChild !== 'function') throw new TypeError('TutorialScene requires a DOM container.');
    if (!SCENE_TYPES.includes(type)) throw new Error(`Unsupported tutorial scene type: ${type}`);
    if (!TutorialScene.isSupported()) throw new Error('WebGL is not supported in this environment.');
    this.container = container;
    this.type = type;
    this.reducedMotion = Boolean(reducedMotion);
    this.frameId = null;
    this.startedAt = 0;
    this.disposed = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-4.5, 4.5, 3.8, -3.8, 0.1, 100);
    this.actors = {};
    this.checkpoint = null;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'tutorial-scene-canvas';
    this.container.replaceChildren(this.renderer.domElement);
    this.setupScene();
    this.reset();
    this.resize();
    this.renderStatic();
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.resize());
    this.observer?.observe(this.container);
    if (autoplay && !this.reducedMotion) this.start();
  }

  setupScene() {
    this.camera.position.set(-8, 10, -8);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x385b52, 1.35));
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(-6, 10, -4);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    this.scene.add(light);
    const tileGeometry = new THREE.BoxGeometry(CONFIG.GRID_SIZE, 0.16, CONFIG.GRID_SIZE);
    const grassMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.GRASS_PRIMARY });
    const grassAltMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.GRASS_SECONDARY });
    for (let x = -1; x <= 1; x += 1) for (let z = -3; z <= 3; z += 1) {
      const tile = new THREE.Mesh(tileGeometry, (x + z) % 2 ? grassMaterial : grassAltMaterial);
      tile.position.set(x * CONFIG.GRID_SIZE, 0, z * CONFIG.GRID_SIZE);
      tile.receiveShadow = true;
      this.scene.add(tile);
    }
    const player = createChicken();
    player.castShadow = true;
    this.scene.add(player);
    this.actors.player = player;
    if (this.type === 'push') {
      const friend = AI_CHARACTER_VARIANTS[1].createMesh();
      this.scene.add(friend);
      this.actors.friend = friend;
    }
    if (this.type === 'respawn') this.createCheckpoint();
  }

  createCheckpoint() {
    const flagPole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.08), new THREE.MeshLambertMaterial({ color: 0xf8fafc }));
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.06), new THREE.MeshLambertMaterial({ color: 0xffcc00 }));
    flagPole.position.set(0, 0.58, -2.3 * CONFIG.GRID_SIZE);
    flag.position.set(0.29, 0.93, -2.3 * CONFIG.GRID_SIZE);
    this.scene.add(flagPole, flag);
    this.checkpoint = new THREE.PointLight(0x7dffb1, 0, 3.4);
    this.checkpoint.position.copy(flagPole.position).add(new THREE.Vector3(0, 0.45, 0));
    this.scene.add(this.checkpoint);
  }

  start() {
    if (this.disposed || this.reducedMotion || this.frameId !== null) return this;
    this.reset();
    this.startedAt = performance.now();
    this.frameId = requestAnimationFrame((now) => this.animate(now));
    return this;
  }

  stop({ reset = true } = {}) {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    if (!this.disposed && reset) {
      this.reset();
      this.renderStatic();
    }
    return this;
  }

  reset() {
    const step = CONFIG.GRID_SIZE;
    if (this.type === 'move') this.actors.player.position.set(0, 0.08, -1.5 * step);
    if (this.type === 'push') {
      this.actors.player.position.set(0, 0.08, -2.2 * step);
      this.actors.friend.position.set(0, 0.08, -0.9 * step);
    }
    if (this.type === 'respawn') {
      this.actors.player.position.set(0, 0.08, 1.8 * step);
      this.actors.player.visible = true;
      this.checkpoint.intensity = 0;
    }
  }

  animate(now) {
    if (this.disposed || this.reducedMotion || this.frameId === null) return;
    this.update(((now - this.startedAt) / 1000) % LOOP_DURATION);
    this.renderStatic();
    this.frameId = requestAnimationFrame((nextNow) => this.animate(nextNow));
  }

  update(elapsed) {
    this.reset();
    const step = CONFIG.GRID_SIZE;
    const jump = (actor, from, to, progress) => {
      actor.position.lerpVectors(from, to, progress);
      actor.position.y += Math.sin(progress * Math.PI) * 0.42;
    };
    if (this.type === 'move') {
      jump(this.actors.player, new THREE.Vector3(0, 0.08, -1.5 * step), new THREE.Vector3(0, 0.08, -0.3 * step), clamp01((elapsed - 0.45) / STEP_DURATION));
      return;
    }
    if (this.type === 'push') {
      jump(this.actors.friend, new THREE.Vector3(0, 0.08, -0.9 * step), new THREE.Vector3(0, 0.08, 0.3 * step), clamp01((elapsed - 0.65) / STEP_DURATION));
      jump(this.actors.player, new THREE.Vector3(0, 0.08, -2.2 * step), new THREE.Vector3(0, 0.08, -1.0 * step), clamp01((elapsed - 0.3) / STEP_DURATION));
      return;
    }
    const retreat = clamp01((elapsed - 0.25) / 1.15);
    const resume = clamp01((elapsed - 2.35) / STEP_DURATION);
    if (retreat < 1) {
      jump(this.actors.player, new THREE.Vector3(0, 0.08, 1.8 * step), new THREE.Vector3(0, 0.08, -2.3 * step), retreat);
    } else {
      this.checkpoint.intensity = 2.6 * (0.45 + Math.sin(elapsed * 12) * 0.25);
      jump(this.actors.player, new THREE.Vector3(0, 0.08, -2.3 * step), new THREE.Vector3(0, 0.08, -1.05 * step), resume);
    }
  }

  resize() {
    if (this.disposed) return this;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return this;
    const d = 3.8;
    const aspect = width / height;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderStatic();
    return this;
  }

  renderStatic() {
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
    return this;
  }

  dispose() {
    if (this.disposed) return this;
    this.stop({ reset: false });
    this.observer?.disconnect();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
    this.disposed = true;
    return this;
  }
}

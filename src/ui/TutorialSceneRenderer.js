import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { AI_CHARACTER_VARIANTS, createChicken } from '../graphics/VoxelModels.js';

const STEP_DURATION = 1.25;
const LOOP_DURATION = 4.8;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

/** A deliberately isolated, small version of the game's isometric voxel view. */
export class TutorialSceneRenderer {
  constructor() {
    this.scenes = new Map();
    this.activeType = null;
    this.frameId = null;
    this.startedAt = 0;
    this.reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.supported = typeof window !== 'undefined'
      && typeof document !== 'undefined'
      && typeof window.WebGLRenderingContext !== 'undefined';
  }

  setActive(type) {
    this.stop();
    this.activeType = type;
    if (!this.supported || !type) return;
    const entry = this.ensureScene(type);
    if (!entry) return;
    this.reset(entry);
    this.resize(entry);
    this.render(entry);
    if (!this.reducedMotion) {
      this.startedAt = performance.now();
      this.frameId = requestAnimationFrame((now) => this.animate(now));
    }
  }

  stop() {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    if (this.activeType && this.scenes.has(this.activeType)) {
      const entry = this.scenes.get(this.activeType);
      this.reset(entry);
      this.render(entry);
    }
    this.activeType = null;
  }

  dispose() {
    this.stop();
    this.scenes.forEach((entry) => {
      if (entry.observer) entry.observer.disconnect();
      disposeObject(entry.scene);
      entry.renderer.dispose();
      entry.renderer.domElement.remove();
    });
    this.scenes.clear();
  }

  ensureScene(type) {
    if (this.scenes.has(type)) return this.scenes.get(type);
    const host = document.querySelector(`[data-tutorial-scene="${type}"]`);
    if (!host) return null;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      this.supported = false;
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'tutorial-scene-canvas';
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4.5, 4.5, 3.8, -3.8, 0.1, 100);
    camera.position.set(-8, 10, -8);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x385b52, 1.35));
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(-6, 10, -4);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    scene.add(light);

    const tileGeometry = new THREE.BoxGeometry(CONFIG.GRID_SIZE, 0.16, CONFIG.GRID_SIZE);
    const grassMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.GRASS_PRIMARY });
    const grassAltMaterial = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.GRASS_SECONDARY });
    // Keep this runway compact so the host card background remains visible around it.
    for (let x = -1; x <= 1; x += 1) {
      for (let z = -3; z <= 3; z += 1) {
        const tile = new THREE.Mesh(tileGeometry, (x + z) % 2 ? grassMaterial : grassAltMaterial);
        tile.position.set(x * CONFIG.GRID_SIZE, 0, z * CONFIG.GRID_SIZE);
        tile.receiveShadow = true;
        scene.add(tile);
      }
    }

    const entry = { type, host, scene, camera, renderer, actors: {}, checkpoint: null, observer: null };
    this.buildActors(entry);
    if (typeof ResizeObserver !== 'undefined') {
      entry.observer = new ResizeObserver(() => {
        this.resize(entry);
        if (this.activeType === type) this.render(entry);
      });
      entry.observer.observe(host);
    }
    this.scenes.set(type, entry);
    return entry;
  }

  buildActors(entry) {
    const player = createChicken();
    player.castShadow = true;
    entry.scene.add(player);
    entry.actors.player = player;
    if (entry.type === 'push') {
      const friend = AI_CHARACTER_VARIANTS[1].createMesh();
      entry.scene.add(friend);
      entry.actors.friend = friend;
    }
    if (entry.type === 'respawn') {
      const flagPole = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.15, 0.08),
        new THREE.MeshLambertMaterial({ color: 0xf8fafc })
      );
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.34, 0.06),
        new THREE.MeshLambertMaterial({ color: 0xffcc00 })
      );
      flagPole.position.set(0, 0.58, -2.3 * CONFIG.GRID_SIZE);
      flag.position.set(0.29, 0.93, -2.3 * CONFIG.GRID_SIZE);
      entry.scene.add(flagPole, flag);
      entry.checkpoint = new THREE.PointLight(0x7dffb1, 0, 3.4);
      entry.checkpoint.position.copy(flagPole.position).add(new THREE.Vector3(0, 0.45, 0));
      entry.scene.add(entry.checkpoint);
    }
  }

  reset(entry) {
    const step = CONFIG.GRID_SIZE;
    if (entry.type === 'move') entry.actors.player.position.set(0, 0.08, -1.5 * step);
    if (entry.type === 'push') {
      entry.actors.player.position.set(0, 0.08, -2.2 * step);
      entry.actors.friend.position.set(0, 0.08, -0.9 * step);
    }
    if (entry.type === 'respawn') {
      entry.actors.player.position.set(0, 0.08, 1.8 * step);
      entry.actors.player.visible = true;
      entry.checkpoint.intensity = 0;
    }
  }

  animate(now) {
    if (!this.activeType || this.reducedMotion) return;
    const entry = this.scenes.get(this.activeType);
    if (!entry) return;
    this.update(entry, ((now - this.startedAt) / 1000) % LOOP_DURATION);
    this.render(entry);
    this.frameId = requestAnimationFrame((nextNow) => this.animate(nextNow));
  }

  update(entry, elapsed) {
    this.reset(entry);
    const step = CONFIG.GRID_SIZE;
    const jump = (actor, from, to, progress) => {
      actor.position.lerpVectors(from, to, progress);
      actor.position.y += Math.sin(progress * Math.PI) * 0.42;
    };
    if (entry.type === 'move') {
      const progress = clamp01((elapsed - 0.45) / STEP_DURATION);
      jump(entry.actors.player, new THREE.Vector3(0, 0.08, -1.5 * step), new THREE.Vector3(0, 0.08, -0.3 * step), progress);
      return;
    }
    if (entry.type === 'push') {
      const friendProgress = clamp01((elapsed - 0.65) / STEP_DURATION);
      const playerProgress = clamp01((elapsed - 0.3) / STEP_DURATION);
      jump(entry.actors.friend, new THREE.Vector3(0, 0.08, -0.9 * step), new THREE.Vector3(0, 0.08, 0.3 * step), friendProgress);
      jump(entry.actors.player, new THREE.Vector3(0, 0.08, -2.2 * step), new THREE.Vector3(0, 0.08, -1.0 * step), playerProgress);
      return;
    }
    const retreat = clamp01((elapsed - 0.25) / 1.15);
    const resume = clamp01((elapsed - 2.35) / STEP_DURATION);
    if (retreat < 1) {
      jump(entry.actors.player, new THREE.Vector3(0, 0.08, 1.8 * step), new THREE.Vector3(0, 0.08, -2.3 * step), retreat);
    } else {
      entry.checkpoint.intensity = 2.6 * (0.45 + Math.sin(elapsed * 12) * 0.25);
      jump(entry.actors.player, new THREE.Vector3(0, 0.08, -2.3 * step), new THREE.Vector3(0, 0.08, -1.05 * step), resume);
    }
  }

  resize(entry) {
    const width = entry.host.clientWidth;
    const height = entry.host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const d = 3.8;
    entry.camera.left = -d * aspect;
    entry.camera.right = d * aspect;
    entry.camera.top = d;
    entry.camera.bottom = -d;
    entry.camera.updateProjectionMatrix();
    entry.renderer.setSize(width, height, false);
  }

  render(entry) {
    entry.renderer.render(entry.scene, entry.camera);
  }
}

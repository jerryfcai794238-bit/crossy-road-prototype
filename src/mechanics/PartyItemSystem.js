import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createEagle } from '../graphics/VoxelModels.js';
import { drawItemIcon, ITEM_META } from '../ui/ItemIcons.js';

const pool = () => CONFIG.ITEMS.POOL;
export class PartyItemSystem {
  constructor(game, random = Math.random) {
    this.game = game;
    this.random = random;
    this.states = new Map();
    this.rockets = [];
    this.eagles = [];
    this.feedback = [];
    this.bursts = [];
    this.shieldEffects = new Map();
    this.stunEffects = new Map();
    this.impactEffects = [];
    this.activeShields = new Map();
    this.time = 0;
    this.eaglePenaltySeconds = 0;
    this.stats = { acquired: 0, rocket: 0, shield: 0, eagle: 0, lightning: 0, destroyedTrees: 0, destroyedCars: 0, destroyedTrains: 0 };
  }

  state(actor) {
    if (!this.states.has(actor)) this.states.set(actor, { slots: Array.from({ length: CONFIG.ITEMS.SLOT_COUNT }, () => null), nextTriggerAt: 0 });
    return this.states.get(actor);
  }

  canReceive(actor) {
    return Boolean(actor && !actor.isDead && !actor.isRespawning && this.state(actor).slots.some((slot) => !slot));
  }

  beginRoulette(actor) {
    if (!this.canReceive(actor)) return false;
    const state = this.state(actor);
    const slotIndex = state.slots.findIndex((slot) => !slot);
    const reservedTypes = state.slots.map((slot) => slot?.type || slot?.roulette?.result).filter(Boolean);
    const eligible = pool().filter(type => !reservedTypes.includes(type));
    const result = eligible[Math.floor(this.random() * eligible.length)] || 'lightning';
    state.slots[slotIndex] = { roulette: { remaining: CONFIG.ITEMS.ROULETTE_SECONDS, total: CONFIG.ITEMS.ROULETTE_SECONDS, preview: 'rocket', result } };
    this.showFeedback(actor, 'box', '抽取中', CONFIG.ITEMS.ROULETTE_SECONDS);
    this.refreshHUD();
    return true;
  }

  award(actor, slotIndex, type) {
    const state = this.state(actor);
    const reservedTypes = state.slots
      .map((slot, index) => index === slotIndex ? null : slot?.type || slot?.roulette?.result)
      .filter(Boolean);
    if (reservedTypes.includes(type)) type = pool().find((candidate) => !reservedTypes.includes(candidate)) || type;
    this.stats.acquired++;
    this.showFeedback(actor, type, type === 'shield' ? `護盾 ${CONFIG.SHIELD.DURATION}秒` : '獲得', CONFIG.ITEMS.TRIGGER_INTERVAL);
    state.slots[slotIndex] = { type, readyAt: this.time, expiresAt: null };
    this.refreshHUD();
  }

  selectRocketTarget(owner) {
    const candidates = this.game.getActiveActors().filter(a => a !== owner && !a.isDead && !a.isRespawning);
    if (!candidates.length) return null;
    const positionOf = (actor) => actor.position || new THREE.Vector3(actor.gridX * CONFIG.GRID_SIZE, 0, actor.gridZ * CONFIG.GRID_SIZE);
    const ownerPosition = positionOf(owner);
    const distanceSquared = (actor) => {
      const position = positionOf(actor);
      const x = position.x - ownerPosition.x;
      const z = position.z - ownerPosition.z;
      return x * x + z * z;
    };
    const gap = Math.min(...candidates.map(distanceSquared));
    const tied = candidates.filter(actor => Math.abs(distanceSquared(actor) - gap) < 1e-8);
    return tied[Math.floor(this.random() * tied.length)] || null;
  }

  selectEagleTarget(owner) {
    const active = this.game.getActiveActors().filter(a => !a.isDead && !a.isRespawning);
    if (!active.length) return null;
    const firstZ = Math.max(...active.map(a => a.gridZ));
    const targetZ = owner.gridZ === firstZ
      ? Math.max(...active.filter(a => a.gridZ < firstZ).map(a => a.gridZ), -Infinity)
      : firstZ;
    if (!Number.isFinite(targetZ)) return null;
    const candidates = active.filter(a => a !== owner && a.gridZ === targetZ && !this.eagles.some(e => e.target === a));
    return candidates[Math.floor(this.random() * candidates.length)] || null;
  }

  update(dt) {
    this.time += dt;
    for (const [actor, shield] of this.activeShields) {
      if (actor.isDead || actor.isRespawning || shield.expiresAt <= this.time) {
        this.activeShields.delete(actor);
        this.removeShieldEffect(actor);
        if (!actor.isDead && !actor.isRespawning) this.showFeedback(actor, 'shield', '護盾失效');
      }
    }
    this.states.forEach((state, actor) => {
      if (actor.isDead || actor.isRespawning) return;
      state.slots.forEach((slot, index) => {
        if (!slot) return;
        if (slot.roulette) {
          const roulette = slot.roulette;
          roulette.remaining = Math.max(0, roulette.remaining - dt);
          roulette.preview = pool()[Math.floor((roulette.total - roulette.remaining) * CONFIG.ITEMS.ROULETTE_PREVIEW_RATE) % pool().length];
          if (roulette.remaining === 0) this.award(actor, index, roulette.result);
          return;
        }
        if (this.time < slot.readyAt || this.time < state.nextTriggerAt || actor.stunTimer > 0) return;
        if (slot.type === 'shield') {
          state.slots[index] = null; state.nextTriggerAt = this.time + CONFIG.ITEMS.TRIGGER_INTERVAL;
          this.activeShields.set(actor, { expiresAt: this.time + CONFIG.SHIELD.DURATION, blocks: CONFIG.SHIELD.BLOCKS });
          this.ensureShieldEffect(actor); this.updateShieldEffect(actor, this.shieldEffects.get(actor));
        } else if (slot.type === 'lightning') {
          state.slots[index] = null; state.nextTriggerAt = this.time + CONFIG.ITEMS.TRIGGER_INTERVAL; this.activate(actor, 'lightning');
        } else if (slot.type === 'rocket') {
          const target = this.selectRocketTarget(actor);
          if (target) { state.slots[index] = null; state.nextTriggerAt = this.time + CONFIG.ITEMS.TRIGGER_INTERVAL; this.launchRocket(actor, target); }
        } else if (slot.type === 'eagle') {
          const target = this.selectEagleTarget(actor);
          if (target) { state.slots[index] = null; state.nextTriggerAt = this.time + CONFIG.ITEMS.TRIGGER_INTERVAL; this.launchEagle(actor, target); }
        }
      });
    });
    this.updateRockets(dt);
    this.updateEagles(dt);
    this.updateFeedback(dt);
    this.updateBursts(dt);
    this.updateStatusEffects();
    this.updateImpactEffects(dt);
    this.refreshHUD();
  }

  refreshHUD() {
    const state = this.states.get(this.game.player);
    this.game.uiManager.updateItemHUD?.(state?.slots || Array.from({ length: CONFIG.ITEMS.SLOT_COUNT }, () => null), this.time);
  }

  activate(actor, type) {
    this.stats[type]++;
    this.showFeedback(actor, type, '發動');
    if (type === 'lightning') this.game.startGlobalLightning(actor);
  }

  blockAttack(actor, type) {
    const shield = this.activeShields.get(actor);
    if (!shield) return false;
    if (shield.expiresAt <= this.time) {
      this.activeShields.delete(actor);
      this.removeShieldEffect(actor);
      this.showFeedback(actor, 'shield', '護盾失效');
      this.refreshHUD();
      return false;
    }
    shield.blocks -= 1;
    if (shield.blocks <= 0) this.activeShields.delete(actor);
    if (shield.blocks <= 0) this.removeShieldEffect(actor);
    this.stats.shield++;
    this.showFeedback(actor, 'shield', '擋下攻擊！');
    this.burst(actor.position, 0x7de5ff, true);
    this.refreshHUD();
    return true;
  }

  hit(actor, type, stun) {
    if (actor.isDead || actor.isRespawning) return false;
    if (this.blockAttack(actor, type)) return false;
    this.showFeedback(actor, type, '受擊');
    return actor.applyStun(stun);
  }

  hasActiveShield(actor) {
    const shield = this.activeShields.get(actor);
    return Boolean(shield && shield.expiresAt > this.time && !actor.isDead && !actor.isRespawning);
  }

  ensureShieldEffect(actor) {
    if (this.shieldEffects.has(actor)) return;
    const group = new THREE.Group();
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(.58, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x5edcff, transparent: true, opacity: .22, wireframe: true })
    );
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(.52, .035, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xc5f7ff, transparent: true, opacity: .85 })
    );
    band.rotation.x = Math.PI / 2;
    group.add(bubble, band);
    this.game.scene.add(group);
    this.shieldEffects.set(actor, { group, bubble, band });
  }

  removeShieldEffect(actor) {
    const effect = this.shieldEffects.get(actor);
    if (!effect) return;
    this.disposeMesh(effect.group);
    this.shieldEffects.delete(actor);
  }

  ensureStunEffect(actor) {
    if (this.stunEffects.has(actor)) return;
    const group = new THREE.Group();
    for (let index = 0; index < 5; index++) {
      const shape = new THREE.Shape();
      for (let point = 0; point < 10; point++) {
        const radius = point % 2 === 0 ? .15 : .065;
        const angle = Math.PI / 2 + point * Math.PI / 5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (point === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      const star = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: 0xffe25c, transparent: true, opacity: .98, side: THREE.DoubleSide })
      );
      star.userData.isStunStar = true;
      group.add(star);
    }
    this.game.scene.add(group);
    this.stunEffects.set(actor, { group });
  }

  removeStunEffect(actor) {
    const effect = this.stunEffects.get(actor);
    if (!effect) return;
    this.disposeMesh(effect.group);
    this.stunEffects.delete(actor);
  }

  updateStatusEffects() {
    const active = new Set(this.game.getActiveActors());
    for (const [actor] of this.activeShields) {
      if (actor.isDead || actor.isRespawning) {
        this.activeShields.delete(actor);
        this.removeShieldEffect(actor);
      }
    }
    for (const actor of this.shieldEffects.keys()) {
      if (!active.has(actor) || !this.hasActiveShield(actor)) this.removeShieldEffect(actor);
    }
    for (const actor of this.stunEffects.keys()) {
      if (!active.has(actor) || actor.isDead || actor.isRespawning || actor.stunTimer <= 0) this.removeStunEffect(actor);
    }
    active.forEach((actor) => {
      if (actor.isDead || actor.isRespawning) return;
      if (this.hasActiveShield(actor)) {
        this.ensureShieldEffect(actor);
        const effect = this.shieldEffects.get(actor);
        this.updateShieldEffect(actor, effect);
      }
      if (actor.stunTimer > 0) {
        this.ensureStunEffect(actor);
        const effect = this.stunEffects.get(actor);
        effect.group.position.copy(actor.position).add(new THREE.Vector3(0, 1.25, 0));
        effect.group.children.forEach((star, index) => {
          const angle = this.time * 6 + index * Math.PI * 2 / effect.group.children.length;
          star.position.set(Math.cos(angle) * CONFIG.VFX.STUN_STAR_RADIUS, Math.sin(angle * 2) * .07, Math.sin(angle) * CONFIG.VFX.STUN_STAR_RADIUS);
          if (this.game.sceneSetup?.camera) star.lookAt(this.game.sceneSetup.camera.position);
          star.rotateZ(-angle * .55);
        });
      }
    });
  }

  updateShieldEffect(actor, effect) {
    if (!effect) return;
    const remaining = Math.max(0, (this.activeShields.get(actor)?.expiresAt ?? 0) - this.time);
    const pulse = 1 + Math.sin(this.time * 7) * .06;
    const flashing = remaining <= CONFIG.SHIELD.FINAL_FLASH && Math.floor(this.time * CONFIG.SHIELD.FLASH_RATE) % 2 === 0;
    effect.group.position.copy(actor.position).add(new THREE.Vector3(0, .55, 0));
    effect.group.scale.setScalar(pulse);
    effect.bubble.material.opacity = flashing ? .055 : .24;
    effect.band.material.opacity = flashing ? .22 : .9;
    effect.band.rotation.z += .05;
  }

  createRocketImpact(position, shielded = false) {
    const group = new THREE.Group();
    const color = shielded ? 0x65ddff : 0xffd15a;
    const flash = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(.15, .48, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    group.add(flash, ring);
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI * 2 / 12;
      const fragment = new THREE.Mesh(new THREE.BoxGeometry(.11, .11, .11), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95 }));
      fragment.userData.velocity = new THREE.Vector3(Math.cos(angle) * (1.8 + index % 3), .8 + index % 4 * .25, Math.sin(angle) * (1.8 + index % 3));
      group.add(fragment);
    }
    group.position.copy(position).add(new THREE.Vector3(0, .52, 0));
    this.game.scene.add(group);
    this.impactEffects.push({ group, flash, ring, age: 0, duration: CONFIG.ROCKET.IMPACT_DURATION, shielded });
  }

  updateImpactEffects(dt) {
    this.impactEffects = this.impactEffects.filter((effect) => {
      effect.age += dt;
      const progress = Math.min(1, effect.age / effect.duration);
      effect.flash.scale.setScalar(1 + progress * 2.8);
      effect.flash.material.opacity = Math.max(0, 1 - progress * 1.35);
      effect.ring.scale.setScalar(1 + progress * 4.2);
      effect.ring.material.opacity = Math.max(0, .95 - progress);
      effect.group.children.forEach((node) => {
        if (!node.userData.velocity) return;
        node.position.addScaledVector(node.userData.velocity, dt);
        node.material.opacity = Math.max(0, 1 - progress);
      });
      if (effect.age < effect.duration) return true;
      this.disposeMesh(effect.group);
      return false;
    });
  }

  launchRocket(owner, target) {
    this.activate(owner, 'rocket');
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.14, .16, .55, 8), new THREE.MeshLambertMaterial({ color: 0xf1f6ff }));
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 8), new THREE.MeshLambertMaterial({ color: 0xff5e4a }));
    nose.rotation.x = Math.PI / 2; nose.position.z = .41;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.13, .4, 6), new THREE.MeshBasicMaterial({ color: 0xffd047 }));
    flame.rotation.x = -Math.PI / 2; flame.position.z = -.44;
    mesh.add(body, nose, flame);
    for (const x of [-.18, .18]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(.13, .05, .26), new THREE.MeshLambertMaterial({ color: 0xff6355 }));
      fin.position.set(x, 0, -.17); mesh.add(fin);
    }
    const position = owner.position.clone();
    mesh.position.copy(position).add(new THREE.Vector3(0, .65, 0));
    this.game.scene.add(mesh);
    this.rockets.push({ owner, target, targetDeaths: target.deathCount || 0, mesh, flame, position, direction: new THREE.Vector3(0, 0, 1) });
    this.showFeedback(target, 'rocket', '被鎖定');
  }

  updateRockets(dt) {
    this.rockets = this.rockets.filter(rocket => {
      const { target, mesh } = rocket;
      const nonfatalReturn = this.game.casualRecovery?.states?.get(target)?.countDeath === false;
      if ((target.isDead && !nonfatalReturn) || (target.deathCount || 0) !== rocket.targetDeaths) { this.disposeMesh(mesh); return false; }
      const delta = target.position.clone().sub(rocket.position); delta.y = 0;
      const distance = delta.length();
      if (distance > 0) rocket.direction.copy(delta).normalize();
      const previous = rocket.position.clone();
      rocket.position.addScaledVector(rocket.direction, Math.min(CONFIG.ROCKET.SPEED * dt, distance));
      this.destroyAlong(previous, rocket.position);
      mesh.position.copy(rocket.position).add(new THREE.Vector3(0, .65, 0));
      mesh.rotation.y = Math.atan2(rocket.direction.x, rocket.direction.z);
      rocket.flame.scale.setScalar(.8 + Math.sin(this.time * 55) * .2);
      if (distance <= CONFIG.ROCKET.SPEED * dt + CONFIG.ROCKET.HIT_RADIUS && !target.isDead && !target.isRespawning) {
        const shielded = this.hasActiveShield(target);
        this.hit(target, 'rocket', CONFIG.ROCKET.STUN_DURATION);
        this.createRocketImpact(target.position, shielded);
        this.disposeMesh(mesh); return false;
      }
      return true;
    });
  }

  destroyAlong(start, end) {
    const map = this.game.mapGenerator;
    const dx = end.x - start.x, dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    const distanceTo = (x, z) => {
      const t = lengthSquared ? Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared)) : 0;
      return Math.hypot(start.x + dx * t - x, start.z + dz * t - z);
    };
    for (const row of map.activeRows.values()) {
      const z = row.z * CONFIG.GRID_SIZE;
      if (z < Math.min(start.z, end.z) - .7 || z > Math.max(start.z, end.z) + .7) continue;
      row.trees = (row.trees || []).filter(tree => {
        const x = tree.gridX * CONFIG.GRID_SIZE;
        if (distanceTo(x, z) > .55) return true;
        map.destroyedTreeCells.add(`${tree.gridX},${row.z}`);
        row.mesh.remove(tree.mesh); this.stats.destroyedTrees++;
        this.burst(new THREE.Vector3(x, 0, z), 0x8bb957); return false;
      });
      if (row.vehicles) row.vehicles = row.vehicles.filter(vehicle => {
        // Use a swept rectangle, matching the vehicle's actual collision width.
        const halfWidth = (vehicle.width || 1.8) / 2;
        const x = vehicle.mesh.position.x;
        if (!this.segmentHitsTraffic(start, end, x, z, halfWidth, .48)) return true;
        row.mesh.remove(vehicle.mesh); this.stats.destroyedCars++; this.burst(new THREE.Vector3(x, 0, z), 0xffa657); return false;
      });
      if (row.train && this.segmentHitsTraffic(start, end, row.train.position.x, z, 4, .5)) {
        const x = row.train.position.x;
        row.mesh.remove(row.train); row.train = null; row.trainState = 'IDLE'; row.idleTimer = 5;
        this.stats.destroyedTrains++; this.burst(new THREE.Vector3(x, 0, z), 0xffa657);
      }
    }
  }

  segmentHitsTraffic(a, b, x, z, halfX, halfZ) {
    let low = 0, high = 1;
    for (const [origin, delta, min, max] of [[a.x, b.x - a.x, x - halfX, x + halfX], [a.z, b.z - a.z, z - halfZ, z + halfZ]]) {
      if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) return false; }
      else { const t1 = (min - origin) / delta, t2 = (max - origin) / delta; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2)); if (low > high) return false; }
    }
    return true;
  }

  launchEagle(owner, target) {
    this.activate(owner, 'eagle');
    this.showFeedback(target, 'eagle', '老鷹來襲！', CONFIG.EAGLE.WARNING_DURATION);
    const mesh = createEagle();
    mesh.position.copy(target.position).add(new THREE.Vector3(-5, 7, 1));
    this.game.scene.add(mesh);
    this.eagles.push({ owner, target, targetDeaths: target.deathCount || 0, mesh, age: 0, hit: false });
  }

  updateEagles(dt) {
    this.eagles = this.eagles.filter(eagle => {
      const { target, mesh } = eagle;
      eagle.age += dt;
      if (!eagle.hit && (target.isDead || target.isRespawning || (target.deathCount || 0) !== eagle.targetDeaths)) { this.disposeMesh(mesh); return false; }
      if (eagle.age < CONFIG.EAGLE.WARNING_DURATION) {
        const t = Math.min(1, eagle.age / CONFIG.EAGLE.WARNING_DURATION);
        mesh.position.copy(target.position).add(new THREE.Vector3(-5 * (1 - t), .6 + 6 * (1 - t) ** 2, 1 - t));
        mesh.rotation.z = Math.sin(eagle.age * 16) * .13;
      } else if (!eagle.hit) {
        eagle.hit = true;
        if (!this.blockAttack(target, 'eagle')) {
          this.showFeedback(target, 'eagle', '送回安全點');
          this.game.casualRecovery.schedule(target, 'eagle', CONFIG.EAGLE.PARTY_RESPAWN_PENALTY_SECONDS, { countDeath: false, animate: false });
        }
      } else {
        mesh.position.y += dt * 9; mesh.position.x += dt * 5;
        if (eagle.age > 2) { this.disposeMesh(mesh); return false; }
      }
      return true;
    });
  }

  showFeedback(actor, type, message = '', duration = CONFIG.VFX.FEEDBACK_SECONDS) {
    const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 112;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#132b43ee'; ctx.beginPath(); ctx.roundRect(8, 8, 96, 96, 22); ctx.fill();
    ctx.strokeStyle = ITEM_META[type]?.color || '#fff0a0'; ctx.lineWidth = 4; ctx.stroke();
    drawItemIcon(ctx, type, 56, 56, 78);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(.78, .78, 1); sprite.renderOrder = 30;
    this.game.scene.add(sprite);
    this.feedback.push({ actor, type, message, sprite, texture, offset: 0, remaining: duration, total: duration });
    this.layoutFeedback(actor);
  }

  layoutFeedback(actor) {
    const effects = this.feedback.filter(effect => effect.actor === actor);
    effects.forEach((effect, index) => {
      effect.offset = (index - (effects.length - 1) / 2) * .86;
      effect.sprite.position.copy(actor.position).add(new THREE.Vector3(effect.offset, 1.65, 0));
    });
  }

  updateFeedback(dt) {
    const affectedActors = new Set();
    this.feedback = this.feedback.filter(effect => {
      effect.remaining -= dt;
      affectedActors.add(effect.actor);
      effect.sprite.position.copy(effect.actor.position).add(new THREE.Vector3(effect.offset, 1.65, 0));
      effect.sprite.material.opacity = Math.min(1, Math.max(0, effect.remaining / .2));
      if (effect.remaining > 0) return true;
      this.game.scene.remove(effect.sprite); effect.sprite.material.dispose(); effect.texture.dispose(); return false;
    });
    affectedActors.forEach(actor => this.layoutFeedback(actor));
  }

  burst(position, color, bubble = false) {
    const group = new THREE.Group(); group.position.copy(position).add(new THREE.Vector3(0, .6, 0));
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 });
    if (bubble) group.add(new THREE.Mesh(new THREE.SphereGeometry(.65, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .35, wireframe: true })));
    for (let i = 0; i < 8; i++) {
      const fragment = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), material.clone());
      fragment.userData.velocity = new THREE.Vector3(Math.cos(i * Math.PI / 4) * 2, 1.6 + i % 3 * .3, Math.sin(i * Math.PI / 4) * 2);
      group.add(fragment);
    }
    material.dispose(); this.game.scene.add(group); this.bursts.push({ group, age: 0 });
  }

  updateBursts(dt) {
    this.bursts = this.bursts.filter(effect => {
      effect.age += dt;
      effect.group.children.forEach(node => { if (node.userData.velocity) node.position.addScaledVector(node.userData.velocity, dt); node.material.opacity = Math.max(0, 1 - effect.age / .5); });
      if (effect.age < .5) return true;
      this.disposeMesh(effect.group); return false;
    });
  }

  disposeMesh(mesh) { this.game.scene.remove(mesh); mesh.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); }

  clear() {
    [...this.rockets, ...this.eagles].forEach(effect => this.disposeMesh(effect.mesh));
    this.bursts.forEach(effect => this.disposeMesh(effect.group));
    this.impactEffects.forEach(effect => this.disposeMesh(effect.group));
    [...this.shieldEffects.keys()].forEach(actor => this.removeShieldEffect(actor));
    [...this.stunEffects.keys()].forEach(actor => this.removeStunEffect(actor));
    this.feedback.forEach(effect => { this.game.scene.remove(effect.sprite); effect.sprite.material.dispose(); effect.texture.dispose(); });
    this.rockets = []; this.eagles = []; this.bursts = []; this.impactEffects = []; this.feedback = [];
    this.states.clear(); this.activeShields.clear(); this.time = 0;
    Object.keys(this.stats).forEach(key => { this.stats[key] = 0; });
    this.refreshHUD();
  }
}

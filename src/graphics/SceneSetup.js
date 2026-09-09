import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class SceneSetup {
  constructor(container) {
    this.container = container;

    // 1. 三維場景與經典天藍背景 + 薄霧
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9bd5ed);
    this.scene.fog = new THREE.FogExp2(0x9bd5ed, 0.012);

    // 2. 正交相機 (Isometric Camera d = 4.2)
    const aspect = window.innerWidth / window.innerHeight;
    const d = CONFIG.CAMERA.ORTHO_SIZE;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      CONFIG.CAMERA.NEAR,
      CONFIG.CAMERA.FAR
    );

    // 經典 45度俯瞰視角偏移 (Camera Offset)
    this.cameraOffset = new THREE.Vector3(CONFIG.CAMERA.OFFSET_X, CONFIG.CAMERA.OFFSET_Y, CONFIG.CAMERA.OFFSET_Z);
    this.cameraTarget = new THREE.Vector3(0, 0, CONFIG.CAMERA.TARGET_AHEAD * CONFIG.GRID_SIZE);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);

    // 3. WebGL 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.CAMERA.PIXEL_RATIO_MAX));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);
    }

    // 4. 光源
    this.setupLights();

    // 5. 視窗 Resizing 響應
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dirLight.position.set(-18, 30, -12);
    this.dirLight.castShadow = true;

    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    const d = 25;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 100;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
  }

  resetCamera() {
    this.cameraTarget.set(0, 0, CONFIG.CAMERA.TARGET_AHEAD * CONFIG.GRID_SIZE);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);
  }

  updateCamera(targetPosition) {
    if (!targetPosition) return;

    const x = Number.isFinite(targetPosition.x) ? targetPosition.x : 0;
    const z = Number.isFinite(targetPosition.z) ? targetPosition.z : 1.2 * CONFIG.GRID_SIZE;
    const playerZ = Number.isFinite(targetPosition.playerZ) ? targetPosition.playerZ : z;
    const aspect = (this.camera.right - this.camera.left) / (this.camera.top - this.camera.bottom);

    // 直式等角投影的前方鏡頭偏移會把 x=0 玩家推往畫面左側；抵銷 Z 偏移以維持中央安全區。
    const targetX = aspect < 1 ? x + (z - playerZ) : x * 0.4;
    this.cameraTarget.set(targetX, 0, z);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);

    if (this.dirLight) {
      this.dirLight.position.set(
        this.cameraTarget.x - 18,
        30,
        this.cameraTarget.z - 12
      );
      this.dirLight.target.position.copy(this.cameraTarget);
      this.dirLight.target.updateMatrixWorld();
    }

    this.camera.lookAt(this.cameraTarget);
  }

  onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = CONFIG.CAMERA.ORTHO_SIZE;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

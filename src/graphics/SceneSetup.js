import * as THREE from 'three';

export class SceneSetup {
  constructor(container) {
    this.container = container;

    // 1. 初始化 Three.js 場景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa0d8ef); // 天藍色背景
    this.scene.fog = new THREE.FogExp2(0xa0d8ef, 0.015); // 遠景霧化效果

    // 2. 正交相機 (Isometric Camera - 拉近鏡頭 d = 5.0)
    const aspect = window.innerWidth / window.innerHeight;
    const d = 5.0; // 鏡頭距離拉至 5.0
    this.camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      1,
      1000
    );

    // 經典左下角往右上角視角角度 (-14, 18, -14)
    this.cameraOffset = new THREE.Vector3(-14, 18, -14);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);

    // 3. 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. 光源設定
    this.setupLights();

    // 5. 視窗大小改變監聽
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLights() {
    // 環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    // 半球光
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.35);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // 主平行日光 + 動態陰影
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    this.dirLight.position.set(-20, 35, -15);
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
  }

  updateCamera(targetPosition) {
    if (!targetPosition) return;

    const desiredTarget = new THREE.Vector3(
      targetPosition.x * 0.4,
      0,
      targetPosition.z
    );

    this.cameraTarget.lerp(desiredTarget, 0.08);

    // 更新相機與平行光位置
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.dirLight.position.set(
      this.cameraTarget.x - 20,
      35,
      this.cameraTarget.z - 15
    );
    this.dirLight.target.position.copy(this.cameraTarget);
    this.dirLight.target.updateMatrixWorld();

    this.camera.lookAt(this.cameraTarget);
  }

  onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 5.0; // 保持 d = 5.0
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

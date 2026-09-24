import * as THREE from "three";
import { ObjectInteraction } from "./objectInteraction.js";

const accent = 0xd96c35;
const metal = 0x51524e;
const darkMetal = 0x292a28;
const lightMetal = 0x85857f;
const background = 0xf4f2ed;

export class RobotArm {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.Fog(background, 17, 32);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    this.camera.position.set(4.2, 3.2, 5.7);
    this.camera.lookAt(0, 1.3, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.performanceMode = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.lastUpdateTime = performance.now();
    this.createLights();
    this.createEnvironment();
    this.createArm();
    this.objects = new ObjectInteraction(this.scene);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xaaa79f, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(3, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 16;
    key.shadow.bias = -0.0002;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 1.1);
    fill.position.set(-4, 3, -3);
    this.scene.add(fill);
  }

  createEnvironment() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ color: 0xe9e7e1, metalness: 0.02, roughness: 0.98 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(14, 28, 0xb9b7af, 0xd3d1c9);
    grid.position.y = 0.012;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.62; material.depthWrite = false; });
    this.scene.add(grid);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.58, 1.68, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: 0x41423e, metalness: 0.32, roughness: 0.7 }),
    );
    platform.position.y = 0.09;
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.scene.add(platform);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.012, 6, 64),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.18, roughness: 0.68 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.185;
    this.scene.add(rim);

    this.addAxis("X", accent, [3.3, 0.025, 0]);
    this.addAxis("Y", 0x687c6d, [0, 3.1, 0]);
    this.addAxis("Z", 0x687985, [0, 0.025, 3.3]);
    this.addLabel("ORIGIN", 0x62635d, [0.28, 0.11, 0.28], 0.5);
  }

  addAxis(name, color, endpoint) {
    const axis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.03, 0), new THREE.Vector3(...endpoint)]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78 }),
    );
    this.scene.add(axis);
    this.addLabel(name, color, [endpoint[0] * 1.04, endpoint[1] + (name === "Y" ? 0.1 : 0), endpoint[2] * 1.04], 0.8);
  }

  addLabel(text, color, position, scale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    context.font = "600 30px Consolas, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, sizeAttenuation: true }));
    label.position.set(...position);
    label.scale.set(0.38 * scale, 0.19 * scale, 1);
    this.scene.add(label);
  }

  createArm() {
    this.base = new THREE.Group();
    this.base.position.y = 0.19;
    this.root.add(this.base);

    const baseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.95, 0.42, 32),
      new THREE.MeshStandardMaterial({ color: darkMetal, metalness: 0.42, roughness: 0.62 }),
    );
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    this.base.add(baseMesh);

    const baseBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.018, 8, 40),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.2, roughness: 0.68 }),
    );
    baseBand.rotation.x = Math.PI / 2;
    baseBand.position.y = 0.19;
    this.base.add(baseBand);

    this.shoulder = new THREE.Group();
    this.shoulder.position.y = 0.3;
    this.base.add(this.shoulder);
    const shoulderMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 24, 16),
      new THREE.MeshStandardMaterial({ color: metal, metalness: 0.28, roughness: 0.72 }),
    );
    shoulderMesh.castShadow = true;
    this.shoulder.add(shoulderMesh);

    this.upper = this.makeSegment(0.95, 0.18);
    this.upper.position.y = 0.48;
    this.shoulder.add(this.upper);
    this.elbow = new THREE.Group();
    this.elbow.position.y = 0.98;
    this.shoulder.add(this.elbow);
    this.elbowJoint = this.makeJoint();
    this.elbow.add(this.elbowJoint);
    this.forearm = this.makeSegment(0.82, 0.15);
    this.forearm.position.y = 0.4;
    this.elbow.add(this.forearm);
    this.wrist = new THREE.Group();
    this.wrist.position.y = 0.83;
    this.elbow.add(this.wrist);
    this.wrist.add(this.makeJoint(0.2));
    this.gripper = new THREE.Group();
    this.gripper.position.y = 0.22;
    this.wrist.add(this.gripper);
    this.fingerLeft = this.makeFinger(-1);
    this.fingerRight = this.makeFinger(1);
    this.gripper.add(this.fingerLeft, this.fingerRight);
  }

  makeSegment(length, width) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, length, width),
      new THREE.MeshStandardMaterial({ color: metal, metalness: 0.24, roughness: 0.7 }),
    );
    body.position.y = length / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.13, length * 0.56, 0.012),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.12, roughness: 0.74 }),
    );
    marker.position.set(width * 0.27, length / 2, width / 2 + 0.007);
    group.add(marker);
    return group;
  }

  makeJoint(radius = 0.18) {
    const joint = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      new THREE.MeshStandardMaterial({ color: lightMetal, metalness: 0.28, roughness: 0.64 }),
    );
    core.castShadow = true;
    joint.add(core);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.8, 0.014, 6, 32),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.14, roughness: 0.72 }),
    );
    collar.rotation.x = Math.PI / 2;
    joint.add(collar);
    return joint;
  }

  makeFinger(side) {
    const finger = new THREE.Group();
    finger.position.x = side * 0.09;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.25, 0.1),
      new THREE.MeshStandardMaterial({ color: metal, metalness: 0.22, roughness: 0.72 }),
    );
    body.position.y = 0.12;
    finger.add(body);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.055, 0.105),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.05, roughness: 0.86 }),
    );
    pad.position.y = 0.015;
    finger.add(pad);
    return finger;
  }

  update(state, now = performance.now()) {
    const delta = Math.max(0, Math.min(0.1, (now - this.lastUpdateTime) / 1000));
    this.lastUpdateTime = now;
    this.base.rotation.y = state.base;
    this.shoulder.rotation.z = -state.shoulder;
    this.elbow.rotation.z = state.elbow - 0.8;
    this.wrist.rotation.z = state.wrist;
    const open = 1 - state.gripper;
    this.fingerLeft.rotation.z = 0.35 * open;
    this.fingerRight.rotation.z = -0.35 * open;
    const end = this.getGripperPosition();
    this.objects.update(end, state.gripper > 0.55, delta);
    this.updateTrail(end);
  }

  getGripperPosition() {
    const position = new THREE.Vector3();
    this.gripper.getWorldPosition(position);
    return [position.x, position.y, position.z];
  }

  updateTrail(position) {
    if (!this.trail) {
      this.trail = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...position), new THREE.Vector3(...position)]),
        new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.24 }),
      );
      this.scene.add(this.trail);
    }
    const points = this.trail.geometry.attributes.position;
    points.setXYZ(0, ...position);
    points.setXYZ(1, position[0], 0.025, position[2]);
    points.needsUpdate = true;
  }

  setPerformanceMode(enabled) {
    this.performanceMode = enabled;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, enabled ? 1 : 1.5));
    this.resize();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  resize() {
    const width = this.container.clientWidth;
    if (!width) return;
    const height = this.container.clientHeight || 400;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  resetObjects() { this.objects.reset(); }

  destroy() {
    this.resizeObserver.disconnect();
    this.scene.traverse((item) => {
      if (item.geometry) item.geometry.dispose();
      if (item.material) {
        const materials = Array.isArray(item.material) ? item.material : [item.material];
        materials.forEach((material) => { material.map?.dispose(); material.dispose(); });
      }
    });
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}

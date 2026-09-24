import * as THREE from "three";
import { ObjectInteraction } from "./objectInteraction.js";
import { ARM_GEOMETRY } from "./robotKinematics.js";

const accent = 0xd96c35;
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
    this.root.position.y = ARM_GEOMETRY.rootHeight;
    this.scene.add(this.root);
    this.lastUpdateTime = performance.now();
    this.createLights();
    this.createEnvironment();
    this.createArm();
    this.objects = new ObjectInteraction(this.scene);
    this.displayMode = "robot";
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
      new THREE.CylinderGeometry(0.82, 0.95, 0.28, 40),
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
    baseBand.position.y = 0.15;
    this.base.add(baseBand);

    this.shoulder = new THREE.Group();
    this.shoulder.position.y = 0.24;
    this.base.add(this.shoulder);
    this.addServo(this.shoulder, [0, 0, 0], [0.66, 0.34, 0.42], true);
    this.shoulder.add(this.makeJoint(0.28, [0.34, 0, 0]));
    this.upper = this.makeSegment(0.94, 0.34);
    this.upper.position.y = 0.22;
    this.shoulder.add(this.upper);
    this.elbow = new THREE.Group();
    this.elbow.position.y = 1.12;
    this.shoulder.add(this.elbow);
    this.elbowJoint = this.makeJoint(0.23);
    this.elbow.add(this.elbowJoint);
    this.addServo(this.elbow, [0, 0, 0], [0.54, 0.3, 0.36], true);
    this.forearm = this.makeSegment(0.78, 0.3);
    this.forearm.position.y = 0.18;
    this.elbow.add(this.forearm);
    this.wrist = new THREE.Group();
    this.wrist.position.y = 0.96;
    this.elbow.add(this.wrist);
    this.wrist.add(this.makeJoint(0.19));
    this.addServo(this.wrist, [0, 0.14, 0], [0.44, 0.24, 0.3], false);
    this.wristRoll = new THREE.Group();
    this.wristRoll.position.y = 0.3;
    this.wrist.add(this.wristRoll);
    this.addServo(this.wristRoll, [0, 0, 0], [0.32, 0.22, 0.28], false);
    this.gripper = new THREE.Group();
    this.gripper.position.y = 0.2;
    this.wristRoll.add(this.gripper);
    this.addServo(this.gripper, [0, 0, 0], [0.27, 0.16, 0.23], false);
    this.fingerLeft = this.makeFinger(-1);
    this.fingerRight = this.makeFinger(1);
    this.gripper.add(this.fingerLeft, this.fingerRight);
  }

  addServo(parent, position, size, horizontal) {
    const housing = new THREE.Group();
    housing.position.set(...position);
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color: 0xe5e2da, metalness: 0.08, roughness: 0.78 }),
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    housing.add(shell);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(size[0] * 0.72, size[1] * 0.86, size[2] * 0.07),
      new THREE.MeshStandardMaterial({ color: 0x4a4b47, metalness: 0.32, roughness: 0.62 }),
    );
    cap.position.z = size[2] * 0.51;
    housing.add(cap);
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(size[0] * 0.34, size[1] * 0.1, 0.012),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.66 }),
    );
    label.position.set(0, size[1] * 0.25, size[2] * 0.55);
    housing.add(label);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, horizontal ? size[0] * 0.92 : size[1] * 0.92, 16),
      new THREE.MeshStandardMaterial({ color: 0x777873, metalness: 0.66, roughness: 0.38 }),
    );
    if (horizontal) shaft.rotation.z = Math.PI / 2;
    shaft.position.x = horizontal ? size[0] * 0.48 : size[0] * 0.4;
    housing.add(shaft);
    parent.add(housing);
    return housing;
  }

  makeSegment(length, width) {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.6, length, width * 0.62),
      new THREE.MeshStandardMaterial({ color: 0xdad8d1, metalness: 0.08, roughness: 0.78 }),
    );
    shell.position.y = length / 2;
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, length * 0.96, width * 0.78),
        new THREE.MeshStandardMaterial({ color: side < 0 ? 0x53544f : 0x777873, metalness: 0.22, roughness: 0.67 }),
      );
      rail.position.set(side * width * 0.42, length / 2, 0);
      rail.castShadow = true;
      group.add(rail);
      for (const y of [length * 0.16, length * 0.84]) {
        const bolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.034, 0.034, 0.018, 12),
          new THREE.MeshStandardMaterial({ color: 0x343531, metalness: 0.46, roughness: 0.48 }),
        );
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(side * width * 0.51, y, width * 0.2);
        group.add(bolt);
      }
    }
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.16, length * 0.42, 0.018),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.08, roughness: 0.72 }),
    );
    marker.position.set(0, length * 0.53, width * 0.32);
    group.add(marker);
    return group;
  }

  makeJoint(radius = 0.18, position = [0, 0, 0]) {
    const joint = new THREE.Group();
    joint.position.set(...position);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.24, 24),
      new THREE.MeshStandardMaterial({ color: lightMetal, metalness: 0.28, roughness: 0.64 }),
    );
    core.rotation.z = Math.PI / 2;
    core.castShadow = true;
    joint.add(core);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.8, 0.014, 6, 32),
      new THREE.MeshStandardMaterial({ color: accent, metalness: 0.14, roughness: 0.72 }),
    );
    collar.rotation.y = Math.PI / 2;
    joint.add(collar);
    return joint;
  }

  makeFinger(side) {
    const finger = new THREE.Group();
    finger.position.x = side * 0.09;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.27, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xdad8d1, metalness: 0.12, roughness: 0.75 }),
    );
    body.position.y = 0.12;
    finger.add(body);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.074, 0.065, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x454641, metalness: 0.02, roughness: 0.9 }),
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
    this.wristRoll.rotation.y = state.wristRoll || 0;
    const open = 1 - state.gripper;
    this.fingerLeft.rotation.z = 0.35 * open;
    this.fingerRight.rotation.z = -0.35 * open;
    const end = this.getGripperPosition();
    this.objects.updateRobot(end, state.gripper > 0.55, delta);
    this.updateTrail(end);
  }

  setDisplayMode(mode) {
    if (this.displayMode === mode) return;
    if (this.displayMode !== mode) this.objects.release();
    this.displayMode = mode;
    const objectMode = mode === "object";
    this.root.visible = !objectMode;
    this.objects.group.visible = true;
    this.camera.position.set(...(objectMode ? [3.4, 5.8, 5.6] : [4.2, 3.2, 5.7]));
    this.camera.lookAt(0, objectMode ? 0.15 : 1.3, 0);
    this.camera.updateProjectionMatrix();
  }

  updateObjectHand(hand, now = performance.now(), hands = [hand], showSkeleton = true) {
    const delta = Math.max(0, Math.min(0.1, (now - this.lastUpdateTime) / 1000));
    this.lastUpdateTime = now;
    return this.objects.update(hand, delta, hands, showSkeleton);
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

import * as THREE from "three";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const angleDelta = (next, previous) => Math.atan2(Math.sin(next - previous), Math.cos(next - previous));

export class ObjectInteraction {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.objects = [];
    this.held = null;
    this.grabOffset = new THREE.Vector3();
    this.lastRotation = null;
    this.createObjects();
    this.createPointer();
  }

  createObjects() {
    const items = [
      ["CUBE", new THREE.BoxGeometry(0.32, 0.32, 0.32), 0xd96c35, [-1.35, 0.17, -0.75]],
      ["SPHERE", new THREE.SphereGeometry(0.2, 24, 16), 0x72806f, [-0.68, 0.21, -0.95]],
      ["CYLINDER", new THREE.CylinderGeometry(0.18, 0.18, 0.36, 24), 0xc1a255, [0.02, 0.19, -0.82]],
      ["RING", new THREE.TorusGeometry(0.19, 0.05, 12, 32), 0x777975, [0.72, 0.22, -0.7]],
      ["BOX", new THREE.BoxGeometry(0.36, 0.23, 0.28), 0x71818a, [1.38, 0.13, -0.92]],
    ];

    items.forEach(([name, geometry, color, position]) => {
      const material = new THREE.MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.72 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { name, home: mesh.position.clone(), homeRotation: mesh.rotation.clone() };
      this.group.add(mesh);
      this.objects.push(mesh);
    });
  }

  createPointer() {
    const material = new THREE.MeshBasicMaterial({ color: 0xd96c35, transparent: true, opacity: 0.9, depthWrite: false });
    this.pointer = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 32), material);
    ring.rotation.x = Math.PI / 2;
    this.pointer.add(ring);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), material);
    center.position.y = 0.02;
    this.pointer.add(center);
    this.pointer.visible = false;
    this.scene.add(this.pointer);
  }

  worldPoint(pose) {
    const depth = clamp((pose.depth - 0.10) / 0.20, 0, 1);
    return new THREE.Vector3(
      clamp((pose.x - 0.5) * 3.8, -1.9, 1.9),
      0.17 + depth * 0.72,
      clamp((0.55 - pose.y) * 3.4, -1.55, 1.55),
    );
  }

  update(hand, delta = 1 / 60) {
    if (!hand?.pose) {
      this.pointer.visible = false;
      this.release();
      return { held: null, pinching: false };
    }

    const point = this.worldPoint(hand.pose);
    this.pointer.position.set(point.x, 0.025, point.z);
    this.pointer.visible = true;

    if (hand.pinch?.active && !this.held) {
      const candidate = this.objects
        .map((object) => ({ object, distance: Math.hypot(object.position.x - point.x, object.position.z - point.z) }))
        .filter(({ distance }) => distance < 0.62)
        .sort((a, b) => a.distance - b.distance)[0];
      if (candidate) {
        this.held = candidate.object;
        this.held.userData.held = true;
        this.grabOffset.copy(this.held.position).sub(point);
        this.lastRotation = { roll: hand.pose.roll, pitch: hand.pose.pitch };
      }
    }

    if (this.held && hand.pinch?.active) {
      const target = point.clone().add(this.grabOffset);
      const follow = 1 - Math.exp(-Math.max(0, delta) * 18);
      this.held.position.lerp(target, follow);
      if (this.lastRotation) {
        this.held.rotation.y += angleDelta(hand.pose.roll, this.lastRotation.roll) * 1.25;
        this.held.rotation.x += angleDelta(hand.pose.pitch, this.lastRotation.pitch) * 1.1;
      }
      this.lastRotation = { roll: hand.pose.roll, pitch: hand.pose.pitch };
    } else if (this.held) {
      this.release();
    }

    return { held: this.held?.userData.name || null, pinching: Boolean(hand.pinch?.active) };
  }

  updateRobot(gripperPosition, closed, delta = 1 / 60) {
    const gripper = new THREE.Vector3(...gripperPosition);
    if (closed && !this.held) {
      const candidate = this.objects
        .map((object) => ({ object, distance: object.position.distanceTo(gripper) }))
        .filter(({ distance }) => distance < 0.5)
        .sort((a, b) => a.distance - b.distance)[0];
      if (candidate) {
        this.held = candidate.object;
        this.held.userData.held = true;
        this.grabOffset.copy(this.held.position).sub(gripper);
      }
    }
    if (this.held && closed) {
      const follow = 1 - Math.exp(-Math.max(0, delta) * 18);
      this.held.position.lerp(gripper.clone().add(this.grabOffset), follow);
    } else if (this.held) {
      this.release();
    }
    return this.held?.userData.name || null;
  }

  release() {
    if (this.held) this.held.userData.held = false;
    this.held = null;
    this.lastRotation = null;
  }

  reset() {
    this.release();
    this.objects.forEach((object) => {
      object.position.copy(object.userData.home);
      object.rotation.copy(object.userData.homeRotation);
    });
  }
}

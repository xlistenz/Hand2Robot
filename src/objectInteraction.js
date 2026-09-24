import * as THREE from "three";
import { ARM_GEOMETRY } from "./robotKinematics.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const angleDelta = (next, previous) => Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
const TABLE_TOP = ARM_GEOMETRY.tableTop;
const TABLE_RADIUS = 1.58;
const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

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
    this.createHandVisuals();
  }

  createObjects() {
    const items = [
      ["CUBE", new THREE.BoxGeometry(0.32, 0.32, 0.32), 0xd96c35, -1.35, -0.75],
      ["SPHERE", new THREE.SphereGeometry(0.2, 24, 16), 0x72806f, -0.68, -0.95],
      ["CYLINDER", new THREE.CylinderGeometry(0.18, 0.18, 0.36, 24), 0xc1a255, 0.02, -0.82],
      ["RING", new THREE.TorusGeometry(0.19, 0.05, 12, 32), 0x777975, 0.72, -0.7],
      ["BOX", new THREE.BoxGeometry(0.36, 0.23, 0.28), 0x71818a, 1.38, -0.92],
    ];

    items.forEach(([name, geometry, color, x, z]) => {
      const material = new THREE.MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.72 });
      const mesh = new THREE.Mesh(geometry, material);
      if (name === "RING") mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      mesh.userData = {
        name,
        collisionRadius: geometry.boundingSphere.radius,
        held: false,
      };
      this.group.add(mesh);
      this.objects.push(mesh);
      this.constrainObject(mesh, false);
      mesh.userData.home = mesh.position.clone();
      mesh.userData.homeRotation = mesh.rotation.clone();
    });
  }

  createPointer() {
    const material = new THREE.MeshBasicMaterial({ color: 0xd96c35, transparent: true, opacity: 0.9, depthWrite: false });
    this.pointer = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 8, 32), material);
    ring.rotation.x = Math.PI / 2;
    this.pointer.add(ring);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), material);
    this.pointer.add(center);
    this.pointer.visible = false;
    this.scene.add(this.pointer);
  }

  createHandVisuals() {
    this.handVisuals = new Map();
    [["Right", 0xd96c35], ["Left", 0x72806f]].forEach(([handedness, color]) => {
      const group = new THREE.Group();
      const boneData = new Float32Array(HAND_CONNECTIONS.length * 6);
      const boneGeometry = new THREE.BufferGeometry();
      boneGeometry.setAttribute("position", new THREE.BufferAttribute(boneData, 3).setUsage(THREE.DynamicDrawUsage));
      const bones = new THREE.LineSegments(boneGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.98, depthTest: false, depthWrite: false }));
      bones.renderOrder = 30;
      const jointData = new Float32Array(21 * 3);
      const jointGeometry = new THREE.BufferGeometry();
      jointGeometry.setAttribute("position", new THREE.BufferAttribute(jointData, 3).setUsage(THREE.DynamicDrawUsage));
      const joints = new THREE.Points(jointGeometry, new THREE.PointsMaterial({ color, size: 0.075, sizeAttenuation: true, depthTest: false, depthWrite: false }));
      joints.renderOrder = 31;
      group.add(bones, joints);
      group.visible = false;
      this.scene.add(group);
      this.handVisuals.set(handedness, { group, bones, joints, boneData, jointData });
    });
  }

  workspacePoint(x, y, depth, relativeZ = 0, centerZ = 0) {
    const span = clamp((depth - 0.1) / 0.22, 0, 1);
    return new THREE.Vector3(
      clamp((x - 0.5) * 3.0, -1.55, 1.55),
      TABLE_TOP + 0.035 + span * 0.78 + (centerZ - relativeZ) * 2.4,
      clamp((0.55 - y) * 2.6, -1.48, 1.48),
    );
  }

  worldPoint(hand) {
    const pose = hand.pose;
    const imagePoint = hand.pinch?.active ? hand.pinchTip : hand.indexTip;
    const point = imagePoint || pose;
    return this.workspacePoint(point.x, point.y, pose.depth, point.z ?? pose.z ?? 0, pose.z ?? 0);
  }

  updateHandVisuals(hands, visible) {
    const shown = new Set();
    if (visible) {
      (hands || []).forEach((hand) => {
        if (!hand?.pose || hand.landmarks?.length !== 21) return;
        const visual = this.handVisuals.get(hand.handedness);
        if (!visual) return;
        shown.add(hand.handedness);
        const centerZ = hand.pose.z || 0;
        hand.landmarks.forEach((landmark, index) => {
          const point = this.workspacePoint(1 - landmark.x, landmark.y, hand.pose.depth, landmark.z, centerZ);
          visual.jointData[index * 3] = point.x;
          visual.jointData[index * 3 + 1] = point.y;
          visual.jointData[index * 3 + 2] = point.z;
        });
        HAND_CONNECTIONS.forEach(([from, to], index) => {
          for (const [offset, pointIndex] of [[0, from], [3, to]]) {
            const source = pointIndex * 3;
            const target = index * 6 + offset;
            visual.boneData[target] = visual.jointData[source];
            visual.boneData[target + 1] = visual.jointData[source + 1];
            visual.boneData[target + 2] = visual.jointData[source + 2];
          }
        });
        visual.bones.geometry.attributes.position.needsUpdate = true;
        visual.joints.geometry.attributes.position.needsUpdate = true;
        visual.bones.geometry.computeBoundingSphere();
        visual.joints.geometry.computeBoundingSphere();
        visual.group.visible = true;
      });
    }
    this.handVisuals.forEach((visual, handedness) => { if (!shown.has(handedness)) visual.group.visible = false; });
  }

  getHalfHeight(object) {
    const box = object.geometry.boundingBox;
    let extent = 0;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          extent = Math.max(extent, Math.abs(new THREE.Vector3(x, y, z).applyQuaternion(object.quaternion).y));
        }
      }
    }
    return extent;
  }

  constrainObject(object, resolveCollisions = true) {
    const radius = object.userData.collisionRadius;
    const centerLimit = Math.max(0.1, TABLE_RADIUS - radius - 0.025);
    const halfHeight = this.getHalfHeight(object);
    object.position.y = Math.max(object.position.y, TABLE_TOP + halfHeight + 0.006);
    object.position.y = Math.min(object.position.y, 2.45);
    const clampToTable = () => {
      const distance = Math.hypot(object.position.x, object.position.z);
      if (distance > centerLimit) {
        const scale = centerLimit / distance;
        object.position.x *= scale;
        object.position.z *= scale;
      }
    };
    clampToTable();

    if (resolveCollisions) {
      for (let pass = 0; pass < 3; pass += 1) {
        this.objects.forEach((other) => {
          if (other === object) return;
          const otherHalfHeight = this.getHalfHeight(other);
          if (Math.abs(object.position.y - other.position.y) >= halfHeight + otherHalfHeight - 0.012) return;
          const dx = object.position.x - other.position.x;
          const dz = object.position.z - other.position.z;
          const distance = Math.hypot(dx, dz);
          const minDistance = radius + other.userData.collisionRadius + 0.012;
          if (distance >= minDistance) return;
          const directionX = distance > 1e-5 ? dx / distance : (object.id % 2 ? 1 : -1);
          const directionZ = distance > 1e-5 ? dz / distance : 0;
          object.position.x = other.position.x + directionX * minDistance;
          object.position.z = other.position.z + directionZ * minDistance;
          clampToTable();
        });
      }
    }
    object.updateMatrixWorld(true);
  }

  update(hand, delta = 1 / 60, hands = [hand], showSkeleton = true) {
    this.updateHandVisuals(hands, showSkeleton);
    if (!hand?.pose) {
      this.pointer.visible = false;
      this.release();
      return { held: null, pinching: false };
    }

    const point = this.worldPoint(hand);
    this.pointer.position.copy(point);
    this.pointer.visible = true;

    if (hand.pinch?.active && !this.held) {
      const candidate = this.objects
        .map((object) => ({ object, distance: object.position.distanceTo(point) }))
        .filter(({ object, distance }) => distance < object.userData.collisionRadius + 0.19)
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
      this.constrainObject(this.held);
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
        .filter(({ object, distance }) => distance < object.userData.collisionRadius + 0.13)
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
      this.constrainObject(this.held);
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
      this.constrainObject(object, false);
    });
  }
}

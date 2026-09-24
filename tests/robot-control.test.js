import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ARM_GEOMETRY, forwardArmPosition, solveArmTarget } from "../src/robotKinematics.js";
import { RobotController } from "../src/robotControl.js";

test("inverse kinematics reaches points across the tabletop workspace", () => {
  const targets = [
    [1.30, 0.39], [1.0, 0.4], [1.5, 0.4], [1.0, 0.8],
    [2.0, 0.6], [0.7, 0.4], [0.82, 0.39], [2.2, 0.38],
  ];
  targets.forEach(([radius, height]) => {
    const solved = solveArmTarget({ radius, height, base: 0.42, wrist: 0.2 });
    assert.ok(Number.isFinite(solved.shoulder) && Number.isFinite(solved.elbow));
    assert.ok(solved.error < 0.09, `endpoint error ${solved.error.toFixed(3)} at (${radius}, ${height})`);
    assert.ok(solved.shoulder >= ARM_GEOMETRY.shoulderMin && solved.shoulder <= ARM_GEOMETRY.shoulderMax);
  });
});

test("analytic forward kinematics matches the actual Three.js arm pivots", () => {
  const states = [
    { base: 0, shoulder: 0.086, elbow: -1.28, wrist: 0 },
    { base: 2.3, shoulder: 0.62, elbow: -1.1, wrist: 0.35 },
    { base: -2.7, shoulder: 1.15, elbow: 0.15, wrist: -0.55 },
  ];
  states.forEach((state) => {
    const root = new THREE.Group();
    root.position.y = ARM_GEOMETRY.rootHeight;
    const base = new THREE.Group();
    base.position.y = ARM_GEOMETRY.baseHeight;
    base.rotation.y = state.base;
    root.add(base);
    const shoulder = new THREE.Group();
    shoulder.position.y = ARM_GEOMETRY.shoulderOffset;
    shoulder.rotation.z = -state.shoulder;
    base.add(shoulder);
    const elbow = new THREE.Group();
    elbow.position.y = 1.12;
    elbow.rotation.z = state.elbow - 0.8;
    shoulder.add(elbow);
    const wrist = new THREE.Group();
    wrist.position.y = 0.96;
    wrist.rotation.z = state.wrist;
    elbow.add(wrist);
    const wristRoll = new THREE.Group();
    wristRoll.position.y = 0.3;
    wrist.add(wristRoll);
    const gripper = new THREE.Group();
    gripper.position.y = 0.2;
    wristRoll.add(gripper);
    root.updateMatrixWorld(true);
    const actual = new THREE.Vector3();
    gripper.getWorldPosition(actual);
    const predicted = forwardArmPosition(state);
    assert.ok(Math.hypot(actual.x - predicted.x, actual.y - predicted.y, actual.z - predicted.z) < 1e-6);
  });
});

test("controller preserves its starting pose and moves the gripper in hand-relative XYZ", () => {
  const controller = new RobotController();
  controller.setParameters({ sensitivity: 1, smoothness: 0, deadZone: 0.02 });
  const firstTime = controller.lastSmoothTime + 20;
  const hand = (pose, pinch = false) => ({ handedness: "Right", pose, pinch: { active: pinch } });
  controller.updateFromHands([hand({ x: 0.5, y: 0.5, depth: 0.16, roll: 0, pitch: 0 })], firstTime);
  const origin = forwardArmPosition(controller.getState().target);
  assert.ok(Math.hypot(origin.x - 1.305, origin.y - 0.857, origin.z) < 0.04, "first frame must not snap away from home");

  controller.updateFromHands([hand({ x: 0.68, y: 0.62, depth: 0.22, roll: 0, pitch: 0 }, true)], firstTime + 20);
  const moved = forwardArmPosition(controller.getState().target);
  assert.ok(moved.z < origin.z - 0.3, "horizontal hand motion should rotate the base toward the target");
  assert.ok(moved.radius > origin.radius + 0.2, "apparent hand depth should control reach");
  assert.ok(moved.y < origin.y - 0.1, "vertical hand motion should lower the gripper");
  assert.equal(controller.getState().target.gripper, 1);
});

test("hand movement spans calibrated base and vertical limits from off-center starting poses", () => {
  const controller = new RobotController();
  controller.setParameters({ sensitivity: 1, smoothness: 0, deadZone: 0 });
  const firstTime = controller.lastSmoothTime + 20;
  const hand = (x, y) => ({
    handedness: "Right",
    pose: { x, y, depth: 0.16, roll: 0, pitch: 0 },
    pinch: { active: false },
  });
  controller.updateFromHands([hand(0.8, 0.7)], firstTime);
  controller.updateFromHands([hand(0, 1)], firstTime + 20);
  assert.ok(Math.abs(controller.getState().target.base + Math.PI) < 1e-6);
  assert.ok(Math.abs(forwardArmPosition(controller.getState().target).y - (ARM_GEOMETRY.tableTop + 0.2)) < 0.03);
  controller.resetCalibration();
  controller.updateFromHands([hand(0.2, 0.5)], firstTime + 40);
  controller.updateFromHands([hand(1, 0)], firstTime + 60);
  assert.ok(Math.abs(controller.getState().target.base - Math.PI) < 1e-6);
  assert.ok(Math.abs(forwardArmPosition(controller.getState().target).y - 1.55) < 0.03);
});

test("left-hand pinching closes the gripper while the right hand steers", () => {
  const controller = new RobotController();
  const now = controller.lastSmoothTime + 20;
  const pose = { x: 0.5, y: 0.5, depth: 0.16, roll: 0, pitch: 0 };
  controller.updateFromHands([
    { handedness: "Right", pose, pinch: { active: false } },
    { handedness: "Left", pose, pinch: { active: true } },
  ], now);
  assert.equal(controller.getState().target.gripper, 1);
  controller.updateFromHands([], now + 20);
  assert.equal(controller.getState().target.gripper, 0);
});

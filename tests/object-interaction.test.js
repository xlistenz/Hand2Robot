import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ObjectInteraction } from "../src/objectInteraction.js";
import { ARM_GEOMETRY, forwardArmPosition } from "../src/robotKinematics.js";
import { RobotController } from "../src/robotControl.js";

const tableTop = 0.18;

function makeHandAt(interaction, position, { pinching = true, handedness = "Right", roll = 0, pitch = 0 } = {}) {
  const depth = 0.1 + ((position.y - tableTop - 0.035) / 0.78) * 0.22;
  const x = 0.5 + position.x / 3;
  const y = 0.55 - position.z / 2.6;
  const point = { x, y, z: 0 };
  return {
    handedness,
    pose: { x, y, z: 0, depth: Math.max(0.1, depth), roll, pitch },
    pinch: { active: pinching },
    pinchTip: point,
    indexTip: point,
    landmarks: Array.from({ length: 21 }, (_, index) => ({ x: 0.45 + index * 0.002, y: 0.5, z: 0 })),
  };
}

function assertOnTableAndInBounds(interaction, object) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  assert.ok(bounds.min.y >= tableTop - 1e-5, `${object.userData.name} passed through the table`);
  assert.ok(Math.hypot(object.position.x, object.position.z) + object.userData.collisionRadius <= 1.59, `${object.userData.name} escaped the work surface`);
}

test("objects start above the table and inside its edge", () => {
  const interaction = new ObjectInteraction(new THREE.Scene());
  interaction.objects.forEach((object) => assertOnTableAndInBounds(interaction, object));
});

test("pinch target follows fingertips, draws both 3D skeletons, and cannot cross the table or edge", () => {
  const interaction = new ObjectInteraction(new THREE.Scene());
  const sphere = interaction.objects.find((object) => object.userData.name === "SPHERE");
  const cube = interaction.objects.find((object) => object.userData.name === "CUBE");
  const hand = makeHandAt(interaction, sphere.position);
  const otherHand = makeHandAt(interaction, cube.position, { handedness: "Left", pinching: false });
  const result = interaction.update(hand, 0.1, [hand, otherHand], true);
  assert.equal(result.held, "SPHERE");
  assert.equal(interaction.handVisuals.get("Right").group.visible, true);
  assert.equal(interaction.handVisuals.get("Left").group.visible, true);

  const edgeHand = makeHandAt(interaction, new THREE.Vector3(2.5, tableTop, 0));
  for (let frame = 0; frame < 8; frame += 1) interaction.update(edgeHand, 0.1, [edgeHand], true);
  assertOnTableAndInBounds(interaction, sphere);

  interaction.reset();
  const centeredSphere = interaction.objects.find((object) => object.userData.name === "SPHERE");
  const centeredCube = interaction.objects.find((object) => object.userData.name === "CUBE");
  const grab = makeHandAt(interaction, centeredSphere.position);
  interaction.update(grab, 0.1, [grab], true);
  const collide = makeHandAt(interaction, centeredCube.position);
  for (let frame = 0; frame < 10; frame += 1) interaction.update(collide, 0.1, [collide], true);
  assertOnTableAndInBounds(interaction, centeredSphere);
  assert.ok(Math.hypot(centeredSphere.position.x - centeredCube.position.x, centeredSphere.position.z - centeredCube.position.z)
    >= centeredSphere.userData.collisionRadius + centeredCube.userData.collisionRadius - 0.01, "objects should not interpenetrate");
});

test("robot gripper only holds nearby objects and a held object stays above the tabletop", () => {
  const interaction = new ObjectInteraction(new THREE.Scene());
  const object = interaction.objects.find((item) => item.userData.name === "SPHERE");
  assert.equal(interaction.updateRobot([0, 0.8, 1.5], true, 0.1), null);
  assert.equal(interaction.updateRobot(object.position.toArray(), true, 0.1), "SPHERE");
  for (let frame = 0; frame < 8; frame += 1) interaction.updateRobot([object.position.x, 0, object.position.z], true, 0.1);
  assertOnTableAndInBounds(interaction, object);
  interaction.updateRobot(object.position.toArray(), false, 0.1);
  assert.equal(object.userData.held, false);
});

test("hand-controlled inverse kinematics can reach and grasp every tabletop object", () => {
  const itemNames = ["CUBE", "SPHERE", "CYLINDER", "RING", "BOX"];
  itemNames.forEach((name) => {
    const interaction = new ObjectInteraction(new THREE.Scene());
    const target = interaction.objects.find((object) => object.userData.name === name);
    const controller = new RobotController();
    controller.setParameters({ sensitivity: 1, smoothness: 0, deadZone: 0 });
    let now = controller.lastSmoothTime + 20;
    const neutral = { x: 0.5, y: 0.5, depth: 0.16, roll: 0, pitch: 0 };
    const hands = (pose) => [
      { handedness: "Right", pose, pinch: { active: false } },
      { handedness: "Left", pose: neutral, pinch: { active: false } },
    ];
    controller.updateFromHands(hands(neutral), now);
    const start = forwardArmPosition(controller.getState());
    const radius = Math.hypot(target.position.x, target.position.z);
    const base = Math.atan2(-target.position.z, target.position.x);
    const minHeight = ARM_GEOMETRY.tableTop + 0.2;
    const targetHeight = Math.max(target.position.y, minHeight);
    const downTravel = (start.y - minHeight) / (1 - neutral.y);
    const targetHandPose = {
      x: 0.5 + base / (2 * Math.PI),
      y: Math.min(1, neutral.y + (start.y - targetHeight) / downTravel),
      depth: neutral.depth + (radius - start.radius) / 7.8,
      roll: 0,
      pitch: 0,
    };
    for (let frame = 0; frame < 90; frame += 1) {
      now += 33;
      controller.updateFromHands(hands(targetHandPose), now);
    }
    const gripper = forwardArmPosition(controller.getState());
    assert.ok(Math.hypot(gripper.x - target.position.x, gripper.y - target.position.y, gripper.z - target.position.z) < target.userData.collisionRadius + 0.13,
      `${name}: the hand-mapped gripper should reach the object's grasp volume`);
    assert.equal(interaction.updateRobot([gripper.x, gripper.y, gripper.z], true, 1 / 60), name);
  });
});

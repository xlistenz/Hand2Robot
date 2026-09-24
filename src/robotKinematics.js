// Dimensions follow the articulated pivots in robotArm.js.
export const ARM_GEOMETRY = Object.freeze({
  rootHeight: 0.13,
  baseHeight: 0.19,
  shoulderOffset: 0.24,
  upperLink: 1.12,
  forearmLink: 0.96,
  toolLink: 0.5,
  shoulderMin: -0.25,
  shoulderMax: 1.48,
  elbowFlexMin: 0,
  elbowFlexMax: 2.86,
  tableTop: 0.18,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const { rootHeight, baseHeight, shoulderOffset, upperLink, forearmLink, toolLink } = ARM_GEOMETRY;
const shoulderWorldHeight = rootHeight + baseHeight + shoulderOffset;

export function forwardArmPosition(state) {
  const shoulder = state.shoulder;
  const elbowFlex = 0.8 - state.elbow;
  const forearmAngle = shoulder + elbowFlex;
  const toolAngle = forearmAngle - (state.wrist || 0);
  const radius = upperLink * Math.sin(shoulder)
    + forearmLink * Math.sin(forearmAngle)
    + toolLink * Math.sin(toolAngle);
  const height = shoulderWorldHeight
    + upperLink * Math.cos(shoulder)
    + forearmLink * Math.cos(forearmAngle)
    + toolLink * Math.cos(toolAngle);
  return {
    x: radius * Math.cos(state.base || 0),
    y: height,
    z: -radius * Math.sin(state.base || 0),
    radius,
    base: state.base || 0,
  };
}

/** Solve the arm's shoulder and elbow for a gripper target in the base plane. */
export function solveArmTarget({ radius, height, wrist = 0, base = 0 }) {
  const { shoulderMin, shoulderMax, elbowFlexMin, elbowFlexMax } = ARM_GEOMETRY;
  const targetHeight = height - shoulderWorldHeight;
  const evaluate = (shoulder, flex) => {
    const forearmAngle = shoulder + flex;
    const toolAngle = forearmAngle - wrist;
    const actualRadius = upperLink * Math.sin(shoulder)
      + forearmLink * Math.sin(forearmAngle)
      + toolLink * Math.sin(toolAngle);
    const actualHeight = upperLink * Math.cos(shoulder)
      + forearmLink * Math.cos(forearmAngle)
      + toolLink * Math.cos(toolAngle);
    const errorRadius = radius - actualRadius;
    const errorHeight = targetHeight - actualHeight;
    return { radius: actualRadius, height: actualHeight, error: errorRadius ** 2 + errorHeight ** 2 };
  };

  // Search the legal joint range first. This also projects targets outside the
  // mechanical workspace onto the closest reachable endpoint.
  let shoulder = shoulderMin;
  let flex = elbowFlexMin;
  let best = evaluate(shoulder, flex);
  const shoulderSteps = 54;
  const flexSteps = 84;
  for (let shoulderIndex = 0; shoulderIndex <= shoulderSteps; shoulderIndex += 1) {
    const candidateShoulder = shoulderMin + (shoulderMax - shoulderMin) * shoulderIndex / shoulderSteps;
    for (let flexIndex = 0; flexIndex <= flexSteps; flexIndex += 1) {
      const candidateFlex = elbowFlexMin + (elbowFlexMax - elbowFlexMin) * flexIndex / flexSteps;
      const candidate = evaluate(candidateShoulder, candidateFlex);
      if (candidate.error < best.error) {
        shoulder = candidateShoulder;
        flex = candidateFlex;
        best = candidate;
      }
    }
  }

  // Refine the coarse grid solution with a damped least-squares Jacobian.
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const forearmAngle = shoulder + flex;
    const toolAngle = forearmAngle - wrist;
    const jacobian = [
      upperLink * Math.cos(shoulder) + forearmLink * Math.cos(forearmAngle) + toolLink * Math.cos(toolAngle),
      -upperLink * Math.sin(shoulder) - forearmLink * Math.sin(forearmAngle) - toolLink * Math.sin(toolAngle),
      forearmLink * Math.cos(forearmAngle) + toolLink * Math.cos(toolAngle),
      -forearmLink * Math.sin(forearmAngle) - toolLink * Math.sin(toolAngle),
    ];
    const errorRadius = radius - best.radius;
    const errorHeight = targetHeight - best.height;
    const damping = 0.0008;
    const a = jacobian[0] ** 2 + jacobian[1] ** 2 + damping;
    const b = jacobian[0] * jacobian[2] + jacobian[1] * jacobian[3];
    const c = jacobian[2] ** 2 + jacobian[3] ** 2 + damping;
    const rhsShoulder = jacobian[0] * errorRadius + jacobian[1] * errorHeight;
    const rhsFlex = jacobian[2] * errorRadius + jacobian[3] * errorHeight;
    const determinant = a * c - b * b;
    if (Math.abs(determinant) < 1e-10) break;
    const deltaShoulder = (c * rhsShoulder - b * rhsFlex) / determinant;
    const deltaFlex = (a * rhsFlex - b * rhsShoulder) / determinant;
    let improved = false;
    for (const step of [1, 0.5, 0.25, 0.125]) {
      const nextShoulder = clamp(shoulder + deltaShoulder * step, shoulderMin, shoulderMax);
      const nextFlex = clamp(flex + deltaFlex * step, elbowFlexMin, elbowFlexMax);
      const next = evaluate(nextShoulder, nextFlex);
      if (next.error < best.error) {
        shoulder = nextShoulder;
        flex = nextFlex;
        best = next;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }

  const state = { base, shoulder, elbow: 0.8 - flex, wrist };
  const actual = forwardArmPosition(state);
  const desired = { x: radius * Math.cos(base), y: height, z: -radius * Math.sin(base) };
  const error = Math.hypot(actual.x - desired.x, actual.y - desired.y, actual.z - desired.z);
  return { ...state, actual, error };
}

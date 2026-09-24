export const GESTURE_LABELS = {
  Open_Palm: "OPEN PALM",
  Closed_Fist: "FIST",
  Pointing_Up: "POINTING UP",
  Thumb_Up: "THUMBS UP",
  Victory: "VICTORY",
  ILoveYou: "I LOVE YOU",
};

export const FINGER_TIPS = [4, 8, 12, 16, 20];
export const FINGER_PIPS = [3, 6, 10, 14, 18];

export class GestureStabilizer {
  constructor({ threshold = 0.65, samples = 4 } = {}) {
    this.threshold = threshold;
    this.samples = samples;
    this.history = [];
    this.current = "NONE";
  }

  update(gesture) {
    const next = gesture.confidence >= this.threshold ? gesture.name : "NONE";
    this.history.push(next);
    this.history.splice(0, Math.max(0, this.history.length - this.samples));
    const counts = this.history.reduce((result, name) => ({ ...result, [name]: (result[name] || 0) + 1 }), {});
    const [candidate, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ["NONE", 0];
    if (count >= Math.ceil(this.samples / 2)) this.current = candidate;
    return { ...gesture, name: this.current };
  }
}

export function getGesture(result, handIndex = 0) {
  const category = result?.gestures?.[handIndex]?.[0];
  const rawName = category?.categoryName || "None";
  return {
    rawName,
    name: GESTURE_LABELS[rawName] || "NONE",
    confidence: category?.score || 0,
  };
}

export function getHandedness(result, handIndex = 0) {
  return result?.handednesses?.[handIndex]?.[0]?.displayName || result?.handednesses?.[handIndex]?.[0]?.categoryName || "--";
}

export function getPinch(landmarks, previous = false) {
  if (!landmarks?.[4] || !landmarks?.[8] || !landmarks?.[5] || !landmarks?.[17]) return { active: false, distance: 1, ratio: 1 };
  const thumb = landmarks[4];
  const index = landmarks[8];
  const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  const palmWidth = Math.max(0.04, Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y));
  const ratio = distance / palmWidth;
  const threshold = previous ? 0.34 : 0.27;
  return { active: ratio < threshold, distance, ratio };
}

export function getPalmPose(landmarks) {
  if (!landmarks?.[0] || !landmarks?.[5] || !landmarks?.[9] || !landmarks?.[13] || !landmarks?.[17]) return null;
  const palm = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const center = palm.reduce((sum, point) => ({ x: sum.x + point.x / palm.length, y: sum.y + point.y / palm.length, z: sum.z + point.z / palm.length }), { x: 0, y: 0, z: 0 });
  const span = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
  const index = landmarks[5];
  const pinky = landmarks[17];
  const wrist = landmarks[0];
  const middle = landmarks[9];
  const roll = Math.atan2(pinky.y - index.y, pinky.x - index.x);
  const pitch = Math.atan2(middle.z - wrist.z, Math.hypot(middle.x - wrist.x, middle.y - wrist.y));
  return { x: 1 - center.x, y: center.y, z: center.z, depth: span, roll, pitch };
}

export function getControlPoint(landmarks) {
  const point = landmarks?.[8];
  return point ? { x: 1 - point.x, y: point.y } : null;
}

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

export function getPinch(landmarks) {
  if (!landmarks?.[4] || !landmarks?.[8]) return { active: false, distance: 1 };
  const thumb = landmarks[4];
  const index = landmarks[8];
  const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y, (thumb.z - index.z) * 0.5);
  return { active: distance < 0.075, distance };
}

export function getControlPoint(landmarks) {
  const point = landmarks?.[8];
  return point ? { x: 1 - point.x, y: point.y } : null;
}

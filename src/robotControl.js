const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;

export class RobotController {
  constructor() {
    this.mode = "free";
    this.sensitivity = 0.85;
    this.smoothness = 0.7;
    this.deadZone = 0.05;
    this.stopped = false;
    this.demo = null;
    this.lastSmoothTime = performance.now();
    this.home = { base: 0, shoulder: 0.42, elbow: 0.78, wrist: 0, wristRoll: 0, gripper: 0 };
    this.target = { ...this.home };
    this.current = { ...this.target };
    this.neutralWrist = null;
  }

  setMode(mode) {
    if (mode === "demo") { this.runDemo(); return; }
    this.mode = mode;
    this.demo = null;
  }
  resetCalibration() { this.neutralWrist = null; }
  setParameters({ sensitivity, smoothness, deadZone }) { this.sensitivity = sensitivity; this.smoothness = smoothness; this.deadZone = deadZone; }
  emergencyStop() {
    this.stopped = true;
    this.demo = null;
    this.target = { ...this.current, handPosition: this.target.handPosition };
    if (this.mode === "demo") this.mode = "free";
  }
  resume() { this.stopped = false; if (this.mode === "demo") this.mode = "free"; }
  homePosition() { this.target = { ...this.home }; this.demo = null; if (this.mode === "demo") this.mode = "free"; }
  runDemo(now = performance.now()) { this.stopped = false; this.mode = "demo"; this.demo = { started: now, duration: 11500 }; }

  updateFromHands(hands, now = performance.now()) {
    if (this.stopped || this.mode === "demo") return;
    if (!hands?.length) {
      this.target.gripper = 0;
      this.smooth(now);
      return;
    }
    const right = hands.find((hand) => hand.handedness === "Right");
    const left = hands.find((hand) => hand.handedness === "Left");
    const controlHand = right || hands[0];
    const pose = controlHand.pose;
    if (!pose) return;

    if (!this.neutralWrist) this.neutralWrist = { roll: pose.roll, pitch: pose.pitch };
    const gain = this.sensitivity * (this.mode === "precise" ? 0.58 : 1);
    const normalizedX = Math.abs(pose.x - 0.5) < this.deadZone ? 0.5 : pose.x;
    const shoulderInput = clamp((pose.y - 0.16) / 0.68, 0, 1);
    const depthInput = clamp((pose.depth - 0.10) / 0.20, 0, 1);
    const shoulder = 0.08 + shoulderInput * 1.35;
    const elbow = 1.16 - depthInput * 0.86;
    const wristPitch = clamp((pose.pitch - this.neutralWrist.pitch) * 3.4, -0.95, 0.95);
    const wristRoll = clamp(this.wrapAngle(pose.roll - this.neutralWrist.roll) * 1.8, -1.25, 1.25);

    this.target.base = clamp((normalizedX - 0.5) * 2.5 * gain, -1.25, 1.25);
    this.target.shoulder = this.home.shoulder + (shoulder - this.home.shoulder) * gain;
    this.target.elbow = this.home.elbow + (elbow - this.home.elbow) * gain;
    this.target.wrist = wristPitch * gain;
    this.target.wristRoll = wristRoll * gain;
    const gripperHand = left || controlHand;
    this.target.gripper = gripperHand.pinch?.active ? 1 : 0;
    this.target.handPosition = { x: pose.x, y: pose.y, z: depthInput };
    this.smooth(now);
  }

  wrapAngle(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }

  smooth(now = performance.now()) {
    if (this.demo) this.updateDemo(now);
    const delta = Math.max(0, Math.min(0.1, (now - this.lastSmoothTime) / 1000));
    this.lastSmoothTime = now;
    const damping = this.mode === "precise" ? 0.1 + this.smoothness * 0.12 : 0.055 + this.smoothness * 0.095;
    const amount = 1 - Math.exp(-delta / Math.max(0.045, damping));
    Object.keys(this.current).forEach((key) => {
      if (key === "handPosition") return;
      this.current[key] = lerp(this.current[key], this.target[key], amount);
    });
  }

  updateDemo(now) {
    const elapsed = (now - this.demo.started) % this.demo.duration;
    const phase = elapsed / this.demo.duration;
    const wave = (start, end, from, to) => {
      const progress = clamp((phase - start) / (end - start), 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      return from + (to - from) * eased;
    };
    this.target.base = phase < 0.22 ? wave(0, 0.22, 0, 0.7) : phase < 0.68 ? 0.7 : wave(0.68, 0.9, 0.7, 0);
    this.target.shoulder = phase < 0.25 ? 0.3 : phase < 0.68 ? 0.95 : wave(0.68, 0.92, 0.95, 0.26);
    this.target.elbow = phase < 0.3 ? 0.9 : phase < 0.68 ? 0.35 : wave(0.68, 0.92, 0.35, 0.78);
    this.target.wrist = Math.sin(phase * Math.PI * 2) * 0.2;
    this.target.wristRoll = Math.sin(phase * Math.PI * 2) * 0.35;
    this.target.gripper = phase > 0.44 && phase < 0.63 ? 1 : 0;
  }

  getState() { return { ...this.current, target: { ...this.target }, stopped: this.stopped, mode: this.mode }; }
}

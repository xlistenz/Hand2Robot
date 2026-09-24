import "./style.css";
import { getGesture, getHandedness, getPalmPose, getPinch, GestureStabilizer } from "./gesture.js";
import { VirtualHand, drawCameraLandmarks } from "./virtualHand.js";
import { RobotController } from "./robotControl.js";
import { PerformanceMonitor } from "./performance.js";
import { createUI } from "./ui.js";

const ui = createUI();
const virtualHand = new VirtualHand(document.querySelector("#virtual-canvas"));
const robotController = new RobotController();
const performanceMonitor = new PerformanceMonitor();
const gestureStabilizers = new Map();
const pinchStates = new Map();
let tracker;
let cameraStartToken = 0;
let cameraStarting = false;
let robotArm;
let robotArmLoading;
let latestHands = [];
let latestObjectHand = null;
let lastUiUpdate = performance.now();
let lastRobotUiUpdate = 0;
let enteredRobot = false;
let renderFailed = false;

function loadRobotArm() {
  if (robotArm) return Promise.resolve(robotArm);
  if (!robotArmLoading) {
    robotArmLoading = import("./robotArm.js").then(({ RobotArm }) => {
      robotArm = new RobotArm(ui.refs.robotCanvas);
      robotArm.setPerformanceMode(performanceMonitor.performanceMode);
      return robotArm;
    }).catch((error) => {
      robotArmLoading = null;
      throw error;
    });
  }
  return robotArmLoading;
}

function handleResult({ result }) {
  latestHands = (result.landmarks || []).map((landmarks, index) => {
    const handedness = getHandedness(result, index);
    const rawGesture = getGesture(result, index);
    if (!gestureStabilizers.has(handedness)) gestureStabilizers.set(handedness, new GestureStabilizer({ threshold: 0.62, samples: 3 }));
    const gesture = gestureStabilizers.get(handedness).update(rawGesture);
    const pinch = getPinch(landmarks, pinchStates.get(handedness) || false);
    pinchStates.set(handedness, pinch.active);
    const pose = getPalmPose(landmarks);
    const pinchTip = landmarks[4] && landmarks[8]
      ? { x: 1 - (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2, z: (landmarks[4].z + landmarks[8].z) / 2 }
      : null;
    const indexTip = landmarks[8] ? { x: 1 - landmarks[8].x, y: landmarks[8].y, z: landmarks[8].z } : null;
    return { landmarks, handedness, gesture, pinch, pose, pinchTip, indexTip };
  });
  const rightHand = latestHands.find((hand) => hand.handedness === "Right");
  latestObjectHand = latestHands.find((hand) => hand.handedness === "Right" && hand.pinch.active)
    || latestHands.find((hand) => hand.pinch.active)
    || rightHand
    || latestHands[0]
    || null;
  const primaryHand = rightHand || latestHands[0];
  performanceMonitor.frame("ai");
  const now = performance.now();
  virtualHand.update(latestHands);
  robotController.updateFromHands(latestHands, now);
  if (ui.getOptions().showSkeleton) drawCameraLandmarks(ui.refs.cameraOverlay, latestHands, ui.getOptions().mirror); else drawCameraLandmarks(ui.refs.cameraOverlay, [], ui.getOptions().mirror);
  if (now - lastUiUpdate < 120) return;
  lastUiUpdate = now;
  ui.setTracking(latestHands.length > 0);
  ui.setMetrics({ hands: latestHands, gesture: primaryHand?.gesture.name || "NONE", confidence: primaryHand?.gesture.confidence || 0, handedness: latestHands.map((hand) => hand.handedness).join(" + ") || "--", aiFps: performanceMonitor.aiFps, renderFps: performanceMonitor.renderFps, pinch: latestHands.some((hand) => hand.pinch.active), landmarks: latestHands, frameWidth: ui.refs.video.videoWidth, frameHeight: ui.refs.video.videoHeight });
  latestHands.forEach((hand) => ui.addHistory(`${hand.handedness.slice(0, 1)} · ${hand.gesture.name}`));
}

function render(now) {
  performanceMonitor.frame("render");
  try {
    if ((ui.mode === "robot" || ui.mode === "object") && robotArm && !renderFailed) {
      robotArm.setDisplayMode(ui.mode);
      if (ui.mode === "robot") {
        robotController.smooth(now);
        const state = robotController.getState();
        robotArm.update(state, now);
        if (now - lastRobotUiUpdate >= 100) {
          const position = state.target.handPosition || { x: 0.5, y: 0.63, z: 0.41 };
          ui.updateRobot(state, position, { aiFps: performanceMonitor.aiFps, renderFps: performanceMonitor.renderFps }, latestHands.length > 0);
          lastRobotUiUpdate = now;
        }
      } else {
        const objectState = robotArm.updateObjectHand(latestObjectHand, now, latestHands, ui.getOptions().showSkeleton);
        ui.updateObjectState(objectState, Boolean(latestObjectHand));
      }
      robotArm.render();
    } else {
      virtualHand.draw(now);
    }
  } catch (error) {
    renderFailed = true;
    console.error("Workspace rendering stopped", error);
    ui.refs.robotAction.textContent = "3D WORKSPACE ERROR";
    ui.error(`The 3D workspace stopped: ${error.message || "unknown rendering error"}. Reload and reopen this mode.`);
  }
  requestAnimationFrame(render);
}

function resetCameraState() {
  latestHands = [];
  latestObjectHand = null;
  robotController.updateFromHands([], performance.now());
  pinchStates.clear();
  gestureStabilizers.clear();
  virtualHand.update([]);
  drawCameraLandmarks(ui.refs.cameraOverlay, []);
}

function stopCamera() {
  cameraStartToken += 1;
  cameraStarting = false;
  const currentTracker = tracker;
  tracker = null;
  currentTracker?.destroy();
  resetCameraState();
  ui.setStatus("offline");
}

function cameraError(error) {
  cameraStartToken += 1;
  cameraStarting = false;
  tracker?.destroy();
  tracker = null;
  resetCameraState();
  ui.setStatus("offline");
  const messages = {
    NotAllowedError: "Camera access was denied. Allow camera access for this site in your browser settings.",
    NotFoundError: "No camera was found. Check that a camera is connected and available.",
    NotReadableError: "The camera is in use by another application. Close it and try again.",
    BROWSER_UNSUPPORTED: "This browser does not support the Camera API. Try an up-to-date version of Chrome, Edge, or Safari.",
  };
  ui.error(messages[error.name] || messages[error.message] || "The camera or hand-tracking models could not start. Check your connection and try again.");
}

function handleMode(mode) {
  if (mode === "robot" && !enteredRobot) { enteredRobot = true; document.querySelector("#robot-training").showModal(); }
  if (mode === "robot" || mode === "object") {
    renderFailed = false;
    robotController.setMode("free");
    if (mode === "robot") robotController.resetCalibration();
    if (!robotArm) ui.refs.robotAction.textContent = "LOADING 3D WORKSPACE";
    loadRobotArm().catch((error) => {
      console.error("The 3D workspace could not be initialized", error);
      ui.refs.robotAction.textContent = "3D WORKSPACE UNAVAILABLE";
      ui.error("The 3D workspace could not be initialized. Check WebGL support and reload the page.");
    });
  }
  else {
    robotController.setMode("free");
    document.querySelectorAll(".robot-mode").forEach((button) => button.classList.toggle("active", button.dataset.robotMode === "free"));
  }
}

ui.bind({
  onMode: handleMode,
  onRobotMode: (mode) => { if (mode === "demo") robotController.runDemo(); else robotController.setMode(mode); document.querySelectorAll(".robot-mode").forEach((button) => button.classList.toggle("active", button.dataset.robotMode === robotController.mode)); },
  onHome: () => { robotController.homePosition(); robotArm?.resetObjects(); document.querySelectorAll(".robot-mode").forEach((button) => button.classList.toggle("active", button.dataset.robotMode === robotController.mode)); },
  onDemo: () => { robotController.runDemo(); document.querySelectorAll(".robot-mode").forEach((button) => button.classList.toggle("active", button.dataset.robotMode === "demo")); },
  onStop: () => { robotController.emergencyStop(); document.querySelectorAll(".robot-mode").forEach((button) => button.classList.toggle("active", button.dataset.robotMode === "free")); },
  onResume: () => robotController.resume(),
  onParameters: (parameters) => robotController.setParameters(parameters),
  onPerformance: (enabled) => { performanceMonitor.setMode(enabled); virtualHand.setPerformanceMode(enabled); robotArm?.setPerformanceMode(enabled); document.body.classList.toggle("performance-mode", enabled); },
});

ui.onStart(async () => {
  if (cameraStarting || tracker?.running) {
    stopCamera();
    return;
  }
  const startToken = ++cameraStartToken;
  cameraStarting = true;
  ui.setStatus("requesting");
  try {
    const { HandTracking } = await import("./handTracking.js");
    if (startToken !== cameraStartToken) return;
    const currentTracker = new HandTracking(ui.refs.video, { onResult: handleResult, onStatus: ui.setStatus });
    tracker = currentTracker;
    await currentTracker.start();
    if (startToken !== cameraStartToken) {
      currentTracker.destroy();
      return;
    }
    cameraStarting = false;
  } catch (error) {
    if (startToken !== cameraStartToken) return;
    cameraError(error);
  }
});

ui.refs.mirror.addEventListener("change", () => ui.refs.video.classList.toggle("mirrored", ui.getOptions().mirror));
ui.refs.video.classList.add("mirrored");
document.querySelector("#close-training").addEventListener("click", () => document.querySelector("#robot-training").close());
document.querySelector("#start-training").addEventListener("click", () => document.querySelector("#robot-training").close());
window.addEventListener("beforeunload", () => { tracker?.destroy(); robotArm?.destroy(); virtualHand.destroy(); });
requestAnimationFrame(render);

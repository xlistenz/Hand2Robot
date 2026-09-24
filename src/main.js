import "./style.css";
import { getControlPoint, getGesture, getHandedness, getPinch, GestureStabilizer } from "./gesture.js";
import { VirtualHand, drawCameraLandmarks } from "./virtualHand.js";
import { RobotController } from "./robotControl.js";
import { PerformanceMonitor } from "./performance.js";
import { createUI } from "./ui.js";

const ui = createUI();
const virtualHand = new VirtualHand(document.querySelector("#virtual-canvas"));
const robotController = new RobotController();
const performanceMonitor = new PerformanceMonitor();
const gestureStabilizer = new GestureStabilizer({ threshold: 0.65, samples: 4 });
let tracker;
let robotArm;
let robotArmLoading;
let latestLandmarks = null;
let latestPinch = { active: false };
let lastUiUpdate = performance.now();
let lastRobotUiUpdate = 0;
let enteredRobot = false;

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

function handleResult({ hands, gestures }) {
  const rightHandIndex = gestures.handednesses?.findIndex((hand) => (hand?.[0]?.displayName || hand?.[0]?.categoryName) === "Right");
  const handIndex = rightHandIndex >= 0 ? rightHandIndex : 0;
  latestLandmarks = hands.landmarks?.[handIndex] || null;
  const rawGesture = getGesture(gestures, handIndex);
  const gesture = gestureStabilizer.update(rawGesture);
  latestPinch = getPinch(latestLandmarks);
  const handedness = getHandedness(gestures, handIndex);
  performanceMonitor.frame("ai");
  const now = performance.now();
  virtualHand.update(latestLandmarks, gesture.name, latestPinch.active);
  robotController.updateFromHand(latestLandmarks, latestPinch, now);
  if (ui.getOptions().showSkeleton) drawCameraLandmarks(ui.refs.cameraOverlay, latestLandmarks, ui.getOptions().mirror); else drawCameraLandmarks(ui.refs.cameraOverlay, null);
  const controlPoint = getControlPoint(latestLandmarks);
  ui.updateObject(controlPoint, latestPinch.active);
  if (now - lastUiUpdate < 120) return;
  lastUiUpdate = now;
  ui.setTracking(Boolean(latestLandmarks));
  ui.setMetrics({ gesture: gesture.name, confidence: gesture.confidence, handedness, aiFps: performanceMonitor.aiFps, renderFps: performanceMonitor.renderFps, pinch: latestPinch.active, landmarks: latestLandmarks, frameWidth: ui.refs.video.videoWidth, frameHeight: ui.refs.video.videoHeight });
  ui.addHistory(gesture.name);
}

function render(now) {
  performanceMonitor.frame("render");
  if (ui.mode === "robot" && robotArm) {
    robotController.smooth(now);
    const state = robotController.getState();
    robotArm.update(state, now);
    robotArm.render();
    if (now - lastRobotUiUpdate >= 100) {
      const position = state.target.handPosition || { x: 0.5, y: 0.63, z: 0.41 };
      ui.updateRobot(state, position, { aiFps: performanceMonitor.aiFps, renderFps: performanceMonitor.renderFps }, Boolean(latestLandmarks));
      lastRobotUiUpdate = now;
    }
  } else {
    virtualHand.draw(now);
  }
  requestAnimationFrame(render);
}

function cameraError(error) {
  tracker?.destroy();
  tracker = null;
  latestLandmarks = null;
  latestPinch = { active: false };
  virtualHand.update(null, "NONE", false);
  drawCameraLandmarks(ui.refs.cameraOverlay, null);
  ui.setStatus("offline");
  const messages = {
    NotAllowedError: "Camera access was denied. Allow camera access for this site in your browser settings.",
    NotFoundError: "No camera was found. Check that a camera is connected and available.",
    NotReadableError: "The camera is in use by another application. Close it and try again.",
    BROWSER_UNSUPPORTED: "This browser does not support the Camera API. Try an up-to-date version of Chrome, Edge, or Safari.",
  };
  ui.error(messages[error.message] || "The camera or hand-tracking models could not start. Check your connection and try again.");
}

function handleMode(mode) {
  if (mode === "robot" && !enteredRobot) { enteredRobot = true; document.querySelector("#robot-training").showModal(); }
  if (mode === "robot") {
    robotController.setMode("free");
    loadRobotArm().catch(() => ui.error("The 3D workspace could not be initialized. Check WebGL support and reload the page."));
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
  if (tracker?.running) {
    tracker.destroy();
    tracker = null;
    latestLandmarks = null;
    latestPinch = { active: false };
    virtualHand.update(null, "NONE", false);
    drawCameraLandmarks(ui.refs.cameraOverlay, null);
    ui.setStatus("offline");
    return;
  }
  try {
    ui.setStatus("loading");
    const { HandTracking } = await import("./handTracking.js");
    tracker = new HandTracking(ui.refs.video, { onResult: handleResult, onStatus: ui.setStatus });
    await tracker.start();
  } catch (error) { cameraError(error); }
});

ui.refs.mirror.addEventListener("change", () => ui.refs.video.classList.toggle("mirrored", ui.getOptions().mirror));
ui.refs.video.classList.add("mirrored");
document.querySelector("#close-training").addEventListener("click", () => document.querySelector("#robot-training").close());
document.querySelector("#start-training").addEventListener("click", () => document.querySelector("#robot-training").close());
window.addEventListener("beforeunload", () => { tracker?.destroy(); robotArm?.destroy(); });
requestAnimationFrame(render);

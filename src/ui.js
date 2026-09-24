const LANDMARK_NAMES = ["WRIST", "THUMB CMC", "THUMB MCP", "THUMB IP", "THUMB TIP", "INDEX MCP", "INDEX PIP", "INDEX DIP", "INDEX TIP", "MIDDLE MCP", "MIDDLE PIP", "MIDDLE DIP", "MIDDLE TIP", "RING MCP", "RING PIP", "RING DIP", "RING TIP", "PINKY MCP", "PINKY PIP", "PINKY DIP", "PINKY TIP"];

export function createUI() {
  const $ = (selector) => document.querySelector(selector);
  const history = [];
  let currentMode = "virtual";
  let lastGesture = "NONE";
  let developerMode = false;
  let toastTimer;

  const refs = {
    video: $("#camera-video"), cameraOverlay: $("#camera-overlay"), placeholder: $("#camera-placeholder"), start: $("#start-camera"),
    cameraState: $("#camera-state"), cameraResolution: $("#camera-resolution"), headerAiFps: $("#header-ai-fps"),
    tracking: $("#tracking-state"), stageMessage: $("#stage-message"), virtualStage: $("#virtual-stage"), robotStage: $("#robot-stage"), robotCanvas: $("#robot-canvas"),
    object: $("#object-orb"), skeleton: $("#skeleton-toggle"), mirror: $("#mirror-toggle"), modeLabel: $("#mode-label"), gestureLabel: $("#gesture-label"),
    metricGesture: $("#metric-gesture"), metricConfidence: $("#metric-confidence"), metricHand: $("#metric-hand"), metricTracking: $("#metric-tracking"), metricFps: $("#metric-fps"), metricPinch: $("#metric-pinch"),
    history: $("#gesture-history"), developerToggle: $("#developer-toggle"), developerPanel: $("#developer-panel"), landmarkGrid: $("#landmark-grid"),
    bottomStatus: $("#bottom-status"), bottomAiFps: $("#bottom-ai-fps"), bottomRenderFps: $("#bottom-render-fps"), toast: $("#toast"),
    robotControls: $("#robot-controls"), robotAction: $("#robot-action"), armStatus: $("#arm-status"), armBase: $("#arm-base"), armShoulder: $("#arm-shoulder"), armElbow: $("#arm-elbow"), armWrist: $("#arm-wrist"), armGripper: $("#arm-gripper"), armFps: $("#arm-fps"), armX: $("#arm-x"), armY: $("#arm-y"), armZ: $("#arm-z"),
    sensitivity: $("#sensitivity"), smoothness: $("#smoothness"), deadZone: $("#dead-zone"), performance: $("#performance-toggle"),
  };

  function setStatus(status) {
    const states = {
      loading: ["LOADING", "Loading hand-tracking models…", "loading"],
      active: ["ONLINE", "Camera online", "active"],
      offline: ["OFFLINE", "Camera offline", "offline"],
    };
    const [label, bottom, className] = states[status] || states.offline;
    refs.cameraState.textContent = label;
    refs.cameraState.className = `live-badge ${className}`;
    refs.bottomStatus.textContent = bottom;

    if (status === "loading") refs.start.disabled = true;
    if (status === "active") {
      refs.placeholder.classList.add("hidden");
      refs.stageMessage.classList.add("hidden");
      refs.start.textContent = "STOP CAMERA";
      refs.start.disabled = false;
    }
    if (status === "offline") {
      refs.placeholder.classList.remove("hidden");
      refs.stageMessage.classList.remove("hidden");
      refs.start.textContent = "START CAMERA";
      refs.start.disabled = false;
      refs.cameraResolution.textContent = "— × —";
      refs.tracking.innerHTML = "<i aria-hidden=\"true\"></i> WAITING";
      refs.tracking.classList.remove("active");
      refs.metricTracking.textContent = "IDLE";
      refs.metricTracking.classList.remove("success-text");
      refs.headerAiFps.textContent = "--";
      refs.metricFps.textContent = "--";
      refs.bottomAiFps.textContent = "--";
      refs.metricGesture.textContent = "NONE";
      refs.metricConfidence.textContent = "--%";
      refs.metricHand.textContent = "--";
      refs.metricPinch.textContent = "OFF";
      refs.gestureLabel.textContent = "NONE";
    }
  }

  function setTracking(active) {
    refs.tracking.innerHTML = `<i aria-hidden="true"></i> ${active ? "ACTIVE" : "NO HAND"}`;
    refs.tracking.classList.toggle("active", active);
    refs.metricTracking.textContent = active ? "ACTIVE" : "NO HAND";
    refs.metricTracking.classList.toggle("success-text", active);
  }

  function setMetrics({ gesture, confidence, handedness, aiFps, renderFps, pinch, landmarks, frameWidth, frameHeight }) {
    refs.gestureLabel.textContent = gesture;
    refs.metricGesture.textContent = gesture;
    refs.metricConfidence.textContent = confidence > 0 ? `${Math.round(confidence * 100)}%` : "--%";
    refs.metricHand.textContent = handedness;
    refs.metricFps.textContent = aiFps || "--";
    refs.headerAiFps.textContent = aiFps || "--";
    refs.metricPinch.textContent = pinch ? "ACTIVE" : "OFF";
    refs.metricPinch.classList.toggle("success-text", pinch);
    refs.bottomAiFps.textContent = aiFps || "--";
    refs.bottomRenderFps.textContent = renderFps || "--";
    if (frameWidth && frameHeight) refs.cameraResolution.textContent = `${frameWidth} × ${frameHeight}`;
    updateLandmarks(landmarks);
  }

  function addHistory(gesture) {
    if (!gesture || gesture === "NONE" || gesture === lastGesture) return;
    lastGesture = gesture;
    history.unshift({ time: new Date().toLocaleTimeString("en-GB"), gesture });
    history.splice(5);
    refs.history.innerHTML = history.map((item) => `<li><time>${item.time}</time><span>${item.gesture}</span></li>`).join("");
  }

  function updateLandmarks(landmarks) {
    if (!developerMode || !landmarks) return;
    refs.landmarkGrid.innerHTML = landmarks.map((point, index) => `<div><span>${String(index).padStart(2, "0")} · ${LANDMARK_NAMES[index]}</span><b>X ${point.x.toFixed(3)} Y ${point.y.toFixed(3)} Z ${point.z.toFixed(3)}</b></div>`).join("");
  }

  function setMode(mode) {
    currentMode = mode;
    const labels = { virtual: "VIRTUAL HAND", robot: "ROBOT ARM", object: "OBJECTS", lab: "GESTURE LAB", settings: "SETTINGS" };
    refs.modeLabel.textContent = labels[mode] || labels.virtual;
    refs.virtualStage.classList.toggle("hidden", mode === "robot");
    refs.robotStage.classList.toggle("hidden", mode !== "robot");
    refs.robotControls.classList.toggle("hidden", mode !== "robot");
    refs.object.classList.toggle("visible", mode === "object");
    document.querySelectorAll(".menu-button").forEach((button) => {
      const active = button.dataset.appMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateObject(point, grabbed) {
    if (!point || currentMode !== "object") return;
    refs.object.style.left = `${point.x * 100}%`;
    refs.object.style.top = `${point.y * 100}%`;
    refs.object.classList.toggle("grabbed", grabbed);
  }

  function updateRobot(state, position, fps, tracking) {
    refs.armStatus.textContent = state.stopped ? "STOPPED" : state.mode === "demo" ? "DEMO" : tracking ? "ACTIVE" : "WAITING";
    refs.armStatus.className = state.stopped ? "danger-text" : state.mode === "demo" || tracking ? "success-text" : "";
    refs.armBase.textContent = `${Math.round(state.base * 57.3)}°`;
    refs.armShoulder.textContent = `${Math.round(state.shoulder * 57.3)}°`;
    refs.armElbow.textContent = `${Math.round((state.elbow - 0.78) * 57.3 + 45)}°`;
    refs.armWrist.textContent = `${Math.round(state.wrist * 57.3)}°`;
    refs.armGripper.textContent = state.gripper > 0.55 ? "CLOSED" : "OPEN";
    refs.armFps.textContent = `${fps.aiFps || "--"} / ${fps.renderFps || "--"} FPS`;
    refs.armX.textContent = position ? position.x.toFixed(2) : "0.50";
    refs.armY.textContent = position ? position.y.toFixed(2) : "0.63";
    refs.armZ.textContent = position ? position.z.toFixed(2) : "0.41";
    refs.robotAction.textContent = state.stopped ? "EMERGENCY STOP" : state.mode === "demo" ? "AUTOMATED DEMO" : !tracking ? "WAITING FOR HAND TRACKING" : state.gripper > 0.55 ? "PINCH / GRIPPER CLOSED" : "HAND CONTROL ACTIVE";
  }

  function getRobotParameters() {
    return { sensitivity: Number(refs.sensitivity.value) / 100, smoothness: Number(refs.smoothness.value) / 100, deadZone: Number(refs.deadZone.value) / 100 };
  }

  function updateSliderLabels() {
    $("#sensitivity-value").textContent = `${refs.sensitivity.value}%`;
    $("#smoothness-value").textContent = `${refs.smoothness.value}%`;
    $("#dead-zone-value").textContent = `${refs.deadZone.value}%`;
  }

  function error(message) {
    window.clearTimeout(toastTimer);
    refs.toast.textContent = message;
    refs.toast.classList.add("show");
    toastTimer = window.setTimeout(() => refs.toast.classList.remove("show"), 5000);
  }

  function toggleDeveloper() {
    developerMode = !developerMode;
    refs.developerPanel.classList.toggle("hidden", !developerMode);
    refs.developerToggle.querySelector("b").textContent = developerMode ? "ON" : "OFF";
    if (developerMode && !refs.landmarkGrid.children.length) refs.landmarkGrid.innerHTML = "<p>Waiting for hand landmarks…</p>";
  }

  function onStart(callback) { refs.start.addEventListener("click", callback); }
  function getOptions() { return { showSkeleton: refs.skeleton.checked, mirror: refs.mirror.checked, performance: refs.performance.checked }; }

  function bind(callbacks) {
    document.querySelectorAll(".menu-button").forEach((button) => button.addEventListener("click", () => {
      const mode = button.dataset.appMode;
      setMode(mode);
      callbacks.onMode?.(mode);
    }));
    document.querySelectorAll(".robot-mode").forEach((button) => button.addEventListener("click", () => callbacks.onRobotMode?.(button.dataset.robotMode)));
    $("#home-button").addEventListener("click", callbacks.onHome);
    $("#run-demo").addEventListener("click", callbacks.onDemo);
    $("#stop-button").addEventListener("click", callbacks.onStop);
    $("#resume-button").addEventListener("click", callbacks.onResume);
    [refs.sensitivity, refs.smoothness, refs.deadZone].forEach((input) => input.addEventListener("input", () => {
      updateSliderLabels();
      callbacks.onParameters?.(getRobotParameters());
    }));
    refs.performance.addEventListener("change", () => callbacks.onPerformance?.(refs.performance.checked));
  }

  updateSliderLabels();
  refs.developerToggle.addEventListener("click", toggleDeveloper);
  $("#help-button").addEventListener("click", () => $("#help-dialog").showModal());
  $("#close-help").addEventListener("click", () => $("#help-dialog").close());
  $("#dialog-start").addEventListener("click", () => $("#help-dialog").close());

  return { refs, setStatus, setTracking, setMetrics, addHistory, updateObject, updateRobot, error, onStart, getOptions, getRobotParameters, bind, setMode, get mode() { return currentMode; } };
}

import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const GESTURE_MODEL = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

export class HandTracking {
  constructor(video, { onResult, onStatus }) {
    this.video = video;
    this.onResult = onResult;
    this.onStatus = onStatus;
    this.stream = null;
    this.gestureRecognizer = null;
    this.animationFrame = 0;
    this.lastVideoTime = -1;
    this.lastInferenceTime = 0;
    this.inferenceInterval = 1000 / 30;
    this.running = false;
  }

  async load() {
    this.onStatus?.("loading");
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = {
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    try {
      this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: "GPU" },
      });
    } catch (gpuError) {
      this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: "CPU" },
      });
    }
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("BROWSER_UNSUPPORTED");
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 30, max: 30 } } });
    this.video.srcObject = this.stream;
    await this.video.play();
    if (!this.gestureRecognizer) await this.load();
    this.running = true;
    this.onStatus?.("active");
    this.loop();
  }

  loop() {
    if (!this.running) return;
    const now = performance.now();
    if (now - this.lastInferenceTime >= this.inferenceInterval && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      this.lastInferenceTime = now;
      const timestamp = now;
      const result = this.gestureRecognizer.recognizeForVideo(this.video, timestamp);
      this.onResult?.({ result, timestamp });
    }
    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  destroy() {
    this.stop();
    this.gestureRecognizer?.close();
    this.gestureRecognizer = null;
  }
}

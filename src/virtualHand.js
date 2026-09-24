const CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export class VirtualHand {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hands = [];
    this.performanceMode = false;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const ratioLimit = this.performanceMode ? 1 : 1.5;
    const ratio = Math.min(window.devicePixelRatio || 1, ratioLimit);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }

  setPerformanceMode(enabled) {
    this.performanceMode = enabled;
    this.resize();
  }

  update(hands = []) {
    this.hands = hands;
  }

  draw() {
    const ctx = this.ctx;
    const { width, height } = this;
    ctx.clearRect(0, 0, width, height);
    this.hands.forEach((hand) => {
      const points = hand.landmarks.map((point) => ({ x: (1 - point.x) * width, y: point.y * height }));
      const palm = points[0];
      const palmWidth = Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y);
      const scale = Math.max(0.88, Math.min(1.18, palmWidth / (Math.min(width, height) * 0.26)));
      const color = hand.handedness === "Left" ? "#72806f" : "#d96c35";
      ctx.save();
      ctx.translate(palm.x, palm.y);
      ctx.scale(scale, scale);
      ctx.translate(-palm.x, -palm.y);
      this.drawConnections(ctx, points, color);
      this.drawPalmMesh(ctx, points, color);
      this.drawJoints(ctx, points, hand.pinch.active, color);
      ctx.restore();
      ctx.fillStyle = color;
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.fillText(hand.handedness.toUpperCase(), palm.x + 8, palm.y - 10);
    });
  }

  drawConnections(ctx, points, color) {
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.88;
    ctx.lineWidth = 2.3;
    CONNECTIONS.forEach(([from, to]) => {
      ctx.beginPath();
      ctx.moveTo(points[from].x, points[from].y);
      ctx.lineTo(points[to].x, points[to].y);
      ctx.stroke();
    });
  }

  drawPalmMesh(ctx, points, color) {
    const palm = [points[0], points[5], points[9], points[13], points[17]];
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 1;
    for (let index = 0; index < palm.length; index += 1) {
      const next = palm[(index + 1) % palm.length];
      ctx.beginPath();
      ctx.moveTo(palm[index].x, palm[index].y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }
    for (let finger = 1; finger < 5; finger += 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[finger * 4 + 1].x, points[finger * 4 + 1].y);
      ctx.stroke();
    }
  }

  drawJoints(ctx, points, pinch, color) {
    points.forEach((point, index) => {
      const pinchTip = pinch && [4, 8].includes(index);
      ctx.beginPath();
      ctx.fillStyle = index === 0 || pinchTip ? color : "#fbfaf7";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.arc(point.x, point.y, index === 0 ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  destroy() { this.resizeObserver.disconnect(); }
}

export function drawCameraLandmarks(canvas, hands = [], mirrored = true) {
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  ctx.clearRect(0, 0, width, height);
  if (!hands?.length) return;

  const point = (item) => ({ x: (mirrored ? 1 - item.x : item.x) * width, y: item.y * height });
  hands.forEach((hand) => {
    const landmarks = hand.landmarks;
    const color = hand.handedness === "Left" ? "#72806f" : "#d96c35";
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.88;
    ctx.lineWidth = 1.5;
    CONNECTIONS.forEach(([from, to]) => {
      const start = point(landmarks[from]);
      const end = point(landmarks[to]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });
    landmarks.forEach((item) => {
      const target = point(item);
      ctx.fillStyle = "#fbfaf7";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  });
}

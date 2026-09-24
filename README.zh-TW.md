# Hand2Robot — Gesture Lab

**以手勢追蹤與虛擬機器人操作為核心的瀏覽器互動工作區。** 使用攝影機探索手部關鍵點、手勢、虛擬手掌與模擬機械手臂。

[English](README.md) · [線上展示](https://xlistenz.github.io/Hand2Robot/) · [原始碼](https://github.com/xlistenz/Hand2Robot)

> [!IMPORTANT]
> 機械手臂是以 Three.js 製作的模擬場景。本專案不控制實體機器人或馬達。攝影機影像在瀏覽器內處理，本專案不會上傳或儲存影像。

## 功能

- 使用 MediaPipe Hand Landmarker 與 Gesture Recognizer 即時分析攝影機畫面。
- 最多追蹤兩隻手的 21 個關鍵點，提供骨架疊圖與鏡像預覽。
- 辨識張開手掌、握拳、指向上方、讚、勝利及 I Love You 手勢。
- Virtual Hand 顯示即時手部骨架、深度縮放與捏合回饋。
- Robot Arm 提供工業風 3D 工作區、X/Y/Z 軸、原點及可移動物件。
- 依手掌位置、傾斜角度、大小和捏合動作控制底座、肩部、手肘、手腕與夾爪。
- 可與方塊、球體、圓柱、圓環及長方體互動。
- Free、Precise、Demo 機械手臂模式，以及 Home、Emergency Stop 和 Resume 控制。
- 可調靈敏度、阻尼和死區；Performance Mode 會降低畫布與 WebGL 解析度，釋出 GPU 資源給追蹤使用。
- 提供 Objects、Gesture Lab、Settings、手勢歷史、信心度、左右手、AI/渲染 FPS 及即時關鍵點座標。
- 支援桌面與手機版面。

## 工作區模式

| 模式 | 說明 |
| --- | --- |
| Virtual Hand | 顯示手部關鍵點與捏合狀態。 |
| Robot Arm | 以手掌位置、傾斜角度、手掌大小和捏合動作控制虛擬手臂；顯示關節角度及操作選項。 |
| Objects | 使用食指指尖移動螢幕上的物件游標，並以捏合操作。 |
| Gesture Lab | 查看手勢信心度、追蹤狀態及最近的手勢歷史。 |
| Settings | 設定攝影機骨架疊圖與鏡像預覽；機械手臂的效能選項位於 Robot Arm 模式。 |

## 機械手臂控制

右手往左或往右移動可旋轉底座，上下移動可抬高或降低手臂，手掌在畫面中看起來較大或較小時會調整手肘前伸程度。手掌傾斜控制手腕。拇指與食指捏合會關閉夾爪，放開則開啟夾爪。

Precise 模式會降低手部控制靈敏度。Demo 模式會重複播放手臂動作。Home 將手臂送回預設位置，Emergency Stop 會停止動作，Resume 會恢復手勢控制。模擬夾爪可以抓取附近物件並移動；放開後物件會停留在放下的位置。

## 手勢

| 手勢 | 作用 |
| --- | --- |
| Open Palm | 辨識為張開手掌。 |
| Fist | 辨識為握拳。 |
| Pointing Up | 在 Objects 模式中以食指指尖移動物件游標。 |
| Thumbs Up | 顯示於手勢讀值與歷史紀錄。 |
| Victory | 顯示於手勢讀值與歷史紀錄。 |
| I Love You | MediaPipe 模型辨識到時顯示。 |
| Pinch | 依目前模式關閉機械手臂夾爪或抓取螢幕物件。 |

## 在本機執行

需求：Node.js 18 以上、npm、攝影機與現代瀏覽器，建議使用 Chrome 或 Edge。瀏覽器會將 localhost 視為允許攝影機存取的安全來源。

```bash
git clone https://github.com/xlistenz/Hand2Robot.git
cd Hand2Robot
npm ci
npm run dev
```

使用 Vite 顯示的 localhost 網址開啟網站，並允許攝影機權限。啟動追蹤時，網站會從公開 CDN 載入 MediaPipe WASM 執行環境與模型，因此需要網際網路連線。

建立並預覽正式版：

```bash
npm run build
npm run preview
```

## GitHub Pages

推送到 `main` 後，GitHub Actions 會執行 `.github/workflows/deploy.yml`：安裝鎖定版本的套件、建置 Vite 網站，並將 `dist/` 部署到 GitHub Pages。Vite 會從 Actions 環境讀取 repository 名稱，自動設定 `/Hand2Robot/` 網站路徑。

線上網站：[https://xlistenz.github.io/Hand2Robot/](https://xlistenz.github.io/Hand2Robot/)

## 隱私與效能

攝影機影像由瀏覽器 `getUserMedia` API 讀取後直接交給 MediaPipe 處理。本專案沒有後端、分析追蹤、廣告或上傳攝影機影像的程式。瀏覽器會向指定的公開 CDN 請求 MediaPipe 執行環境與模型檔案。

手部推論會在新影格上以最高約 30 FPS 執行；Three.js 使用獨立的渲染迴圈，並在選取 Robot Arm 模式時才載入 3D 場景。實際 FPS 會受到裝置、瀏覽器、攝影機與顯示硬體影響。Performance Mode 會降低畫布和 WebGL 的像素比，不會降低手部推論目標頻率。

## 專案結構

```text
.
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
├── README.zh-TW.md
├── LICENSE
├── .github/workflows/deploy.yml
├── public/models/             # 可選的本機模型目錄
└── src/
    ├── main.js                # 應用程式初始化與渲染迴圈
    ├── handTracking.js        # 攝影機、MediaPipe 模型與推論迴圈
    ├── gesture.js             # 手勢名稱、捏合偵測與控制座標
    ├── virtualHand.js         # Canvas 手掌與攝影機關鍵點繪製
    ├── robotArm.js            # Three.js 場景與虛擬手臂
    ├── robotControl.js        # 手勢轉關節控制與 Demo 動作
    ├── objectInteraction.js   # 模擬物件抓取與放開
    ├── performance.js         # AI 與渲染影格率測量
    ├── ui.js                  # 工作區控制與即時讀值
    └── style.css              # 響應式工程工作區介面
```

## 授權

本專案採用 MIT License，詳見 [LICENSE](LICENSE)。

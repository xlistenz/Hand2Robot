# Hand2Robot — Gesture Lab

**以手勢追蹤與虛擬機器人操作為核心的瀏覽器互動工作區。** 使用攝影機探索手部關鍵點、手勢、虛擬手掌與模擬機械手臂。

[English](README.md) · [線上展示](https://xlistenz.github.io/Hand2Robot/) · [原始碼](https://github.com/xlistenz/Hand2Robot)

> [!IMPORTANT]
> 機械手臂是以 Three.js 製作的模擬場景。本專案不控制實體機器人或馬達。攝影機影像在瀏覽器內處理，本專案不會上傳或儲存影像。

## 功能

- 使用單一 MediaPipe Gesture Recognizer 同步追蹤雙手關鍵點與手勢。
- 最多追蹤兩隻手的 21 個關鍵點，提供骨架疊圖與鏡像預覽。
- 辨識張開手掌、握拳、指向上方、讚、勝利及 I Love You 手勢。
- Virtual Hand 顯示即時手部骨架、深度縮放與捏合回饋。
- Robot Arm 提供參考 SO-ARM101 關節配置的 3D 虛擬手臂、工業風工作區與 X/Y/Z 軸。
- 以逆向運動學讓夾爪跟隨右手設定的 3D 座標；右手控制底座方向、高度和前伸距離，手腕動作控制俯仰與翻轉。左手捏合可關閉夾爪；只有一隻手時，該手也能控制夾爪。
- Objects 提供方塊、球體、圓柱、圓環及長方體。工作區會顯示彩色 3D 手部骨架和指尖目標；捏合可搬動物件，轉動手腕可旋轉物件。
- 模擬物件會留在桌面範圍內，並以近似碰撞範圍避免物件互相穿過。
- Free、Precise、Demo 機械手臂模式，以及 Home、Emergency Stop 和 Resume 控制。
- 可調靈敏度、阻尼和死區；Performance Mode 會降低畫布與 WebGL 解析度，釋出 GPU 資源給追蹤使用。
- 提供 Objects、Gesture Lab、Settings、手勢歷史、信心度、左右手、AI/渲染 FPS 及即時關鍵點座標。
- 支援桌面與手機版面。

## 工作區模式

| 模式 | 說明 |
| --- | --- |
| Virtual Hand | 顯示手部關鍵點與捏合狀態。 |
| Robot Arm | 以手部控制 3D 夾爪目標的 SO-ARM101 風格虛擬手臂；顯示即時關節角度及操作選項。 |
| Objects | 顯示即時 3D 手部骨架與指尖目標；可捏合搬動物件並轉動手腕。 |
| Gesture Lab | 查看手勢信心度、追蹤狀態及最近的手勢歷史。 |
| Settings | 設定攝影機骨架疊圖與鏡像預覽；機械手臂的效能選項位於 Robot Arm 模式。 |

## 機械手臂控制

開始追蹤時，第一個手部姿勢會作為操作基準，機械臂不會突然跳動。右手左右移動可旋轉底座，上下移動可升降夾爪，手掌在畫面中的大小會控制前伸距離。轉動右手手腕可控制工具俯仰與翻轉。左手拇指和食指捏合會關閉夾爪；只有一隻手時，該手同時控制手臂和夾爪。

虛擬手臂以 Three.js 呈現，造型與關節配置參考 [TheRobotStudio SO-ARM100/SO-ARM101 專案](https://github.com/TheRobotStudio/SO-ARM100)。本專案不包含官方 CAD 檔，也不會控制實體手臂。

肩部和手肘使用逆向運動學，讓夾爪跟隨可達的 3D 目標；超出關節範圍的目標會投影到最近的可達位置。Precise 模式會降低手部控制靈敏度。Demo 模式會重複播放手臂動作。Home 將手臂送回抬高且可操作的位置，Emergency Stop 會停止動作，Resume 會恢復手勢控制。模擬夾爪必須靠近物件才能抓取；桌面碰撞以包圍體近似處理，並非完整的剛體物理引擎。

## 手勢

| 手勢 | 作用 |
| --- | --- |
| Open Palm | 辨識為張開手掌。 |
| Fist | 辨識為握拳。 |
| Pointing Up | 顯示於手勢讀值與歷史紀錄。 |
| Thumbs Up | 顯示於手勢讀值與歷史紀錄。 |
| Victory | 顯示於手勢讀值與歷史紀錄。 |
| I Love You | MediaPipe 模型辨識到時顯示。 |
| Pinch | 在 Robot Arm 模式關閉夾爪；在 Objects 模式抓取附近的 3D 物件。 |

## 在本機執行

需求：Node.js 18 以上、npm、攝影機與現代瀏覽器，建議使用 Chrome 或 Edge。瀏覽器會將 localhost 視為允許攝影機存取的安全來源。

```bash
git clone https://github.com/xlistenz/Hand2Robot.git
cd Hand2Robot
npm ci
npm run dev
```

使用 `npm test` 執行運動學和物件互動檢查；使用 `npm run build` 驗證正式建置。

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
├── src/
    ├── main.js                # 應用程式初始化與渲染迴圈
    ├── handTracking.js        # 攝影機、MediaPipe 模型與推論迴圈
    ├── gesture.js             # 手勢名稱、捏合偵測與控制座標
    ├── virtualHand.js         # Canvas 手掌與攝影機關鍵點繪製
    ├── robotArm.js            # Three.js 場景與虛擬手臂
    ├── robotControl.js        # 手勢轉 3D 夾爪目標與 Demo 動作
    ├── robotKinematics.js     # 機械臂正向與逆向運動學
    ├── objectInteraction.js   # 3D 手部骨架、抓取及碰撞範圍
    ├── performance.js         # AI 與渲染影格率測量
    ├── ui.js                  # 工作區控制與即時讀值
    └── style.css              # 響應式工程工作區介面
└── tests/
    ├── robot-control.test.js  # 運動學與手勢控制檢查
    └── object-interaction.test.js # 抓取與桌面限制檢查
```

## 授權

本專案採用 MIT License，詳見 [LICENSE](LICENSE)。

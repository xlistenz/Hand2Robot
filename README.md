# Hand2Robot — Gesture Lab

**A browser-based hand-tracking and virtual robotics workspace.** Use your webcam to explore hand landmarks, gestures, a virtual hand, and a simulated robot arm.

[Traditional Chinese](README.zh-TW.md) · [Live demo](https://xlistenz.github.io/Hand2Robot/) · [Source code](https://github.com/xlistenz/Hand2Robot)

> [!IMPORTANT]
> The robot arm is a Three.js simulation. This project does not control a physical robot or motor. Camera frames are processed in the browser and are not uploaded or stored by this project.

## Features

- Live webcam input with one MediaPipe Gesture Recognizer tracking both hands and their gestures together.
- Detection of 21 landmarks on up to two hands, with a hand-skeleton overlay and mirror-view option.
- Gesture classification for Open Palm, Fist, Pointing Up, Thumbs Up, Victory, and I Love You.
- Virtual Hand view with depth-responsive scale and pinch feedback.
- Robot Arm view with a 3D arm inspired by the SO-ARM101 joint layout, an industrial-style work area, X/Y/Z axes, and movable objects.
- Cartesian gripper control: right-hand motion sets the arm's base direction, height, and reach through inverse kinematics; wrist motion controls pitch and roll. Pinch with the left hand to close the gripper. With one hand, its pinch controls the gripper.
- Direct 3D object interaction with a cube, sphere, cylinder, ring, and box. The camera fingertip is shown as a colored 3D hand skeleton and target marker; pinch to move an object and turn the wrist to rotate it.
- Simulated object constraints keep objects on the tabletop, inside its edge, and apart from one another during hand and robot-gripper movement.
- Free, Precise, and Demo robot modes, plus Home, Emergency Stop, and Resume controls.
- Sensitivity, damping, and dead-zone settings, plus a Performance Mode that lowers rendering resolution to free GPU headroom for tracking.
- Objects view, Gesture Lab, Settings, gesture history, confidence and handedness readouts, AI/render FPS, and live landmark coordinates.
- Responsive desktop and mobile layouts.

## Workspace modes

| Mode | What it shows |
| --- | --- |
| Virtual Hand | A live hand-landmark visualization with pinch feedback. |
| Robot Arm | An SO-ARM101-inspired virtual arm whose gripper follows a hand-mapped 3D target. Includes live joint values and robot controls. |
| Objects | A 3D workbench with a live hand skeleton, fingertip target, pinch-to-move, and wrist rotation. |
| Gesture Lab | Gesture confidence, tracking state, and recent gesture history. |
| Settings | Camera overlay and mirror options; robot performance controls are available in Robot Arm mode. |

## Robot controls

The first tracked hand pose becomes the neutral point, so starting tracking does not jump the arm. Move the right hand left or right to rotate the base, move it vertically to raise or lower the gripper, and move it closer to or farther from the camera to adjust reach. Turn the wrist to control tool pitch and roll. Pinch with the left hand to close the gripper; with only one tracked hand, that hand controls both the arm and gripper.

The virtual arm is a Three.js interpretation of the SO-ARM101-style servo and joint arrangement. See [TheRobotStudio SO-ARM100/SO-ARM101 project](https://github.com/TheRobotStudio/SO-ARM100) for the physical design reference. This project does not include the official CAD files or control a physical arm.

The shoulder and elbow use inverse kinematics so the gripper follows a reachable 3D target; targets outside the joint range are projected to the nearest reachable position. Precise mode reduces hand-control sensitivity. Demo mode runs a repeating arm sequence. Home returns the arm to a raised, reachable pose, Emergency Stop halts motion, and Resume re-enables hand control. The simulated gripper picks up objects only when it reaches them. Tabletop collisions use approximate bounding volumes, not a full rigid-body physics engine.

## Gestures

| Gesture | Response |
| --- | --- |
| Open Palm | Recognized as an open hand. |
| Fist | Recognized as a closed hand. |
| Pointing Up | Displayed in the gesture readouts and history. |
| Thumbs Up | Displayed in the gesture readouts and history. |
| Victory | Displayed in the gesture readouts and history. |
| I Love You | Displayed when recognized by the MediaPipe model. |
| Pinch | Closes the gripper in Robot Arm mode or grabs a nearby 3D object in Objects mode. |

## Run locally

Requirements: Node.js 18 or newer, npm, a webcam, and a modern browser. Chrome and Edge are recommended. The development server uses localhost, which browsers treat as a secure context for camera access.

```bash
git clone https://github.com/xlistenz/Hand2Robot.git
cd Hand2Robot
npm ci
npm run dev
```

Run interaction and kinematics checks with `npm test`; verify the production bundle with `npm run build`.

Open the localhost URL printed by Vite and allow camera access when prompted. MediaPipe's WASM runtime and model files are fetched from their published CDN locations when tracking starts, so an internet connection is required.

Create and preview a production build:

```bash
npm run build
npm run preview
```

## GitHub Pages

Pushing to `main` runs the GitHub Actions workflow in `.github/workflows/deploy.yml`. It installs locked dependencies, builds the Vite site, and deploys the `dist/` directory to GitHub Pages. The Vite configuration reads the repository name from the Actions environment, so the same build works at the project's `/Hand2Robot/` Pages path.

Live site: <https://xlistenz.github.io/Hand2Robot/>

## Privacy and performance

Camera frames are read by the browser's `getUserMedia` API and passed directly to MediaPipe. This repository has no application backend, analytics, advertising, or camera-upload code. The browser does request the MediaPipe runtime and model files from the configured public CDNs.

Hand inference is scheduled for up to 30 FPS on new video frames. Three.js rendering runs separately, and the 3D scene is loaded only when Robot Arm mode is selected. Actual frame rates depend on the device, browser, camera, and graphics hardware. Performance Mode reduces canvas and WebGL pixel ratios without lowering the hand-inference target.

## Project structure

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
├── public/models/             # Optional location for locally hosted models
├── src/
    ├── main.js                # Application setup and render loop
    ├── handTracking.js        # Camera, MediaPipe models, and inference loop
    ├── gesture.js             # Gesture labels, pinch detection, and control points
    ├── virtualHand.js         # Canvas hand and camera-landmark rendering
    ├── robotArm.js            # Three.js scene and virtual arm
    ├── robotControl.js        # Hand-to-Cartesian-target mapping and demo control
    ├── robotKinematics.js     # Forward and inverse arm kinematics
    ├── objectInteraction.js   # 3D hand skeleton, grasping, and collision bounds
    ├── performance.js         # AI and render frame-rate measurements
    ├── ui.js                  # Workspace controls and live readouts
    └── style.css              # Responsive engineering-workspace interface
└── tests/
    ├── robot-control.test.js  # Kinematics and hand-to-arm control checks
    └── object-interaction.test.js # Grasping and tabletop constraint checks
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

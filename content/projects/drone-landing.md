---
title: "Autonomous Drone Precision Landing"
summary: "Ground-based vision system that detects an approaching drone using YOLOv8 and a custom DeepSORT tracker, computes its angular offset in real time, and closes the control loop via MAVLink LANDING_TARGET messages to an ArduCopter flight controller."
category: "Drone"
filter: ["drone", "cv"]
featured: true
weight: 2
result: "Closed-loop autonomous landing without GPS, running at 10 Hz on a Raspberry Pi with a pluggable 4-mode detection pipeline"
problem: "Autonomous drones need to land precisely in GPS-degraded or GPS-denied environments. A single upward-facing camera on the landing pad must detect the drone, calculate its position relative to the pad centre, and send corrections to the autopilot fast enough to guide the final descent."
approach: "Camera on the landing pad looks upward and detects the drone using one of four interchangeable modes: frame-differencing motion detection, brightness thresholding, fine-tuned YOLOv8, or YOLOv8 + custom DeepSORT tracking. Pixel coordinates are converted to angular offsets via camera intrinsics, then to NED metre offsets using autopilot altitude. MAVLink LANDING_TARGET messages are streamed at 10 Hz to a Cube Orange (ArduCopter) over Wi-Fi UDP. A stereo camera variant computes metric depth from disparity maps, removing reliance on barometric altitude."
github: "https://github.com/RuchitaVehale1998/drone-precision-landing"
tags: ["YOLOv8", "DeepSORT", "MAVLink", "Stereo Vision", "ArduPilot", "Raspberry Pi", "OpenCV", "Python"]
impact:
  - value: "10 Hz"
    label: "MAVLink Rate"
  - value: "4 Modes"
    label: "Detection Pipeline"
  - value: "Custom"
    label: "DeepSORT Tracker"
  - value: "No GPS"
    label: "Landing Mode"
---

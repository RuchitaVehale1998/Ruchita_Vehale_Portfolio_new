---
title: "Autonomous Drone Landing via Multi-Sensor Fusion"
summary: "Precision landing system fusing GPS, Raspberry Pi camera, LiDAR and stereo depth, deployed at HVN Labs. Handles environments where GPS alone is insufficient."
category: "Drone"
filter: ["drone", "cv"]
featured: true
weight: 2
result: "Precise autonomous landings across varied real-world conditions, deployed at HVN Labs, Bristol"
problem: "Autonomous drones need to land precisely in GPS-degraded, dynamic, visually challenging environments. Single-sensor approaches (GPS-only or camera-only) fail in practice. The system must fuse heterogeneous sensor data in real-time on embedded hardware."
approach: "Fused GPS position, Raspberry Pi camera visual odometry, and LiDAR range measurements using a sensor fusion architecture. Implemented reverse landing logic via MAVLink protocol. Extended with stereo camera-based depth estimation for sub-metre altitude control. All processing on Raspberry Pi in real-time."
github: "https://github.com/RuchitaVehale1998/drone-precision-landing"
tags: ["GPS Fusion", "LiDAR", "Raspberry Pi", "Stereo Vision", "MAVLink", "OpenCV", "Python"]
impact:
  - value: "GPS+V+L"
    label: "3-Sensor Fusion"
  - value: "MAVLink"
    label: "Protocol"
  - value: "Real-time"
    label: "RPi"
  - value: "HVN Labs"
    label: "Deployed"
---

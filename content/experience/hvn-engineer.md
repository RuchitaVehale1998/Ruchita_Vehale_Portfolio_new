---
title: "Jr. Drone System Engineer"
company: "HVN Labs, Future Space, BRL"
location: "Bristol, UK"
date: "2025-06-01"
enddate: "Aug 2025"
weight: 2
companySlug: "hvn"
logourl: "/images/logo-hvn.svg"
problem: "Autonomous drones need to land precisely without GPS in dynamic environments. A ground-based vision system must detect the drone in real time, compute its position, and close the control loop via the autopilot — all on embedded hardware."
tags: ["YOLOv8", "DeepSORT", "MAVLink", "Stereo Vision", "ArduPilot", "Lua", "ESP32", "OpenCV", "Python", "Raspberry Pi"]
impact:
  - value: "10 Hz"
    label: "MAVLink Rate"
  - value: "4 Modes"
    label: "Detection Pipeline"
  - value: "Custom"
    label: "DeepSORT Tracker"
  - value: "Real-time"
    label: "RPi Processing"
---

Engineered a **ground-based autonomous precision landing system** using an upward-facing Raspberry Pi Camera on the landing pad; ran YOLOv8 inference to detect incoming drones and streamed corrective MAVLink `LANDING_TARGET` messages at **10 Hz** to a Cube Orange flight controller over Wi-Fi UDP, enabling closed-loop autonomous landing without GPS.

Implemented a **custom DeepSORT multi-object tracker** from scratch — Kalman filter state prediction, Hungarian algorithm for detection-to-track assignment, and CNN appearance embeddings for re-identification — integrated with a **stereo vision depth pipeline** (stereo rectification + block matching) to compute metric 3D drone position from disparity maps.

Built a **pluggable detection architecture** (motion, brightness, YOLOv8, YOLOv8+DeepSORT) with an **ESP32 Bluetooth** communication module for real-time telemetry transfer, **Feetech STS3032 smart servo** integration via 10 ArduPilot Lua scripts for servo control and health monitoring, and a Flask web interface with live MJPEG stream and browser-based camera calibration.

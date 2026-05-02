---
title: "Magnet-Detecting Robot: Pololu 3Pi+"
summary: "Autonomous robot with boundary detection, PID control, and BFS shortest-path planning for systematic magnet location."
category: "Robotics"
filter: ["robot"]
weight: 7
result: "Accurate magnet localisation with provably optimal traversal path"
problem: "Systematically locate hidden magnets in a bounded arena using only onboard sensing, with no external positioning system or prior map."
approach: "Implemented IR boundary detection, PID-controlled navigation and a BFS-based shortest-path algorithm for full coverage planning. The 3Pi+ calculates the next move based on sensor readings at each node."
tags: ["Pololu 3Pi+", "PID Control", "BFS Path Planning", "C++", "Embedded"]
impact:
  - value: "BFS"
    label: "Path Planning"
  - value: "PID"
    label: "Navigation"
  - value: "IR"
    label: "Boundary Detect"
  - value: "Optimal"
    label: "Path"
---

---
title: "Dynamic Visual SLAM with YOLOv8 + DeepSORT + MiDaS"
summary: "Real-time SLAM that filters dynamic objects to prevent map corruption, enabling reliable localisation in environments with people and vehicles."
category: "SLAM"
filter: ["slam", "ml", "cv"]
featured: true
weight: 1
result: "Robust localisation across monocular and RGB-D cameras in dynamic environments"
problem: "Standard SLAM systems assume a static world. In real environments (hospitals, warehouses, streets), moving people and vehicles cause feature point corruption, leading to catastrophic mislocalisation and map drift. This makes SLAM unreliable for practical deployment."
approach: "Integrated YOLOv8 for real-time object detection, DeepSORT for multi-object temporal tracking, and MiDaS for monocular depth estimation. Detected dynamic objects are semantically masked before ORB-SLAM processes feature points. Open3D handles point cloud refinement and loop closure. Pipeline runs at near real-time on RGB-D cameras."
github: "https://github.com/RuchitaVehale1998/D455-Dynamic-Object-Aware-Visual-SLAM-Framework"
tags: ["YOLOv8", "DeepSORT", "MiDaS", "ORB-SLAM", "Open3D", "Python", "ROS"]
impact:
  - value: "Dynamic"
    label: "Object Filtering"
  - value: "ORB-SLAM"
    label: "Backend"
  - value: "RGB-D"
    label: "Camera Support"
  - value: "Open3D"
    label: "Point Cloud"
---

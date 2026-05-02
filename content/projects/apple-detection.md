---
title: "Hybrid Apple Detection: YOLOv8 vs Traditional CV"
summary: "Deep learning benchmark study: YOLOv8 trained for 1,500 epochs against traditional CV methods. Published in SSRN Electronic Journal."
category: "Machine Learning"
filter: ["ml", "cv"]
featured: true
weight: 3
result: "98.87% mAP, published in SSRN Electronic Journal"
problem: "Agricultural ML needs to be both accurate and computationally efficient. This benchmarks when modern deep learning (YOLOv8) is necessary versus when traditional CV is sufficient, a practical question for real deployment decisions."
approach: "Trained YOLOv8 for 1,500 epochs on a custom apple dataset with segmentation preprocessing. Benchmarked rigorously against traditional CV methods: Hough circle detection, contour analysis, and colour-based segmentation. Analysed accuracy-vs-compute trade-offs."
tags: ["YOLOv8", "Image Segmentation", "OpenCV", "Python", "Deep Learning", "Keras"]
impact:
  - value: "98.87%"
    label: "mAP Accuracy"
  - value: "1500"
    label: "Epochs"
  - value: "SSRN"
    label: "Published"
  - value: "vs CV"
    label: "Benchmarked"
---

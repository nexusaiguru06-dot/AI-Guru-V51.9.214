#!/usr/bin/env python3
"""
Runs LatentSync's scripts/inference.py (from inside the LatentSync folder) with the face finder of our choice.

    python run_latentsync.py --detector mediapipe -- <LatentSync inference arguments>

mediapipe (default): MediaPipe Face Mesh (Apache 2.0) instead of InsightFace (non-commercial models). LatentSync only uses
three points from the face finder: the two eyebrow centres and the nose centre (ImageProcessor.affine_transform), plus a
yes/no "face found". We give it a 106-point array with exactly those points filled, so nothing else changes.
"""
import os
import runpy
import sys
import types

import numpy as np


class MediaPipeFaceDetector:
    # MediaPipe Face Mesh landmark ids (image-left = the person's right side)
    BROW_IMAGE_LEFT = [70, 63, 105, 66, 107]
    BROW_IMAGE_RIGHT = [336, 296, 334, 293, 300]
    NOSE = [1, 4, 98, 327]

    def __init__(self, device="cuda"):
        import mediapipe as mp

        self.mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=False, min_detection_confidence=0.5)

    def __call__(self, frame, threshold=0.5):
        img = frame
        if hasattr(img, "cpu"):  # a torch tensor
            img = img.cpu().numpy()
        img = np.ascontiguousarray(img.astype(np.uint8))
        h, w = img.shape[:2]
        res = self.mesh.process(img)  # LatentSync frames are RGB
        if not res.multi_face_landmarks:
            return None, None
        pts = np.array([[p.x * w, p.y * h] for p in res.multi_face_landmarks[0].landmark], dtype=np.float32)
        x1, y1 = pts.min(axis=0)
        x2, y2 = pts.max(axis=0)
        if x2 - x1 < 50 or y2 - y1 < 60:
            return None, None
        lmk = np.zeros((106, 2), dtype=np.float32)
        left, right, nose = pts[self.BROW_IMAGE_LEFT].mean(axis=0), pts[self.BROW_IMAGE_RIGHT].mean(axis=0), pts[self.NOSE].mean(axis=0)
        lmk[[43, 48, 49, 51, 50]] = left  # what LatentSync averages for the "left eyebrow centre"
        lmk[101:106] = right  # "right eyebrow centre"
        lmk[[74, 77, 83, 86]] = nose  # "nose centre"
        bbox = (int(max(0, x1)), int(max(0, y1)), int(min(w, x2)), int(min(h, y2)))
        return bbox, np.round(lmk).astype(np.int_)


def main():
    argv = sys.argv[1:]
    detector = "mediapipe"
    if "--detector" in argv:
        i = argv.index("--detector")
        detector = argv[i + 1]
        del argv[i : i + 2]
    if argv and argv[0] == "--":
        argv = argv[1:]
    sys.path.insert(0, os.getcwd())  # the LatentSync folder (the worker starts us there)
    if detector == "mediapipe":
        stub = types.ModuleType("latentsync.utils.face_detector")
        stub.FaceDetector = MediaPipeFaceDetector
        sys.modules["latentsync.utils.face_detector"] = stub  # InsightFace is never imported
    sys.argv = ["scripts/inference.py", *argv]
    runpy.run_module("scripts.inference", run_name="__main__")


if __name__ == "__main__":
    main()

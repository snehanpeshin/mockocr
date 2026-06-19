from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def preprocess_image(input_path: Path, output_path: Path) -> Path:
    image = cv2.imread(str(input_path))
    if image is None:
        raise ValueError("Unsupported or unreadable image file.")

    image = _upscale_for_ocr(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 7, 35, 35)
    denoised = cv2.fastNlMeansDenoising(gray, h=14)
    deskewed = _deskew(denoised)
    enhanced = _enhance_contrast(deskewed)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), enhanced)
    return output_path


def _upscale_for_ocr(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    longest_side = max(height, width)
    if longest_side >= 1800:
        return image

    scale = min(2.5, 1800 / max(1, longest_side))
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def _enhance_contrast(gray: np.ndarray) -> np.ndarray:
    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8))
    contrasted = clahe.apply(normalized)
    blurred = cv2.GaussianBlur(contrasted, (0, 0), 1.2)
    sharpened = cv2.addWeighted(contrasted, 1.55, blurred, -0.55, 0)
    thresholded = cv2.adaptiveThreshold(
        sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        41,
        13,
    )
    kernel = np.ones((2, 2), np.uint8)
    return cv2.morphologyEx(thresholded, cv2.MORPH_OPEN, kernel)


def _deskew(gray: np.ndarray) -> np.ndarray:
    inverted = cv2.bitwise_not(gray)
    coords = np.column_stack(np.where(inverted > 0))
    if coords.size == 0:
        return gray

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.25:
        return gray

    height, width = gray.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        gray,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )

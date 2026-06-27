from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def preprocess_image(input_path: Path, output_path: Path) -> Path:
    variants = preprocess_image_variants(input_path, output_path.parent)
    if variants:
        if variants[0] != output_path:
            output_path.write_bytes(variants[0].read_bytes())
        return output_path
    raise ValueError("Unsupported or unreadable image file.")


def preprocess_image_variants(input_path: Path, output_dir: Path) -> list[Path]:
    image = cv2.imread(str(input_path))
    if image is None:
        raise ValueError("Unsupported or unreadable image file.")

    output_dir.mkdir(parents=True, exist_ok=True)
    image = _upscale_for_ocr(image)
    image = _trim_empty_borders(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = _normalize_gray(gray)
    gray = cv2.bilateralFilter(gray, 7, 35, 35)
    gray = cv2.fastNlMeansDenoising(gray, h=10)
    deskewed = _deskew(gray)

    variants: list[tuple[str, np.ndarray]] = [
        ("01_gray_clean", _enhance_gray(deskewed)),
        ("02_adaptive_text", _adaptive_text(deskewed)),
        ("03_shadow_clean", _shadow_clean_text(deskewed)),
        ("04_pencil_light", _pencil_light_text(deskewed)),
    ]

    paths: list[Path] = []
    seen_hashes: set[int] = set()
    for name, variant in variants:
        variant = _ensure_min_margin(variant)
        variant_hash = hash(variant.tobytes())
        if variant_hash in seen_hashes:
            continue
        seen_hashes.add(variant_hash)
        path = output_dir / f"{name}.png"
        cv2.imwrite(str(path), variant)
        paths.append(path)

    return paths


def _upscale_for_ocr(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    longest_side = max(height, width)
    if longest_side >= 1800:
        return image

    scale = min(2.5, 1800 / max(1, longest_side))
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def _normalize_gray(gray: np.ndarray) -> np.ndarray:
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    return gray.astype(np.uint8)


def _enhance_gray(gray: np.ndarray) -> np.ndarray:
    normalized = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrasted = clahe.apply(normalized)
    blurred = cv2.GaussianBlur(contrasted, (0, 0), 1.2)
    return cv2.addWeighted(contrasted, 1.35, blurred, -0.35, 0)


def _adaptive_text(gray: np.ndarray) -> np.ndarray:
    sharpened = _enhance_gray(gray)
    thresholded = cv2.adaptiveThreshold(
        sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        51,
        11,
    )
    return _remove_tiny_noise(thresholded)


def _shadow_clean_text(gray: np.ndarray) -> np.ndarray:
    background = cv2.GaussianBlur(gray, (0, 0), 21)
    normalized = cv2.divide(gray, background, scale=255)
    normalized = _enhance_gray(normalized)
    _, thresholded = cv2.threshold(
        normalized,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )
    return _remove_tiny_noise(thresholded)


def _pencil_light_text(gray: np.ndarray) -> np.ndarray:
    enhanced = _enhance_gray(gray)
    gamma = 0.82
    table = np.array([((i / 255.0) ** gamma) * 255 for i in range(256)]).astype("uint8")
    return cv2.LUT(enhanced, table)


def _remove_tiny_noise(binary: np.ndarray) -> np.ndarray:
    kernel = np.ones((1, 1), np.uint8)
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    return cleaned


def _deskew(gray: np.ndarray) -> np.ndarray:
    threshold = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
    )[1]
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    threshold = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, kernel)
    coords = np.column_stack(np.where(threshold > 0))
    if coords.size == 0:
        return gray

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.25 or abs(angle) > 12:
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


def _trim_empty_borders(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    threshold = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
    )[1]
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    threshold = cv2.morphologyEx(threshold, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image

    height, width = image.shape[:2]
    min_area = max(200, int(width * height * 0.0008))
    boxes = [cv2.boundingRect(contour) for contour in contours if cv2.contourArea(contour) >= min_area]
    if not boxes:
        return image

    x1 = min(x for x, _, _, _ in boxes)
    y1 = min(y for _, y, _, _ in boxes)
    x2 = max(x + w for x, _, w, _ in boxes)
    y2 = max(y + h for _, y, _, h in boxes)

    pad = max(18, int(min(width, height) * 0.025))
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(width, x2 + pad)
    y2 = min(height, y2 + pad)

    cropped_area = (x2 - x1) * (y2 - y1)
    original_area = width * height
    if cropped_area < original_area * 0.35:
        return image
    return image[y1:y2, x1:x2]


def _ensure_min_margin(gray: np.ndarray) -> np.ndarray:
    height, width = gray.shape[:2]
    margin = max(16, int(min(height, width) * 0.018))
    return cv2.copyMakeBorder(
        gray,
        margin,
        margin,
        margin,
        margin,
        cv2.BORDER_CONSTANT,
        value=255,
    )

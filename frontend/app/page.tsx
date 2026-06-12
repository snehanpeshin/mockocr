"use client";

import {
  Clipboard,
  Crop,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  RotateCcw,
  RotateCw,
  ScanText,
  SlidersHorizontal,
  Upload
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type OcrResponse = {
  text: string;
  provider: string;
  filename: string;
};

type CropValues = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type ImageAdjustments = {
  contrast: number;
  crop: CropValues;
  rotation: number;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [rotation, setRotation] = useState(0);
  const [contrast, setContrast] = useState(112);
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  useEffect(() => {
    let isCurrent = true;
    let nextUrl: string | null = null;

    async function updateProcessedPreview() {
      if (!file || !file.type.startsWith("image/")) {
        setProcessedPreviewUrl(null);
        return;
      }

      try {
        const blob = await buildProcessedImage(file, { contrast, crop, rotation });
        if (!isCurrent) {
          return;
        }
        nextUrl = URL.createObjectURL(blob);
        setProcessedPreviewUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }
          return nextUrl;
        });
      } catch {
        if (isCurrent) {
          setProcessedPreviewUrl(null);
        }
      }
    }

    updateProcessedPreview();

    return () => {
      isCurrent = false;
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [file, crop, rotation, contrast]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setText("");
    setProvider(null);
    setMessage(null);
    setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
    setRotation(0);
    setContrast(112);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (selectedFile && selectedFile.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      setPreviewUrl(null);
    }
  }

  async function scanFile() {
    if (!file) {
      setMessage("Choose a handwritten image first.");
      return;
    }

    const formData = new FormData();
    const fileForOcr = file.type.startsWith("image/")
      ? await buildProcessedImageFile(file, { contrast, crop, rotation })
      : file;
    formData.append("file", fileForOcr);
    formData.append("provider", "textract");
    setIsScanning(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/ocr`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail ?? "OCR failed.");
      }

      const data = (await response.json()) as OcrResponse;
      setText(data.text);
      setProvider(data.provider);
      setMessage(`Scanned ${data.filename}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OCR failed.");
    } finally {
      setIsScanning(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setMessage("Copied to clipboard.");
  }

  async function downloadExport(format: "txt" | "docx") {
    const response = await fetch(`${API_BASE}/api/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      setMessage(`Could not export ${format.toUpperCase()}.`);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `handwriting-ocr-output.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFile(null);
    setText("");
    setProvider(null);
    setMessage(null);
    setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
    setRotation(0);
    setContrast(112);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (processedPreviewUrl) {
      URL.revokeObjectURL(processedPreviewUrl);
      setProcessedPreviewUrl(null);
    }
  }

  function updateCrop(side: keyof typeof crop, value: number) {
    setCrop((currentCrop) => ({ ...currentCrop, [side]: value }));
  }

  function rotateLeft() {
    setRotation((currentRotation) => (currentRotation + 270) % 360);
  }

  function rotateRight() {
    setRotation((currentRotation) => (currentRotation + 90) % 360);
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Workspace header">
        <div>
          <p className="eyebrow">Handwriting OCR</p>
          <h1>Scan notes into editable text</h1>
        </div>
        <div className="status-strip">
          <span>{provider ? `OCR: ${provider}` : "OCR: ready"}</span>
          <span>{wordCount} words</span>
        </div>
      </section>

      <section className="workspace">
        <div className="upload-panel">
          <label className="drop-zone">
            <input
              accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,application/pdf"
              onChange={handleFileChange}
              type="file"
            />
            {previewUrl || processedPreviewUrl ? (
              <img
                alt="Uploaded handwriting preview"
                src={processedPreviewUrl ?? previewUrl ?? undefined}
              />
            ) : (
              <div className="empty-state">
                <ImagePlus aria-hidden="true" size={42} />
                <strong>Upload handwriting</strong>
                <span>PNG, JPG, WEBP, TIFF, BMP, or PDF</span>
              </div>
            )}
          </label>

          {file?.type.startsWith("image/") ? (
            <div className="scan-controls" aria-label="Scan cleanup controls">
              <div className="control-header">
                <Crop aria-hidden="true" size={18} />
                <span>Crop</span>
              </div>
              <div className="crop-grid">
                {(["top", "right", "bottom", "left"] as const).map((side) => (
                  <label key={side}>
                    <span>{side}</span>
                    <input
                      max="35"
                      min="0"
                      onChange={(event) => updateCrop(side, Number(event.target.value))}
                      type="range"
                      value={crop[side]}
                    />
                  </label>
                ))}
              </div>
              <div className="control-row">
                <div className="control-header">
                  <SlidersHorizontal aria-hidden="true" size={18} />
                  <span>Contrast</span>
                </div>
                <input
                  max="180"
                  min="80"
                  onChange={(event) => setContrast(Number(event.target.value))}
                  type="range"
                  value={contrast}
                />
              </div>
              <div className="rotate-row">
                <button onClick={rotateLeft} type="button">
                  <RotateCcw aria-hidden="true" size={18} />
                  <span>Left</span>
                </button>
                <span>{rotation} deg</span>
                <button onClick={rotateRight} type="button">
                  <RotateCw aria-hidden="true" size={18} />
                  <span>Right</span>
                </button>
              </div>
            </div>
          ) : null}

          <div className="toolbar" aria-label="Scan tools">
            <div className="provider-badge" aria-label="OCR provider">
              <span>OCR</span>
              <strong>Amazon Textract</strong>
            </div>
            <button className="primary" disabled={isScanning} onClick={scanFile}>
              {isScanning ? (
                <Loader2 className="spin" aria-hidden="true" size={18} />
              ) : (
                <ScanText aria-hidden="true" size={18} />
              )}
              <span>{isScanning ? "Scanning" : "Scan"}</span>
            </button>
            <button onClick={reset} type="button">
              <RotateCcw aria-hidden="true" size={18} />
              <span>Reset</span>
            </button>
          </div>

          {file ? (
            <div className="file-row">
              <Upload aria-hidden="true" size={18} />
              <span>{file.name}</span>
            </div>
          ) : null}
        </div>

        <div className="editor-panel">
          <div className="editor-header">
            <div>
              <p className="eyebrow">Result editor</p>
              <h2>Extracted text</h2>
            </div>
            <div className="icon-actions" aria-label="Export tools">
              <button disabled={!text} onClick={copyText} title="Copy text">
                <Clipboard aria-hidden="true" size={18} />
              </button>
              <button disabled={!text} onClick={() => downloadExport("txt")} title="Download TXT">
                <FileText aria-hidden="true" size={18} />
              </button>
              <button disabled={!text} onClick={() => downloadExport("docx")} title="Download DOCX">
                <Download aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          <textarea
            aria-label="Editable extracted text"
            onChange={(event) => setText(event.target.value)}
            placeholder="Extracted handwriting will appear here."
            value={text}
          />

          {message ? <p className="message">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}

async function buildProcessedImageFile(file: File, adjustments: ImageAdjustments): Promise<File> {
  const blob = await buildProcessedImage(file, adjustments);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "scan";
  return new File([blob], `${baseName}-cleaned.png`, { type: "image/png" });
}

async function buildProcessedImage(file: File, adjustments: ImageAdjustments): Promise<Blob> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare image.");
  }

  const cropBox = getCropBox(image.naturalWidth, image.naturalHeight, adjustments.crop);
  const rotation = adjustments.rotation;
  const isSideways = rotation === 90 || rotation === 270;
  canvas.width = isSideways ? cropBox.height : cropBox.width;
  canvas.height = isSideways ? cropBox.width : cropBox.height;

  context.save();
  context.filter = `contrast(${adjustments.contrast}%) grayscale(100%)`;
  if (rotation === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else if (rotation === 270) {
    context.translate(0, canvas.height);
    context.rotate((3 * Math.PI) / 2);
  }

  context.drawImage(
    image,
    cropBox.x,
    cropBox.y,
    cropBox.width,
    cropBox.height,
    0,
    0,
    cropBox.width,
    cropBox.height
  );
  context.restore();

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not prepare image."));
      }
    }, "image/png");
  });

  function getCropBox(width: number, height: number, crop: CropValues) {
    const left = Math.round((width * crop.left) / 100);
    const right = Math.round((width * crop.right) / 100);
    const top = Math.round((height * crop.top) / 100);
    const bottom = Math.round((height * crop.bottom) / 100);
    return {
      x: left,
      y: top,
      width: Math.max(1, width - left - right),
      height: Math.max(1, height - top - bottom)
    };
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;

  try {
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

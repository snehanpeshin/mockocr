"use client";

import {
  Clipboard,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanText,
  Upload
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type OcrResponse = {
  text: string;
  provider: string;
  filename: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setText("");
    setProvider(null);
    setMessage(null);

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
    formData.append("file", file);
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
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
            {previewUrl ? (
              <img alt="Uploaded handwriting preview" src={previewUrl} />
            ) : (
              <div className="empty-state">
                <ImagePlus aria-hidden="true" size={42} />
                <strong>Upload handwriting</strong>
                <span>PNG, JPG, WEBP, TIFF, BMP, or PDF</span>
              </div>
            )}
          </label>

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

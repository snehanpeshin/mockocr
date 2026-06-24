"use client";

import {
  Clipboard,
  Check,
  Crop,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
  ScanText,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const SAVED_NOTES_KEY = "cleanote.savedNotes";
const LEGACY_SAVED_NOTES_KEY = "pen2txt.savedNotes";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type OcrResponse = {
  text: string;
  provider: string;
  filename: string;
  subject: string;
  context_text?: string;
};

type SavedNote = {
  id: string;
  createdAt: string;
  filename: string;
  provider: string;
  subject: string;
  text: string;
  contextText?: string;
};

type BetaAccess = {
  beta_access?: boolean;
  email?: string;
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

const SUBJECTS = [
  { label: "General", value: "general" },
  { label: "Biology", value: "biology" },
  { label: "Chemistry", value: "chemistry" },
  { label: "Math", value: "math" },
  { label: "Engineering", value: "engineering" },
  { label: "Medicine", value: "medicine" },
  { label: "Research", value: "research" }
];

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [rotation, setRotation] = useState(0);
  const [contrast, setContrast] = useState(112);
  const [subject, setSubject] = useState("general");
  const [contextText, setContextText] = useState("");
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [cloudNotes, setCloudNotes] = useState<SavedNote[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [isScanning, setIsScanning] = useState(false);
  const [isSearchingArchive, setIsSearchingArchive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const file = files[activeFileIndex] ?? null;
  const previewUrl = previewUrls[activeFileIndex] ?? null;

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  const archiveNotes = useMemo(() => {
    const notesById = new Map<string, SavedNote>();
    [...cloudNotes, ...savedNotes].forEach((note) => {
      notesById.set(note.id, note);
    });
    return Array.from(notesById.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [cloudNotes, savedNotes]);

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return archiveNotes.slice(0, 8);
    }

    return archiveNotes
      .filter((note) => {
        const haystack =
          `${note.filename} ${note.subject} ${note.contextText ?? ""} ${note.text}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [archiveNotes, searchQuery]);

  useEffect(() => {
    try {
      const betaAccess = window.localStorage.getItem("cleanote.betaAccess");
      const parsedAccess = betaAccess ? (JSON.parse(betaAccess) as BetaAccess) : null;
      setUserEmail(parsedAccess?.beta_access && parsedAccess.email ? parsedAccess.email : null);
      const storedNotes =
        window.localStorage.getItem(SAVED_NOTES_KEY) ??
        window.localStorage.getItem(LEGACY_SAVED_NOTES_KEY);
      if (storedNotes) {
        const parsedNotes = JSON.parse(storedNotes) as SavedNote[];
        setSavedNotes(parsedNotes);
        window.localStorage.setItem(SAVED_NOTES_KEY, JSON.stringify(parsedNotes));
      }
    } catch {
      setSavedNotes([]);
    }
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setCloudNotes([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      email: userEmail,
      q: searchQuery.trim(),
      limit: "30"
    });
    setIsSearchingArchive(true);

    fetch(`${API_BASE}/api/notes/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Cloud note search is unavailable.");
        }
        return response.json();
      })
      .then((data: { notes?: SavedNote[] }) => {
        setCloudNotes(data.notes ?? []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setCloudNotes([]);
      })
      .finally(() => setIsSearchingArchive(false));

    return () => controller.abort();
  }, [searchQuery, userEmail]);

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
    const selectedFiles = Array.from(event.target.files ?? []);
    const oversizedFiles = selectedFiles.filter((selectedFile) => selectedFile.size > MAX_UPLOAD_BYTES);
    const validFiles = selectedFiles.filter((selectedFile) => selectedFile.size <= MAX_UPLOAD_BYTES);

    if (oversizedFiles.length) {
      setMessage("Files over 50 MB are too large. Use a clearer, smaller photo for faster OCR.");
    } else {
      setMessage(null);
    }

    setActiveFileIndex(0);
    setText("");
    setProvider(null);
    setFilename(null);
    setCurrentNoteId(null);
    setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
    setRotation(0);
    setContrast(112);

    previewUrls.forEach((url) => URL.revokeObjectURL(url));

    setFiles(validFiles);
    setPreviewUrls(
      validFiles.map((selectedFile) =>
        selectedFile.type.startsWith("image/") || isPdfFile(selectedFile)
          ? URL.createObjectURL(selectedFile)
          : ""
      )
    );
    event.target.value = "";
  }

  async function scanFile() {
    if (!files.length) {
      setMessage("Choose one or more images, PDFs, or DOCX files first.");
      return;
    }

    setIsScanning(true);
    setMessage(null);

    try {
      const results: OcrResponse[] = [];

      for (const selectedFile of files) {
        const formData = new FormData();
        const fileForOcr = selectedFile.type.startsWith("image/")
          ? await buildProcessedImageFile(selectedFile, { contrast, crop, rotation })
          : selectedFile;
        formData.append("file", fileForOcr);
        formData.append("provider", "textract");
        formData.append("subject", subject);
        formData.append("context_text", contextText);

        const response = await fetch(`${API_BASE}/api/ocr`, {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, `OCR failed for ${selectedFile.name}.`));
        }

        results.push((await response.json()) as OcrResponse);
      }

      const combinedText = results
        .map((result, index) =>
          results.length > 1 ? `Page ${index + 1}: ${result.filename}\n\n${result.text}` : result.text
        )
        .join("\n\n---\n\n");
      const noteFilename = results.length > 1 ? `${results.length} page scan` : results[0].filename;
      setText(combinedText);
      setProvider(results[0].provider);
      setFilename(noteFilename);
      const noteId = crypto.randomUUID();
      setCurrentNoteId(noteId);
      saveNote({
        id: noteId,
        createdAt: new Date().toISOString(),
        filename: noteFilename,
        provider: results[0].provider,
        subject: results[0].subject || subject,
        text: combinedText,
        contextText: contextText.trim()
      });
      setMessage(
        results.length > 1
          ? `Text extracted successfully from ${results.length} pages.`
          : `Text extracted successfully from ${noteFilename}.`
      );
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

  async function downloadExport(format: "txt" | "docx" | "pdf") {
    if (format === "pdf") {
      downloadBlob(buildSimplePdf(text), "cleanote-output.pdf");
      setMessage("Downloaded PDF.");
      return;
    }

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
    downloadBlob(blob, `cleanote-output.${format}`);
  }

  function downloadBlob(blob: Blob, downloadName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setText("");
    setProvider(null);
    setFilename(null);
    setCurrentNoteId(null);
    setMessage(null);
    setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
    setRotation(0);
    setContrast(112);
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setFiles([]);
    setActiveFileIndex(0);
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

  function saveNote(note: SavedNote) {
    setSavedNotes((currentNotes) => {
      const nextNotes = [
        note,
        ...currentNotes.filter((currentNote) => currentNote.id !== note.id)
      ].slice(0, 30);
      window.localStorage.setItem(SAVED_NOTES_KEY, JSON.stringify(nextNotes));
      return nextNotes;
    });
    if (userEmail) {
      void syncNoteToCloud(note, userEmail).catch(() => undefined);
    }
  }

  function saveCurrentNote() {
    if (!text.trim()) {
      setMessage("There is no text to save yet.");
      return;
    }

    const noteId = currentNoteId ?? crypto.randomUUID();
    const noteFilename = filename ?? createNoteTitle(subject);
    setCurrentNoteId(noteId);
    saveNote({
      id: noteId,
      createdAt: new Date().toISOString(),
      filename: noteFilename,
      provider: provider ?? "edited",
      subject,
      text,
      contextText: contextText.trim()
    });
    setFilename(noteFilename);
    setSaveStatus("saved");
    window.setTimeout(() => setSaveStatus("idle"), 1400);
    setMessage(userEmail ? "Saved note for cloud search." : "Saved note for local search.");
  }

  function clearEditor() {
    setText("");
    setProvider(null);
    setFilename(null);
    setCurrentNoteId(null);
    setMessage("Editor cleared.");
  }

  function openSavedNote(note: SavedNote) {
    setText(note.text);
    setProvider(note.provider);
    setFilename(note.filename);
    setSubject(note.subject);
    setContextText(note.contextText ?? "");
    setCurrentNoteId(note.id);
    setMessage(`Opened ${note.filename}`);
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Workspace header">
        <div>
          <p className="eyebrow">Cleanote</p>
          <h1>Scan notes into editable text</h1>
          <p className="company-line">Cleanote, a product of Karigari Home LLC</p>
          <div className="topbar-links">
            <a className="policy-link" href="/billing">Premium</a>
            <a className="policy-link" href="/privacy">Privacy Policy</a>
            <a className="policy-link" href="/refund">Refund Policy</a>
          </div>
        </div>
        <div className="status-strip">
          <span>{provider ? `OCR: ${provider}` : "OCR: ready"}</span>
          <span>{wordCount} words</span>
        </div>
      </section>

      <section className="premium-banner" aria-label="Cleanote Premium">
        <div>
          <strong>Premium is optional during launch</strong>
          <span>Keep scanning for free, or support Cleanote with Monthly Premium $9.99 or Annual Premium $99.</span>
        </div>
        <div className="premium-actions">
          <a href="/billing">View plans</a>
          <a href="/refund">Refund policy</a>
        </div>
      </section>

      <section className="workspace">
        <div className="upload-panel">
          <label className={`drop-zone ${file && isPdfFile(file) ? "pdf-drop-zone" : ""}`}>
            <input
              accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              multiple
              onChange={handleFileChange}
              type="file"
            />
            {file?.type.startsWith("image/") && (previewUrl || processedPreviewUrl) ? (
              <img
                alt="Uploaded handwriting preview"
                src={processedPreviewUrl ?? previewUrl ?? undefined}
              />
            ) : file && isPdfFile(file) && previewUrl ? (
              <object
                aria-label={`PDF preview for ${file.name}`}
                className="pdf-preview"
                data={`${previewUrl}#toolbar=0&navpanes=0&page=1&zoom=page-fit`}
                type="application/pdf"
              >
                <div className="file-preview-card">
                  <FileText aria-hidden="true" size={38} />
                  <strong>{file.name}</strong>
                  <span>PDF · {formatFileSize(file.size)}</span>
                  <p>PDF preview is not available in this browser. Cleanote will scan the first page.</p>
                </div>
              </object>
            ) : file ? (
              <div className="file-preview-card">
                <FileText aria-hidden="true" size={38} />
                <strong>{file.name}</strong>
                <span>{fileKind(file)} · {formatFileSize(file.size)}</span>
                <p>
                  {isDocxFile(file)
                    ? "DOCX files do not render a visual page preview in the browser. Cleanote will extract the document text when you scan."
                    : "PDF selected. Cleanote will scan the first page for OCR."}
                </p>
              </div>
            ) : (
              <div className="empty-state">
                <ImagePlus aria-hidden="true" size={42} />
                <strong>Upload notes</strong>
                <span>Images, PDFs, or DOCX files</span>
              </div>
            )}
          </label>

          {files.length ? (
            <div className="page-strip" aria-label="Selected pages">
              {files.map((selectedFile, index) => (
                <button
                  className={index === activeFileIndex ? "active" : ""}
                  key={`${selectedFile.name}-${index}`}
                  onClick={() => setActiveFileIndex(index)}
                  type="button"
                >
                  <span>Page {index + 1}</span>
                  <strong>{selectedFile.name}</strong>
                </button>
              ))}
            </div>
          ) : null}

          {file?.type.startsWith("image/") ? (
            <div className="scan-controls" aria-label="Scan cleanup controls">
              <p className="scan-tip">
                Crop is optional. Use a bright, flat photo with dark handwriting for better results.
              </p>
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
              <span>
                {isScanning
                  ? "Scanning"
                  : files.length > 1
                    ? "Scan all"
                    : "Scan"}
              </span>
            </button>
            <button onClick={reset} type="button">
              <RotateCcw aria-hidden="true" size={18} />
              <span>Reset</span>
            </button>
          </div>

          {file ? (
            <div className="file-row">
              <Upload aria-hidden="true" size={18} />
              <span>{files.length > 1 ? `${files.length} files selected` : file.name}</span>
            </div>
          ) : null}

          <label className="subject-select">
            <span>Subject</span>
            <select onChange={(event) => setSubject(event.target.value)} value={subject}>
              {SUBJECTS.map((subjectOption) => (
                <option key={subjectOption.value} value={subjectOption.value}>
                  {subjectOption.label}
                </option>
              ))}
            </select>
          </label>

          <label className="context-box">
            <span>Context</span>
            <textarea
              onChange={(event) => setContextText(event.target.value)}
              placeholder="Optional: what is this note about? Example: biology lecture on ATP and glycolysis."
              value={contextText}
            />
          </label>

          <div className="saved-notes-panel">
            <div className="saved-header">
              <div>
                <p className="eyebrow">Archive</p>
                <h2>Search saved notes</h2>
              </div>
              <span>{archiveNotes.length}</span>
            </div>
            <label className="search-box">
              <Search aria-hidden="true" size={18} />
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={userEmail ? "Search cloud notes" : "Search local notes"}
                value={searchQuery}
              />
              {searchQuery ? (
                <button onClick={() => setSearchQuery("")} type="button">
                  Clear
                </button>
              ) : null}
            </label>
            <div className="saved-list">
              {filteredNotes.length ? (
                filteredNotes.map((note) => (
                  <button key={note.id} onClick={() => openSavedNote(note)} type="button">
                    <strong>{note.filename}</strong>
                    <span>{note.subject} · {new Date(note.createdAt).toLocaleDateString()}</span>
                  </button>
                ))
              ) : (
                <p>
                  {isSearchingArchive
                    ? "Searching notes..."
                    : searchQuery
                      ? "No matching notes found. Clear search to view all saved notes."
                      : "No saved notes yet."}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-header">
            <div>
              <p className="eyebrow">Result editor</p>
              <h2>Extracted text</h2>
            </div>
            <div className="icon-actions" aria-label="Export tools">
              <button
                className={saveStatus === "saved" ? "saved-action" : ""}
                disabled={!text}
                onClick={saveCurrentNote}
                title={saveStatus === "saved" ? "Saved" : "Save searchable note"}
              >
                {saveStatus === "saved" ? (
                  <Check aria-hidden="true" size={18} />
                ) : (
                  <Save aria-hidden="true" size={18} />
                )}
              </button>
              <button disabled={!text} onClick={clearEditor} title="Clear editor">
                <Trash2 aria-hidden="true" size={18} />
              </button>
              <button disabled={!text} onClick={copyText} title="Copy text">
                <Clipboard aria-hidden="true" size={18} />
              </button>
              <button disabled={!text} onClick={() => downloadExport("txt")} title="Download TXT">
                <FileText aria-hidden="true" size={18} />
              </button>
              <button disabled={!text} onClick={() => downloadExport("docx")} title="Download DOCX">
                <Download aria-hidden="true" size={18} />
              </button>
              <button disabled={!text} onClick={() => downloadExport("pdf")} title="Download PDF">
                <FileText aria-hidden="true" size={18} />
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
          {filename ? <p className="message">Current note: {filename}</p> : null}
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

async function syncNoteToCloud(note: SavedNote, email: string) {
  await fetch(`${API_BASE}/api/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...note, email })
  });
}

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const error = await response.json();
      return error.detail ?? fallback;
    } catch {
      return fallback;
    }
  }

  const text = await response.text();
  return text.trim() || fallback;
}

function createNoteTitle(subject: string) {
  const date = new Date();
  const datePart = date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${subject} note ${datePart} ${timePart}`;
}

function fileKind(file: File) {
  if (isPdfFile(file)) {
    return "PDF";
  }
  if (isDocxFile(file)) {
    return "DOCX";
  }
  if (file.type.startsWith("image/")) {
    return "Image";
  }
  return "File";
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isDocxFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSimplePdf(text: string) {
  const lines = wrapPdfLines(text);
  const pages = chunkLines(lines, 48);
  const fontObjectId = 3 + pages.length * 2;
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>"];
  const pageObjectIds = pages.map((_, index) => 3 + index);
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  const contentObjects: string[] = [];
  pages.forEach((pageLines, index) => {
    const contentObjectId = 3 + pages.length + index;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    const stream = pdfTextStream(pageLines);
    contentObjects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects.push(...contentObjects);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  return new Blob([pdfFromObjects(objects)], { type: "application/pdf" });
}

function wrapPdfLines(text: string, width = 88) {
  const sourceLines = text.split(/\r?\n/) || [""];
  const wrapped: string[] = [];
  sourceLines.forEach((sourceLine) => {
    let line = sourceLine.trim();
    if (!line) {
      wrapped.push("");
      return;
    }
    while (line.length > width) {
      let splitAt = line.lastIndexOf(" ", width);
      if (splitAt < 24) {
        splitAt = width;
      }
      wrapped.push(line.slice(0, splitAt).trim());
      line = line.slice(splitAt).trim();
    }
    wrapped.push(line);
  });
  return wrapped.length ? wrapped : [""];
}

function chunkLines(lines: string[], pageSize: number) {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  return pages.length ? pages : [[""]];
}

function pdfTextStream(lines: string[]) {
  return [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "48 744 Td",
    ...lines.flatMap((line) => [`(${escapePdfString(line)}) Tj`, "T*"]),
    "ET"
  ].join("\n");
}

function escapePdfString(text: string) {
  return text
    .replace(/[^\x00-\x7F]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfFromObjects(objects: string[]) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
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

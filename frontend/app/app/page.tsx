"use client";

import {
  Camera,
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
  Star,
  Trash2,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, MutableRefObject } from "react";
import { getApiBase } from "../apiBase";
import { useAuth } from "../lib/auth";

const API_BASE = getApiBase();
const APP_STORE_URL = "https://apps.apple.com/app/cleanote/id6784403759";
const SAVED_NOTES_KEY = "cleanote.savedNotes";
const LEGACY_SAVED_NOTES_KEY = "pen2txt.savedNotes";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_SIDE = 2200;
const PROCESSED_IMAGE_QUALITY = 0.88;
const MAX_CONTEXT_LENGTH = 800;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

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
  name?: string;
  role?: string;
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

type ImageQualityRecommendation = {
  message: string;
  recommendedContrast: number;
};

type CameraQuality = {
  detail: string;
  ready: boolean;
  status: "checking" | "ready" | "warning";
};

type DocxPreviewResponse = {
  filename: string;
  html: string;
  text: string;
};

const SUBJECTS = [
  { label: "General", value: "general" },
  { label: "Kids Homework", value: "kids" },
  { label: "Biology", value: "biology" },
  { label: "Chemistry", value: "chemistry" },
  { label: "Math", value: "math" },
  { label: "Engineering", value: "engineering" },
  { label: "Medicine", value: "medicine" },
  { label: "Research", value: "research" }
];

export default function Home() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const steadyStartRef = useRef<number | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const hasAutoCapturedRef = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [rotation, setRotation] = useState(0);
  const [contrast, setContrast] = useState(112);
  const [scanRecommendation, setScanRecommendation] = useState<string | null>(null);
  const [subject, setSubject] = useState("general");
  const [contextText, setContextText] = useState("");
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [cloudNotes, setCloudNotes] = useState<SavedNote[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [isScanning, setIsScanning] = useState(false);
  const [isSearchingArchive, setIsSearchingArchive] = useState(false);
  const [docxPreviewHtml, setDocxPreviewHtml] = useState("");
  const [isLoadingDocxPreview, setIsLoadingDocxPreview] = useState(false);
  const [docxPreviewError, setDocxPreviewError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(true);
  const [cameraQuality, setCameraQuality] = useState<CameraQuality>({
    detail: "Start camera to align the page.",
    ready: false,
    status: "checking"
  });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showDiscoveryForm, setShowDiscoveryForm] = useState(false);
  const [discoveryEmail, setDiscoveryEmail] = useState("");
  const [discoveryRating, setDiscoveryRating] = useState(0);
  const [discoveryFeedback, setDiscoveryFeedback] = useState("");
  const [discoveryWorked, setDiscoveryWorked] = useState("");
  const [discoveryMissing, setDiscoveryMissing] = useState("");
  const [discoveryPayValue, setDiscoveryPayValue] = useState("");
  const [isSubmittingDiscovery, setIsSubmittingDiscovery] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const file = files[activeFileIndex] ?? null;
  const previewUrl = previewUrls[activeFileIndex] ?? null;
  const discoveryEmailError = discoveryEmail.trim()
    ? validateEmail(discoveryEmail)
    : "Email is required.";
  const canSubmitDiscovery = !discoveryEmailError && !isSubmittingDiscovery;

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
      return archiveNotes.slice(0, 30);
    }

    return archiveNotes
      .filter((note) => {
        const haystack =
          `${note.filename} ${note.subject} ${note.contextText ?? ""} ${note.text}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 30);
  }, [archiveNotes, searchQuery]);

  useEffect(() => {
    try {
      const betaAccess = window.localStorage.getItem("cleanote.betaAccess");
      const parsedAccess = betaAccess ? (JSON.parse(betaAccess) as BetaAccess) : null;
      setUserName(parsedAccess?.name ?? "");
      setUserRole(parsedAccess?.role ?? "");
      setDiscoveryEmail(parsedAccess?.email ?? "");
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
    const authenticatedEmail = user?.email?.trim().toLowerCase() ?? null;
    setUserEmail(authenticatedEmail);
    if (authenticatedEmail) {
      setDiscoveryEmail((currentEmail) => currentEmail || authenticatedEmail);
    }
  }, [user]);

  useEffect(() => {
    if (!userEmail || !user) {
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

    user.getIdToken()
      .then((token) => fetch(`${API_BASE}/api/notes/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      }))
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
  }, [searchQuery, user, userEmail]);

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

  useEffect(() => {
    if (!file || !isDocxFile(file)) {
      setDocxPreviewHtml("");
      setDocxPreviewError(null);
      setIsLoadingDocxPreview(false);
      return;
    }

    const controller = new AbortController();

    async function loadDocxPreview() {
      setDocxPreviewHtml("");
      setDocxPreviewError(null);
      setIsLoadingDocxPreview(true);

      try {
        const formData = new FormData();
        formData.append("file", file as File);

        const response = await fetch(`${API_BASE}/api/preview/docx`, {
          body: formData,
          method: "POST",
          signal: controller.signal
        });

        const payload = (await response.json()) as Partial<DocxPreviewResponse> & { detail?: string };
        if (!response.ok) {
          throw new Error(payload.detail ?? "DOCX preview is not available.");
        }
        setDocxPreviewHtml(payload.html ?? "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setDocxPreviewError(error instanceof Error ? error.message : "DOCX preview is not available.");
      } finally {
        setIsLoadingDocxPreview(false);
      }
    }

    loadDocxPreview();

    return () => controller.abort();
  }, [file]);

  useEffect(() => {
    if (!isCameraActive) {
      return undefined;
    }

    function checkFrame() {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationRef.current = window.requestAnimationFrame(checkFrame);
        return;
      }

      const quality = evaluateCameraFrame(video, previousFrameRef, steadyStartRef);
      setCameraQuality(quality);
      if (isAutoCaptureEnabled && quality.ready && !hasAutoCapturedRef.current) {
        hasAutoCapturedRef.current = true;
        void captureCameraFrame("auto");
        return;
      }

      animationRef.current = window.requestAnimationFrame(checkFrame);
    }

    animationRef.current = window.requestAnimationFrame(checkFrame);

    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isAutoCaptureEnabled, isCameraActive]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function recommendImageSettings() {
      if (!file || !file.type.startsWith("image/")) {
        setScanRecommendation(null);
        return;
      }

      try {
        const recommendation = await analyzeImageQuality(file);
        if (!isCurrent) {
          return;
        }
        setContrast(recommendation.recommendedContrast);
        setScanRecommendation(recommendation.message);
      } catch {
        if (isCurrent) {
          setScanRecommendation(
            "Auto check could not read this preview. Use a bright, flat image for best OCR."
          );
        }
      }
    }

    recommendImageSettings();

    return () => {
      isCurrent = false;
    };
  }, [file]);

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
    setScanRecommendation(null);
    setDocxPreviewHtml("");
    setDocxPreviewError(null);
    setIsLoadingDocxPreview(false);

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

  async function startCamera() {
    setCameraError(null);
    setCameraQuality({
      detail: "Opening camera...",
      ready: false,
      status: "checking"
    });

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not available in this browser.");
      return;
    }

    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          height: { ideal: 1440 },
          width: { ideal: 1920 }
        }
      });

      streamRef.current = stream;
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      previousFrameRef.current = null;
      steadyStartRef.current = null;
      hasAutoCapturedRef.current = false;
    } catch (error) {
      setCameraError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow camera access to use guided capture."
          : "Could not open the camera. Try uploading a photo instead."
      );
      stopCamera();
    }
  }

  function stopCamera() {
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    previousFrameRef.current = null;
    steadyStartRef.current = null;
    hasAutoCapturedRef.current = false;
    setIsCameraActive(false);
  }

  async function captureCameraFrame(mode: "auto" | "manual" = "manual") {
    const video = videoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      setCameraError("Camera preview is not ready yet.");
      hasAutoCapturedRef.current = false;
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture this camera frame.");
      hasAutoCapturedRef.current = false;
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.94)
    );

    if (!blob) {
      setCameraError("Could not save this camera frame.");
      hasAutoCapturedRef.current = false;
      return;
    }

    const capturedFile = new File([blob], `cleanote-camera-${Date.now()}.jpg`, {
      type: "image/jpeg"
    });
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setFiles([capturedFile]);
    setPreviewUrls([URL.createObjectURL(capturedFile)]);
    setActiveFileIndex(0);
    setText("");
    setProvider(null);
    setFilename(null);
    setCurrentNoteId(null);
    setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
    setRotation(0);
    setContrast(132);
    setScanRecommendation(
      mode === "auto"
        ? "Guided capture saved a steady frame. Review the crop/contrast, then scan."
        : "Camera frame captured. Review the crop/contrast, then scan."
    );
    setMessage(mode === "auto" ? "Auto-captured a steady page." : "Camera photo captured.");
    stopCamera();
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
      setShowDiscoveryForm(true);
      setDiscoveryMessage(null);
      setDiscoveryEmail((currentEmail) => currentEmail || userEmail || "");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "OCR failed.";
      setMessage(
        errorMessage === "Failed to fetch"
          ? `Failed to fetch from ${API_BASE}. Try a smaller/clearer image first; large scans or long PDFs can time out before the backend returns.`
          : errorMessage
      );
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
    stopCamera();
    setText("");
    setProvider(null);
    setFilename(null);
    setCurrentNoteId(null);
    setMessage(null);
    setSubject("general");
    setContextText("");
    setCrop({ top: 0, right: 0, bottom: 0, left: 0 });
    setRotation(0);
    setContrast(112);
    setScanRecommendation(null);
    setDocxPreviewHtml("");
    setDocxPreviewError(null);
    setIsLoadingDocxPreview(false);
    setShowDiscoveryForm(false);
    setDiscoveryMessage(null);
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
    if (userEmail && user) {
      void user.getIdToken()
        .then((token) => syncNoteToCloud(note, userEmail, token))
        .then(() => setMessage("Saved locally and to your signed-in cloud archive."))
        .catch(() => setMessage("Saved locally. Cloud saving is currently unavailable."));
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
    setMessage(userEmail ? "Saved locally. Syncing your signed-in cloud copy..." : "Saved note for local search.");
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

  function deleteSavedNote(note: SavedNote) {
    const confirmed = window.confirm(`Delete "${note.filename}" from saved notes?`);
    if (!confirmed) {
      return;
    }

    setSavedNotes((currentNotes) => {
      const nextNotes = currentNotes.filter((currentNote) => currentNote.id !== note.id);
      window.localStorage.setItem(SAVED_NOTES_KEY, JSON.stringify(nextNotes));
      return nextNotes;
    });
    setCloudNotes((currentNotes) => currentNotes.filter((currentNote) => currentNote.id !== note.id));

    if (currentNoteId === note.id) {
      setText("");
      setProvider(null);
      setFilename(null);
      setCurrentNoteId(null);
    }

    if (userEmail && user) {
      void user.getIdToken()
        .then((token) => deleteCloudNote(note.id, userEmail, token))
        .then(() => setMessage("Saved note deleted locally and from your cloud archive."))
        .catch(() => setMessage("Deleted locally. Cloud deletion is currently unavailable."));
    }
    setMessage(userEmail ? "Deleted locally. Updating your cloud archive..." : "Saved note deleted locally.");
  }

  async function submitDiscovery() {
    const emailError = validateEmail(discoveryEmail);
    if (emailError) {
      setDiscoveryMessage(null);
      return;
    }

    setIsSubmittingDiscovery(true);
    setDiscoveryMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/beta/discovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: discoveryEmail,
          name: userName,
          role: userRole,
          source: "post_scan",
          note_filename: filename ?? file?.name ?? "",
          subject,
          word_count: wordCount,
          rating: discoveryRating,
          feedback: discoveryFeedback,
          worked: discoveryWorked,
          missing: discoveryMissing,
          pay_value: discoveryPayValue
        })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Could not save feedback."));
      }

      setDiscoveryWorked("");
      setDiscoveryMissing("");
      setDiscoveryPayValue("");
      setDiscoveryFeedback("");
      setDiscoveryRating(0);
      setShowDiscoveryForm(false);
      setDiscoveryMessage("Thanks. Your feedback was saved.");
    } catch (error) {
      setDiscoveryMessage(error instanceof Error ? error.message : "Could not save feedback.");
    } finally {
      setIsSubmittingDiscovery(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Workspace header">
        <div className="app-title-lockup">
          <a className="app-back-home" href="/">Back to Home</a>
          <img className="app-header-logo" alt="" src="/cleanote-icon.png" />
          <div className="app-title-copy">
            <p className="eyebrow">Cleanote</p>
            <h1>Scan notes into editable text</h1>
            <p className="company-line">Cleanote, a product of Karigari Home LLC</p>
          </div>
        </div>
        <div className="status-strip">
          <span>{provider ? `OCR: ${provider}` : "OCR: ready"}</span>
          <span>{wordCount} words</span>
        </div>
      </section>

      <section className="premium-banner" aria-label="Cleanote Premium">
        <div>
          <strong>Cleanote for iPhone is available now</strong>
          <span>Download the paid iOS app from the App Store for a one-time $0.99 purchase.</span>
        </div>
        <div className="premium-actions">
          <a href={APP_STORE_URL} rel="noreferrer" target="_blank">Download app</a>
          <a href="/refund">Refund policy</a>
        </div>
      </section>

      <section className="workspace">
        <div className="upload-panel">
          <section className="camera-capture-panel" aria-label="Guided camera capture">
            <div className="camera-capture-header">
              <div>
                <p className="eyebrow">Guided capture</p>
                <h2>Auto-capture a steady page</h2>
              </div>
              <div className="camera-actions">
                <button
                  className={isCameraActive ? "" : "primary"}
                  onClick={isCameraActive ? stopCamera : startCamera}
                  type="button"
                >
                  <Camera aria-hidden="true" size={18} />
                  <span>{isCameraActive ? "Close camera" : "Start camera"}</span>
                </button>
              </div>
            </div>

            {isCameraActive ? (
              <div className="camera-preview-shell">
                <video
                  aria-label="Live camera preview"
                  muted
                  playsInline
                  ref={videoRef}
                />
                <div className="camera-page-frame" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className={`camera-quality ${cameraQuality.status}`}>
                  {cameraQuality.detail}
                </div>
              </div>
            ) : (
              <p className="camera-capture-copy">
                Align the paper or 8.5-inch tablet inside the frame. Cleanote watches lighting,
                sharpness, and movement, then captures when the page is steady.
              </p>
            )}

            <div className="camera-capture-footer">
              <label className="camera-toggle">
                <input
                  checked={isAutoCaptureEnabled}
                  onChange={(event) => setIsAutoCaptureEnabled(event.target.checked)}
                  type="checkbox"
                />
                <span>Auto-capture when steady</span>
              </label>
              <button disabled={!isCameraActive} onClick={() => captureCameraFrame("manual")} type="button">
                Capture now
              </button>
            </div>
            {cameraError ? <p className="camera-error">{cameraError}</p> : null}
          </section>

          <label
            className={`drop-zone ${file && isPdfFile(file) ? "pdf-drop-zone" : ""} ${
              file && isDocxFile(file) ? "docx-drop-zone" : ""
            }`}
          >
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
                  <p>PDF preview is not available in this browser. Cleanote will scan the document pages.</p>
                </div>
              </object>
            ) : file && isDocxFile(file) ? (
              <div className="docx-preview-shell">
                {isLoadingDocxPreview ? (
                  <div className="file-preview-card">
                    <Loader2 aria-hidden="true" className="spin" size={38} />
                    <strong>{file.name}</strong>
                    <span>Preparing DOCX preview...</span>
                  </div>
                ) : docxPreviewHtml ? (
                  <article
                    aria-label={`DOCX preview for ${file.name}`}
                    className="docx-preview-page"
                    dangerouslySetInnerHTML={{ __html: docxPreviewHtml }}
                  />
                ) : (
                  <div className="file-preview-card">
                    <FileText aria-hidden="true" size={38} />
                    <strong>{file.name}</strong>
                    <span>DOCX · {formatFileSize(file.size)}</span>
                    <p>
                      {docxPreviewError ??
                        "DOCX preview is not available, but Cleanote can still extract the document text when you scan."}
                    </p>
                  </div>
                )}
              </div>
            ) : file ? (
              <div className="file-preview-card">
                <FileText aria-hidden="true" size={38} />
                <strong>{file.name}</strong>
                <span>{fileKind(file)} · {formatFileSize(file.size)}</span>
                <p>Cleanote will scan this file for OCR.</p>
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
                Crop is optional. Cleanote now tests several cleanup versions automatically, but a bright,
                flat photo with dark handwriting still gives the best result.
              </p>
              {scanRecommendation ? (
                <p className="scan-recommendation">{scanRecommendation}</p>
              ) : null}
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
              maxLength={MAX_CONTEXT_LENGTH}
              onChange={(event) => setContextText(event.target.value)}
              placeholder="Optional: what is this note about? Example: biology lecture on ATP and glycolysis."
              value={contextText}
            />
            <small>{contextText.length}/{MAX_CONTEXT_LENGTH}</small>
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
                  <article className="saved-note-row" key={note.id}>
                    <button onClick={() => openSavedNote(note)} type="button">
                      <strong>{note.filename}</strong>
                      <span>{note.subject} · {new Date(note.createdAt).toLocaleDateString()}</span>
                    </button>
                    <button
                      aria-label={`Delete ${note.filename}`}
                      className="saved-delete-button"
                      onClick={() => deleteSavedNote(note)}
                      title="Delete saved note"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </article>
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
          {filename ? <p className="note-reference">Current note: {filename}</p> : null}
          {showDiscoveryForm ? (
            <section className="discovery-panel" aria-label="Post-scan feedback">
              <div>
                <p className="eyebrow">Help improve Cleanote</p>
                <h3>How did this scan do?</h3>
              </div>
              <label>
                <span>Email</span>
                <input
                  aria-invalid={Boolean(discoveryEmailError)}
                  maxLength={MAX_EMAIL_LENGTH}
                  onChange={(event) => setDiscoveryEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={discoveryEmail}
                />
                {discoveryEmailError ? <small className="field-error">{discoveryEmailError}</small> : null}
              </label>
              <div className="rating-field">
                <span>Rating</span>
                <div className="star-row" aria-label="Rate this scan">
                  {[1, 2, 3, 4, 5].map((ratingValue) => (
                    <button
                      aria-label={`${ratingValue} star${ratingValue === 1 ? "" : "s"}`}
                      className={ratingValue <= discoveryRating ? "active" : ""}
                      key={ratingValue}
                      onClick={() => setDiscoveryRating(ratingValue)}
                      type="button"
                    >
                      <Star aria-hidden="true" size={20} />
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span>Quick feedback</span>
                <textarea
                  onChange={(event) => setDiscoveryFeedback(event.target.value)}
                  placeholder="Example: useful, but it missed two equations."
                  value={discoveryFeedback}
                />
              </label>
              <label>
                <span>What worked well?</span>
                <textarea
                  onChange={(event) => setDiscoveryWorked(event.target.value)}
                  placeholder="Example: headings were good, text was readable, export helped."
                  value={discoveryWorked}
                />
              </label>
              <label>
                <span>What was wrong or missing?</span>
                <textarea
                  onChange={(event) => setDiscoveryMissing(event.target.value)}
                  placeholder="Example: math symbols failed, diagram was ignored, handwriting was shortened."
                  value={discoveryMissing}
                />
              </label>
              <label>
                <span>What would make this worth paying for?</span>
                <textarea
                  onChange={(event) => setDiscoveryPayValue(event.target.value)}
                  placeholder="Example: better equations, searchable folders, multi-page PDF export."
                  value={discoveryPayValue}
                />
              </label>
              <div className="discovery-actions">
                <button disabled={!canSubmitDiscovery} onClick={submitDiscovery} type="button">
                  {isSubmittingDiscovery ? (
                    <Loader2 aria-hidden="true" className="spin" size={18} />
                  ) : (
                    <Check aria-hidden="true" size={18} />
                  )}
                  <span>{isSubmittingDiscovery ? "Saving" : "Save feedback"}</span>
                </button>
                <button onClick={() => setShowDiscoveryForm(false)} type="button">
                  Skip
                </button>
              </div>
            </section>
          ) : null}
          {discoveryMessage ? <p className="message">{discoveryMessage}</p> : null}
        </div>
      </section>
      <footer className="app-footer">
        <span>© {new Date().getFullYear()} KARIGARI HOME LLC DBA CLEANOTE. All Rights Reserved.</span>
        <nav aria-label="Scanner footer links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/delete-account">Delete account or data</a>
          <a href="/refund">Refund Policy</a>
          <a href="/support">Support</a>
          <a href="/mobile">Mobile App</a>
        </nav>
      </footer>
    </main>
  );
}

async function buildProcessedImageFile(file: File, adjustments: ImageAdjustments): Promise<File> {
  const blob = await buildProcessedImage(file, adjustments);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "scan";
  return new File([blob], `${baseName}-cleaned.jpg`, { type: "image/jpeg" });
}

async function syncNoteToCloud(note: SavedNote, email: string, token: string) {
  await fetch(`${API_BASE}/api/notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ...note, email })
  });
}

async function deleteCloudNote(noteId: string, email: string, token: string) {
  const params = new URLSearchParams({ email });
  await fetch(`${API_BASE}/api/notes/${encodeURIComponent(noteId)}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    method: "DELETE"
  });
}

function validateEmail(email: string) {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return "Email is required.";
  }
  if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    return `Email must be ${MAX_EMAIL_LENGTH} characters or fewer.`;
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return "Enter a valid email address.";
  }
  return "";
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
  const rotatedWidth = isSideways ? cropBox.height : cropBox.width;
  const rotatedHeight = isSideways ? cropBox.width : cropBox.height;
  const scale = Math.min(1, MAX_PROCESSED_IMAGE_SIDE / Math.max(rotatedWidth, rotatedHeight));
  canvas.width = Math.max(1, Math.round(rotatedWidth * scale));
  canvas.height = Math.max(1, Math.round(rotatedHeight * scale));

  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.filter = `contrast(${adjustments.contrast}%) grayscale(100%)`;
  if (rotation === 90) {
    context.translate(rotatedWidth, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(rotatedWidth, rotatedHeight);
    context.rotate(Math.PI);
  } else if (rotation === 270) {
    context.translate(0, rotatedHeight);
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
    }, "image/jpeg", PROCESSED_IMAGE_QUALITY);
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

async function analyzeImageQuality(file: File): Promise<ImageQualityRecommendation> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not inspect image.");
  }

  const sampleWidth = 180;
  const sampleHeight = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * sampleWidth));
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const luminanceValues: number[] = [];

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
    luminanceValues.push(luminance);
  }

  const average = luminanceValues.reduce((sum, value) => sum + value, 0) / luminanceValues.length;
  const variance =
    luminanceValues.reduce((sum, value) => sum + (value - average) ** 2, 0) / luminanceValues.length;
  const deviation = Math.sqrt(variance);
  const darkRatio = luminanceValues.filter((value) => value < 85).length / luminanceValues.length;
  const brightRatio = luminanceValues.filter((value) => value > 210).length / luminanceValues.length;

  if (average < 105 || darkRatio > 0.38) {
    return {
      recommendedContrast: 166,
      message: "Auto check: this image looks dark, so Cleanote raised contrast before scanning."
    };
  }

  if (deviation < 38 && brightRatio < 0.55) {
    return {
      recommendedContrast: 148,
      message: "Auto check: this image has low contrast, so Cleanote boosted text separation."
    };
  }

  if (brightRatio > 0.82 && deviation > 62) {
    return {
      recommendedContrast: 122,
      message: "Auto check: this looks well lit. A light contrast boost is enough."
    };
  }

  return {
    recommendedContrast: 132,
    message: "Auto check: image quality looks usable. Cleanote set a moderate contrast boost."
  };
}

function evaluateCameraFrame(
  video: HTMLVideoElement,
  previousFrameRef: MutableRefObject<Uint8ClampedArray | null>,
  steadyStartRef: MutableRefObject<number | null>
): CameraQuality {
  const sampleWidth = 96;
  const sampleHeight = 72;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return {
      detail: "Camera preview is not ready.",
      ready: false,
      status: "checking"
    };
  }

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  context.drawImage(video, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const luminance = new Uint8ClampedArray(sampleWidth * sampleHeight);

  let total = 0;
  for (let index = 0, pixelIndex = 0; index < pixels.length; index += 4, pixelIndex += 1) {
    const value = Math.round(
      0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]
    );
    luminance[pixelIndex] = value;
    total += value;
  }

  const average = total / luminance.length;
  const variance =
    luminance.reduce((sum, value) => sum + (value - average) ** 2, 0) / luminance.length;
  const deviation = Math.sqrt(variance);
  let edgeScore = 0;
  let edgeCount = 0;

  for (let y = 1; y < sampleHeight; y += 1) {
    for (let x = 1; x < sampleWidth; x += 1) {
      const index = y * sampleWidth + x;
      edgeScore += Math.abs(luminance[index] - luminance[index - 1]);
      edgeScore += Math.abs(luminance[index] - luminance[index - sampleWidth]);
      edgeCount += 2;
    }
  }
  edgeScore /= edgeCount;

  const previousFrame = previousFrameRef.current;
  let motionScore = 100;
  if (previousFrame) {
    let motionTotal = 0;
    for (let index = 0; index < luminance.length; index += 8) {
      motionTotal += Math.abs(luminance[index] - previousFrame[index]);
    }
    motionScore = motionTotal / (luminance.length / 8);
  }
  previousFrameRef.current = luminance;

  const now = performance.now();
  const isBrightEnough = average >= 72;
  const isNotWashedOut = average <= 232;
  const hasContrast = deviation >= 24;
  const looksSharp = edgeScore >= 8.5;
  const isStable = motionScore <= 8;

  if (!isBrightEnough) {
    steadyStartRef.current = null;
    return {
      detail: "Too dark. Move near brighter light.",
      ready: false,
      status: "warning"
    };
  }

  if (!isNotWashedOut) {
    steadyStartRef.current = null;
    return {
      detail: "Too much glare. Tilt the page slightly.",
      ready: false,
      status: "warning"
    };
  }

  if (!hasContrast || !looksSharp) {
    steadyStartRef.current = null;
    return {
      detail: "Move closer and keep the writing in focus.",
      ready: false,
      status: "checking"
    };
  }

  if (!isStable) {
    steadyStartRef.current = null;
    return {
      detail: "Hold steady inside the frame.",
      ready: false,
      status: "checking"
    };
  }

  steadyStartRef.current ??= now;
  const steadyMs = now - steadyStartRef.current;
  if (steadyMs < 1100) {
    return {
      detail: `Good. Hold steady ${Math.ceil((1100 - steadyMs) / 1000)}s.`,
      ready: false,
      status: "checking"
    };
  }

  return {
    detail: "Ready. Capturing a clear frame.",
    ready: true,
    status: "ready"
  };
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

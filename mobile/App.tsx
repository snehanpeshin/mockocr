import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useRef, useState } from "react";
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType
} from "react-native-google-mobile-ads";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  CLEANOTE_PRODUCT_IDS,
  subscriptionPrice,
  useCleanotePurchases
} from "./useCleanotePurchases";

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://mo-9f59128d1e0048feab5efaaaa71df90c.ecs.us-east-1.on.aws";

type PickedImage = {
  fileName: string;
  mimeType: string;
  uri: string;
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

type CameraQualityStatus = "waiting" | "aligning" | "steady" | "ready";

const SUBJECTS = [
  "general",
  "kids homework",
  "biology",
  "chemistry",
  "math",
  "engineering",
  "medicine",
  "research"
];

const OUTCOMES = ["Ordinary paper", "Editable text", "Review & export"];

const INSTALLATION_ID_KEY = "cleanote.installationId";
const GUIDED_CAPTURE_STEPS = ["Fill the frame", "Bright light", "Hold steady"];
const AUTO_CAPTURE_PROGRESS_STEP = 18;
const AUTO_CAPTURE_READY_THRESHOLD = 100;
const ADMOB_UNIT_IDS = {
  android: {
    banner: "ca-app-pub-6605747981994820/1494286316",
    interstitial: "ca-app-pub-6605747981994820/6178647101",
    rewarded: "ca-app-pub-6605747981994820/3330112161"
  },
  ios: {
    banner: "ca-app-pub-6605747981994820/3345434359",
    interstitial: "ca-app-pub-6605747981994820/7013216624",
    rewarded: "ca-app-pub-6605747981994820/2032352684"
  }
} as const;

function getAdUnitId(format: keyof (typeof ADMOB_UNIT_IDS)["ios"]) {
  return Platform.OS === "ios" ? ADMOB_UNIT_IDS.ios[format] : ADMOB_UNIT_IDS.android[format];
}

function createInstallationId() {
  return `mobile-${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function App() {
  const cameraRef = useRef<CameraView | null>(null);
  const interstitialAdRef = useRef<ReturnType<typeof InterstitialAd.createForAdRequest> | null>(null);
  const rewardedAdRef = useRef<ReturnType<typeof RewardedAd.createForAdRequest> | null>(null);
  const successfulScanCountRef = useRef(0);
  const autoCaptureTriggeredRef = useRef(false);
  const installationIdRef = useRef(createInstallationId());
  const [installationId, setInstallationId] = useState(installationIdRef.current);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [pickedImages, setPickedImages] = useState<PickedImage[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [subject, setSubject] = useState("general");
  const [contextText, setContextText] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isGuidedCameraOpen, setIsGuidedCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(true);
  const [cameraQualityProgress, setCameraQualityProgress] = useState(0);
  const [cameraQualityStatus, setCameraQualityStatus] = useState<CameraQualityStatus>("waiting");
  const [cameraQualityMessage, setCameraQualityMessage] = useState("Opening camera...");
  const [cleanupMode, setCleanupMode] = useState<"rules" | "bedrock">("rules");
  const [showingPaywall, setShowingPaywall] = useState(false);
  const [isInterstitialLoaded, setIsInterstitialLoaded] = useState(false);
  const [isRewardedLoaded, setIsRewardedLoaded] = useState(false);
  const [rewardedAiCleanupCredits, setRewardedAiCleanupCredits] = useState(0);
  const [message, setMessage] = useState("Choose a page to turn handwriting into searchable text.");
  const purchases = useCleanotePurchases({ apiBase: API_BASE, installationId });

  const pickedImage = pickedImages[activeImageIndex] ?? null;

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  useEffect(() => {
    void SecureStore.getItemAsync(INSTALLATION_ID_KEY)
      .then((storedId) => {
        if (storedId && storedId.length >= 16) {
          installationIdRef.current = storedId;
          setInstallationId(storedId);
          return;
        }
        setInstallationId(installationIdRef.current);
        return SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationIdRef.current);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (purchases.isPro) {
      return;
    }

    void mobileAds().initialize().catch(() => undefined);

    const interstitial = InterstitialAd.createForAdRequest(getAdUnitId("interstitial"), {
      requestNonPersonalizedAdsOnly: true
    });
    const rewarded = RewardedAd.createForAdRequest(getAdUnitId("rewarded"), {
      requestNonPersonalizedAdsOnly: true
    });

    interstitialAdRef.current = interstitial;
    rewardedAdRef.current = rewarded;

    const unsubscribeInterstitialLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () =>
      setIsInterstitialLoaded(true)
    );
    const unsubscribeInterstitialClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setIsInterstitialLoaded(false);
      interstitial.load();
    });
    const unsubscribeInterstitialError = interstitial.addAdEventListener(AdEventType.ERROR, () =>
      setIsInterstitialLoaded(false)
    );

    const unsubscribeRewardedLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () =>
      setIsRewardedLoaded(true)
    );
    const unsubscribeRewardedEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        setRewardedAiCleanupCredits((currentCredits) => currentCredits + 1);
        setMessage("Reward unlocked: one AI cleanup scan credit added.");
      }
    );
    const unsubscribeRewardedClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setIsRewardedLoaded(false);
      rewarded.load();
    });
    const unsubscribeRewardedError = rewarded.addAdEventListener(AdEventType.ERROR, () =>
      setIsRewardedLoaded(false)
    );

    interstitial.load();
    rewarded.load();

    return () => {
      unsubscribeInterstitialLoaded();
      unsubscribeInterstitialClosed();
      unsubscribeInterstitialError();
      unsubscribeRewardedLoaded();
      unsubscribeRewardedEarned();
      unsubscribeRewardedClosed();
      unsubscribeRewardedError();
      interstitialAdRef.current = null;
      rewardedAdRef.current = null;
    };
  }, [purchases.isPro]);

  useEffect(() => {
    if (!isGuidedCameraOpen) {
      setCameraQualityProgress(0);
      setCameraQualityStatus("waiting");
      setCameraQualityMessage("Opening camera...");
      autoCaptureTriggeredRef.current = false;
      return;
    }

    if (!isCameraReady) {
      setCameraQualityProgress(0);
      setCameraQualityStatus("waiting");
      setCameraQualityMessage("Opening camera...");
      return;
    }

    const interval = setInterval(() => {
      setCameraQualityProgress((currentProgress) => {
        if (isCapturing) {
          return currentProgress;
        }

        const nextProgress = Math.min(
          AUTO_CAPTURE_READY_THRESHOLD,
          currentProgress + AUTO_CAPTURE_PROGRESS_STEP
        );

        if (nextProgress < 42) {
          setCameraQualityStatus("aligning");
          setCameraQualityMessage("Move closer until the page fills the frame.");
        } else if (nextProgress < 76) {
          setCameraQualityStatus("steady");
          setCameraQualityMessage("Good frame. Hold still and avoid shadows.");
        } else {
          setCameraQualityStatus("ready");
          setCameraQualityMessage(
            isAutoCaptureEnabled ? "Ready. Auto-capturing when steady..." : "Ready for manual capture."
          );
        }

        if (
          isAutoCaptureEnabled &&
          nextProgress >= AUTO_CAPTURE_READY_THRESHOLD &&
          !autoCaptureTriggeredRef.current
        ) {
          autoCaptureTriggeredRef.current = true;
          void captureGuidedPhoto("auto");
        }

        return nextProgress;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [isAutoCaptureEnabled, isCameraReady, isCapturing, isGuidedCameraOpen]);

  function maybeShowInterstitialAfterScan() {
    if (purchases.isPro) {
      return;
    }
    successfulScanCountRef.current += 1;
    if (successfulScanCountRef.current % 2 === 0 && isInterstitialLoaded) {
      interstitialAdRef.current?.show();
    }
  }

  function showRewardedAd() {
    if (purchases.isPro) {
      setMessage("Cleanote Plus is active, so ads are hidden.");
      return;
    }
    if (!isRewardedLoaded) {
      rewardedAdRef.current?.load();
      setMessage("Rewarded ad is loading. Try again in a moment.");
      return;
    }
    rewardedAdRef.current?.show();
  }

  async function choosePhoto(source: "camera" | "library") {
    if (source === "camera") {
      await openGuidedCamera();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 0.92,
      selectionLimit: 10
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    addPickedAssets(
      result.assets.map((asset, index) => ({
        fileName: asset.fileName ?? `cleanote-scan-${Date.now()}-${index + 1}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        uri: asset.uri
      })),
      "library"
    );
  }

  async function openGuidedCamera() {
    let permission = cameraPermission;
    if (!permission?.granted) {
      permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Cleanote needs camera access to scan handwritten notes.");
        return;
      }
    }

    autoCaptureTriggeredRef.current = false;
    setCameraQualityProgress(0);
    setCameraQualityStatus("waiting");
    setCameraQualityMessage("Opening camera...");
    setIsCameraReady(false);
    setIsGuidedCameraOpen(true);
    setMessage("Align the paper inside the guide. Cleanote can auto-capture when steady.");
  }

  async function captureGuidedPhoto(mode: "auto" | "manual" = "manual") {
    if (!cameraRef.current || !isCameraReady || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setCameraQualityMessage(mode === "auto" ? "Auto-capturing page..." : "Capturing page...");
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.94,
        skipProcessing: false
      });

      addPickedAssets(
        [
          {
            fileName: `cleanote-camera-${Date.now()}.jpg`,
            mimeType: "image/jpeg",
            uri: photo.uri
          }
        ],
        "camera"
      );
      setIsGuidedCameraOpen(false);
      setIsCameraReady(false);
      setCameraQualityProgress(0);
      setCameraQualityStatus("waiting");
    } catch {
      autoCaptureTriggeredRef.current = false;
      setCameraQualityProgress(55);
      setCameraQualityStatus("steady");
      setCameraQualityMessage("Could not capture. Hold steady and try again.");
      setMessage("Could not capture the page. Try again or choose an image.");
    } finally {
      setIsCapturing(false);
    }
  }

  function addPickedAssets(nextImages: PickedImage[], source: "camera" | "library") {
    setPickedImages((currentImages) =>
      source === "camera" ? [...currentImages, nextImages[0]] : nextImages
    );
    setActiveImageIndex(source === "camera" ? pickedImages.length : 0);
    setFilename(nextImages.length > 1 ? `${nextImages.length} page scan` : nextImages[0].fileName);
    setProvider(null);
    setText("");
    setMessage(
      nextImages.length > 1
        ? `${nextImages.length} pages ready. Tap Scan all.`
        : "Photo ready. Tap Scan note."
    );
  }

  async function scanHandwriting() {
    if (!pickedImages.length) {
      setMessage("Choose or take one or more note photos first.");
      return;
    }
    if (cleanupMode === "bedrock" && !purchases.isPro && rewardedAiCleanupCredits <= 0) {
      setShowingPaywall(true);
      setMessage("AI cleanup is included with Cleanote Plus, or you can watch a rewarded ad for one AI cleanup scan.");
      return;
    }

    setIsScanning(true);
    setMessage(pickedImages.length > 1 ? "Scanning pages..." : "Scanning note...");
    let usedRewardedCleanupCredit = false;

    try {
      if (cleanupMode === "bedrock" && !purchases.isPro && rewardedAiCleanupCredits > 0) {
        usedRewardedCleanupCredit = true;
        setRewardedAiCleanupCredits((currentCredits) => Math.max(0, currentCredits - 1));
      }
      const results = [];

      for (const image of pickedImages) {
        const formData = new FormData();
        formData.append("file", {
          name: image.fileName,
          type: image.mimeType,
          uri: image.uri
        } as unknown as Blob);
        formData.append("provider", "textract");
        formData.append("subject", subject);
        formData.append("context_text", contextText);
        formData.append("cleanup_mode", cleanupMode);

        const response = await fetch(`${API_BASE}/api/ocr`, {
          body: formData,
          headers: {
            "X-Cleanote-Installation-Id": installationIdRef.current,
            "Idempotency-Key": `${installationIdRef.current}-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 12)}`
          },
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail ?? `OCR failed for ${image.fileName}.`);
        }
        results.push(payload);
      }

      const combinedText = results
        .map((payload, index) =>
          results.length > 1
            ? `Page ${index + 1}: ${payload.filename ?? pickedImages[index].fileName}\n\n${
                payload.text ?? ""
              }`
            : payload.text ?? ""
        )
        .join("\n\n---\n\n");
      const nextFilename =
        results.length > 1 ? `${results.length} page scan` : results[0].filename ?? pickedImages[0].fileName;
      setText(combinedText);
      setFilename(nextFilename);
      setProvider(results[0].provider ?? "textract");
      setMessage(
        results.length > 1
          ? `Scan complete for ${results.length} pages.`
          : "Scan complete. Edit, save, or search your note."
      );
      maybeShowInterstitialAfterScan();
    } catch (error) {
      if (usedRewardedCleanupCredit) {
        setRewardedAiCleanupCredits((currentCredits) => currentCredits + 1);
      }
      setMessage(error instanceof Error ? error.message : "OCR failed.");
    } finally {
      setIsScanning(false);
    }
  }

  async function saveNote() {
    if (!text.trim()) {
      setMessage("There is no text to save yet.");
      return;
    }

    const note: SavedNote = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      filename: filename ?? "Untitled note",
      provider: provider ?? "edited",
      subject,
      text,
      contextText: contextText.trim()
    };
    setNotes((currentNotes) => [note, ...currentNotes].slice(0, 20));

    if (email.trim()) {
      try {
        await fetch(`${API_BASE}/api/notes`, {
          body: JSON.stringify({ ...note, email: email.trim() }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
        setMessage("Saved to Cleanote cloud search.");
        return;
      } catch {
        setMessage("Saved on this device. Cloud save is unavailable.");
        return;
      }
    }

    setMessage("Saved on this device.");
  }

  async function searchNotes() {
    const query = searchQuery.trim().toLowerCase();
    if (email.trim()) {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          email: email.trim(),
          limit: "30",
          q: query
        });
        const response = await fetch(`${API_BASE}/api/notes/search?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail ?? "Cloud search failed.");
        }
        setNotes(payload.notes ?? []);
        setMessage("Cloud search updated.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Cloud search failed.");
      } finally {
        setIsSearching(false);
      }
      return;
    }

    setNotes((currentNotes) =>
      currentNotes.filter((note) => {
        const haystack =
          `${note.filename} ${note.subject} ${note.contextText ?? ""} ${note.text}`.toLowerCase();
        return haystack.includes(query);
      })
    );
  }

  function openNote(note: SavedNote) {
    setFilename(note.filename);
    setProvider(note.provider);
    setSubject(note.subject);
    setContextText(note.contextText ?? "");
    setText(note.text);
    setMessage(`Opened ${note.filename}`);
  }

  function clearImages() {
    setPickedImages([]);
    setActiveImageIndex(0);
    setFilename(null);
    setProvider(null);
    setText("");
    setMessage("Choose a page to turn handwriting into searchable text.");
  }

  function openPrivacyPolicy() {
    void Linking.openURL("https://www.cleanote.in/privacy");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {isGuidedCameraOpen ? (
        <View style={styles.cameraScreen}>
          <CameraView
            active={isGuidedCameraOpen}
            autofocus="on"
            facing="back"
            mode="picture"
            onCameraReady={() => setIsCameraReady(true)}
            onMountError={() => {
              setIsGuidedCameraOpen(false);
              setMessage("Could not open guided camera. Try choosing an image instead.");
            }}
            ref={cameraRef}
            responsiveOrientationWhenOrientationLocked
            style={styles.cameraView}
          >
            <View style={styles.cameraScrim}>
              <View style={styles.cameraTopBar}>
                <View>
                  <Text style={styles.cameraEyebrow}>Guided capture</Text>
                  <Text style={styles.cameraTitle}>Detect the full page</Text>
                </View>
                <Pressable
                  style={styles.cameraCloseButton}
                  onPress={() => {
                    setIsGuidedCameraOpen(false);
                    setIsCameraReady(false);
                    setCameraQualityProgress(0);
                    setCameraQualityStatus("waiting");
                    autoCaptureTriggeredRef.current = false;
                  }}
                >
                  <Text style={styles.cameraCloseText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.documentGuide}>
                <View style={[styles.guideCorner, styles.guideCornerTopLeft]} />
                <View style={[styles.guideCorner, styles.guideCornerTopRight]} />
                <View style={[styles.guideCorner, styles.guideCornerBottomLeft]} />
                <View style={[styles.guideCorner, styles.guideCornerBottomRight]} />
                <View
                  style={[
                    styles.dynamicScanBand,
                    cameraQualityStatus === "ready"
                      ? styles.dynamicScanBandReady
                      : cameraQualityStatus === "steady"
                        ? styles.dynamicScanBandSteady
                        : cameraQualityStatus === "aligning"
                          ? styles.dynamicScanBandAligning
                          : null
                  ]}
                />
                <Text style={styles.guideText}>
                  {cameraQualityStatus === "ready"
                    ? "Page detected"
                    : "Place all page edges inside this frame"}
                </Text>
              </View>

              <View style={styles.cameraBottomBar}>
                <View style={styles.cameraQualityCard}>
                  <View style={styles.cameraQualityHeader}>
                    <Text style={styles.cameraQualityTitle}>
                      {cameraQualityStatus === "ready"
                        ? "Ready"
                        : cameraQualityStatus === "steady"
                          ? "Almost ready"
                          : cameraQualityStatus === "aligning"
                            ? "Aligning page"
                            : "Checking camera"}
                    </Text>
                    <Text style={styles.cameraQualityPercent}>{cameraQualityProgress}%</Text>
                  </View>
                  <View style={styles.cameraProgressTrack}>
                    <View style={[styles.cameraProgressFill, { width: `${cameraQualityProgress}%` }]} />
                  </View>
                  <Text style={styles.cameraQualityMessage}>{cameraQualityMessage}</Text>
                </View>
                <View style={styles.qualityRow}>
                  {GUIDED_CAPTURE_STEPS.map((step) => (
                    <View key={step} style={styles.qualityPill}>
                      <Text style={styles.qualityDot}>•</Text>
                      <Text style={styles.qualityText}>{step}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.cameraHint}>
                  Keep the tablet or paper flat. Avoid shadows and glare before capturing.
                </Text>
                <View style={styles.autoCaptureRow}>
                  <Text style={styles.autoCaptureLabel}>Auto-capture</Text>
                  <Pressable
                    onPress={() => {
                      autoCaptureTriggeredRef.current = false;
                      setCameraQualityProgress(0);
                      setIsAutoCaptureEnabled((currentValue) => !currentValue);
                    }}
                    style={[
                      styles.autoCaptureToggle,
                      isAutoCaptureEnabled ? styles.autoCaptureToggleActive : null
                    ]}
                  >
                    <View
                      style={[
                        styles.autoCaptureKnob,
                        isAutoCaptureEnabled ? styles.autoCaptureKnobActive : null
                      ]}
                    />
                  </Pressable>
                </View>
                <Pressable
                  disabled={!isCameraReady || isCapturing}
                  onPress={() => captureGuidedPhoto("manual")}
                  style={[
                    styles.captureButton,
                    !isCameraReady || isCapturing ? styles.disabledButton : null
                  ]}
                >
                  {isCapturing ? <ActivityIndicator color="#182024" /> : null}
                  <Text style={styles.captureButtonText}>
                    {isCapturing ? "Capturing" : isCameraReady ? "Capture page" : "Opening camera"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </CameraView>
        </View>
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image source={require("./assets/icon.png")} style={styles.logo} />
              <View style={styles.brandCopy}>
                <Text style={styles.eyebrow}>Cleanote mobile</Text>
                <Text style={styles.companyLine}>A product of Karigari Home LLC</Text>
              </View>
            </View>
            <Text style={styles.title}>Turn handwritten pages into editable notes.</Text>
            <Text style={styles.subtitle}>
              Photograph ordinary paper, worksheets, and study pages. Cleanote creates a text draft
              you can review, edit, save, and search.
            </Text>
            <View style={styles.outcomeRow}>
              {OUTCOMES.map((outcome) => (
                <View key={outcome} style={styles.outcomeCard}>
                  <Text style={styles.outcomeText}>{outcome}</Text>
                </View>
              ))}
            </View>
            <Pressable onPress={openPrivacyPolicy}>
              <Text style={styles.policyLink}>Privacy Policy</Text>
            </Pressable>
          </View>

          <View style={styles.tipsPanel}>
            <Text style={styles.eyebrow}>Best scan results</Text>
            <Text style={styles.tipText}>Use bright light, keep the page flat, and fill the frame.</Text>
            <Text style={styles.tipText}>
              For long notes, scan one clear page at a time and review the OCR before relying on it.
            </Text>
          </View>

          {Platform.OS === "ios" ? (
            <View style={[styles.panel, styles.plusPanel]}>
              <View style={styles.resultHeader}>
                <View style={styles.plusHeading}>
                  <Text style={styles.eyebrow}>Cleanote Plus</Text>
                  <Text style={styles.sectionTitle}>
                    {purchases.isPro ? "Your plan is active" : "More scans and AI cleanup"}
                  </Text>
                </View>
                {purchases.isPro ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.hint}>
                {purchases.isPro
                  ? "AI cleanup and the higher monthly scan allowance are available on this device."
                  : "Standard OCR remains free within the monthly allowance. Plus supports the ongoing cloud cost of higher limits and optional AI cleanup."}
              </Text>

              {!purchases.isPro && (showingPaywall || purchases.annual || purchases.monthly) ? (
                <View style={styles.planList}>
                  <Pressable
                    disabled={purchases.isPurchasing}
                    onPress={() => purchases.purchase(CLEANOTE_PRODUCT_IDS.annual)}
                    style={styles.planButton}
                  >
                    <View>
                      <Text style={styles.planTitle}>Annual</Text>
                      <Text style={styles.planDetail}>Best value · cancel anytime</Text>
                    </View>
                    <Text style={styles.planPrice}>
                      {subscriptionPrice(purchases.annual, "$29.99/year")}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={purchases.isPurchasing}
                    onPress={() => purchases.purchase(CLEANOTE_PRODUCT_IDS.monthly)}
                    style={styles.planButton}
                  >
                    <View>
                      <Text style={styles.planTitle}>Monthly</Text>
                      <Text style={styles.planDetail}>Flexible monthly access</Text>
                    </View>
                    <Text style={styles.planPrice}>
                      {subscriptionPrice(purchases.monthly, "$4.99/month")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {!purchases.isPro && !showingPaywall ? (
                <Pressable style={styles.primaryButton} onPress={() => setShowingPaywall(true)}>
                  <Text style={styles.primaryButtonText}>See Plus options</Text>
                </Pressable>
              ) : null}

              <View style={styles.purchaseLinks}>
                <Pressable onPress={purchases.isPro ? purchases.manage : purchases.restore}>
                  <Text style={styles.policyLink}>
                    {purchases.isPro ? "Manage subscription" : "Restore purchases"}
                  </Text>
                </Pressable>
                {showingPaywall && !purchases.isPro ? (
                  <Pressable onPress={() => setShowingPaywall(false)}>
                    <Text style={styles.policyLink}>Not now</Text>
                  </Pressable>
                ) : null}
              </View>
              {purchases.isPurchasing ? <ActivityIndicator color="#17614f" /> : null}
              {purchases.purchaseMessage ? (
                <Text style={styles.message}>{purchases.purchaseMessage}</Text>
              ) : null}
              <Text style={styles.purchaseTerms}>
                Payment is charged to your Apple Account. Subscriptions renew automatically unless
                canceled at least 24 hours before the current period ends.
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={() => choosePhoto("camera")}>
              <Text style={styles.primaryButtonText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => choosePhoto("library")}>
              <Text style={styles.secondaryButtonText}>Choose images</Text>
            </Pressable>
          </View>

          <View style={styles.previewPanel}>
            {pickedImage ? (
              <Image source={{ uri: pickedImage.uri }} style={styles.preview} />
            ) : (
              <View style={styles.emptyPreview}>
                <Text style={styles.emptyPreviewTitle}>Upload handwriting</Text>
                <Text style={styles.emptyPreviewText}>Select one page or multiple pages</Text>
              </View>
            )}
          </View>

          {pickedImages.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pageRow}>
                {pickedImages.map((image, index) => (
                  <Pressable
                    key={`${image.fileName}-${index}`}
                    onPress={() => setActiveImageIndex(index)}
                    style={[
                      styles.pageChip,
                      index === activeImageIndex ? styles.pageChipActive : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.pageChipLabel,
                        index === activeImageIndex ? styles.pageChipLabelActive : null
                      ]}
                    >
                      Page {index + 1}
                    </Text>
                    <Text numberOfLines={1} style={styles.pageChipName}>
                      {image.fileName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : null}

          <View style={styles.panel}>
            <Text style={styles.label}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.subjectRow}>
                {SUBJECTS.map((subjectOption) => (
                  <Pressable
                    key={subjectOption}
                    onPress={() => setSubject(subjectOption)}
                    style={[
                      styles.subjectChip,
                      subject === subjectOption ? styles.subjectChipActive : null
                    ]}
                  >
                    <Text
                      style={[
                        styles.subjectChipText,
                        subject === subjectOption ? styles.subjectChipTextActive : null
                      ]}
                    >
                      {subjectOption}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.label}>Context</Text>
            <TextInput
              multiline
              onChangeText={setContextText}
              placeholder="Optional: what is this note about? Example: biology lecture on ATP and glycolysis."
              style={styles.contextInput}
              textAlignVertical="top"
              value={contextText}
            />
            <Text style={styles.label}>Text cleanup</Text>
            <View style={styles.cleanupRow}>
              <Pressable
                onPress={() => setCleanupMode("rules")}
                style={[
                  styles.cleanupOption,
                  cleanupMode === "rules" ? styles.cleanupOptionActive : null
                ]}
              >
                <Text
                  style={[
                    styles.cleanupOptionTitle,
                    cleanupMode === "rules" ? styles.cleanupOptionTitleActive : null
                  ]}
                >
                  Standard
                </Text>
                <Text style={styles.cleanupOptionDetail}>Fast OCR cleanup</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!purchases.isPro && rewardedAiCleanupCredits <= 0) {
                    if (Platform.OS === "ios") {
                      setShowingPaywall(true);
                    } else {
                      Alert.alert(
                        "Cleanote Plus",
                        "AI cleanup purchases are currently available in the iPhone and iPad app."
                      );
                    }
                    return;
                  }
                  setCleanupMode("bedrock");
                }}
                style={[
                  styles.cleanupOption,
                  cleanupMode === "bedrock" ? styles.cleanupOptionActive : null
                ]}
              >
                <Text
                  style={[
                    styles.cleanupOptionTitle,
                    cleanupMode === "bedrock" ? styles.cleanupOptionTitleActive : null
                  ]}
                >
                  AI cleanup {purchases.isPro ? "" : "· Plus"}
                </Text>
                <Text style={styles.cleanupOptionDetail}>For difficult handwriting</Text>
              </Pressable>
            </View>
            <Pressable
              disabled={isScanning}
              onPress={scanHandwriting}
              style={[styles.primaryButton, isScanning ? styles.disabledButton : null]}
            >
              {isScanning ? <ActivityIndicator color="#fff" /> : null}
              <Text style={styles.primaryButtonText}>
                {isScanning ? "Scanning" : pickedImages.length > 1 ? "Scan all" : "Scan note"}
              </Text>
            </Pressable>
            {pickedImages.length ? (
              <Pressable style={styles.secondaryButton} onPress={clearImages}>
                <Text style={styles.secondaryButtonText}>Reset pages</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.panel}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.eyebrow}>Result editor</Text>
                <Text style={styles.sectionTitle}>{wordCount} words</Text>
              </View>
              <Pressable style={styles.secondaryButtonSmall} onPress={saveNote}>
                <Text style={styles.secondaryButtonText}>Save</Text>
              </Pressable>
            </View>
            <TextInput
              multiline
              onChangeText={setText}
              placeholder="Extracted handwriting will appear here."
              style={styles.editor}
              textAlignVertical="top"
              value={text}
            />
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.eyebrow}>Cloud search</Text>
            <Text style={styles.hint}>
              Enter the verified beta email used on the website to save/search notes in DynamoDB.
            </Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="verified@email.com"
              style={styles.input}
              value={email}
            />
            <View style={styles.searchRow}>
              <TextInput
                onChangeText={setSearchQuery}
                placeholder="Search notes"
                style={[styles.input, styles.searchInput]}
                value={searchQuery}
              />
              <Pressable style={styles.secondaryButtonSmall} onPress={searchNotes}>
                {isSearching ? (
                  <ActivityIndicator color="#17614f" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Search</Text>
                )}
              </Pressable>
            </View>
            <FlatList
              data={notes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable style={styles.noteRow} onPress={() => openNote(item)}>
                  <Text numberOfLines={1} style={styles.noteTitle}>
                    {item.filename}
                  </Text>
                  <Text numberOfLines={1} style={styles.noteMeta}>
                    {item.subject} · {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </Pressable>
              )}
              scrollEnabled={false}
            />
          </View>

          {!purchases.isPro ? (
            <View style={styles.adSupportPanel}>
              <View style={styles.adSupportCopy}>
                <Text style={styles.eyebrow}>Free app support</Text>
                <Text style={styles.adSupportTitle}>Watch an ad for one AI cleanup scan</Text>
                <Text style={styles.hint}>
                  Credits available: {rewardedAiCleanupCredits}. Standard OCR stays free within
                  the monthly allowance.
                </Text>
              </View>
              <Pressable
                disabled={!isRewardedLoaded}
                onPress={showRewardedAd}
                style={[styles.secondaryButtonSmall, !isRewardedLoaded ? styles.disabledButton : null]}
              >
                <Text style={styles.secondaryButtonText}>
                  {isRewardedLoaded ? "Watch ad" : "Loading ad"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {!purchases.isPro ? (
        <View style={styles.bannerAdContainer}>
          <BannerAd
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            unitId={getAdUnitId("banner")}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  adSupportCopy: {
    flex: 1,
    gap: 5
  },
  adSupportPanel: {
    alignItems: "center",
    backgroundColor: "#eef7f5",
    borderColor: "#cde4df",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14
  },
  adSupportTitle: {
    color: "#182024",
    fontSize: 16,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    gap: 12
  },
  bannerAdContainer: {
    alignItems: "center",
    backgroundColor: "#f7f8f4",
    borderTopColor: "#d8e0e2",
    borderTopWidth: 1,
    minHeight: 56,
    paddingVertical: 4
  },
  autoCaptureKnob: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    height: 20,
    transform: [{ translateX: 0 }],
    width: 20
  },
  autoCaptureKnobActive: {
    transform: [{ translateX: 22 }]
  },
  autoCaptureLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  },
  autoCaptureRow: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 10
  },
  autoCaptureToggle: {
    backgroundColor: "rgba(255,255,255,0.28)",
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    paddingHorizontal: 3,
    width: 52
  },
  autoCaptureToggleActive: {
    backgroundColor: "#287c6b",
    borderColor: "#9ff3df"
  },
  activeBadge: {
    backgroundColor: "#dff4eb",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  activeBadgeText: {
    color: "#17614f",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  cleanupOption: {
    backgroundColor: "#fbfcfa",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 74,
    padding: 12
  },
  cleanupOptionActive: {
    backgroundColor: "#eef7f5",
    borderColor: "#287c6b"
  },
  cleanupOptionDetail: {
    color: "#607078",
    fontSize: 12,
    lineHeight: 17
  },
  cleanupOptionTitle: {
    color: "#405058",
    fontSize: 14,
    fontWeight: "900"
  },
  cleanupOptionTitleActive: {
    color: "#17614f"
  },
  cleanupRow: {
    flexDirection: "row",
    gap: 10
  },
  brandCopy: {
    flex: 1,
    gap: 4
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14
  },
  cameraBottomBar: {
    gap: 12,
    paddingBottom: 28
  },
  cameraCloseButton: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  cameraCloseText: {
    color: "#182024",
    fontSize: 13,
    fontWeight: "900"
  },
  cameraEyebrow: {
    color: "#9ff3df",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  cameraHint: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
  },
  cameraScreen: {
    backgroundColor: "#000000",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20
  },
  cameraScrim: {
    backgroundColor: "rgba(0,0,0,0.22)",
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 28
  },
  cameraTitle: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 3
  },
  cameraTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cameraView: {
    flex: 1
  },
  captureButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 56,
    minWidth: 190,
    paddingHorizontal: 22
  },
  captureButtonText: {
    color: "#182024",
    fontSize: 16,
    fontWeight: "900"
  },
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 36
  },
  companyLine: {
    color: "#607078",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  contextInput: {
    backgroundColor: "#fbfcfa",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#182024",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 92,
    padding: 12
  },
  disabledButton: {
    opacity: 0.7
  },
  documentGuide: {
    alignItems: "center",
    alignSelf: "center",
    aspectRatio: 3 / 4,
    borderColor: "rgba(159,243,223,0.8)",
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: "center",
    maxHeight: "58%",
    overflow: "hidden",
    width: "82%"
  },
  dynamicScanBand: {
    backgroundColor: "rgba(255,255,255,0.2)",
    height: 4,
    left: "12%",
    opacity: 0.7,
    position: "absolute",
    right: "12%",
    top: "34%"
  },
  dynamicScanBandAligning: {
    backgroundColor: "rgba(255,210,80,0.8)",
    top: "46%"
  },
  dynamicScanBandReady: {
    backgroundColor: "rgba(159,243,223,0.95)",
    top: "58%"
  },
  dynamicScanBandSteady: {
    backgroundColor: "rgba(159,243,223,0.72)",
    top: "52%"
  },
  guideCorner: {
    borderColor: "#9ff3df",
    height: 34,
    position: "absolute",
    width: 34
  },
  guideCornerBottomLeft: {
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    bottom: -4,
    left: -4
  },
  guideCornerBottomRight: {
    borderBottomWidth: 5,
    borderRightWidth: 5,
    bottom: -4,
    right: -4
  },
  guideCornerTopLeft: {
    borderLeftWidth: 5,
    borderTopWidth: 5,
    left: -4,
    top: -4
  },
  guideCornerTopRight: {
    borderRightWidth: 5,
    borderTopWidth: 5,
    right: -4,
    top: -4
  },
  guideText: {
    backgroundColor: "rgba(0,0,0,0.56)",
    borderRadius: 999,
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center"
  },
  cameraProgressFill: {
    backgroundColor: "#9ff3df",
    borderRadius: 999,
    height: "100%"
  },
  cameraProgressTrack: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    height: 7,
    overflow: "hidden"
  },
  cameraQualityCard: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    maxWidth: 420,
    padding: 12,
    width: "100%"
  },
  cameraQualityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cameraQualityMessage: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  cameraQualityPercent: {
    color: "#9ff3df",
    fontSize: 13,
    fontWeight: "900"
  },
  cameraQualityTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  editor: {
    backgroundColor: "#fbfcfa",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#182024",
    fontSize: 16,
    lineHeight: 24,
    minHeight: 220,
    padding: 14
  },
  emptyPreview: {
    alignItems: "center",
    backgroundColor: "#f7faf9",
    borderColor: "#aac0bd",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    flex: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 250,
    padding: 24
  },
  emptyPreviewText: {
    color: "#607078",
    fontSize: 15,
    textAlign: "center"
  },
  emptyPreviewTitle: {
    color: "#182024",
    fontSize: 18,
    fontWeight: "900"
  },
  eyebrow: {
    color: "#b94f65",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  header: {
    gap: 8,
    paddingTop: 12
  },
  hint: {
    color: "#607078",
    lineHeight: 21
  },
  input: {
    backgroundColor: "#fbfcfa",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#182024",
    minHeight: 46,
    paddingHorizontal: 12
  },
  keyboardView: {
    flex: 1
  },
  label: {
    color: "#607078",
    fontSize: 13,
    fontWeight: "800"
  },
  logo: {
    borderRadius: 16,
    height: 72,
    width: 72
  },
  message: {
    color: "#607078",
    lineHeight: 21
  },
  noteMeta: {
    color: "#607078",
    fontSize: 13
  },
  noteRow: {
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  noteTitle: {
    color: "#182024",
    fontWeight: "800"
  },
  outcomeCard: {
    backgroundColor: "#eef7f5",
    borderColor: "#cde4df",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  outcomeRow: {
    flexDirection: "row",
    gap: 8
  },
  outcomeText: {
    color: "#17614f",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center"
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  pageChip: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    minWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  pageChipActive: {
    borderColor: "#287c6b"
  },
  pageChipLabel: {
    color: "#607078",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  pageChipLabelActive: {
    color: "#17614f"
  },
  pageChipName: {
    color: "#607078",
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 126
  },
  pageRow: {
    flexDirection: "row",
    gap: 8
  },
  planButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cde4df",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 68,
    padding: 14
  },
  planDetail: {
    color: "#607078",
    fontSize: 12,
    marginTop: 3
  },
  planList: {
    gap: 10
  },
  planPrice: {
    color: "#17614f",
    fontSize: 15,
    fontWeight: "900"
  },
  planTitle: {
    color: "#182024",
    fontSize: 16,
    fontWeight: "900"
  },
  plusHeading: {
    flex: 1,
    gap: 4
  },
  plusPanel: {
    backgroundColor: "#f4fbf8",
    borderColor: "#b9ded5"
  },
  policyLink: {
    color: "#17614f",
    fontSize: 15,
    fontWeight: "900"
  },
  purchaseLinks: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  purchaseTerms: {
    color: "#7c8a8f",
    fontSize: 11,
    lineHeight: 16
  },
  preview: {
    aspectRatio: 3 / 4,
    backgroundColor: "#eef5f3",
    borderRadius: 8,
    maxHeight: 520,
    resizeMode: "contain",
    width: "100%"
  },
  previewPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  qualityDot: {
    color: "#9ff3df",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 18
  },
  qualityPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  qualityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center"
  },
  qualityText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#287c6b",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  resultHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  safeArea: {
    backgroundColor: "#f7f8f4",
    flex: 1
  },
  searchInput: {
    flex: 1
  },
  searchRow: {
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14
  },
  secondaryButtonSmall: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 82,
    paddingHorizontal: 12
  },
  secondaryButtonText: {
    color: "#17614f",
    fontWeight: "800"
  },
  sectionTitle: {
    color: "#182024",
    fontSize: 20,
    fontWeight: "800"
  },
  subjectChip: {
    borderColor: "#d8e0e2",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  subjectChipActive: {
    backgroundColor: "#287c6b",
    borderColor: "#287c6b"
  },
  subjectChipText: {
    color: "#607078",
    fontWeight: "800",
    textTransform: "capitalize"
  },
  subjectChipTextActive: {
    color: "#ffffff"
  },
  subjectRow: {
    flexDirection: "row",
    gap: 8
  },
  subtitle: {
    color: "#607078",
    fontSize: 16,
    lineHeight: 24
  },
  title: {
    color: "#182024",
    fontSize: 31,
    fontWeight: "800",
    lineHeight: 36
  },
  tipText: {
    color: "#405058",
    fontSize: 14,
    lineHeight: 20
  },
  tipsPanel: {
    backgroundColor: "#fff8e6",
    borderColor: "#eadcae",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14
  }
});

import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
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
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  TestIds
} from "react-native-google-mobile-ads";

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

const AD_UNIT_IDS = {
  banner: __DEV__ ? TestIds.BANNER : "ca-app-pub-6605747981994820/1494286316",
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : "ca-app-pub-6605747981994820/6178647101",
  rewarded: __DEV__ ? TestIds.REWARDED : "ca-app-pub-6605747981994820/3330112161"
};

const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;

export default function App() {
  const interstitialAdRef = useRef<InterstitialAd | null>(null);
  const lastInterstitialShownAtRef = useRef(0);
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
  const [isInterstitialLoaded, setIsInterstitialLoaded] = useState(false);
  const [message, setMessage] = useState("Choose a page to turn handwriting into searchable text.");

  const pickedImage = pickedImages[activeImageIndex] ?? null;

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    let isMounted = true;
    const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
      requestNonPersonalizedAdsOnly: true
    });
    interstitialAdRef.current = interstitial;

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      if (isMounted) {
        setIsInterstitialLoaded(true);
      }
    });
    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      if (isMounted) {
        setIsInterstitialLoaded(false);
      }
      interstitial.load();
    });
    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      if (isMounted) {
        setIsInterstitialLoaded(false);
      }
    });

    void mobileAds()
      .setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false
      })
      .then(() => mobileAds().initialize())
      .then(() => {
        interstitial.load();
      });

    return () => {
      isMounted = false;
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  function maybeShowScanCompleteAd() {
    if (Platform.OS !== "android" || !isInterstitialLoaded || !interstitialAdRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastInterstitialShownAtRef.current < INTERSTITIAL_COOLDOWN_MS) {
      return;
    }

    lastInterstitialShownAtRef.current = now;
    setIsInterstitialLoaded(false);
    interstitialAdRef.current.show();
  }

  async function choosePhoto(source: "camera" | "library") {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Cleanote needs camera access to scan handwritten notes.");
        return;
      }
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.92 })
        : await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: true,
            mediaTypes: ["images"],
            quality: 0.92,
            selectionLimit: 10
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const nextImages = result.assets.map((asset, index) => ({
      fileName: asset.fileName ?? `cleanote-scan-${Date.now()}-${index + 1}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      uri: asset.uri
    }));

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

    setIsScanning(true);
    setMessage(pickedImages.length > 1 ? "Scanning pages..." : "Scanning note...");

    try {
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

        const response = await fetch(`${API_BASE}/api/ocr`, {
          body: formData,
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
      maybeShowScanCompleteAd();
    } catch (error) {
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

          {Platform.OS === "android" ? (
            <View style={styles.adPanel}>
              <Text style={styles.adLabel}>Advertisement</Text>
              <BannerAd
                unitId={AD_UNIT_IDS.banner}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{ requestNonPersonalizedAdsOnly: true }}
              />
            </View>
          ) : null}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 12
  },
  adLabel: {
    color: "#7c8a8f",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  adPanel: {
    alignItems: "center",
    backgroundColor: "#eef7f5",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minHeight: 82,
    overflow: "hidden",
    padding: 10
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
  policyLink: {
    color: "#17614f",
    fontSize: 15,
    fontWeight: "900"
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

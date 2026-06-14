import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

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
};

const SUBJECTS = ["general", "biology", "chemistry", "math", "engineering", "medicine", "research"];

export default function App() {
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [subject, setSubject] = useState("general");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("Choose a notebook photo to begin.");

  const wordCount = useMemo(() => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }, [text]);

  async function choosePhoto(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Cleanote needs photo access to scan handwritten notes.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.92 })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            mediaTypes: ["images"],
            quality: 0.92
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const nextImage = {
      fileName: asset.fileName ?? `cleanote-scan-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      uri: asset.uri
    };
    setPickedImage(nextImage);
    setFilename(nextImage.fileName);
    setProvider(null);
    setText("");
    setMessage("Photo ready. Tap Scan handwriting.");
  }

  async function scanHandwriting() {
    if (!pickedImage) {
      setMessage("Choose or take a note photo first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", {
      name: pickedImage.fileName,
      type: pickedImage.mimeType,
      uri: pickedImage.uri
    } as unknown as Blob);
    formData.append("provider", "textract");
    formData.append("subject", subject);

    setIsScanning(true);
    setMessage("Scanning handwriting...");

    try {
      const response = await fetch(`${API_BASE}/api/ocr`, {
        body: formData,
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "OCR failed.");
      }
      setText(payload.text ?? "");
      setFilename(payload.filename ?? pickedImage.fileName);
      setProvider(payload.provider ?? "textract");
      setMessage("Scan complete. Edit, save, or search your notes.");
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
      text
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
        const haystack = `${note.filename} ${note.subject} ${note.text}`.toLowerCase();
        return haystack.includes(query);
      })
    );
  }

  function openNote(note: SavedNote) {
    setFilename(note.filename);
    setProvider(note.provider);
    setSubject(note.subject);
    setText(note.text);
    setMessage(`Opened ${note.filename}`);
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
            <Text style={styles.eyebrow}>Cleanote mobile</Text>
            <Text style={styles.title}>Scan notes into searchable text</Text>
            <Text style={styles.subtitle}>
              Use your camera, clean the result, and search saved notes from your AWS backend.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={() => choosePhoto("camera")}>
              <Text style={styles.primaryButtonText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => choosePhoto("library")}>
              <Text style={styles.secondaryButtonText}>Choose image</Text>
            </Pressable>
          </View>

          {pickedImage ? <Image source={{ uri: pickedImage.uri }} style={styles.preview} /> : null}

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
            <Pressable
              disabled={isScanning}
              onPress={scanHandwriting}
              style={[styles.primaryButton, isScanning ? styles.disabledButton : null]}
            >
              {isScanning ? <ActivityIndicator color="#fff" /> : null}
              <Text style={styles.primaryButtonText}>
                {isScanning ? "Scanning" : "Scan handwriting"}
              </Text>
            </Pressable>
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
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 36
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
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e0e2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  preview: {
    aspectRatio: 4 / 3,
    backgroundColor: "#eef5f3",
    borderRadius: 8,
    width: "100%"
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
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38
  }
});

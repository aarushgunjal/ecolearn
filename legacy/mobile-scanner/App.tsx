import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import type { Session } from "@supabase/supabase-js";
import { isConfigured, supabase } from "./src/supabase";

type Photo = { uri: string; name: string; mimeType: string; base64?: string | null };
type DelawareGuidance = {
  title: string;
  category: string;
  curbside: boolean;
  instructions: string;
  sourceUrl: string;
  matchConfidence?: number;
};
type VisionScanResponse = {
  verified: boolean;
  guidance: DelawareGuidance | null;
  observedItem: string | null;
  material: string | null;
  confidence: number;
  imageStatus: "single_item" | "multiple_items" | "unclear";
  visibleEvidence: string | null;
  nextSteps: string[];
  message: string;
};
type ScanResult = {
  item: string;
  confidence: number;
  category: string;
  instructions: string;
  tips: string[];
  material?: string | null;
  visibleEvidence?: string | null;
  guidance?: DelawareGuidance | null;
};

const percent = (value: number) => Math.round(value <= 1 ? value * 100 : Math.min(100, value));
const newRequestId = () => {
  const part = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${part()}${part()}-${part()}-4${part().slice(1)}-a${part().slice(1)}-${part()}${part()}${part()}`;
};
const functionErrorMessage = async (error: unknown) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
      } catch {
        // Fall through to the standard client error.
      }
    }
  }
  return error instanceof Error && error.message
    ? error.message
    : "EcoLearn could not complete the visual item check.";
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <MessageScreen title="Connect EcoScan" detail="Add the Supabase URL and publishable key to this app's .env file, then restart Expo." />;
  if (loadingSession) return <MessageScreen title="Opening EcoScan" loading />;
  if (!session) return <AuthScreen />;
  return <ScannerScreen />;
}

function MessageScreen({ title, detail, loading = false }: { title: string; detail?: string; loading?: boolean }) {
  return <SafeAreaView style={styles.safe}><View style={styles.center}>{loading && <ActivityIndicator color="#347e45" />}<Text style={styles.title}>{title}</Text>{detail && <Text style={styles.description}>{detail}</Text>}</View></SafeAreaView>;
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    if (!email.trim() || password.length < 6) return Alert.alert("Check your details", "Enter your EcoLearn email and password.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert("Could not sign in", error.message);
  };
  return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.kicker}>ECOLEARN ACCOUNT</Text><Text style={styles.title}>Sign in to scan.</Text><Text style={styles.description}>The protected visual service uses your account to keep scans private and enforce usage limits.</Text><TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.input} /><TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} /><Pressable disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void signIn()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}</Pressable></View></SafeAreaView>;
}

function ScannerScreen() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const requestId = useRef(newRequestId());

  const choosePhoto = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", `Allow ${fromCamera ? "camera" : "photo library"} access to scan an item.`);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, base64: true };
    const response = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (response.canceled || !response.assets[0]) return;
    const asset = response.assets[0];
    requestId.current = newRequestId();
    setPhoto({
      uri: asset.uri,
      name: asset.fileName ?? "ecolearn-photo.jpg",
      mimeType: asset.base64 ? "image/jpeg" : asset.mimeType ?? "image/jpeg",
      base64: asset.base64,
    });
    setResult(null);
  };

  const scan = async () => {
    if (!photo || scanning) return;
    setScanning(true);
    try {
      const base64 = photo.base64 ?? await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data, error } = await supabase.functions.invoke("explain-scan", {
        body: { image: `data:${photo.mimeType};base64,${base64}` },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const identified = data as VisionScanResponse;
      const guidance = identified.guidance;
      setResult(guidance
        ? { item: guidance.title, confidence: guidance.matchConfidence ?? identified.confidence, category: guidance.category, instructions: guidance.instructions, tips: ["Verified against Delaware DNREC Recyclopedia", "Follow the complete official item protocol"], material: identified.material, visibleEvidence: identified.visibleEvidence, guidance }
        : { item: identified.observedItem ?? "Item not identified", confidence: identified.confidence, category: identified.imageStatus === "multiple_items" ? "Multiple items detected" : "No official DNREC match", instructions: identified.message, tips: identified.nextSteps, material: identified.material, visibleEvidence: identified.visibleEvidence, guidance: null });
      if (guidance) {
        const { error: saveError } = await supabase.rpc("record_ecolearn_scan", {
          p_item_name: guidance.title,
          p_is_recyclable: guidance.curbside,
          p_confidence_score: guidance.matchConfidence ?? identified.confidence,
          p_category: guidance.category,
          p_instructions: guidance.instructions,
          p_client_request_id: requestId.current,
        });
        if (saveError) Alert.alert("Guidance found", "The official result is shown, but progress could not be saved.");
      }
    } catch (error) {
      Alert.alert("Visual item check unavailable", await functionErrorMessage(error));
    } finally {
      setScanning(false);
    }
  };

  const reset = () => { setPhoto(null); setResult(null); requestId.current = newRequestId(); };

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoText}>e</Text></View><View><Text style={styles.brand}>EcoScan</Text><Text style={styles.subtitle}>Official Delaware lookup</Text></View><Pressable style={styles.signOut} onPress={() => void supabase.auth.signOut()}><Text style={styles.signOutText}>Sign out</Text></Pressable></View>
    {!result ? <>
      <Text style={styles.kicker}>ITEM SCANNER</Text><Text style={styles.title}>Know where it goes.</Text><Text style={styles.description}>Choose or take a clear photo of one household item. EcoLearn identifies it once, then searches the official DNREC catalog.</Text>
      <View style={styles.photoCard}>{photo ? <Image source={{ uri: photo.uri }} style={styles.photo} /> : <Text style={styles.cameraGlyph}>⌁</Text>}<Text style={styles.photoPrompt}>{photo ? "Ready to identify" : "Add an item photo"}</Text><Text style={styles.photoHint}>One item, good lighting, and a simple background work best.</Text></View>
      <View style={styles.row}><Pressable style={[styles.secondaryButton, styles.half]} onPress={() => void choosePhoto(false)} disabled={scanning}><Text style={styles.secondaryText}>Choose from gallery</Text></Pressable><Pressable style={[styles.primaryButton, styles.half]} onPress={() => void choosePhoto(true)} disabled={scanning}><Text style={styles.primaryText}>Use camera</Text></Pressable></View>
      <Pressable style={[styles.scanButton, (!photo || scanning) && styles.disabled]} onPress={() => void scan()} disabled={!photo || scanning}>{scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanText}>Identify + check DNREC</Text>}</Pressable>
    </> : <>
      {photo && <Image source={{ uri: photo.uri }} style={styles.resultPhoto} />}
      <Text style={styles.kicker}>{result.guidance ? "OFFICIAL DELAWARE MATCH" : "VISUAL IDENTIFICATION"}</Text><Text style={styles.title}>{result.item}</Text>
      <View style={[styles.badge, result.guidance?.curbside ? styles.goodBadge : styles.warnBadge]}><Text style={[styles.badgeText, result.guidance?.curbside ? styles.goodText : styles.warnText]}>{result.guidance ? `DNREC: ${result.category}` : result.category} · {percent(result.confidence)}%</Text></View>
      {!!result.material && !result.guidance && <Text style={styles.disclaimer}>Likely material: {result.material}</Text>}
      <View style={styles.guidanceCard}><Text style={styles.cardLabel}>{result.guidance ? "OFFICIAL DELAWARE DNREC PROTOCOL" : "NO OFFICIAL DELAWARE MATCH"}</Text><Text style={styles.guidance}>{result.instructions}</Text>{!!result.visibleEvidence && !result.guidance && <Text style={styles.tip}>Visible evidence: {result.visibleEvidence}</Text>}{result.tips.map((tip) => <Text key={tip} style={styles.tip}>• {tip}</Text>)}{result.guidance && <Pressable onPress={() => void Linking.openURL(result.guidance!.sourceUrl)}><Text style={styles.link}>Open Delaware DNREC source</Text></Pressable>}</View>
      {!result.guidance && <Text style={styles.disclaimer}>Safe next steps are not Delaware disposal instructions. Official guidance appears only after a DNREC catalog match.</Text>}
      <Pressable style={styles.scanButton} onPress={reset}><Text style={styles.scanText}>Scan another item</Text></Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f4" }, center: { flex: 1, justifyContent: "center", padding: 26 }, page: { padding: 22, paddingBottom: 48 }, header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 38 }, logo: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#173d2a" }, logoText: { color: "#fff", fontSize: 22, fontWeight: "800" }, brand: { color: "#173d2a", fontSize: 21, fontWeight: "800" }, subtitle: { color: "#78857a", fontSize: 12 }, signOut: { marginLeft: "auto", padding: 8 }, signOutText: { color: "#647368", fontSize: 12, fontWeight: "700" }, kicker: { color: "#4d9557", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, title: { marginTop: 9, color: "#173d2a", fontSize: 36, lineHeight: 41, fontWeight: "800", letterSpacing: -1.5 }, description: { marginTop: 12, color: "#66746a", fontSize: 15, lineHeight: 23 }, input: { marginTop: 12, borderWidth: 1, borderColor: "#d9e3d6", borderRadius: 13, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 13, color: "#173d2a" }, photoCard: { alignItems: "center", justifyContent: "center", minHeight: 290, marginTop: 28, overflow: "hidden", borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 24, backgroundColor: "#eef8eb", padding: 20 }, photo: { position: "absolute", width: "100%", height: "100%", opacity: 0.42 }, cameraGlyph: { color: "#367e45", fontSize: 52 }, photoPrompt: { marginTop: 12, color: "#1d492c", fontSize: 18, fontWeight: "800" }, photoHint: { marginTop: 6, color: "#718075", textAlign: "center", fontSize: 13, lineHeight: 19 }, row: { flexDirection: "row", gap: 10, marginTop: 14 }, half: { flex: 1 }, primaryButton: { alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 14, backgroundColor: "#173d2a", paddingVertical: 14, paddingHorizontal: 12 }, primaryText: { color: "#fff", fontWeight: "800", textAlign: "center" }, secondaryButton: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 14, backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 12 }, secondaryText: { color: "#286d3b", fontWeight: "800", textAlign: "center" }, scanButton: { alignItems: "center", marginTop: 12, borderRadius: 14, backgroundColor: "#3d8c4c", paddingVertical: 16 }, disabled: { opacity: 0.42 }, scanText: { color: "#fff", fontSize: 16, fontWeight: "800" }, resultPhoto: { width: "100%", aspectRatio: 1, borderRadius: 24, marginBottom: 25 }, badge: { alignSelf: "flex-start", marginTop: 15, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 }, goodBadge: { backgroundColor: "#e0f3da" }, warnBadge: { backgroundColor: "#fff0e9" }, badgeText: { fontSize: 13, fontWeight: "800" }, goodText: { color: "#256c38" }, warnText: { color: "#a25143" }, guidanceCard: { marginTop: 20, borderWidth: 1, borderColor: "#dce8d8", borderRadius: 20, backgroundColor: "#fff", padding: 18 }, cardLabel: { color: "#718075", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, guidance: { marginTop: 8, color: "#274033", fontSize: 16, lineHeight: 24, fontWeight: "700" }, tip: { marginTop: 10, color: "#617166", fontSize: 14, lineHeight: 20 }, disclaimer: { marginTop: 16, color: "#77847a", fontSize: 12, lineHeight: 18 }, link: { marginTop: 16, color: "#287640", fontSize: 14, fontWeight: "800" },
});

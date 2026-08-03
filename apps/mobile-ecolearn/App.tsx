import { useEffect, useMemo, useRef, useState } from "react";
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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { decode } from "base64-arraybuffer";
import type { Session, User } from "@supabase/supabase-js";
import { isConfigured, supabase } from "./src/supabase";

WebBrowser.maybeCompleteAuthSession();

type Tab = "Home" | "Scan" | "Learn" | "Challenges" | "Ranks" | "Profile";
type Photo = { uri: string; name: string; mimeType: string };
type ScanResult = { item: string; recyclable: boolean; confidence: number; category: string; instructions: string; tips?: string[]; top_predictions?: { class: string; confidence: number }[]; dnrec?: DelawareGuidance | null };
type DelawareGuidance = { title: string; category: string; curbside: boolean; instructions: string; sourceName: string; sourceUrl: string; matchConfidence?: number };
type Progress = { xp: number; level: number; total_scans: number; total_lessons_completed: number; streak_days: number };
type Site = { id: string; name: string; type: string; latitude: number; longitude: number; distanceKm: number; address?: string };
type Lesson = { id: string; title: string; topic: string; duration: string; xp: number; summary: string; question: string; choices: string[]; answer: number; explanation: string };

const labels = ["battery", "biological", "cardboard", "clothes", "glass", "metal", "paper", "plastic", "shoes", "trash"];
const usingExpoGo = Constants.appOwnership === "expo";
const lessons: Lesson[] = [
  { id: "10000000-0000-4000-8000-000000000001", title: "The Delaware recycling loop", topic: "Recycling basics", duration: "4 min", xp: 20, summary: "Delaware DNREC says accepted curbside items should be loose, empty, clean, and dry.", question: "Which action best helps a recycling facility sort materials?", choices: ["Bag recyclables", "Keep empty items loose", "Recycle every item with a triangle"], answer: 1, explanation: "DNREC's Recyclopedia advises keeping accepted materials loose, empty, clean, and dry." },
  { id: "10000000-0000-4000-8000-000000000002", title: "Plastic, decoded", topic: "Delaware materials", duration: "6 min", xp: 30, summary: "A plastic number does not guarantee curbside acceptance. Check the exact item in Delaware DNREC Recyclopedia.", question: "What is the safest choice for plastic bags and film?", choices: ["Put them in curbside recycling", "Use a dedicated store drop-off", "Mix them with paper"], answer: 1, explanation: "Film can tangle sorting equipment. Confirm the exact Delaware drop-off protocol first." },
  { id: "10000000-0000-4000-8000-000000000003", title: "Wishcycling myths", topic: "Smart sorting", duration: "5 min", xp: 25, summary: "Wishcycling is placing an item in recycling because we hope it is accepted. It can contaminate real recyclables.", question: "What should you do with an unknown material?", choices: ["Put it in recycling just in case", "Check Delaware DNREC guidance", "Place it in a bag with paper"], answer: 1, explanation: "When unsure, Delaware DNREC guidance is safer than guessing." },
  { id: "10000000-0000-4000-8000-000000000004", title: "Food's second life", topic: "Composting", duration: "7 min", xp: 35, summary: "Food scraps can be a resource through composting where a local program accepts them.", question: "What should you check before composting food scraps?", choices: ["Whether your local program accepts them", "Whether they are in plastic", "Nothing"], answer: 0, explanation: "Accepted materials differ by program, so local rules come first." },
];

const percent = (value: number) => Math.round(value <= 1 ? value * 100 : Math.min(100, value));
const photoFromAsset = (asset: ImagePicker.ImagePickerAsset): Photo => ({ uri: asset.uri, name: asset.fileName ?? "ecolearn-photo.jpg", mimeType: asset.mimeType ?? "image/jpeg" });
const newRequestId = () => {
  const part = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${part()}${part()}-${part()}-4${part().slice(1)}-a${part().slice(1)}-${part()}${part()}${part()}`;
};
const extras = StyleSheet.create({
  headerStreak: { marginLeft: "auto", borderRadius: 99, backgroundColor: "#fff3d5", paddingHorizontal: 10, paddingVertical: 7 },
  headerStreakText: { color: "#976700", fontSize: 11, fontWeight: "800" },
  navIcon: { color: "#b9d2bc", fontSize: 15, lineHeight: 16, textAlign: "center" },
  webNav: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: "#e5e9e1", backgroundColor: "#ffffff", paddingHorizontal: 4, paddingTop: 8, paddingBottom: 12 },
  webNavItem: { minWidth: 48, alignItems: "center", borderRadius: 10, paddingHorizontal: 4, paddingVertical: 5 },
  webNavActive: { backgroundColor: "#e8f3df" },
  webNavText: { color: "#77847a", fontSize: 9, fontWeight: "800" },
  webNavTextActive: { color: "#237342" },
  photoHint: { marginTop: 8, color: "#5b8061", fontSize: 12, textAlign: "center" },
  toolsLinkCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 18, backgroundColor: "#fff", padding: 16 },
});

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoadingSession(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <ConfigurationScreen />;
  if (loadingSession) return <LoadingScreen message="Opening EcoLearn…" />;
  if (!session) return <AuthScreen />;
  return <EcoLearnApp user={session.user} />;
}

function ConfigurationScreen() {
  return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.brandLarge}>ecolearn</Text><Text style={styles.pageTitle}>Connect the app</Text><Text style={styles.body}>Copy .env.example to .env and add the same Supabase URL and publishable key used by the web platform. Then restart Expo.</Text></View></SafeAreaView>;
}

function LoadingScreen({ message }: { message: string }) { return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color="#317c44" /><Text style={[styles.body, { marginTop: 16 }]}>{message}</Text></View></SafeAreaView>; }

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim() || password.length < 6) return Alert.alert("Check your details", "Enter an email and a password with at least six characters.");
    setBusy(true);
    const response = mode === "signin" ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (response.error) return Alert.alert("Could not continue", response.error.message);
    if (mode === "signup" && !response.data.session) Alert.alert("Check your email", "Confirm your email, then return here to sign in.");
  };
  const google = async () => {
    if (usingExpoGo) {
      Alert.alert(
        "Use email sign-in in Expo Go",
        "Google sign-in needs the EcoLearn development build because Expo Go cannot provide the stable OAuth callback URL Google requires.",
      );
      return;
    }
    setBusy(true);
    try {
      const redirectTo = ExpoLinking.createURL("auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
      if (error || !data.url) throw error ?? new Error("Google sign-in is unavailable.");
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return;
      const callback = new URL(result.url.replace("#", "?"));
      const access_token = callback.searchParams.get("access_token");
      const refresh_token = callback.searchParams.get("refresh_token");
      if (!access_token || !refresh_token) throw new Error("Google did not return a session. Add the mobile redirect URL to Supabase Auth and try again.");
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) throw sessionError;
    } catch (error) { Alert.alert("Google sign-in needs setup", error instanceof Error ? error.message : "Try email sign-in or check the mobile redirect configuration."); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.authPage}><Text style={styles.brandLarge}>ecolearn</Text><Text style={styles.pageTitle}>{mode === "signin" ? "Welcome back." : "Start your impact."}</Text><Text style={styles.body}>Save scans, learn sustainable habits, and build a more circular world.</Text><Pressable onPress={() => void google()} disabled={busy} style={[styles.googleButton, usingExpoGo && styles.disabled]}><Text style={styles.googleText}>{usingExpoGo ? "Google sign-in needs development build" : "Continue with Google"}</Text></Pressable>{usingExpoGo && <Text style={styles.helper}>For Expo Go testing, use email/password. Google works in the later EcoLearn development build.</Text>}<Text style={styles.or}>OR WITH EMAIL</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" style={styles.input} /><TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Password" style={styles.input} /><Pressable onPress={() => void submit()} disabled={busy} style={styles.primaryButton}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>}</Pressable><Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}><Text style={styles.link}>{mode === "signin" ? "New to EcoLearn? Create an account" : "Already a member? Sign in"}</Text></Pressable><Text style={styles.legal}>By continuing, you agree to EcoLearn’s Terms of Service and Privacy Policy.</Text></ScrollView></SafeAreaView>;
}

function EcoLearnApp({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("Home");
  const [showScanTools, setShowScanTools] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const refresh = async () => {
    const [{ data: nextProgress }, { data: lessonProgress }] = await Promise.all([supabase.from("user_progress").select("xp,level,total_scans,total_lessons_completed,streak_days").eq("user_id", user.id).maybeSingle(), supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("status", "completed")]);
    setProgress(nextProgress as Progress | null); setCompleted((lessonProgress ?? []).map((row) => row.lesson_id));
  };
  useEffect(() => { void refresh(); }, []);
  const screen = tab === "Home" ? <Home progress={progress} onScan={() => { setShowScanTools(false); setTab("Scan"); }} onLearn={() => setTab("Learn")} /> : tab === "Scan" ? showScanTools ? <ToolsScreen /> : <ScanScreen user={user} onRecorded={refresh} onTools={() => setShowScanTools(true)} /> : tab === "Learn" ? <LearnScreen completed={completed} onCompleted={refresh} /> : tab === "Challenges" ? <QuestsScreen progress={progress} /> : tab === "Ranks" ? <LeaderboardScreen progress={progress} /> : <ProfileScreen user={user} progress={progress} />;
  const navItems: { tab: Tab; icon: string; label: string }[] = [
    { tab: "Home", icon: "⌂", label: "Home" },
    { tab: "Scan", icon: "⌕", label: "Scan" },
    { tab: "Learn", icon: "▤", label: "Learn" },
    { tab: "Challenges", icon: "★", label: "Challenges" },
    { tab: "Ranks", icon: "♛", label: "Ranks" },
    { tab: "Profile", icon: "◉", label: "Profile" },
  ];
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><View style={styles.appHeader}><View style={styles.logo}><Text style={styles.logoText}>e</Text></View><Text style={styles.brand}>ecolearn</Text><View style={extras.headerStreak}><Text style={extras.headerStreakText}>🔥 {progress?.streak_days ?? 0} day streak</Text></View></View><ScrollView contentContainerStyle={styles.page}>{screen}</ScrollView><View style={extras.webNav}>{navItems.map(({ tab: item, icon, label }) => <Pressable key={item} onPress={() => { setShowScanTools(false); setTab(item); }} style={[extras.webNavItem, item === tab && extras.webNavActive]}><Text style={[extras.navIcon, extras.webNavText, item === tab && extras.webNavTextActive]}>{icon}</Text><Text style={[extras.webNavText, item === tab && extras.webNavTextActive]}>{label}</Text></Pressable>)}</View></SafeAreaView>;
}

function Home({ progress, onScan, onLearn }: { progress: Progress | null; onScan: () => void; onLearn: () => void }) { return <><Text style={styles.kicker}>GOOD TO SEE YOU</Text><Text style={styles.hero}>Small choices.{"\n"}<Text style={styles.heroAccent}>Real impact.</Text></Text><View style={styles.heroCard}><Text style={styles.cardEyebrow}>YOUR IMPACT</Text><Text style={styles.cardTitle}>{progress?.total_scans ?? 0} items scanned</Text><Text style={styles.cardText}>You are level {progress?.level ?? 1} with a {progress?.streak_days ?? 0}-day activity streak.</Text><Pressable style={styles.lightButton} onPress={onScan}><Text style={styles.lightText}>Scan an item</Text></Pressable></View><Text style={styles.sectionTitle}>Keep going</Text><Pressable style={styles.rowCard} onPress={onLearn}><View style={styles.iconSquare}><Text>◌</Text></View><View style={{ flex: 1 }}><Text style={styles.smallLabel}>LEARN BY DOING</Text><Text style={styles.rowTitle}>Build your eco instinct</Text><Text style={styles.rowMeta}>Short lessons with real-world choices</Text></View><Text style={styles.chevron}>›</Text></Pressable></>; }

function ScanScreen({ user, onRecorded, onTools }: { user: User; onRecorded: () => Promise<void>; onTools: () => void }) {
  const [photo, setPhoto] = useState<Photo | null>(null); const [result, setResult] = useState<ScanResult | null>(null); const [busy, setBusy] = useState(false); const [explanation, setExplanation] = useState<{ observedItem?: string; explanation?: string; disposalAction?: string; caution?: string; guidance?: DelawareGuidance | null; sourceUrl?: string } | null>(null); const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null); const [correctedLabel, setCorrectedLabel] = useState("trash");
  const requestId = useRef(newRequestId());
  const recordOfficial = async (verified: ScanResult) => {
    if (!verified.dnrec) return;
    const { error } = await supabase.rpc("record_ecolearn_scan", {
      p_item_name: verified.dnrec.title,
      p_is_recyclable: verified.dnrec.curbside,
      p_confidence_score: verified.dnrec.matchConfidence ?? verified.confidence,
      p_category: verified.dnrec.category,
      p_instructions: verified.dnrec.instructions,
      p_client_request_id: requestId.current,
    });
    if (error) throw error;
    await onRecorded();
  };
  const choose = async (camera: boolean) => { const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return Alert.alert("Permission needed", "Allow access to scan an item."); const picked = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 }); if (!picked.canceled && picked.assets[0]) { requestId.current = newRequestId(); setPhoto(photoFromAsset(picked.assets[0])); setResult(null); setExplanation(null); setFeedback(null); } };
  const scan = async () => { if (!photo || busy) return; setBusy(true); try { const form = new FormData(); form.append("file", { uri: photo.uri, type: photo.mimeType, name: photo.name } as unknown as Blob); const { data, error } = await supabase.functions.invoke("classify-scan", { body: form }); if (error) throw error; const classified = data as ScanResult; const broad = labels.includes(String(classified.item ?? "").toLowerCase()); let guidance: DelawareGuidance | null = null; if (!broad) { const { data: guidanceData, error: guidanceError } = await supabase.functions.invoke("delaware-guidance", { body: { item: classified.item } }); if (!guidanceError && guidanceData?.verified && guidanceData.guidance) guidance = guidanceData.guidance as DelawareGuidance; } const verified: ScanResult = guidance ? { ...classified, item: guidance.title, recyclable: guidance.curbside, category: guidance.category, instructions: guidance.instructions, dnrec: guidance } : { ...classified, recyclable: false, category: "Verification required", instructions: "No disposal recommendation is shown until EcoLearn verifies an official Delaware DNREC item.", dnrec: null }; setResult(verified); if (guidance) await recordOfficial(verified); } catch (error) { Alert.alert("We couldn't scan that image", error instanceof Error ? error.message : "Try another clear photo."); } finally { setBusy(false); } };
  const explain = async () => { if (!photo || !result || busy) return; setBusy(true); try { const base64 = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 }); const { data, error } = await supabase.functions.invoke("explain-scan", { body: { image: `data:${photo.mimeType};base64,${base64}`, predictedLabel: result.item, predictedConfidence: result.confidence } }); if (error) throw error; setExplanation(data); const guidance = data?.guidance as DelawareGuidance | null | undefined; if (guidance) { const verified: ScanResult = { ...result, item: guidance.title, recyclable: guidance.curbside, category: guidance.category, instructions: guidance.instructions, dnrec: guidance }; setResult(verified); await recordOfficial(verified); } } catch (error) { Alert.alert("AI explanation unavailable", error instanceof Error ? error.message : "Please try again shortly."); } finally { setBusy(false); } };
  const submitFeedback = async (
    verdict: "correct" | "incorrect",
    includePhoto: boolean,
  ) => {
    if (!result) return;
    setBusy(true);
    try {
      let imagePath: string | null = null;
      if (includePhoto && photo) {
        const base64 = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        imagePath = `${user.id}/${Date.now()}-${photo.name.replace(/[^a-z0-9._-]/gi, "-")}`;
        const { error: uploadError } = await supabase.storage
          .from("training-feedback")
          .upload(imagePath, decode(base64), {
            contentType: photo.mimeType,
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from("scan_feedback")
        .insert({
          user_id: user.id,
          predicted_label: result.item,
          predicted_recyclable: result.recyclable,
          predicted_confidence:
            result.confidence <= 1 ? result.confidence : result.confidence / 100,
          verdict,
          issue: verdict === "incorrect" ? "wrong_item" : null,
          corrected_disposal: verdict === "incorrect" ? "not_sure" : null,
          normalized_label:
            verdict === "incorrect" ? correctedLabel : result.item.toLowerCase(),
          training_consent: Boolean(imagePath),
          ai_review_consent: Boolean(imagePath),
          image_path: imagePath,
          active_learning_reason:
            verdict === "incorrect"
              ? "user_correction"
              : result.confidence < 0.85
                ? "low_confidence"
                : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (imagePath && data?.id) {
        void supabase.functions.invoke("review-feedback", {
          body: { feedbackId: data.id },
        });
      }
      setFeedback(verdict);
      Alert.alert(
        "Thank you",
        includePhoto
          ? "Your consented feedback is ready for review."
          : "Your feedback was saved without a photo.",
      );
    } catch (error) {
      Alert.alert(
        "Could not save feedback",
        error instanceof Error ? error.message : "Try again shortly.",
      );
    } finally {
      setBusy(false);
    }
  };
  const askFeedback = (verdict: "correct" | "incorrect") => { if (verdict === "incorrect") { setFeedback("incorrect"); return; } Alert.alert("Share a photo for training?", "Only an eligible photo you explicitly share can be reviewed for future model training.", [{ text: "No photo", onPress: () => void submitFeedback("correct", false) }, { text: "Share once", onPress: () => void submitFeedback("correct", true) }, { text: "Cancel", style: "cancel" }]); };
  if (!result && !photo) return <>
    <Text style={styles.kicker}>ITEM SCANNER</Text>
    <Text style={styles.pageTitle}>Know where it goes.</Text>
    <Text style={styles.body}>Take a clear photo of one household item for practical, local disposal guidance. Every signed-in scan grows your impact.</Text>
    <View style={styles.photoBox}><Text style={styles.photoIcon}>SCAN</Text><Text style={extras.photoHint}>Use a well-lit photo with one item in view.</Text></View>
    <View style={styles.row}><Pressable style={[styles.secondaryButton, styles.half]} onPress={() => void choose(false)}><Text style={styles.secondaryText}>Choose photo</Text></Pressable><Pressable style={[styles.primaryButton, styles.half]} onPress={() => void choose(true)}><Text style={styles.primaryText}>Use camera</Text></Pressable></View>
    <Pressable style={extras.toolsLinkCard} onPress={onTools}><View><Text style={styles.smallLabel}>MORE SCAN TOOLS</Text><Text style={styles.rowTitle}>Barcode, label, and nearby sites</Text><Text style={styles.rowMeta}>Use another way to make the right call.</Text></View><Text style={styles.chevron}>›</Text></Pressable>
  </>;
  if (!result) return <><Text style={styles.kicker}>ITEM SCANNER</Text><Text style={styles.pageTitle}>Ready to scan?</Text><Text style={styles.body}>This photo will be analyzed only to provide your disposal guidance.</Text><View style={styles.photoBox}><Image source={{ uri: photo!.uri }} style={styles.fullImage} /></View><View style={styles.row}><Pressable style={[styles.secondaryButton, styles.half]} onPress={() => void choose(false)}><Text style={styles.secondaryText}>Choose another</Text></Pressable><Pressable style={[styles.primaryButton, styles.half]} onPress={() => void choose(true)}><Text style={styles.primaryText}>Use camera</Text></Pressable></View><Pressable disabled={busy} style={[styles.scanButton, busy && styles.disabled]} onPress={() => void scan()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Scan this item</Text>}</Pressable></>;
  const official = explanation?.guidance ?? result.dnrec;
  if (!official) return <><Image source={{ uri: photo?.uri }} style={styles.resultImage} /><Text style={styles.kicker}>DELAWARE VERIFICATION</Text><Text style={styles.pageTitle}>No official item match yet.</Text><View style={styles.guidanceCard}><Text style={styles.smallLabel}>DELAWARE RULES ONLY</Text><Text style={styles.guidance}>EcoLearn will not show a disposal recommendation until it matches this photo to an official Delaware DNREC Recyclopedia item.</Text><Text style={styles.tip}>• Retake a clear photo with one item in view.</Text><Text style={styles.tip}>• Or let the Delaware catalog check find an exact official item.</Text></View><Pressable disabled={busy} style={styles.explainButton} onPress={() => void explain()}>{busy ? <ActivityIndicator color="#286d3b" /> : <Text style={styles.explainText}>Check official Delaware item</Text>}</Pressable><Text style={styles.helper}>The visual check can select only from official DNREC item titles. It never creates a Delaware disposal rule.</Text>{explanation && !explanation.guidance && <Text style={styles.helper}>No official DNREC item could be verified from this photo. Try a clearer, one-item photo.</Text>}<Pressable style={styles.scanButton} onPress={() => { setResult(null); setPhoto(null); setExplanation(null); setFeedback(null); }}><Text style={styles.primaryText}>Try another photo</Text></Pressable></>;
  return <><Image source={{ uri: photo?.uri }} style={styles.resultImage} /><Text style={styles.kicker}>SCAN RESULT</Text><Text style={styles.pageTitle}>{official?.title ?? result.item}</Text><View style={[styles.badge, official?.curbside ? styles.goodBadge : styles.warnBadge]}><Text style={[styles.badgeText, official?.curbside ? styles.goodText : styles.warnText]}>{official ? `DNREC: ${official.category}` : "Needs exact Delaware item check"} · {percent(result.confidence)}% confidence</Text></View><View style={styles.guidanceCard}><Text style={styles.smallLabel}>{official ? "OFFICIAL DELAWARE DNREC PROTOCOL" : "BROAD CLASSIFIER RESULT"}</Text><Text style={styles.guidance}>{official?.instructions ?? "The scanner recognized a broad material category. Choose Explain with AI so EcoLearn can look for the exact item in Delaware DNREC Recyclopedia."}</Text>{official && <Pressable onPress={() => void Linking.openURL(official.sourceUrl)}><Text style={styles.link}>Open Delaware DNREC source</Text></Pressable>}{!official && (result.tips ?? []).map((tip) => <Text key={tip} style={styles.tip}>• {tip}</Text>)}</View><Pressable disabled={busy} style={styles.explainButton} onPress={() => void explain()}>{busy ? <ActivityIndicator color="#286d3b" /> : <Text style={styles.explainText}>Explain with AI + check DNREC</Text>}</Pressable><Text style={styles.helper}>The AI identifies the visible item; Delaware disposal rules and links are supplied only by official DNREC data. Your image is sent to AI only when you choose this and is not stored through this feature.</Text>{explanation && <View style={styles.explanation}><Text style={styles.rowTitle}>{explanation.observedItem}</Text><Text style={styles.body}>{explanation.explanation}</Text><Text style={styles.helper}>{explanation.caution}</Text></View>}<Text style={styles.sectionTitle}>Was this helpful?</Text>{feedback === "incorrect" ? <><Text style={styles.body}>Choose the more accurate broad label, then submit your correction.</Text><View style={styles.chips}>{labels.map((label) => <Pressable key={label} onPress={() => setCorrectedLabel(label)} style={[styles.chip, correctedLabel === label && styles.chipActive]}><Text style={[styles.chipText, correctedLabel === label && styles.chipTextActive]}>{label}</Text></Pressable>)}</View><Pressable style={styles.primaryButton} onPress={() => Alert.alert("Share this photo for training?", "A human reviewer checks consented corrections before they can improve the classifier.", [{ text: "No photo", onPress: () => void submitFeedback("incorrect", false) }, { text: "Share once", onPress: () => void submitFeedback("incorrect", true) }, { text: "Cancel", style: "cancel" }])}><Text style={styles.primaryText}>Submit correction</Text></Pressable></> : <View style={styles.row}><Pressable style={[styles.secondaryButton, styles.half]} onPress={() => askFeedback("correct")}><Text style={styles.secondaryText}>Yes, correct</Text></Pressable><Pressable style={[styles.warnButton, styles.half]} onPress={() => askFeedback("incorrect")}><Text style={styles.warnText}>Needs correction</Text></Pressable></View>}<Pressable style={styles.scanButton} onPress={() => { setResult(null); setPhoto(null); setExplanation(null); setFeedback(null); }}><Text style={styles.primaryText}>Scan another item</Text></Pressable></>;
}

function LearnScreen({ completed, onCompleted }: { completed: string[]; onCompleted: () => Promise<void> }) { const [active, setActive] = useState<Lesson | null>(null); const [choice, setChoice] = useState<number | null>(null); const complete = async () => { if (!active || choice !== active.answer) return; const { error } = await supabase.rpc("complete_ecolearn_lesson", { p_lesson_id: active.id, p_selected_answer: choice }); if (error) return Alert.alert("Could not save lesson", error.message); await onCompleted(); Alert.alert("Lesson complete", `+${active.xp} XP earned.`); setActive(null); setChoice(null); }; if (active) return <><Text style={styles.kicker}>{active.topic.toUpperCase()}</Text><Text style={styles.pageTitle}>{active.title}</Text><Text style={styles.body}>{active.summary}</Text><Text style={styles.question}>{active.question}</Text>{active.choices.map((item, index) => <Pressable key={item} onPress={() => setChoice(index)} style={[styles.answer, choice === index && styles.answerActive]}><Text style={styles.answerText}>{item}</Text></Pressable>)}{choice !== null && <Text style={styles.helper}>{choice === active.answer ? active.explanation : "Not quite—review the lesson and choose again."}</Text>}<Pressable disabled={choice !== active.answer} style={[styles.primaryButton, choice !== active.answer && styles.disabled]} onPress={() => void complete()}><Text style={styles.primaryText}>Complete lesson</Text></Pressable><Pressable onPress={() => { setActive(null); setChoice(null); }}><Text style={styles.link}>Back to lessons</Text></Pressable></>; return <><Text style={styles.kicker}>LEARN BY DOING</Text><Text style={styles.pageTitle}>Build your eco instinct.</Text><Text style={styles.body}>{completed.length} of {lessons.length} lessons complete.</Text>{lessons.map((lesson, index) => { const done = completed.includes(lesson.id); const unlocked = index === 0 || completed.includes(lessons[index - 1].id); return <Pressable key={lesson.id} disabled={!unlocked} onPress={() => setActive(lesson)} style={[styles.lessonCard, !unlocked && styles.disabled]}><View style={styles.number}><Text style={styles.numberText}>{done ? "✓" : index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.smallLabel}>{lesson.topic.toUpperCase()} · {lesson.duration}</Text><Text style={styles.rowTitle}>{lesson.title}</Text><Text style={styles.rowMeta}>{done ? "Complete — tap to review" : unlocked ? `${lesson.xp} XP` : "Finish the previous lesson"}</Text></View></Pressable>; })}</>; }

function QuestsScreen({ progress }: { progress: Progress | null }) {
  const scans = progress?.total_scans ?? 0;
  const lessonsDone = progress?.total_lessons_completed ?? 0;
  const quests = [
    { title: "The clean bin", detail: "Scan 3 household items and sort with confidence.", current: Math.min(scans, 3), target: 3, reward: "30 XP" },
    { title: "Lesson learner", detail: "Finish a lesson and strengthen your eco instinct.", current: Math.min(lessonsDone, 1), target: 1, reward: "25 XP" },
    { title: "Seven-day glow", detail: "Keep building your daily eco habit.", current: Math.min(progress?.streak_days ?? 0, 7), target: 7, reward: "100 XP" },
  ];
  return <>
    <Text style={styles.kicker}>MAKE IT A GAME</Text>
    <Text style={styles.pageTitle}>Quests with purpose.</Text>
    <Text style={styles.body}>Your real scans and completed lessons count toward these challenges.</Text>
    {quests.map((quest) => <View key={quest.title} style={questStyles.card}>
      <Text style={questStyles.reward}>{quest.reward}</Text>
      <Text style={styles.rowTitle}>{quest.title}</Text>
      <Text style={styles.body}>{quest.detail}</Text>
      <View style={questStyles.track}><View style={[questStyles.fill, { width: `${Math.round((quest.current / quest.target) * 100)}%` }]} /></View>
      <Text style={styles.rowMeta}>{quest.current} of {quest.target} complete</Text>
    </View>)}
    <Text style={styles.sectionTitle}>Community ranks</Text>
    <View style={questStyles.card}>
      <Text style={styles.rowMeta}>This early community view is motivational only; personal scan history remains private.</Text>
      {["Maya Green", "Jordan Lee", "You", "Sam Rivera"].map((name, index) => <View key={name} style={questStyles.rankRow}>
        <Text style={questStyles.rank}>{index + 1}</Text>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={questStyles.rankXp}>{index === 2 ? `${progress?.xp ?? 0} XP` : `${420 - index * 70} XP`}</Text>
      </View>)}
    </View>
  </>;
}

function LeaderboardScreen({ progress }: { progress: Progress | null }) {
  const yourXp = progress?.xp ?? 0;
  const players = [
    { name: "Maya Chen", initials: "MC", xp: Math.max(yourXp + 1640, 1640), tone: "#f4d2a4" },
    { name: "Jordan Kim", initials: "JK", xp: Math.max(yourXp + 1215, 1215), tone: "#cde3f5" },
    { name: "You", initials: "YO", xp: yourXp, tone: "#d9edcf" },
    { name: "Noah Williams", initials: "NW", xp: Math.max(yourXp - 135, 0), tone: "#ded2f2" },
  ].sort((left, right) => right.xp - left.xp);
  return <>
    <Text style={styles.kicker}>COMMUNITY IMPACT</Text>
    <Text style={styles.pageTitle}>Better together.</Text>
    <Text style={styles.body}>A friendly view of this week's EcoLearn champions. Your scan history stays private.</Text>
    <View style={questStyles.card}>
      <Text style={styles.smallLabel}>DELAWARE</Text>
      <Text style={styles.rowTitle}>This week's eco champions</Text>
      {players.map((player, index) => <View key={player.name} style={[questStyles.rankRow, player.name === "You" && questStyles.youRow]}>
        <Text style={questStyles.rank}>{index + 1}</Text>
        <View style={[questStyles.avatar, { backgroundColor: player.tone }]}><Text style={questStyles.avatarText}>{player.initials}</Text></View>
        <Text style={styles.rowTitle}>{player.name}</Text>
        <Text style={questStyles.rankXp}>{player.xp.toLocaleString()} XP</Text>
      </View>)}
    </View>
  </>;
}

function ToolsScreen() { const [barcode, setBarcode] = useState(""); const [barcodeResult, setBarcodeResult] = useState<any>(null); const [toolBusy, setToolBusy] = useState(false); const [labelResult, setLabelResult] = useState<any>(null); const [sites, setSites] = useState<Site[]>([]); const [siteType, setSiteType] = useState("recycling"); const lookupBarcode = async () => { const code = barcode.replace(/\D/g, ""); if (code.length < 8 || code.length > 14) return Alert.alert("Enter a valid barcode", "Use the 8–14 digits below the bars."); setToolBusy(true); try { const { data, error } = await supabase.functions.invoke("lookup-barcode", { body: { barcode: code } }); if (error) throw error; setBarcodeResult(data); } catch { Alert.alert("Barcode lookup is unavailable", "Try again shortly or use item scanning."); } finally { setToolBusy(false); } }; const readLabel = async () => { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return Alert.alert("Permission needed", "Allow photo access to read a label."); const response = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 }); if (response.canceled || !response.assets[0]) return; Alert.alert("Send label to AI?", "This is separate from training consent. The image is used only to read its visible label and symbols.", [{ text: "Cancel", style: "cancel" }, { text: "Continue", onPress: async () => { setToolBusy(true); try { const asset = response.assets[0]; const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }); const { data, error } = await supabase.functions.invoke("read-label", { body: { image: `data:${asset.mimeType ?? "image/jpeg"};base64,${base64}` } }); if (error) throw error; setLabelResult(data); } catch { Alert.alert("Could not read that label", "Use a clearer, well-lit photo and try again."); } finally { setToolBusy(false); } } }]); }; const nearby = async () => { const permission = await Location.requestForegroundPermissionsAsync(); if (!permission.granted) return Alert.alert("Location permission needed", "Allow location access to see nearby disposal sites."); setToolBusy(true); try { const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); const { data, error } = await supabase.functions.invoke("find-disposal-sites", { body: { latitude: location.coords.latitude, longitude: location.coords.longitude, type: siteType } }); if (error) throw error; setSites(data?.sites ?? []); } catch { Alert.alert("Nearby search is unavailable", "Try again shortly."); } finally { setToolBusy(false); } }; return <><Text style={styles.kicker}>SMART TOOLS</Text><Text style={styles.pageTitle}>More ways to decide.</Text><View style={styles.toolCard}><Text style={styles.rowTitle}>Barcode lookup</Text><Text style={styles.body}>Enter the digits below a product barcode.</Text><TextInput style={styles.input} value={barcode} onChangeText={setBarcode} keyboardType="number-pad" placeholder="8–14 digit barcode" /><Pressable style={styles.primaryButton} onPress={() => void lookupBarcode()}><Text style={styles.primaryText}>{toolBusy ? "Looking up…" : "Look up barcode"}</Text></Pressable>{barcodeResult && <Text style={styles.body}>{barcodeResult.found ? `${barcodeResult.name ?? "Product found"}${barcodeResult.guidance ? ` — ${barcodeResult.guidance}` : ""}` : "No product match found."}</Text>}</View><View style={styles.toolCard}><Text style={styles.rowTitle}>Read a package label</Text><Text style={styles.body}>Read visible material and recycling symbols from a selected photo.</Text><Pressable style={styles.secondaryButton} onPress={() => void readLabel()}><Text style={styles.secondaryText}>Choose label photo</Text></Pressable>{labelResult && <Text style={styles.body}>{labelResult.guidance}{labelResult.materials?.length ? `\nMaterials: ${labelResult.materials.join(", ")}` : ""}</Text>}</View><View style={styles.toolCard}><Text style={styles.rowTitle}>Nearby disposal sites</Text><Text style={styles.body}>Find a local option, then confirm its accepted materials and hours.</Text><View style={styles.chips}>{["recycling", "battery", "electronics", "textile"].map((type) => <Pressable key={type} onPress={() => setSiteType(type)} style={[styles.chip, siteType === type && styles.chipActive]}><Text style={[styles.chipText, siteType === type && styles.chipTextActive]}>{type}</Text></Pressable>)}</View><Pressable style={styles.primaryButton} onPress={() => void nearby()}><Text style={styles.primaryText}>Find nearby sites</Text></Pressable>{sites.map((site) => <Pressable key={site.id} style={styles.siteCard} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`)}><Text style={styles.rowTitle}>{site.name}</Text><Text style={styles.rowMeta}>{site.address ?? site.type} · {site.distanceKm.toFixed(1)} km away</Text></Pressable>)}</View></>; }

function ProfileScreen({ user, progress }: { user: User; progress: Progress | null }) { const [name, setName] = useState(String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "")); const [notifications, setNotifications] = useState(true); const [saving, setSaving] = useState(false); useEffect(() => { void supabase.from("user_settings").select("display_name,notifications_enabled").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data) { setName(data.display_name ?? name); setNotifications(data.notifications_enabled ?? true); } }); }, []); const save = async () => { setSaving(true); const clean = name.trim().slice(0, 80); const [{ error: settingError }, { error: authError }] = await Promise.all([supabase.from("user_settings").upsert({ user_id: user.id, display_name: clean || null, notifications_enabled: notifications, updated_at: new Date().toISOString() }), supabase.auth.updateUser({ data: { full_name: clean } })]); setSaving(false); if (settingError || authError) Alert.alert("Could not save profile", (settingError ?? authError)?.message); else Alert.alert("Profile updated", "Your preferences are saved."); }; return <><View style={styles.profileCircle}><Text style={styles.profileInitials}>{(name || user.email || "E").slice(0, 2).toUpperCase()}</Text></View><Text style={styles.pageTitle}>{name || "Eco explorer"}</Text><Text style={styles.body}>{user.email}</Text><View style={styles.stats}><Stat value={String(progress?.xp ?? 0)} label="XP" /><Stat value={String(progress?.total_scans ?? 0)} label="Scans" /><Stat value={String(progress?.total_lessons_completed ?? 0)} label="Lessons" /></View><Text style={styles.sectionTitle}>Profile settings</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Display name" /><View style={styles.setting}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Notifications</Text><Text style={styles.rowMeta}>Receive future EcoLearn updates on this device.</Text></View><Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: "#74ad76" }} /></View><Pressable style={styles.primaryButton} onPress={() => void save()}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save settings</Text>}</Pressable><Pressable style={styles.signOut} onPress={() => void supabase.auth.signOut()}><Text style={styles.signOutText}>Sign out</Text></Pressable></>; }

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.rowMeta}>{label}</Text></View>; }

const questStyles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#dfe7db",
    borderRadius: 19,
    backgroundColor: "#fff",
    padding: 16,
  },
  reward: {
    alignSelf: "flex-start",
    borderRadius: 9,
    backgroundColor: "#fff2d5",
    color: "#956609",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#e5ece2",
    marginTop: 16,
  },
  fill: { height: "100%", backgroundColor: "#70ad70" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e7ede4",
    marginTop: 10,
    paddingTop: 10,
  },
  rank: { width: 26, color: "#397d48", fontWeight: "800", textAlign: "center" },
  rankXp: { marginLeft: "auto", color: "#397d48", fontSize: 12, fontWeight: "800" },
  youRow: { backgroundColor: "#f1f8ed", marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#24412e", fontSize: 11, fontWeight: "800" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f4" }, center: { flex: 1, justifyContent: "center", padding: 28 }, page: { padding: 22, paddingBottom: 104 }, authPage: { flexGrow: 1, justifyContent: "center", padding: 26 }, appHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14 }, logo: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#173d2a" }, logoText: { color: "#fff", fontSize: 21, fontWeight: "800" }, brand: { marginLeft: 9, color: "#173d2a", fontSize: 21, fontWeight: "800" }, brandLarge: { color: "#173d2a", fontSize: 31, fontWeight: "800", letterSpacing: -1.3 }, xp: { marginLeft: "auto", color: "#337943", fontSize: 13, fontWeight: "800" }, kicker: { color: "#4d9557", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, hero: { marginTop: 9, color: "#173d2a", fontSize: 39, lineHeight: 42, fontWeight: "800", letterSpacing: -1.8 }, heroAccent: { color: "#529c5a" }, pageTitle: { marginTop: 8, color: "#173d2a", fontSize: 34, lineHeight: 39, fontWeight: "800", letterSpacing: -1.4 }, body: { marginTop: 10, color: "#66746a", fontSize: 14, lineHeight: 21 }, heroCard: { marginTop: 27, borderRadius: 24, backgroundColor: "#173d2a", padding: 21 }, cardEyebrow: { color: "#a8d697", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, cardTitle: { marginTop: 8, color: "#fff", fontSize: 21, fontWeight: "800" }, cardText: { marginTop: 7, color: "#d4e4d1", fontSize: 14, lineHeight: 20 }, lightButton: { alignSelf: "flex-start", marginTop: 18, borderRadius: 12, backgroundColor: "#e5f3dd", paddingHorizontal: 15, paddingVertical: 11 }, lightText: { color: "#214c2e", fontWeight: "800" }, sectionTitle: { marginTop: 28, marginBottom: 12, color: "#173d2a", fontSize: 20, fontWeight: "800" }, rowCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 18, backgroundColor: "#fff", padding: 15 }, iconSquare: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#e4f3dc" }, smallLabel: { color: "#748177", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 }, rowTitle: { marginTop: 3, color: "#173d2a", fontSize: 16, fontWeight: "800" }, rowMeta: { marginTop: 4, color: "#738075", fontSize: 12, lineHeight: 18 }, chevron: { color: "#3f864c", fontSize: 28 }, nav: { position: "absolute", left: 12, right: 12, bottom: 13, flexDirection: "row", justifyContent: "space-around", borderRadius: 18, backgroundColor: "#173d2a", padding: 7 }, navItem: { borderRadius: 11, paddingHorizontal: 8, paddingVertical: 8 }, navActive: { backgroundColor: "#315845" }, navText: { color: "#b9d2bc", fontSize: 10, fontWeight: "800" }, navTextActive: { color: "#fff" }, input: { marginTop: 12, borderWidth: 1, borderColor: "#d9e3d6", borderRadius: 13, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 13, color: "#173d2a" }, primaryButton: { alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 13, backgroundColor: "#173d2a", paddingVertical: 14, paddingHorizontal: 14 }, primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" }, secondaryButton: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 13, backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 14 }, secondaryText: { color: "#286d3b", fontSize: 14, fontWeight: "800" }, googleButton: { alignItems: "center", marginTop: 27, borderWidth: 1, borderColor: "#d7dfd4", borderRadius: 13, backgroundColor: "#fff", paddingVertical: 14 }, googleText: { color: "#173d2a", fontWeight: "800" }, or: { marginVertical: 20, color: "#8c988e", textAlign: "center", fontSize: 11, fontWeight: "800", letterSpacing: 1 }, link: { marginTop: 18, color: "#287640", textAlign: "center", fontSize: 14, fontWeight: "800" }, legal: { marginTop: 22, color: "#89948b", textAlign: "center", fontSize: 11, lineHeight: 17 }, photoBox: { alignItems: "center", justifyContent: "center", height: 272, marginTop: 24, overflow: "hidden", borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 24, backgroundColor: "#eef8eb" }, photoIcon: { color: "#397e48", fontSize: 52 }, fullImage: { width: "100%", height: "100%" }, row: { flexDirection: "row", gap: 10, marginTop: 13 }, half: { flex: 1 }, scanButton: { alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 13, backgroundColor: "#3d8c4c", paddingVertical: 15 }, disabled: { opacity: 0.42 }, resultImage: { width: "100%", aspectRatio: 1, borderRadius: 23, marginBottom: 23 }, badge: { alignSelf: "flex-start", marginTop: 14, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8 }, goodBadge: { backgroundColor: "#e0f3da" }, warnBadge: { backgroundColor: "#fff0e9" }, badgeText: { fontSize: 12, fontWeight: "800" }, goodText: { color: "#256c38" }, warnText: { color: "#a25143" }, guidanceCard: { marginTop: 18, borderWidth: 1, borderColor: "#dce8d8", borderRadius: 19, backgroundColor: "#fff", padding: 17 }, guidance: { marginTop: 9, color: "#274033", fontSize: 15, lineHeight: 23, fontWeight: "700" }, tip: { marginTop: 9, color: "#617166", fontSize: 13, lineHeight: 19 }, explainButton: { alignItems: "center", justifyContent: "center", marginTop: 12, borderWidth: 1, borderColor: "#6aa574", borderRadius: 13, backgroundColor: "#f5fbf2", paddingVertical: 14 }, explainText: { color: "#286d3b", fontSize: 14, fontWeight: "800" }, helper: { marginTop: 10, color: "#77847a", fontSize: 11, lineHeight: 17 }, explanation: { marginTop: 13, borderWidth: 1, borderColor: "#dce8d8", borderRadius: 17, backgroundColor: "#f7fbf4", padding: 15 }, warnButton: { alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#fff0ed", paddingVertical: 14, paddingHorizontal: 14 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 }, chip: { borderWidth: 1, borderColor: "#d5ded2", borderRadius: 99, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 7 }, chipActive: { borderColor: "#347e45", backgroundColor: "#e6f4e1" }, chipText: { color: "#647368", fontSize: 12, fontWeight: "700" }, chipTextActive: { color: "#286536" }, lessonCard: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 13, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 18, backgroundColor: "#fff", padding: 15 }, number: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#e5f3dd" }, numberText: { color: "#357d44", fontWeight: "800" }, question: { marginTop: 24, color: "#173d2a", fontSize: 19, lineHeight: 27, fontWeight: "800" }, answer: { marginTop: 10, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 14, backgroundColor: "#fff", padding: 14 }, answerActive: { borderColor: "#4c9856", backgroundColor: "#e9f5e4" }, answerText: { color: "#365342", fontSize: 14, lineHeight: 20, fontWeight: "700" }, toolCard: { marginTop: 18, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 19, backgroundColor: "#fff", padding: 16 }, siteCard: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e7ede4", paddingTop: 10 }, profileCircle: { width: 78, height: 78, alignItems: "center", justifyContent: "center", borderRadius: 39, backgroundColor: "#cde9be" }, profileInitials: { color: "#285c35", fontSize: 24, fontWeight: "800" }, stats: { flexDirection: "row", gap: 9, marginTop: 23 }, stat: { flex: 1, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 14, backgroundColor: "#fff", padding: 12 }, statValue: { color: "#1e512f", fontSize: 21, fontWeight: "800" }, setting: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, borderRadius: 14, backgroundColor: "#fff", padding: 14 }, signOut: { alignItems: "center", marginTop: 18, padding: 12 }, signOutText: { color: "#b44b3c", fontSize: 14, fontWeight: "800" },
});

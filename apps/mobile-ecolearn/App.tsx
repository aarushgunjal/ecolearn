import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import MapView, { Marker } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Session, User } from "@supabase/supabase-js";
import { isConfigured, supabase } from "./src/supabase";
import { challengeDefinitions, dswaVideoForItem, lessonEditorial } from "./src/content";
import { CommunityScreen } from "./src/CommunityScreen";
import { MapScreen } from "./src/MapScreen";
import ecoLearnIcon from "./assets/ecolearn-icon-v2.png";

WebBrowser.maybeCompleteAuthSession();

type Tab = "Home" | "Scan" | "Map" | "Learn" | "Community" | "Challenges" | "Profile";
type Photo = { uri: string; name: string; mimeType: string; base64?: string | null };
type ScanResult = { item: string; recyclable: boolean; confidence: number; category: string; instructions: string; tips?: string[]; imageStatus?: "single_item" | "multiple_items" | "unclear"; material?: string | null; visibleEvidence?: string | null; dnrec?: DelawareGuidance | null };
type DelawareGuidance = { title: string; category: string; curbside: boolean; instructions: string; sourceName: string; sourceUrl: string; matchConfidence?: number };
type VisionScanResponse = { verified: boolean; guidance: DelawareGuidance | null; observedItem: string | null; material: string | null; confidence: number; imageStatus: "single_item" | "multiple_items" | "unclear"; visibleEvidence: string | null; nextSteps: string[]; message: string };
type Progress = { xp: number; level: number; total_scans: number; total_lessons_completed: number; streak_days: number; last_activity_date?: string | null };
type Site = { id: string; name: string; type: string; latitude: number; longitude: number; distanceKm: number; address?: string; services?: string[]; sourceUrl?: string; provider?: string };
const milesFromKm = (kilometers: number) => kilometers * 0.621371;
type Lesson = { id: string; slug: string; title: string; topic: string; description: string | null; duration_minutes: number; xp_reward: number; sort_order: number };
type Achievement = { id: string; title: string; description: string | null; icon: string; requirement_type: "scans" | "lessons" | "streak" | "level"; requirement_value: number };
type ScanHistoryItem = { id: string; item_name: string; category: string | null; is_recyclable: boolean; created_at: string };
type DelawareSuggestion = { title: string; category: string };
type BarcodeResult = { found: boolean; name?: string | null; guidance?: string | null };
type LabelResult = { guidance: string; materials: string[]; text?: string | null; recyclingSymbols?: string[] };
type MapSearchRequest = { item: string; requestId: number };

const usingExpoGo = Constants.appOwnership === "expo";
const publicSiteUrl = "https://ecolearn.dev";
const openPublicPage = (path: "/privacy" | "/terms" | "/delete-account" | "/support" | "/licenses") =>
  Linking.openURL(`${publicSiteUrl}${path}`);
const appVersion = Constants.expoConfig?.version ?? "1.0.0";
const nativeBuildVersion = Constants.nativeBuildVersion ?? "1";
const percent = (value: number) => Math.round(value <= 1 ? value * 100 : Math.min(100, value));
const photoFromAsset = (asset: ImagePicker.ImagePickerAsset): Photo => ({ uri: asset.uri, name: asset.fileName ?? "ecolearn-photo.jpg", mimeType: asset.base64 ? "image/jpeg" : asset.mimeType ?? "image/jpeg", base64: asset.base64 });
const functionErrorMessage = async (
  error: unknown,
  fallback = "EcoLearn could not complete the visual item check.",
) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
      } catch {
        // Fall through to the standard client message.
      }
    }
  }
  return error instanceof Error && error.message
    ? error.message
    : fallback;
};
const newRequestId = () => {
  const part = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${part()}${part()}-${part()}-4${part().slice(1)}-a${part().slice(1)}-${part()}${part()}${part()}`;
};
const extras = StyleSheet.create({
  appleButton: { width: "100%", height: 48, marginTop: 27 },
  googleAfterApple: { marginTop: 12 },
  headerStreak: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 99, backgroundColor: "#fff3d5", paddingHorizontal: 10, paddingVertical: 7 },
  headerStreakText: { color: "#976700", fontSize: 11, fontWeight: "800" },
  headerProfile: { width: 34, height: 34, marginLeft: 7, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#e6f2df" },
  webNav: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e2e7df", backgroundColor: "#ffffff", paddingHorizontal: 8, paddingTop: 7, paddingBottom: 4 },
  webNavItem: { flex: 1, alignItems: "center", gap: 3, borderRadius: 13, paddingHorizontal: 4, paddingVertical: 7 },
  webNavActive: { backgroundColor: "#e8f3df" },
  webNavText: { color: "#77847a", fontSize: 10, fontWeight: "700" },
  webNavTextActive: { color: "#237342" },
  photoHint: { marginTop: 8, color: "#5b8061", fontSize: 12, textAlign: "center" },
  toolsLinkCard: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 18, backgroundColor: "#fff", padding: 16 },
  map: { height: 330, marginTop: 16, borderRadius: 16 },
  selectedSite: { marginHorizontal: -8, borderRadius: 12, backgroundColor: "#f0f8ec", paddingHorizontal: 8, paddingBottom: 8 },
  siteActions: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
});

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const handledAuthLinks = useRef(new Set<string>());

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoadingSession(false); });
    const consumeAuthLink = async (url: string) => {
      if (handledAuthLinks.current.has(url)) return;
      handledAuthLinks.current.add(url);
      const callback = new URL(url.replace("#", "?"));
      const authError = callback.searchParams.get("error_description") ?? callback.searchParams.get("error");
      if (authError) {
        Alert.alert("Could not confirm email", authError);
        return;
      }
      const accessToken = callback.searchParams.get("access_token");
      const refreshToken = callback.searchParams.get("refresh_token");
      if (!accessToken || !refreshToken) return;
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        Alert.alert("Could not open sign-in link", error.message);
        return;
      }
      const linkType = callback.searchParams.get("type");
      if (linkType === "recovery") {
        setRecoveringPassword(true);
      } else if (linkType === "signup" || linkType === "email" || linkType === "invite") {
        Alert.alert(
          "Your email is confirmed",
          "Welcome to EcoLearn. You’re signed in and ready to get started.",
        );
      }
    };
    void ExpoLinking.getInitialURL().then((url) => { if (url) void consumeAuthLink(url); });
    const linkListener = ExpoLinking.addEventListener("url", ({ url }) => { void consumeAuthLink(url); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
    });
    return () => {
      linkListener.remove();
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!isConfigured) return <ConfigurationScreen />;
  if (loadingSession) return <LoadingScreen message="Opening EcoLearn…" />;
  if (recoveringPassword && session) return <PasswordRecoveryScreen onComplete={() => setRecoveringPassword(false)} />;
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
    const response = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: ExpoLinking.createURL("auth/callback") },
        });
    setBusy(false);
    if (response.error) return Alert.alert("Could not continue", response.error.message);
    if (mode === "signup" && !response.data.session) {
      Alert.alert(
        "Check your email",
        "Open the EcoLearn confirmation link on this device. EcoLearn will reopen, confirm your email, and sign you in automatically.",
      );
    }
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
  const apple = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const state = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        state,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.state !== state) throw new Error("Apple sign-in could not be verified. Please try again.");
      if (!credential.identityToken) throw new Error("Apple did not return an identity token.");
      const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
      if (error) throw error;
      const fullName = [credential.fullName?.givenName, credential.fullName?.middleName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      if (fullName) {
        const { error: profileError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: credential.fullName?.givenName,
            family_name: credential.fullName?.familyName,
          },
        });
        if (profileError) throw profileError;
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple sign-in unavailable", error instanceof Error ? error.message : "Please try again or use email sign-in.");
      }
    } finally {
      setBusy(false);
    }
  };
  const resetPassword = async () => {
    if (!email.trim()) return Alert.alert("Enter your email", "Enter the email address for your EcoLearn account first.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: ExpoLinking.createURL("auth/reset-password"),
    });
    setBusy(false);
    if (error) return Alert.alert("Could not send reset email", error.message);
    Alert.alert("Check your email", "Open the EcoLearn password-reset link on this device to choose a new password.");
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled"><Text style={styles.brandLarge}>ecolearn</Text><Text style={styles.pageTitle}>{mode === "signin" ? "Welcome back." : "Start your impact."}</Text><Text style={styles.body}>Save scans, learn sustainable habits, and build a more circular world.</Text>{Platform.OS === "ios" && <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={13} style={extras.appleButton} onPress={() => void apple()} />}<Pressable onPress={() => void google()} disabled={busy} style={[styles.googleButton, Platform.OS === "ios" && extras.googleAfterApple, usingExpoGo && styles.disabled]}><Text style={styles.googleText}>{usingExpoGo ? "Google sign-in needs development build" : "Continue with Google"}</Text></Pressable>{usingExpoGo && <Text style={styles.helper}>For Expo Go testing, use email/password. Google works in the later EcoLearn development build.</Text>}<Text style={styles.or}>OR WITH EMAIL</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" style={styles.input} /><TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Password" style={styles.input} /><Pressable onPress={() => void submit()} disabled={busy} style={styles.primaryButton}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>}</Pressable>{mode === "signin" && <Pressable onPress={() => void resetPassword()} disabled={busy}><Text style={styles.link}>Forgot password?</Text></Pressable>}<Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}><Text style={styles.link}>{mode === "signin" ? "New to EcoLearn? Create an account" : "Already a member? Sign in"}</Text></Pressable><Text style={styles.legal}>By continuing, you agree to EcoLearn’s <Text style={styles.legalLink} onPress={() => void openPublicPage("/terms")}>Terms of Service</Text> and <Text style={styles.legalLink} onPress={() => void openPublicPage("/privacy")}>Privacy Policy</Text>.</Text>{mode === "signup" && <Text style={styles.legal}>Learners under 13 need a parent, guardian, or authorized school to create and manage their account.</Text>}</ScrollView></SafeAreaView>;
}

function PasswordRecoveryScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (password.length < 8) return Alert.alert("Use a stronger password", "Your new password must contain at least eight characters.");
    if (password !== confirmation) return Alert.alert("Passwords do not match", "Enter the same new password twice.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return Alert.alert("Could not update password", error.message);
    Alert.alert("Password updated", "You can continue using EcoLearn with your new password.", [{ text: "Continue", onPress: onComplete }]);
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled"><Text style={styles.brandLarge}>ecolearn</Text><Text style={styles.pageTitle}>Choose a new password.</Text><Text style={styles.body}>Use at least eight characters and keep it private.</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="New password" style={styles.input} /><TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" placeholder="Confirm new password" style={styles.input} /><Pressable onPress={() => void save()} disabled={busy} style={styles.primaryButton}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save new password</Text>}</Pressable></ScrollView></SafeAreaView>;
}

function EcoLearnApp({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("Home");
  const [showScanTools, setShowScanTools] = useState(false);
  const [mapSearchRequest, setMapSearchRequest] = useState<MapSearchRequest | null>(null);
  const mapSearchRequestId = useRef(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [earnedAchievementIds, setEarnedAchievementIds] = useState<string[]>([]);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [rewardClaims, setRewardClaims] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState(() => String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""));
  const [refreshing, setRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setDataError(null);
    const results = await Promise.all([
      supabase.from("user_progress").select("xp,level,total_scans,total_lessons_completed,streak_days,last_activity_date").eq("user_id", user.id).maybeSingle(),
      supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("status", "completed"),
      supabase.from("lessons").select("id,slug,title,topic,description,duration_minutes,xp_reward,sort_order").eq("is_published", true).order("sort_order"),
      supabase.from("achievements").select("id,title,description,icon,requirement_type,requirement_value").order("requirement_value"),
      supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
      supabase.from("scan_history").select("id,item_name,category,is_recyclable,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("reward_claims").select("reward_key").eq("user_id", user.id),
      supabase.from("user_settings").select("display_name").eq("user_id", user.id).maybeSingle(),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) setDataError("Some account data could not be refreshed. Pull down to try again.");
    const [progressResult, lessonProgress, lessonsResult, achievementsResult, earnedResult, scansResult, claimsResult, settingsResult] = results;
    if (progressResult.data) setProgress(progressResult.data as Progress);
    setCompleted(((lessonProgress.data ?? []) as Array<{ lesson_id: string }>).map((row) => row.lesson_id));
    setLessons((lessonsResult.data ?? []) as Lesson[]);
    setAchievements((achievementsResult.data ?? []) as Achievement[]);
    setEarnedAchievementIds(((earnedResult.data ?? []) as Array<{ achievement_id: string }>).map((row) => row.achievement_id));
    setRecentScans((scansResult.data ?? []) as ScanHistoryItem[]);
    setRewardClaims(((claimsResult.data ?? []) as Array<{ reward_key: string }>).map((row) => row.reward_key));
    const savedName = (settingsResult.data as { display_name?: string | null } | null)?.display_name;
    if (savedName) setDisplayName(savedName);
  }, [user.id]);
  useEffect(() => { void refresh(); }, [refresh]);
  const refreshAll = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };
  const openTab = (next: Tab, tools = false) => {
    setShowScanTools(tools);
    if (next === "Map") setMapSearchRequest(null);
    setTab(next);
  };
  const openMapForItem = (item: string) => {
    mapSearchRequestId.current += 1;
    setShowScanTools(false);
    setMapSearchRequest({ item, requestId: mapSearchRequestId.current });
    setTab("Map");
  };
  const consumeMapSearchRequest = useCallback(() => setMapSearchRequest(null), []);
  const screen = tab === "Home"
    ? <Home user={user} displayName={displayName} progress={progress} lessons={lessons} completed={completed} achievements={achievements} earnedAchievementIds={earnedAchievementIds} recentScans={recentScans} onScan={() => openTab("Scan")} onLearn={() => openTab("Learn")} onMap={() => openTab("Map")} onCommunity={() => openTab("Community")} onChallenges={() => openTab("Challenges")} />
    : tab === "Scan"
      ? showScanTools ? <ToolsScreen onBack={() => setShowScanTools(false)} /> : <ScanScreen onRecorded={refresh} onTools={() => setShowScanTools(true)} onNearby={openMapForItem} />
      : tab === "Map"
        ? <MapScreen initialItem={mapSearchRequest?.item} searchRequestId={mapSearchRequest?.requestId} onInitialSearchHandled={consumeMapSearchRequest} />
      : tab === "Learn"
        ? <LearnScreen lessons={lessons} completed={completed} onCompleted={refresh} />
        : tab === "Community"
          ? <CommunityScreen onOpenLesson={() => openTab("Learn")} />
        : tab === "Challenges"
          ? <QuestsScreen progress={progress} claims={rewardClaims} achievements={achievements} earnedAchievementIds={earnedAchievementIds} onRefresh={refresh} />
          : <ProfileScreen user={user} progress={progress} achievements={achievements} earnedAchievementIds={earnedAchievementIds} onNameSaved={setDisplayName} />;
  const navItems: { tab: Tab; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { tab: "Home", icon: "home-outline", activeIcon: "home", label: "Home" },
    { tab: "Scan", icon: "scan-outline", activeIcon: "scan", label: "Scan" },
    { tab: "Map", icon: "map-outline", activeIcon: "map", label: "Map" },
    { tab: "Learn", icon: "book-outline", activeIcon: "book", label: "Learn" },
    { tab: "Community", icon: "people-outline", activeIcon: "people", label: "Community" },
  ];
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" />
    <View style={styles.appHeader}>
      <Image source={ecoLearnIcon} style={styles.logoImage} />
      <View><Text style={styles.brand}>EcoLearn</Text><Text style={styles.headerSubtitle}>Delaware-first guidance</Text></View>
      <View style={extras.headerStreak}><Ionicons name="flame" size={14} color="#9a6800" /><Text style={extras.headerStreakText}>{progress?.streak_days ?? 0} day streak</Text></View>
      <Pressable accessibilityLabel="Open profile" onPress={() => openTab("Profile")} style={extras.headerProfile}><Ionicons name="person" size={17} color="#245533" /></Pressable>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} tintColor="#2f7a43" />} keyboardShouldPersistTaps="handled">
      {dataError && <View style={styles.notice}><Ionicons name="cloud-offline-outline" size={18} color="#8a5b17" /><Text style={styles.noticeText}>{dataError}</Text></View>}
      {screen}
    </ScrollView>
    <View style={extras.webNav}>{navItems.map(({ tab: item, icon, activeIcon, label }) => {
      const active = item === tab;
      return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => openTab(item)} style={[extras.webNavItem, active && extras.webNavActive]}>
        <Ionicons name={active ? activeIcon : icon} size={21} color={active ? "#1f6e39" : "#7c8980"} />
        <Text style={[extras.webNavText, active && extras.webNavTextActive]}>{label}</Text>
      </Pressable>;
    })}</View>
  </SafeAreaView>;
}

function Home({ user, displayName, progress, lessons, completed, achievements, earnedAchievementIds, recentScans, onScan, onLearn, onMap, onCommunity, onChallenges }: { user: User; displayName: string; progress: Progress | null; lessons: Lesson[]; completed: string[]; achievements: Achievement[]; earnedAchievementIds: string[]; recentScans: ScanHistoryItem[]; onScan: () => void; onLearn: () => void; onMap: () => void; onCommunity: () => void; onChallenges: () => void }) {
  const firstName = (displayName || String(user.user_metadata?.full_name ?? "") || "Eco learner").trim().split(/\s+/)[0];
  const nextLesson = lessons.find((lesson) => !completed.includes(lesson.id));
  const xp = progress?.xp ?? 0;
  const levelProgress = xp % 100;
  const nextAchievement = achievements.find((achievement) => !earnedAchievementIds.includes(achievement.id));
  const achievementCurrent = nextAchievement ? achievementMetric(nextAchievement, progress) : 0;
  return <>
    <Text style={styles.kicker}>WELCOME BACK, {firstName.toUpperCase()}</Text>
    <Text style={styles.hero}>Learn it. Scan it.{"\n"}<Text style={styles.heroAccent}>Make it count.</Text></Text>
    <View style={styles.heroCard}>
      <View style={styles.cardTopRow}><View><Text style={styles.cardEyebrow}>LEVEL {progress?.level ?? 1}</Text><Text style={styles.cardTitle}>{xp.toLocaleString()} XP earned</Text></View><View style={styles.levelBadge}><Ionicons name="leaf" size={20} color="#173d2a" /></View></View>
      <View style={styles.darkTrack}><View style={[styles.darkFill, { width: `${levelProgress}%` }]} /></View>
      <Text style={styles.cardText}>{100 - levelProgress} XP until your next level</Text>
      <View style={styles.heroActions}><Pressable style={styles.lightButton} onPress={onScan}><Ionicons name="scan" size={18} color="#214c2e" /><Text style={styles.lightText}>Scan an item</Text></Pressable><Pressable style={styles.darkGhostButton} onPress={onLearn}><Text style={styles.darkGhostText}>Continue learning</Text></Pressable></View>
    </View>
    <View style={styles.metricsRow}>
      <Metric icon="scan-outline" value={progress?.total_scans ?? 0} label="Verified checks" />
      <Metric icon="book-outline" value={progress?.total_lessons_completed ?? 0} label="Lessons" />
      <Metric icon="ribbon-outline" value={earnedAchievementIds.length} label="Badges" />
    </View>
    <Text style={styles.sectionTitle}>Pick up where you left off</Text>
    {nextLesson ? <Pressable style={styles.featureCard} onPress={onLearn}>
      <View style={styles.featureIcon}><Ionicons name="book" size={23} color="#2f7b44" /></View>
      <View style={styles.flexOne}><Text style={styles.smallLabel}>NEXT LESSON · {nextLesson.duration_minutes} MIN</Text><Text style={styles.rowTitle}>{nextLesson.title}</Text><Text style={styles.rowMeta}>{nextLesson.description}</Text></View>
      <Ionicons name="chevron-forward" size={21} color="#3f864c" />
    </Pressable> : <View style={styles.successCard}><Ionicons name="checkmark-circle" size={23} color="#2d7a42" /><View style={styles.flexOne}><Text style={styles.rowTitle}>All lessons completed</Text><Text style={styles.rowMeta}>Review any lesson or keep checking real items.</Text></View></View>}
    <View style={styles.quickGrid}>
      <Pressable style={styles.quickCard} onPress={onMap}><Ionicons name="location-outline" size={24} color="#2d7a42" /><Text style={styles.quickTitle}>Nearby sites</Text><Text style={styles.rowMeta}>Find verified disposal options.</Text></Pressable>
      <Pressable style={styles.quickCard} onPress={onCommunity}><Ionicons name="people-outline" size={24} color="#2d7a42" /><Text style={styles.quickTitle}>My community</Text><Text style={styles.rowMeta}>Classes, schools, and local groups.</Text></Pressable>
      <Pressable style={styles.quickCard} onPress={onChallenges}><Ionicons name="trophy-outline" size={24} color="#a66d10" /><Text style={styles.quickTitle}>Quests</Text><Text style={styles.rowMeta}>Turn real actions into progress.</Text></Pressable>
    </View>
    {nextAchievement && <><Text style={styles.sectionTitle}>Next badge</Text><View style={styles.progressCard}><View style={styles.cardTopRow}><View style={styles.flexOne}><Text style={styles.rowTitle}>{nextAchievement.title}</Text><Text style={styles.rowMeta}>{nextAchievement.description}</Text></View><Text style={styles.progressValue}>{Math.min(achievementCurrent, nextAchievement.requirement_value)}/{nextAchievement.requirement_value}</Text></View><View style={questStyles.track}><View style={[questStyles.fill, { width: `${Math.min(100, Math.round((achievementCurrent / nextAchievement.requirement_value) * 100))}%` }]} /></View></View></>}
    <Text style={styles.sectionTitle}>Recent verified checks</Text>
    <View style={styles.listCard}>{recentScans.length ? recentScans.map((scan, index) => <View key={scan.id} style={[styles.activityRow, index > 0 && styles.activityBorder]}><View style={[styles.activityIcon, scan.is_recyclable ? styles.activityGood : styles.activitySpecial]}><Ionicons name={scan.is_recyclable ? "checkmark" : "information"} size={17} color={scan.is_recyclable ? "#286d3b" : "#9a5e13"} /></View><View style={styles.flexOne}><Text style={styles.activityTitle}>{scan.item_name}</Text><Text style={styles.rowMeta}>{scan.category ?? "Official Delaware guidance"}</Text></View><Text style={styles.activityDate}>{new Date(scan.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text></View>) : <View style={styles.emptyState}><Ionicons name="scan-outline" size={25} color="#6f7e73" /><Text style={styles.emptyTitle}>No verified checks yet</Text><Text style={styles.rowMeta}>Scan or search for an item to start your private history.</Text></View>}</View>
  </>;
}

function Metric({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string }) {
  return <View style={styles.metric}><Ionicons name={icon} size={19} color="#327844" /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function achievementMetric(achievement: Achievement, progress: Progress | null) {
  if (!progress) return 0;
  if (achievement.requirement_type === "scans") return progress.total_scans;
  if (achievement.requirement_type === "lessons") return progress.total_lessons_completed;
  if (achievement.requirement_type === "streak") return progress.streak_days;
  return progress.level;
}

function ScanScreen({ onRecorded, onTools, onNearby }: { onRecorded: () => Promise<void>; onTools: () => void; onNearby: (item: string) => void }) {
  const [photo, setPhoto] = useState<Photo | null>(null); const [result, setResult] = useState<ScanResult | null>(null); const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DelawareSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
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
  const choose = async (camera: boolean) => { const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return Alert.alert("Permission needed", `Allow ${camera ? "camera" : "photo library"} access to scan an item.`); const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, base64: true }; const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options); if (!picked.canceled && picked.assets[0]) { requestId.current = newRequestId(); setPhoto(photoFromAsset(picked.assets[0])); setResult(null); } };
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2 || photo || result) { setSuggestions([]); setSuggestionsLoading(false); return; }
    let active = true;
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      const { data, error } = await supabase.functions.invoke("delaware-guidance", { body: { item: query, mode: "suggestions" } });
      if (active) {
        setSuggestions(error ? [] : ((data?.suggestions ?? []) as DelawareSuggestion[]));
        setSuggestionsLoading(false);
      }
    }, 280);
    return () => { active = false; clearTimeout(timer); };
  }, [searchQuery, photo, result]);
  const searchCatalog = async (value = searchQuery, inputMethod: "typed_search" | "suggestion" = "typed_search") => {
    const item = value.trim();
    if (!item || busy) return;
    setBusy(true); setSuggestions([]); setResult(null); requestId.current = newRequestId();
    try {
      const { data, error } = await supabase.functions.invoke("delaware-guidance", {
        body: { item, inputMethod, clientPlatform: "mobile" },
      });
      if (error) throw error;
      const guidance = data?.verified ? data.guidance as DelawareGuidance | null : null;
      const checked: ScanResult = guidance
        ? { item: guidance.title, recyclable: guidance.curbside, confidence: guidance.matchConfidence ?? 1, category: guidance.category, instructions: guidance.instructions, tips: ["Verified against Delaware DNREC Recyclopedia", "Follow the complete official item protocol", "Use nearby locations for specialty items"], dnrec: guidance }
        : { item, recyclable: false, confidence: 0, category: "No official DNREC match", instructions: "EcoLearn could not verify that name against the official Delaware catalog.", tips: ["Choose a suggested official item if one appears", "Try a simpler material or item name", "Use a clear one-item photo for visual identification"], dnrec: null };
      setResult(checked);
      if (guidance) await recordOfficial(checked);
    } catch (error) {
      Alert.alert("Delaware catalog unavailable", await functionErrorMessage(error, "Try the catalog search again shortly."));
    } finally { setBusy(false); }
  };
  const scan = async () => {
    if (!photo || busy) return;
    setBusy(true);
    try {
      const base64 = photo.base64 ?? await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data, error } = await supabase.functions.invoke("explain-scan", {
        body: { image: `data:${photo.mimeType};base64,${base64}`, clientPlatform: "mobile" },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const identified = data as VisionScanResponse;
      const guidance = identified.guidance;
      const scanResult: ScanResult = guidance
        ? { item: guidance.title, recyclable: guidance.curbside, confidence: guidance.matchConfidence ?? identified.confidence, category: guidance.category, instructions: guidance.instructions, tips: ["Verified against Delaware DNREC Recyclopedia", "Follow the complete official item protocol", "Use Delaware locations for nearby options"], imageStatus: identified.imageStatus, material: identified.material, visibleEvidence: identified.visibleEvidence, dnrec: guidance }
        : { item: identified.observedItem ?? "Item not identified", recyclable: false, confidence: identified.confidence, category: identified.imageStatus === "multiple_items" ? "Multiple items detected" : "No official DNREC match", instructions: identified.message, tips: identified.nextSteps, imageStatus: identified.imageStatus, material: identified.material, visibleEvidence: identified.visibleEvidence, dnrec: null };
      setResult(scanResult);
      if (guidance) await recordOfficial(scanResult);
    } catch (error) {
      Alert.alert("Visual item check unavailable", await functionErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  if (!result && !photo) return <>
    <Text style={styles.kicker}>OFFICIAL DELAWARE ITEM CHECK</Text>
    <Text style={styles.pageTitle}>Know where it goes.</Text>
    <Text style={styles.body}>Use a photo or search by name. Disposal instructions appear only when EcoLearn finds a strong DNREC catalog match.</Text>
    <View style={styles.scanPanel}>
      <View style={styles.scanIllustration}><Ionicons name="scan" size={36} color="#2e7a43" /></View>
      <Text style={styles.scanPanelTitle}>Identify one household item</Text>
      <Text style={styles.scanPanelText}>Use a clear, well-lit photo without people or personal information.</Text>
      <View style={styles.row}><Pressable style={[styles.secondaryButton, styles.half]} onPress={() => void choose(false)}><Ionicons name="images-outline" size={18} color="#286d3b" /><Text style={styles.secondaryText}>Gallery</Text></Pressable><Pressable style={[styles.primaryButton, styles.half, styles.noTopMargin]} onPress={() => void choose(true)}><Ionicons name="camera-outline" size={18} color="#fff" /><Text style={styles.primaryText}>Camera</Text></Pressable></View>
    </View>
    <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>OR SEARCH THE CATALOG</Text><View style={styles.divider} /></View>
    <View style={styles.searchRow}><Ionicons name="search" size={19} color="#78847b" /><TextInput value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => void searchCatalog()} returnKeyType="search" autoCorrect placeholder="Try “soda can”" style={styles.searchInput} /><Pressable disabled={!searchQuery.trim() || busy} onPress={() => void searchCatalog()} style={[styles.searchButton, (!searchQuery.trim() || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchButtonText}>Check</Text>}</Pressable></View>
    {(suggestionsLoading || suggestions.length > 0) && <View style={styles.suggestionCard}>{suggestionsLoading ? <View style={styles.suggestionLoading}><ActivityIndicator color="#2e7a43" /><Text style={styles.rowMeta}>Searching official items…</Text></View> : suggestions.map((suggestion, index) => <Pressable key={suggestion.title} onPress={() => { setSearchQuery(suggestion.title); void searchCatalog(suggestion.title, "suggestion"); }} style={[styles.suggestionRow, index > 0 && styles.activityBorder]}><View style={styles.flexOne}><Text style={styles.activityTitle}>{suggestion.title}</Text><Text style={styles.rowMeta}>{suggestion.category}</Text></View><Ionicons name="arrow-forward" size={18} color="#3d834b" /></Pressable>)}</View>}
    <Pressable style={extras.toolsLinkCard} onPress={onTools}><View style={styles.toolIcon}><Ionicons name="location-outline" size={22} color="#2f7b44" /></View><View style={styles.flexOne}><Text style={styles.smallLabel}>MORE WAYS TO CHECK</Text><Text style={styles.rowTitle}>Barcode, label, and nearby sites</Text><Text style={styles.rowMeta}>Use the right tool for the item in front of you.</Text></View><Ionicons name="chevron-forward" size={21} color="#3f864c" /></Pressable>
  </>;
  if (!result) return <><Text style={styles.kicker}>ITEM SCANNER</Text><Text style={styles.pageTitle}>Ready to scan?</Text><Text style={styles.body}>One visual check will identify the item, then EcoLearn will search the official Delaware catalog.</Text><View style={styles.photoBox}><Image source={{ uri: photo!.uri }} style={styles.fullImage} /></View><View style={styles.row}><Pressable style={[styles.secondaryButton, styles.half]} onPress={() => void choose(false)}><Text style={styles.secondaryText}>Choose another</Text></Pressable><Pressable style={[styles.primaryButton, styles.half]} onPress={() => void choose(true)}><Text style={styles.primaryText}>Use camera</Text></Pressable></View><Pressable disabled={busy} style={[styles.scanButton, busy && styles.disabled]} onPress={() => void scan()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Identify + check DNREC</Text>}</Pressable></>;
  const official = result.dnrec;
  const relatedVideo = dswaVideoForItem([result.item, result.category, result.material, result.instructions]);
  const resetScan = () => { setResult(null); setPhoto(null); setSearchQuery(""); setSuggestions([]); requestId.current = newRequestId(); };
  if (!official) return <>
    {photo && <Image source={{ uri: photo.uri }} style={styles.resultImage} />}
    <Text style={styles.kicker}>VISUAL IDENTIFICATION</Text>
    <Text style={styles.pageTitle}>{result.item}</Text>
    <View style={[styles.badge, styles.warnBadge]}><Text style={[styles.badgeText, styles.warnText]}>{result.category} · {percent(result.confidence)}% confidence</Text></View>
    {!!result.material && <Text style={styles.helper}>Likely material: {result.material}</Text>}
    <View style={styles.guidanceCard}>
      <Text style={styles.smallLabel}>NO OFFICIAL DELAWARE MATCH</Text>
      <Text style={styles.guidance}>{result.instructions}</Text>
      {!!result.visibleEvidence && <Text style={styles.helper}>Visible evidence: {result.visibleEvidence}</Text>}
      {(result.tips ?? []).map((tip) => <Text key={tip} style={styles.tip}>• {tip}</Text>)}
    </View>
    <Text style={styles.helper}>These are safe next steps, not Delaware disposal instructions. Official guidance appears only after a DNREC catalog match.</Text>
    <Pressable style={styles.scanButton} onPress={resetScan}><Text style={styles.primaryText}>Try another photo</Text></Pressable>
  </>;
  return <>
    {photo && <Image source={{ uri: photo.uri }} style={styles.resultImage} />}
    <Text style={styles.kicker}>OFFICIAL DELAWARE MATCH</Text>
    <Text style={styles.pageTitle}>{official.title}</Text>
    <View style={[styles.badge, official.curbside ? styles.goodBadge : styles.warnBadge]}><Text style={[styles.badgeText, official.curbside ? styles.goodText : styles.warnText]}>DNREC: {official.category} · {percent(result.confidence)}% confidence</Text></View>
    <View style={styles.guidanceCard}><Text style={styles.smallLabel}>OFFICIAL DELAWARE DNREC PROTOCOL</Text><Text style={styles.guidance}>{official.instructions}</Text><Pressable onPress={() => void Linking.openURL(official.sourceUrl)}><Text style={styles.link}>Open Delaware DNREC source</Text></Pressable></View>
    {relatedVideo && <Pressable style={styles.explainButton} onPress={() => void Linking.openURL(relatedVideo.url)}><Text style={styles.explainText}>{relatedVideo.title}</Text></Pressable>}
    <Text style={styles.helper}>The image was used for this visual check only and is not stored or used for training.</Text>
    <Pressable style={styles.primaryButton} onPress={() => onNearby(official.title)} accessibilityLabel={`Search nearby locations for ${official.title}`}><Ionicons name="location" size={18} color="#fff" /><Text style={styles.primaryText}>Search nearby locations</Text></Pressable>
    <Pressable style={[styles.secondaryButton, styles.resultSecondaryButton]} onPress={resetScan}><Ionicons name="scan-outline" size={18} color="#286d3b" /><Text style={styles.secondaryText}>Scan another item</Text></Pressable>
  </>;
}

function LearnScreen({ lessons, completed, onCompleted }: { lessons: Lesson[]; completed: string[]; onCompleted: () => Promise<void> }) {
  const [active, setActive] = useState<Lesson | null>(null);
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeLesson = () => { setActive(null); setStep(0); setChoice(null); setChecked(false); };
  const openLesson = (lesson: Lesson) => { setActive(lesson); setStep(0); setChoice(null); setChecked(false); };
  if (active) {
    const content = lessonEditorial[active.id];
    if (!content) return <View style={styles.emptyState}><Ionicons name="alert-circle-outline" size={28} color="#8a5b17" /><Text style={styles.emptyTitle}>Lesson content unavailable</Text><Text style={styles.rowMeta}>This lesson was unpublished from the app because its reviewed content is missing.</Text><Pressable onPress={closeLesson} style={styles.secondaryButton}><Text style={styles.secondaryText}>Back to lessons</Text></Pressable></View>;
    const quizStep = content.facts.length + 1;
    const isQuiz = step === quizStep;
    const totalSteps = quizStep + 1;
    const alreadyDone = completed.includes(active.id);
    const complete = async () => {
      if (choice !== content.answer || saving) return;
      setSaving(true);
      const { error } = await supabase.rpc("complete_ecolearn_lesson", { p_lesson_id: active.id, p_selected_answer: choice });
      if (error) { setSaving(false); return Alert.alert("Could not save lesson", error.message); }
      await onCompleted(); setSaving(false);
      Alert.alert(alreadyDone ? "Review complete" : "Lesson complete", alreadyDone ? "Your original progress remains saved." : `+${active.xp_reward} XP earned.`, [{ text: "Continue", onPress: closeLesson }]);
    };
    return <>
      <Pressable onPress={closeLesson} style={styles.backButton}><Ionicons name="arrow-back" size={19} color="#286d3b" /><Text style={styles.backText}>All lessons</Text></Pressable>
      <View style={styles.lessonProgressRow}>{Array.from({ length: totalSteps }).map((_, index) => <View key={index} style={[styles.lessonProgressSegment, index <= step && styles.lessonProgressSegmentActive]} />)}</View>
      <Text style={styles.kicker}>{active.topic.toUpperCase()} · {step + 1} OF {totalSteps}</Text>
      <Text style={styles.pageTitle}>{active.title}</Text>
      {!isQuiz && <View style={styles.lessonBodyCard}>
        <View style={styles.lessonHeroIcon}><Ionicons name={step === 0 ? "bulb-outline" : "leaf-outline"} size={30} color="#2f7b44" /></View>
        <Text style={styles.lessonSectionTitle}>{step === 0 ? "Why this matters" : content.facts[step - 1].title}</Text>
        <Text style={styles.lessonBody}>{step === 0 ? content.intro : content.facts[step - 1].body}</Text>
      </View>}
      {isQuiz && <>
        <View style={styles.quizHeader}><Ionicons name="checkmark-done-circle-outline" size={25} color="#2f7b44" /><View style={styles.flexOne}><Text style={styles.smallLabel}>QUICK CHECK</Text><Text style={styles.rowTitle}>Prove what you learned</Text></View></View>
        <Text style={styles.question}>{content.question}</Text>
        {content.choices.map((item, index) => {
          const selected = choice === index;
          const correct = checked && index === content.answer;
          const wrong = checked && selected && index !== content.answer;
          return <Pressable key={item} disabled={checked} onPress={() => setChoice(index)} style={[styles.answer, selected && styles.answerActive, correct && styles.answerCorrect, wrong && styles.answerWrong]}><View style={[styles.answerIndex, selected && styles.answerIndexActive]}><Text style={[styles.answerIndexText, selected && styles.answerIndexTextActive]}>{String.fromCharCode(65 + index)}</Text></View><Text style={styles.answerText}>{item}</Text>{correct && <Ionicons name="checkmark-circle" size={21} color="#2d7a42" />}{wrong && <Ionicons name="close-circle" size={21} color="#b04c42" />}</Pressable>;
        })}
        {checked && <View style={[styles.feedbackCard, choice === content.answer ? styles.feedbackGood : styles.feedbackBad]}><Text style={styles.feedbackTitle}>{choice === content.answer ? "Exactly right" : "Not quite yet"}</Text><Text style={styles.feedbackText}>{choice === content.answer ? content.explanation : "Review the choices and try once more. Your progress is only saved after the correct answer."}</Text></View>}
      </>}
      {!isQuiz ? <Pressable style={styles.primaryButton} onPress={() => setStep((value) => value + 1)}><Text style={styles.primaryText}>{step === content.facts.length ? "Take the quiz" : "Continue"}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable> : !checked ? <Pressable disabled={choice === null} style={[styles.primaryButton, choice === null && styles.disabled]} onPress={() => setChecked(true)}><Text style={styles.primaryText}>Check answer</Text></Pressable> : choice === content.answer ? <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void complete()}>{saving ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryText}>{alreadyDone ? "Finish review" : `Complete · +${active.xp_reward} XP`}</Text><Ionicons name="checkmark" size={19} color="#fff" /></>}</Pressable> : <Pressable style={styles.secondaryButton} onPress={() => { setChoice(null); setChecked(false); }}><Text style={styles.secondaryText}>Try again</Text></Pressable>}
    </>;
  }
  const percentComplete = lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0;
  return <>
    <Text style={styles.kicker}>LEARN BY DOING</Text>
    <Text style={styles.pageTitle}>Build skills that stick.</Text>
    <Text style={styles.body}>Short, reviewed lessons turn Delaware recycling guidance into choices you can use.</Text>
    <View style={styles.courseSummary}><View><Text style={styles.courseValue}>{completed.length}/{lessons.length}</Text><Text style={styles.rowMeta}>lessons complete</Text></View><View style={styles.courseProgressWrap}><Text style={styles.coursePercent}>{percentComplete}%</Text><View style={questStyles.track}><View style={[questStyles.fill, { width: `${percentComplete}%` }]} /></View></View></View>
    {!lessons.length && <View style={styles.emptyState}><ActivityIndicator color="#2e7a43" /><Text style={styles.rowMeta}>Loading published lessons…</Text></View>}
    {lessons.map((lesson, index) => {
      const done = completed.includes(lesson.id);
      const unlocked = index === 0 || completed.includes(lessons[index - 1].id);
      return <Pressable key={lesson.id} disabled={!unlocked} onPress={() => openLesson(lesson)} style={[styles.lessonCard, !unlocked && styles.lockedCard]}><View style={[styles.number, done && styles.numberDone]}>{done ? <Ionicons name="checkmark" size={19} color="#fff" /> : <Text style={styles.numberText}>{index + 1}</Text>}</View><View style={styles.flexOne}><Text style={styles.smallLabel}>{lesson.topic.toUpperCase()} · {lesson.duration_minutes} MIN</Text><Text style={styles.rowTitle}>{lesson.title}</Text><Text style={styles.rowMeta}>{done ? "Completed · tap to review" : unlocked ? `${lesson.xp_reward} XP · includes quiz` : "Complete the previous lesson to unlock"}</Text></View><Ionicons name={unlocked ? "chevron-forward" : "lock-closed"} size={19} color={unlocked ? "#3f864c" : "#9aa49c"} /></Pressable>;
    })}
  </>;
}

function QuestsScreen({ progress, claims, achievements, earnedAchievementIds, onRefresh }: { progress: Progress | null; claims: string[]; achievements: Achievement[]; earnedAchievementIds: string[]; onRefresh: () => Promise<void> }) {
  const [claiming, setClaiming] = useState<string | null>(null);
  const metric = (name: "scans" | "lessons" | "streak") => name === "scans" ? progress?.total_scans ?? 0 : name === "lessons" ? progress?.total_lessons_completed ?? 0 : progress?.streak_days ?? 0;
  const claim = async (key: string) => {
    setClaiming(key);
    const { error } = await supabase.rpc("claim_ecolearn_reward", { p_reward_key: key });
    if (error) Alert.alert("Reward unavailable", error.message);
    else { await onRefresh(); Alert.alert("Quest complete", "Your 15 XP reward was added to your progress."); }
    setClaiming(null);
  };
  return <>
    <Text style={styles.kicker}>REAL ACTIONS · REAL PROGRESS</Text>
    <Text style={styles.pageTitle}>Quests worth completing.</Text>
    <Text style={styles.body}>Only your verified checks, finished lessons, and actual activity streak count. EcoLearn never invents competitors or progress.</Text>
    {challengeDefinitions.map((quest) => {
      const current = Math.min(metric(quest.metric), quest.target);
      const complete = current >= quest.target;
      const claimed = claims.includes(quest.key);
      return <View key={quest.key} style={[questStyles.card, complete && styles.questComplete]}>
        <View style={styles.cardTopRow}><View style={[styles.questIcon, complete && styles.questIconDone]}><Ionicons name={complete ? "checkmark" : quest.metric === "scans" ? "scan" : quest.metric === "lessons" ? "book" : "flame"} size={21} color={complete ? "#fff" : "#2f7a43"} /></View><View style={styles.flexOne}><Text style={styles.rowTitle}>{quest.title}</Text><Text style={styles.rowMeta}>{quest.description}</Text></View>{quest.xp > 0 && <Text style={questStyles.reward}>+{quest.xp} XP</Text>}</View>
        <View style={questStyles.track}><View style={[questStyles.fill, { width: `${Math.round((current / quest.target) * 100)}%` }]} /></View>
        <View style={styles.questFooter}><Text style={styles.rowMeta}>{current} of {quest.target} complete</Text>{quest.claimable && complete && !claimed && <Pressable disabled={claiming !== null} style={styles.claimButton} onPress={() => void claim(quest.key)}>{claiming === quest.key ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.claimText}>Claim reward</Text>}</Pressable>}{claimed && <Text style={styles.claimedText}>Claimed</Text>}{!quest.claimable && complete && <Text style={styles.claimedText}>Complete</Text>}</View>
      </View>;
    })}
    <Text style={styles.sectionTitle}>Achievement collection</Text>
    <Text style={styles.sectionDescription}>Badges are awarded automatically from your private progress.</Text>
    <View style={styles.badgeGrid}>{achievements.map((achievement) => {
      const earned = earnedAchievementIds.includes(achievement.id);
      const current = Math.min(achievementMetric(achievement, progress), achievement.requirement_value);
      return <View key={achievement.id} style={[styles.achievementCard, !earned && styles.achievementLocked]}><View style={[styles.achievementIcon, earned && styles.achievementIconEarned]}><Ionicons name={achievement.icon === "book" ? "book" : achievement.icon === "flame" ? "flame" : achievement.icon === "star" ? "star" : "leaf"} size={23} color={earned ? "#fff" : "#7b887e"} /></View><Text style={styles.achievementTitle}>{achievement.title}</Text><Text style={styles.achievementDescription}>{achievement.description}</Text><Text style={[styles.achievementStatus, earned && styles.achievementStatusEarned]}>{earned ? "Earned" : `${current}/${achievement.requirement_value}`}</Text></View>;
    })}</View>
  </>;
}

function ToolsScreen({ onBack }: { onBack: () => void }) {
  const [barcode, setBarcode] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<BarcodeResult | null>(null);
  const [labelResult, setLabelResult] = useState<LabelResult | null>(null);
  const [busyTool, setBusyTool] = useState<"barcode" | "label" | "locations" | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteType, setSiteType] = useState("recycling");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...userLocation, latitudeDelta: 0.18, longitudeDelta: 0.18 },
      350,
    );
  }, [sites, userLocation]);

  const lookupBarcode = async () => {
    const code = barcode.replace(/\D/g, "");
    if (code.length < 8 || code.length > 14) {
      return Alert.alert("Enter a valid barcode", "Use the 8–14 digits below the bars.");
    }
    setBusyTool("barcode");
    setBarcodeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-barcode", { body: { barcode: code } });
      if (error) throw error;
      const result = data as Partial<BarcodeResult> | null;
      setBarcodeResult({
        found: Boolean(result?.found),
        name: typeof result?.name === "string" ? result.name : null,
        guidance: typeof result?.guidance === "string" ? result.guidance : null,
      });
    } catch {
      Alert.alert("Barcode lookup is unavailable", "Try again shortly or use item scanning.");
    } finally {
      setBusyTool(null);
    }
  };

  const readLabel = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Allow photo access to read a label.");
    const response = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (response.canceled || !response.assets[0]) return;
    Alert.alert(
      "Send label to AI?",
      "The image is used only to read its visible label and symbols. EcoLearn does not store it or use it for training.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            setBusyTool("label");
            setLabelResult(null);
            try {
              const asset = response.assets[0];
              const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
              const { data, error } = await supabase.functions.invoke("read-label", {
                body: { image: `data:${asset.mimeType ?? "image/jpeg"};base64,${base64}` },
              });
              if (error) throw error;
              const result = data as Partial<LabelResult> | null;
              setLabelResult({
                guidance: typeof result?.guidance === "string" ? result.guidance : "No label guidance was returned.",
                materials: Array.isArray(result?.materials) ? result.materials.filter((item): item is string => typeof item === "string") : [],
                text: typeof result?.text === "string" ? result.text : null,
                recyclingSymbols: Array.isArray(result?.recyclingSymbols)
                  ? result.recyclingSymbols.filter((item): item is string => typeof item === "string")
                  : [],
              });
            } catch {
              Alert.alert("Could not read that label", "Use a clearer, well-lit photo and try again.");
            } finally {
              setBusyTool(null);
            }
          },
        },
      ],
    );
  };

  const nearby = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return Alert.alert("Location permission needed", "Allow location access to see nearby disposal sites.");
    setBusyTool("locations");
    setSites([]);
    setLocationNotice(null);
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const current = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setUserLocation(current);
      const { data, error } = await supabase.functions.invoke("find-disposal-sites", {
        body: { ...current, type: siteType },
      });
      if (error) throw error;
      const nextSites = (data?.sites ?? []) as Site[];
      setSites(nextSites);
      setSelectedSiteId(null);
      setLocationNotice(data?.notice ?? null);
      if (!nextSites.length) Alert.alert("No nearby matches", "Try another category or check the DSWA facility directory.");
    } catch {
      Alert.alert("Nearby search is unavailable", "Try again shortly.");
    } finally {
      setBusyTool(null);
    }
  };

  const focusSite = (site: Site) => {
    setSelectedSiteId(site.id);
    mapRef.current?.animateToRegion(
      { latitude: site.latitude, longitude: site.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      350,
    );
  };

  return <>
    <Pressable onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={19} color="#286d3b" /><Text style={styles.backText}>Item scanner</Text></Pressable>
    <Text style={styles.kicker}>SMART TOOLS</Text>
    <Text style={styles.pageTitle}>Use the right tool.</Text>
    <Text style={styles.body}>Look up a barcode, read a package label, or find verified disposal locations near you.</Text>
    <View style={styles.toolCard}>
      <Text style={styles.rowTitle}>Barcode lookup</Text>
      <Text style={styles.body}>Enter the digits below a product barcode.</Text>
      <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} keyboardType="number-pad" placeholder="8–14 digit barcode" />
      <Pressable disabled={busyTool !== null} style={[styles.primaryButton, busyTool !== null && styles.disabled]} onPress={() => void lookupBarcode()}>
        <Text style={styles.primaryText}>{busyTool === "barcode" ? "Looking up…" : "Look up barcode"}</Text>
      </Pressable>
      {barcodeResult && <Text style={styles.body}>{barcodeResult.found ? `${barcodeResult.name ?? "Product found"}${barcodeResult.guidance ? ` — ${barcodeResult.guidance}` : ""}` : "No product match found."}</Text>}
    </View>
    <View style={styles.toolCard}>
      <Text style={styles.rowTitle}>Read a package label</Text>
      <Text style={styles.body}>Read visible material and recycling symbols from a selected photo.</Text>
      <Pressable disabled={busyTool !== null} style={[styles.secondaryButton, busyTool !== null && styles.disabled]} onPress={() => void readLabel()}>
        <Text style={styles.secondaryText}>{busyTool === "label" ? "Reading label…" : "Choose label photo"}</Text>
      </Pressable>
      {labelResult && <Text style={styles.body}>{labelResult.guidance}{labelResult.materials?.length ? `\nMaterials: ${labelResult.materials.join(", ")}` : ""}</Text>}
    </View>
    <View style={styles.toolCard}>
      <Text style={styles.rowTitle}>Nearby recycling and disposal locations</Text>
      <Text style={styles.body}>Choose a service, then use your location to see nearby results. EcoLearn requests precise location for this lookup; you can choose approximate location in device settings. Your location is not saved.</Text>
      <View style={styles.chips}>
        {[["recycling", "Recycling"], ["battery", "Batteries"], ["electronics", "Electronics"], ["hazardous", "Hazardous"], ["compost", "Yard waste"], ["textile", "Textiles"]].map(([value, label]) => (
          <Pressable key={value} onPress={() => setSiteType(value)} style={[styles.chip, siteType === value && styles.chipActive]}>
            <Text style={[styles.chipText, siteType === value && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable disabled={busyTool !== null} style={[styles.primaryButton, busyTool !== null && styles.disabled]} onPress={() => void nearby()}>
        <Text style={styles.primaryText}>{busyTool === "locations" ? "Finding locations…" : "Find nearby locations"}</Text>
      </Pressable>
      {userLocation && <MapView
        ref={mapRef}
        style={extras.map}
        initialRegion={{ ...userLocation, latitudeDelta: 0.35, longitudeDelta: 0.35 }}
        showsUserLocation
        showsMyLocationButton
        accessibilityLabel={`Nearby disposal map with ${sites.length} locations`}
      >
        {sites.map((site, index) => <Marker
          key={site.id}
          coordinate={{ latitude: site.latitude, longitude: site.longitude }}
          title={`${index + 1}. ${site.name}`}
          description={`${site.type} · ${milesFromKm(site.distanceKm).toFixed(1)} miles away`}
          pinColor={selectedSiteId === site.id ? "#e38b24" : "#28763f"}
          onPress={() => setSelectedSiteId(site.id)}
        />)}
      </MapView>}
      {locationNotice && <Text style={styles.helper}>{locationNotice}</Text>}
      {sites.map((site, index) => <View key={site.id} style={[styles.siteCard, selectedSiteId === site.id && extras.selectedSite]}>
        <Pressable onPress={() => focusSite(site)} accessibilityLabel={`Show ${site.name} on map`}>
          <Text style={styles.rowTitle}>{index + 1}. {site.name}</Text>
          <Text style={styles.rowMeta}>{site.address ?? site.type} · {milesFromKm(site.distanceKm).toFixed(1)} miles away</Text>
          {site.services?.length ? <Text style={styles.helper}>Services: {site.services.join(", ")}</Text> : null}
        </Pressable>
        <View style={extras.siteActions}>
          <Pressable onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`)}>
            <Text style={styles.link}>Directions ↗</Text>
          </Pressable>
          {site.sourceUrl && <Pressable onPress={() => void Linking.openURL(site.sourceUrl!)}><Text style={styles.link}>Verify details ↗</Text></Pressable>}
        </View>
      </View>)}
    </View>
  </>;
}

function ProfileScreen({ user, progress, achievements, earnedAchievementIds, onNameSaved }: { user: User; progress: Progress | null; achievements: Achievement[]; earnedAchievementIds: string[]; onNameSaved: (name: string) => void }) {
  const initialName = useMemo(
    () => String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
    [user.user_metadata?.full_name, user.user_metadata?.name],
  );
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void supabase
      .from("user_settings")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.display_name ?? initialName);
        }
      });
  }, [initialName, user.id]);

  const save = async () => {
    setSaving(true);
    const clean = name.trim().slice(0, 80);
    const [{ error: settingError }, { error: authError }] = await Promise.all([
      supabase.from("user_settings").upsert({
        user_id: user.id,
        display_name: clean || null,
        updated_at: new Date().toISOString(),
      }),
      supabase.auth.updateUser({ data: { full_name: clean } }),
    ]);
    setSaving(false);
    if (settingError || authError) {
      Alert.alert("Could not save profile", (settingError ?? authError)?.message);
    } else {
      onNameSaved(clean);
      Alert.alert("Profile updated", "Your display name is saved across EcoLearn.");
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: "DELETE" },
      });
      if (error) throw error;
      await supabase.auth.signOut({ scope: "local" });
      Alert.alert("Account deleted", "Your EcoLearn account and associated app data were deleted.");
    } catch (error) {
      Alert.alert(
        "Could not delete account",
        await functionErrorMessage(error, "EcoLearn could not delete your account. Please try again or use the deletion-help page."),
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletion = () => {
    Alert.alert(
      "Delete EcoLearn account?",
      "This permanently deletes your account, saved progress, settings, and associated app activity. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => Alert.alert(
            "Permanently delete account",
            "Are you absolutely sure?",
            [
              { text: "Keep account", style: "cancel" },
              { text: "Delete permanently", style: "destructive", onPress: () => void deleteAccount() },
            ],
          ),
        },
      ],
    );
  };
  const profileInitials = (name || user.email || "E").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return <>
    <View style={styles.profileHeader}><View style={styles.profileCircle}><Text style={styles.profileInitials}>{profileInitials}</Text></View><View style={styles.flexOne}><Text style={styles.profileName}>{name || "Eco learner"}</Text><Text style={styles.profileEmail}>{user.email}</Text><View style={styles.memberBadge}><Ionicons name="shield-checkmark" size={13} color="#2e7340" /><Text style={styles.memberBadgeText}>Private EcoLearn account</Text></View></View></View>
    <View style={styles.stats}>
      <Stat value={String(progress?.xp ?? 0)} label="XP" />
      <Stat value={String(progress?.total_scans ?? 0)} label="Checks" />
      <Stat value={String(progress?.total_lessons_completed ?? 0)} label="Lessons" />
    </View>
    <Text style={styles.sectionTitle}>Your badges</Text>
    <View style={styles.profileBadges}>{achievements.map((achievement) => { const earned = earnedAchievementIds.includes(achievement.id); return <View key={achievement.id} style={[styles.miniBadge, !earned && styles.miniBadgeLocked]}><Ionicons name={achievement.icon === "book" ? "book" : achievement.icon === "flame" ? "flame" : achievement.icon === "star" ? "star" : "leaf"} size={19} color={earned ? "#2f7a43" : "#a3aca5"} /><Text style={[styles.miniBadgeText, !earned && styles.miniBadgeTextLocked]} numberOfLines={1}>{achievement.title}</Text></View>; })}</View>
    <Text style={styles.sectionTitle}>Profile</Text>
    <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
    <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={80} autoCorrect placeholder="How should EcoLearn address you?" />
    <Pressable style={styles.primaryButton} onPress={() => void save()} disabled={saving || deleting}>
      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save profile</Text>}
    </Pressable>
    <Text style={styles.sectionTitle}>Help, privacy, and account</Text>
    <View style={styles.settingsCard}>
      <SettingLink icon="help-circle-outline" label="Support" onPress={() => void openPublicPage("/support")} />
      <SettingLink icon="lock-closed-outline" label="Privacy Policy" onPress={() => void openPublicPage("/privacy")} />
      <SettingLink icon="document-text-outline" label="Terms of Service" onPress={() => void openPublicPage("/terms")} />
      <SettingLink icon="code-slash-outline" label="Open source licenses" onPress={() => void openPublicPage("/licenses")} />
      <SettingLink icon="information-circle-outline" label="Account deletion information" onPress={() => void openPublicPage("/delete-account")} last />
    </View>
    <Text style={styles.versionText}>EcoLearn {appVersion} · build {nativeBuildVersion}</Text>
    <Pressable style={styles.dangerButton} onPress={confirmDeletion} disabled={saving || deleting}>
      {deleting ? <ActivityIndicator color="#a33c34" /> : <Text style={styles.dangerText}>Delete account</Text>}
    </Pressable>
    <Pressable style={styles.signOut} onPress={() => void supabase.auth.signOut()} disabled={deleting}>
      <Text style={styles.signOutText}>Sign out</Text>
    </Pressable>
  </>;
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.rowMeta}>{label}</Text></View>; }

function SettingLink({ icon, label, onPress, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; last?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.settingLink, !last && styles.settingLinkBorder]}><Ionicons name={icon} size={20} color="#347a46" /><Text style={styles.settingLinkText}>{label}</Text><Ionicons name="open-outline" size={17} color="#849087" /></Pressable>;
}

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
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f4" },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: "center", padding: 28 },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  authPage: { flexGrow: 1, justifyContent: "center", padding: 26 },
  appHeader: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#e8ece5", backgroundColor: "#fff", paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  logoImage: { width: 42, height: 42, borderRadius: 12 },
  brand: { color: "#173d2a", fontSize: 19, fontWeight: "800", letterSpacing: -0.4 },
  headerSubtitle: { marginTop: 1, color: "#7a867d", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  brandLarge: { color: "#173d2a", fontSize: 31, fontWeight: "800", letterSpacing: -1.3 },
  kicker: { color: "#438b50", fontSize: 10, fontWeight: "800", letterSpacing: 1.25 },
  hero: { marginTop: 8, color: "#173d2a", fontSize: 35, lineHeight: 39, fontWeight: "800", letterSpacing: -1.6 },
  heroAccent: { color: "#529c5a" },
  pageTitle: { marginTop: 7, color: "#173d2a", fontSize: 31, lineHeight: 36, fontWeight: "800", letterSpacing: -1.25 },
  body: { marginTop: 9, color: "#66746a", fontSize: 14, lineHeight: 21 },
  flexOne: { flex: 1 },
  notice: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 16, borderRadius: 13, backgroundColor: "#fff5df", padding: 12 },
  noticeText: { flex: 1, color: "#79561e", fontSize: 12, lineHeight: 17 },
  heroCard: { marginTop: 22, borderRadius: 23, backgroundColor: "#173d2a", padding: 20 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardEyebrow: { color: "#a8d697", fontSize: 10, fontWeight: "800", letterSpacing: 1.15 },
  cardTitle: { marginTop: 6, color: "#fff", fontSize: 21, fontWeight: "800" },
  cardText: { marginTop: 7, color: "#d4e4d1", fontSize: 12, lineHeight: 18 },
  levelBadge: { marginLeft: "auto", width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#dff0d7" },
  darkTrack: { height: 8, marginTop: 18, overflow: "hidden", borderRadius: 99, backgroundColor: "#315b45" },
  darkFill: { height: "100%", borderRadius: 99, backgroundColor: "#8fc886" },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  lightButton: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 12, backgroundColor: "#e5f3dd", paddingHorizontal: 14, paddingVertical: 11 },
  lightText: { color: "#214c2e", fontSize: 13, fontWeight: "800" },
  darkGhostButton: { paddingHorizontal: 8, paddingVertical: 11 },
  darkGhostText: { color: "#d9ead5", fontSize: 12, fontWeight: "800" },
  metricsRow: { flexDirection: "row", gap: 9, marginTop: 11 },
  metric: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: "#e0e7dc", borderRadius: 15, backgroundColor: "#fff", paddingHorizontal: 6, paddingVertical: 12 },
  metricValue: { marginTop: 5, color: "#173d2a", fontSize: 18, fontWeight: "800" },
  metricLabel: { marginTop: 2, color: "#758178", fontSize: 9, fontWeight: "700", textAlign: "center" },
  sectionTitle: { marginTop: 25, marginBottom: 10, color: "#173d2a", fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  sectionDescription: { marginTop: -5, marginBottom: 10, color: "#738075", fontSize: 12, lineHeight: 18 },
  featureCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 18, backgroundColor: "#fff", padding: 15 },
  featureIcon: { width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#e5f3dd" },
  successCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "#e8f5e2", padding: 16 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  quickCard: { flexGrow: 1, flexBasis: "46%", minHeight: 118, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 17, backgroundColor: "#fff", padding: 14 },
  quickTitle: { marginTop: 11, color: "#173d2a", fontSize: 14, fontWeight: "800" },
  progressCard: { borderWidth: 1, borderColor: "#dfe7db", borderRadius: 17, backgroundColor: "#fff", padding: 15 },
  progressValue: { color: "#327844", fontSize: 13, fontWeight: "800" },
  listCard: { overflow: "hidden", borderWidth: 1, borderColor: "#dfe7db", borderRadius: 18, backgroundColor: "#fff" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14 },
  activityBorder: { borderTopWidth: 1, borderTopColor: "#edf0eb" },
  activityIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  activityGood: { backgroundColor: "#e5f3df" },
  activitySpecial: { backgroundColor: "#fff0d8" },
  activityTitle: { color: "#24412e", fontSize: 13, fontWeight: "800" },
  activityDate: { color: "#8a958c", fontSize: 10, fontWeight: "700" },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 6, padding: 25 },
  emptyTitle: { marginTop: 3, color: "#24412e", fontSize: 15, fontWeight: "800" },
  smallLabel: { color: "#748177", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  rowTitle: { marginTop: 3, color: "#173d2a", fontSize: 15, fontWeight: "800" },
  rowMeta: { marginTop: 3, color: "#738075", fontSize: 11, lineHeight: 16 },
  input: { marginTop: 10, borderWidth: 1, borderColor: "#d9e3d6", borderRadius: 13, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 13, color: "#173d2a", fontSize: 14 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, borderRadius: 13, backgroundColor: "#173d2a", paddingVertical: 14, paddingHorizontal: 14 },
  primaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 13, backgroundColor: "#fff", paddingVertical: 13, paddingHorizontal: 13 },
  secondaryText: { color: "#286d3b", fontSize: 13, fontWeight: "800" },
  noTopMargin: { marginTop: 0 },
  resultSecondaryButton: { marginTop: 10 },
  googleButton: { alignItems: "center", marginTop: 27, borderWidth: 1, borderColor: "#d7dfd4", borderRadius: 13, backgroundColor: "#fff", paddingVertical: 14 },
  googleText: { color: "#173d2a", fontWeight: "800" },
  or: { marginVertical: 20, color: "#8c988e", textAlign: "center", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  link: { marginTop: 16, color: "#287640", textAlign: "center", fontSize: 13, fontWeight: "800" },
  legal: { marginTop: 22, color: "#89948b", textAlign: "center", fontSize: 11, lineHeight: 17 },
  legalLink: { color: "#287640", fontWeight: "800", textDecorationLine: "underline" },
  scanPanel: { alignItems: "center", marginTop: 20, borderWidth: 1, borderColor: "#cfe0ca", borderRadius: 22, backgroundColor: "#eff8eb", padding: 18 },
  scanIllustration: { width: 68, height: 68, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#fff" },
  scanPanelTitle: { marginTop: 13, color: "#173d2a", fontSize: 17, fontWeight: "800" },
  scanPanelText: { marginTop: 5, color: "#718077", fontSize: 11, lineHeight: 17, textAlign: "center" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 9, marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: "#e1e6df" },
  dividerText: { color: "#8b968e", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#d9e3d6", borderRadius: 14, backgroundColor: "#fff", paddingLeft: 13, paddingRight: 5, paddingVertical: 5 },
  searchInput: { flex: 1, minHeight: 42, color: "#173d2a", fontSize: 14 },
  searchButton: { minWidth: 68, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#173d2a", paddingHorizontal: 12 },
  searchButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  suggestionCard: { marginTop: 7, overflow: "hidden", borderWidth: 1, borderColor: "#dfe7db", borderRadius: 14, backgroundColor: "#fff" },
  suggestionLoading: { flexDirection: "row", alignItems: "center", gap: 9, padding: 14 },
  suggestionRow: { flexDirection: "row", alignItems: "center", padding: 13 },
  toolIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#e8f4e2" },
  photoBox: { alignItems: "center", justifyContent: "center", height: 270, marginTop: 20, overflow: "hidden", borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 22, backgroundColor: "#eef8eb" },
  photoIcon: { color: "#397e48", fontSize: 45 },
  fullImage: { width: "100%", height: "100%" },
  row: { flexDirection: "row", gap: 9, marginTop: 12 },
  half: { flex: 1 },
  scanButton: { alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 13, backgroundColor: "#3d8c4c", paddingVertical: 15 },
  disabled: { opacity: 0.42 },
  resultImage: { width: "100%", aspectRatio: 1.25, borderRadius: 22, marginBottom: 20 },
  badge: { alignSelf: "flex-start", marginTop: 13, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  goodBadge: { backgroundColor: "#e0f3da" },
  warnBadge: { backgroundColor: "#fff0e9" },
  badgeText: { fontSize: 11, fontWeight: "800" },
  goodText: { color: "#256c38" },
  warnText: { color: "#a25143" },
  guidanceCard: { marginTop: 17, borderWidth: 1, borderColor: "#dce8d8", borderRadius: 18, backgroundColor: "#fff", padding: 16 },
  guidance: { marginTop: 9, color: "#274033", fontSize: 14, lineHeight: 22, fontWeight: "700" },
  tip: { marginTop: 8, color: "#617166", fontSize: 12, lineHeight: 18 },
  explainButton: { alignItems: "center", justifyContent: "center", marginTop: 12, borderWidth: 1, borderColor: "#6aa574", borderRadius: 13, backgroundColor: "#f5fbf2", paddingVertical: 14 },
  explainText: { color: "#286d3b", fontSize: 13, fontWeight: "800" },
  helper: { marginTop: 9, color: "#77847a", fontSize: 10, lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: "#d5ded2", borderRadius: 99, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 7 },
  chipActive: { borderColor: "#347e45", backgroundColor: "#e6f4e1" },
  chipText: { color: "#647368", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#286536" },
  backButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginBottom: 15, paddingVertical: 4 },
  backText: { color: "#286d3b", fontSize: 12, fontWeight: "800" },
  lessonProgressRow: { flexDirection: "row", gap: 5, marginBottom: 18 },
  lessonProgressSegment: { flex: 1, height: 5, borderRadius: 99, backgroundColor: "#dfe6dc" },
  lessonProgressSegmentActive: { backgroundColor: "#57a062" },
  lessonBodyCard: { marginTop: 19, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 20, backgroundColor: "#fff", padding: 19 },
  lessonHeroIcon: { width: 55, height: 55, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#e8f4e2" },
  lessonSectionTitle: { marginTop: 17, color: "#173d2a", fontSize: 21, fontWeight: "800" },
  lessonBody: { marginTop: 9, color: "#52665a", fontSize: 15, lineHeight: 24 },
  quizHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 19, borderRadius: 15, backgroundColor: "#eaf5e5", padding: 13 },
  question: { marginTop: 20, color: "#173d2a", fontSize: 18, lineHeight: 26, fontWeight: "800" },
  answer: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 14, backgroundColor: "#fff", padding: 12 },
  answerActive: { borderColor: "#4c9856", backgroundColor: "#edf7e9" },
  answerCorrect: { borderColor: "#4c9856", backgroundColor: "#e4f4df" },
  answerWrong: { borderColor: "#d78d86", backgroundColor: "#fff0ed" },
  answerIndex: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#edf1eb" },
  answerIndexActive: { backgroundColor: "#438b50" },
  answerIndexText: { color: "#657369", fontSize: 11, fontWeight: "800" },
  answerIndexTextActive: { color: "#fff" },
  answerText: { flex: 1, color: "#365342", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  feedbackCard: { marginTop: 13, borderRadius: 14, padding: 13 },
  feedbackGood: { backgroundColor: "#e5f4df" },
  feedbackBad: { backgroundColor: "#fff0ed" },
  feedbackTitle: { color: "#24412e", fontSize: 13, fontWeight: "800" },
  feedbackText: { marginTop: 4, color: "#5f6f64", fontSize: 11, lineHeight: 17 },
  courseSummary: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 18, borderRadius: 18, backgroundColor: "#173d2a", padding: 17 },
  courseValue: { color: "#fff", fontSize: 24, fontWeight: "800" },
  courseProgressWrap: { flex: 1 },
  coursePercent: { color: "#d7ead2", fontSize: 12, fontWeight: "800", textAlign: "right" },
  lessonCard: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 11, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 17, backgroundColor: "#fff", padding: 14 },
  lockedCard: { backgroundColor: "#f0f2ee", opacity: 0.72 },
  number: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#e5f3dd" },
  numberDone: { backgroundColor: "#438b50" },
  numberText: { color: "#357d44", fontWeight: "800" },
  questComplete: { borderColor: "#acd0a8", backgroundColor: "#fbfef9" },
  questIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#e8f4e2" },
  questIconDone: { backgroundColor: "#438b50" },
  questFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  claimButton: { minWidth: 98, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#173d2a", paddingHorizontal: 11 },
  claimText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  claimedText: { color: "#2e7a43", fontSize: 11, fontWeight: "800" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementCard: { width: "48%", minHeight: 165, borderWidth: 1, borderColor: "#cfe2cb", borderRadius: 17, backgroundColor: "#fff", padding: 14 },
  achievementLocked: { borderColor: "#e0e5de", backgroundColor: "#f1f3f0" },
  achievementIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#e3e8e1" },
  achievementIconEarned: { backgroundColor: "#438b50" },
  achievementTitle: { marginTop: 12, color: "#173d2a", fontSize: 14, fontWeight: "800" },
  achievementDescription: { marginTop: 4, color: "#758178", fontSize: 10, lineHeight: 15 },
  achievementStatus: { marginTop: "auto", paddingTop: 8, color: "#8a958c", fontSize: 10, fontWeight: "800" },
  achievementStatusEarned: { color: "#2e7a43" },
  toolCard: { marginTop: 16, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 18, backgroundColor: "#fff", padding: 16 },
  siteCard: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e7ede4", paddingTop: 10 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 15 },
  profileCircle: { width: 70, height: 70, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#cde9be" },
  profileInitials: { color: "#285c35", fontSize: 22, fontWeight: "800" },
  profileName: { color: "#173d2a", fontSize: 25, fontWeight: "800", letterSpacing: -0.8 },
  profileEmail: { marginTop: 3, color: "#758178", fontSize: 11 },
  memberBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, marginTop: 7, borderRadius: 99, backgroundColor: "#e7f3e2", paddingHorizontal: 8, paddingVertical: 4 },
  memberBadgeText: { color: "#2e7340", fontSize: 9, fontWeight: "800" },
  stats: { flexDirection: "row", gap: 9, marginTop: 20 },
  stat: { flex: 1, borderWidth: 1, borderColor: "#dfe7db", borderRadius: 14, backgroundColor: "#fff", padding: 12 },
  statValue: { color: "#1e512f", fontSize: 20, fontWeight: "800" },
  profileBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniBadge: { width: "48%", flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#cfe2cb", borderRadius: 13, backgroundColor: "#fff", padding: 10 },
  miniBadgeLocked: { borderColor: "#e1e5df", backgroundColor: "#f1f3f0" },
  miniBadgeText: { flex: 1, color: "#2f6740", fontSize: 10, fontWeight: "800" },
  miniBadgeTextLocked: { color: "#929d95" },
  fieldLabel: { marginTop: 2, color: "#748177", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  settingsCard: { overflow: "hidden", borderWidth: 1, borderColor: "#dfe7db", borderRadius: 17, backgroundColor: "#fff" },
  settingLink: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 52, paddingHorizontal: 14 },
  settingLinkBorder: { borderBottomWidth: 1, borderBottomColor: "#edf0eb" },
  settingLinkText: { flex: 1, color: "#24412e", fontSize: 13, fontWeight: "700" },
  versionText: { marginTop: 14, color: "#8b968e", fontSize: 10, textAlign: "center" },
  dangerButton: { alignItems: "center", marginTop: 16, borderWidth: 1, borderColor: "#e8b9b4", borderRadius: 13, backgroundColor: "#fff5f3", paddingVertical: 14, paddingHorizontal: 14 },
  dangerText: { color: "#a33c34", fontSize: 13, fontWeight: "800" },
  signOut: { alignItems: "center", marginTop: 10, padding: 12 },
  signOutText: { color: "#a34239", fontSize: 13, fontWeight: "800" },
});

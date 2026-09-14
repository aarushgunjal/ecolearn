import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const deviceKey = "ecolearn-push-token";
export async function syncPushDevice() {
  const token = await AsyncStorage.getItem(deviceKey);
  if (!token) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // Rebind a shared device to its current account before considering delivery.
  const bound = await supabase.rpc("ecolearn_register_push_device", { p_token: token });
  if (bound.error) throw new Error(bound.error.message);
  const { data, error } = await supabase.from("ecolearn_notification_preferences").select("push_enabled").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  const permission = await Notifications.getPermissionsAsync();
  if (!data?.push_enabled || !permission.granted) await unregisterPushDevice();
}
export async function unregisterPushDevice() {
  const token = await AsyncStorage.getItem(deviceKey);
  if (token) {
    const { error } = await supabase.rpc("ecolearn_register_push_device", { p_token: token, p_remove: true });
    if (error) throw new Error("Could not disconnect notifications. Check your connection and retry signing out.");
    await AsyncStorage.removeItem(deviceKey);
  }
}
export async function registerPushDevice() {
  if (Constants.appOwnership === "expo") throw new Error("Push notifications require an installed EcoLearn build.");
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "EcoLearn updates", importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Enable notifications for EcoLearn in your device settings to receive push updates.");
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Push notifications are unavailable in this build.");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc("ecolearn_register_push_device", { p_token: token });
  if (error) throw new Error(error.message);
  await AsyncStorage.setItem(deviceKey, token);
}

type Notice = { id: string; title: string; body: string; read_at: string | null; created_at: string; target_path: string };
type Preferences = { email_enabled: boolean; push_enabled: boolean; streak_reminders: boolean; learning_updates: boolean; community_updates: boolean; timezone: string; reminder_hour: number };
const defaults: Preferences = { email_enabled: false, push_enabled: false, streak_reminders: true, learning_updates: true, community_updates: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, reminder_hour: 18 };

export function NotificationsScreen({ onOpen }: { onOpen: (path: string) => void }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [prefs, setPrefs] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sign in again to load notifications."); setLoading(false); return; }
    const [inbox, settings] = await Promise.all([
      supabase.from("notifications").select("id,title,body,created_at,read_at,target_path").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("ecolearn_notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setError(inbox.error?.message || settings.error?.message || "");
    setReady(!settings.error);
    if (!inbox.error) setItems((inbox.data ?? []) as Notice[]);
    if (!settings.error) setPrefs(settings.data ? settings.data as Preferences : defaults);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
    // Returning from the OS permission prompt must not overwrite unsaved settings.
    const refreshInbox = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error: problem } = await supabase.from("notifications").select("id,title,body,created_at,read_at,target_path").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
        if (!problem) setItems((data ?? []) as Notice[]);
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshInbox();
    });
    const received = Notifications.addNotificationReceivedListener(() => { void refreshInbox(); });
    return () => { subscription.remove(); received.remove(); };
  }, [load]);
  const save = async () => {
    setSaving(true);
    try {
      if (prefs.push_enabled) await registerPushDevice(); else await unregisterPushDevice();
      const { error: problem } = await supabase.rpc("ecolearn_set_notification_preferences", { p_email: prefs.email_enabled, p_push: prefs.push_enabled, p_streak: prefs.streak_reminders, p_learning: prefs.learning_updates, p_community: prefs.community_updates, p_timezone: prefs.timezone, p_hour: prefs.reminder_hour });
      if (problem) throw new Error(problem.message);
      setError(""); Alert.alert("Preferences saved");
    } catch (problem) { Alert.alert("Could not save preferences", problem instanceof Error ? problem.message : "Try again."); }
    finally { setSaving(false); }
  };
  const mark = async (id: string | null) => {
    setSaving(true);
    const { error: problem } = await supabase.rpc("ecolearn_mark_notifications_read", { p_id: id });
    if (problem) Alert.alert("Could not mark read", problem.message);
    else setItems((current) => current.map((n) => !id || n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setSaving(false);
  };
  return <View><Text style={s.heading}>Notifications</Text>
    {!!error && <View style={s.card}><Text>{error}</Text><Pressable onPress={() => void load()}><Text style={s.link}>Retry</Text></Pressable></View>}
    {loading ? <ActivityIndicator /> : <>
      <Pressable disabled={saving || !items.some((n) => !n.read_at)} onPress={() => void mark(null)}><Text style={s.link}>Mark all read</Text></Pressable>
      {!items.length && <Text style={s.body}>You’re all caught up. New classroom and community updates will appear here.</Text>}
      {items.map((n) => <View key={n.id} style={[s.card, !n.read_at && { backgroundColor: "#eef7e9" }]}><Text style={s.title}>{n.title}</Text><Text style={s.body}>{n.body}</Text><Text style={s.body}>{new Date(n.created_at).toLocaleString()}</Text><Pressable onPress={() => onOpen(n.target_path)}><Text style={s.link}>Open update</Text></Pressable>{!n.read_at && <Pressable disabled={saving} onPress={() => void mark(n.id)}><Text style={s.link}>Mark read</Text></Pressable>}</View>)}
      <View style={s.card}><Text style={s.title}>Notification preferences</Text>
        {([["email_enabled", "Email notifications"], ["push_enabled", "Push on this device"], ["streak_reminders", "Streak reminders"], ["learning_updates", "Assignments and due dates"], ["community_updates", "Community updates"]] as const).map(([key, label]) => <View key={key} style={s.row}><Text style={s.body}>{label}</Text><Switch accessibilityLabel={label} value={prefs[key]} onValueChange={(value) => setPrefs({ ...prefs, [key]: value })} /></View>)}
        <Text style={s.body}>Reminder timezone</Text><TextInput accessibilityLabel="Reminder timezone" style={s.input} value={prefs.timezone} autoCapitalize="none" onChangeText={(timezone) => setPrefs({ ...prefs, timezone })} />
        <Text style={s.body}>Reminder hour (0–23)</Text><TextInput accessibilityLabel="Reminder hour" keyboardType="number-pad" style={s.input} value={String(prefs.reminder_hour)} onChangeText={(hour) => setPrefs({ ...prefs, reminder_hour: Number(hour) })} />
        <Pressable disabled={saving || !ready} onPress={() => void save()} style={s.button}><Text style={s.buttonText}>{saving ? "Saving…" : "Save preferences"}</Text></Pressable>
      </View>
    </>}
  </View>;
}
const s = StyleSheet.create({ heading: { fontSize: 30, fontWeight: "800", color: "#173d2a" }, title: { fontSize: 17, fontWeight: "700", color: "#173d2a" }, body: { color: "#526257", lineHeight: 21, marginVertical: 5, flexShrink: 1 }, card: { padding: 18, marginTop: 15, backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: "#dce5d9" }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, link: { color: "#287440", fontWeight: "700", paddingVertical: 10 }, input: { borderWidth: 1, borderColor: "#dce5d9", padding: 12, borderRadius: 10 }, button: { marginTop: 16, backgroundColor: "#173d2a", borderRadius: 12, padding: 14 }, buttonText: { color: "white", fontWeight: "700", textAlign: "center" } });

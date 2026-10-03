import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import Ionicons from "@expo/vector-icons/Ionicons";

export function useEasyReading() {
  const [easy, setEasy] = useState(false);
  const changed = useRef(false);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem("ecolearn.easyReading").then((value) => {
      if (alive && !changed.current) setEasy(value === "true");
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const change = (value: boolean) => {
    changed.current = true;
    setEasy(value);
    void AsyncStorage.setItem("ecolearn.easyReading", String(value)).catch(() => {});
  };
  return [easy, change] as const;
}

export function ReadingMode({ easy, onChange }: { easy: boolean; onChange: (value: boolean) => void }) {
  return <View style={supportStyles.panel}>
    <Pressable accessibilityRole="switch" accessibilityLabel="Easy reading" accessibilityState={{ checked: easy }}
      onPress={() => onChange(!easy)} style={supportStyles.button}>
      <Text style={supportStyles.buttonText}>Easy reading: {easy ? "On" : "Off"}</Text>
    </Pressable>
    <Text style={supportStyles.note}>For K–3 or anyone who wants shorter words and picture clues. This setting is for this device.</Text>
  </View>;
}

export function ListenButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const stop = () => {
      generation.current++;
      void Speech.stop().catch(() => {});
      setSpeaking(false);
    };
    stop();
    setError("");
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") stop(); });
    return () => { stop(); subscription.remove(); };
  }, [text]);
  const listen = async () => {
    const current = ++generation.current;
    const failed = () => {
      if (generation.current !== current) return;
      setSpeaking(false);
      setError("Listen could not start. Try again, or ask a grown-up to read with you.");
    };
    try {
      await Speech.stop();
      if (generation.current !== current) return;
      if (speaking) { setSpeaking(false); return; }
      setError("");
      setSpeaking(true);
      Speech.speak(text, {
        language: "en-US", rate: 0.85,
        onDone: () => { if (generation.current === current) setSpeaking(false); },
        onStopped: () => { if (generation.current === current) setSpeaking(false); },
        onError: failed,
      });
    } catch { failed(); }
  };
  return <View style={supportStyles.panel}>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: speaking }}
      onPress={() => void listen()} style={supportStyles.button}>
      <Ionicons name={speaking ? "stop" : "volume-high"} size={24} color="#173d2a" />
      <Text style={supportStyles.buttonText}>{speaking ? "Stop reading" : "Listen"}</Text>
    </Pressable>
    <Text style={supportStyles.note}>Sound off? Check your volume and silent mode.</Text>
    {error ? <Text accessibilityLiveRegion="polite" style={supportStyles.note}>{error}</Text> : null}
  </View>;
}

const supportStyles = StyleSheet.create({
  panel: { marginVertical: 12, gap: 8 },
  button: { minHeight: 52, borderWidth: 2, borderColor: "#286c3d", borderRadius: 14, padding: 14, backgroundColor: "#edf7e8", flexDirection: "row", alignItems: "center", gap: 10 },
  buttonText: { fontSize: 18, fontWeight: "700", color: "#173d2a" },
  note: { fontSize: 16, lineHeight: 24, color: "#52665a" },
});

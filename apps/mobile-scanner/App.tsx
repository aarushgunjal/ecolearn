import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

type Prediction = { class: string; confidence: number };
type ScanResult = {
  item: string;
  recyclable: boolean;
  confidence: number;
  category: string;
  instructions: string;
  tips?: string[];
  top_predictions?: Prediction[];
};
type Photo = { uri: string; name: string; mimeType: string };

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const percent = (value: number) =>
  Math.round(value <= 1 ? value * 100 : Math.min(100, value));

export default function App() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const choosePhoto = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        `Allow ${fromCamera ? "camera" : "photo library"} access to scan an item.`,
      );
      return;
    }
    const response = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          allowsEditing: false,
        });
    if (response.canceled || !response.assets[0]) return;
    const asset = response.assets[0];
    setPhoto({
      uri: asset.uri,
      name: asset.fileName ?? "ecoscan-photo.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
    setResult(null);
  };

  const scan = async () => {
    if (!photo) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      Alert.alert(
        "Connect EcoScan first",
        "Add your Supabase URL and publishable key to this app's .env file, then restart Expo.",
      );
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append(
        "file",
        { uri: photo.uri, type: photo.mimeType, name: photo.name } as unknown as Blob,
      );
      const response = await fetch(`${SUPABASE_URL}/functions/v1/classify-scan`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "The scanner is unavailable.");
      setResult(data as ScanResult);
    } catch (error) {
      Alert.alert(
        "Could not scan this image",
        error instanceof Error ? error.message : "Try a clear photo in better light.",
      );
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setResult(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>e</Text></View>
          <View><Text style={styles.brand}>EcoScan</Text><Text style={styles.subtitle}>Smart disposal, simplified</Text></View>
        </View>

        {!result ? (
          <>
            <Text style={styles.kicker}>ITEM SCANNER</Text>
            <Text style={styles.title}>Know where it goes.</Text>
            <Text style={styles.description}>
              Take or choose a clear photo of one household item. EcoScan will suggest the safest next step.
            </Text>
            <View style={styles.photoCard}>
              {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} /> : <Text style={styles.cameraGlyph}>⌁</Text>}
              <Text style={styles.photoPrompt}>{photo ? "Ready to scan" : "Add an item photo"}</Text>
              <Text style={styles.photoHint}>{photo ? "Use a different photo if the item is not clear." : "Good lighting and a simple background help."}</Text>
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.secondaryButton, styles.half]} onPress={() => void choosePhoto(false)} disabled={scanning}>
                <Text style={styles.secondaryText}>Choose photo</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.half]} onPress={() => void choosePhoto(true)} disabled={scanning}>
                <Text style={styles.primaryText}>Use camera</Text>
              </Pressable>
            </View>
            <Pressable style={[styles.scanButton, !photo && styles.disabled]} onPress={() => void scan()} disabled={!photo || scanning}>
              {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanText}>Scan this item</Text>}
            </Pressable>
            {scanning && <Text style={styles.status}>Looking closely… the model may take a moment to wake up.</Text>}
          </>
        ) : (
          <View>
            {photo && <Image source={{ uri: photo.uri }} style={styles.resultPhoto} />}
            <Text style={styles.kicker}>SCAN RESULT</Text>
            <Text style={styles.title}>{result.item}</Text>
            <View style={[styles.badge, result.recyclable ? styles.goodBadge : styles.warnBadge]}>
              <Text style={[styles.badgeText, result.recyclable ? styles.goodText : styles.warnText]}>
                {result.recyclable ? "Recyclable" : "Keep out of curbside recycling"} · {percent(result.confidence)}% confidence
              </Text>
            </View>
            <View style={styles.guidanceCard}>
              <Text style={styles.cardLabel}>DELAWARE RULES ONLY</Text>
              <Text style={styles.guidance}>This standalone scanner does not issue disposal instructions. Use the signed-in EcoLearn app to match an item to an official Delaware DNREC Recyclopedia protocol.</Text>
              {(result.tips ?? []).map((tip) => <Text key={tip} style={styles.tip}>• {tip}</Text>)}
            </View>
            {!!result.top_predictions?.length && <View style={styles.alternatives}><Text style={styles.cardLabel}>ALSO CONSIDERED</Text>{result.top_predictions.slice(0, 3).map((item) => <Text key={item.class} style={styles.alternative}>{item.class} · {percent(item.confidence)}%</Text>)}</View>}
            <Text style={styles.disclaimer}>Only a verified Delaware DNREC item match can produce a disposal recommendation.</Text>
            <Pressable style={styles.scanButton} onPress={reset}><Text style={styles.scanText}>Scan another item</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f4" }, page: { padding: 22, paddingBottom: 48 }, header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 42 }, logo: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#173d2a" }, logoText: { color: "#fff", fontSize: 22, fontWeight: "800" }, brand: { color: "#173d2a", fontSize: 21, fontWeight: "800" }, subtitle: { color: "#78857a", fontSize: 12 }, kicker: { color: "#4d9557", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, title: { marginTop: 9, color: "#173d2a", fontSize: 38, lineHeight: 42, fontWeight: "800", letterSpacing: -1.6 }, description: { marginTop: 12, color: "#66746a", fontSize: 15, lineHeight: 23 }, photoCard: { alignItems: "center", justifyContent: "center", minHeight: 290, marginTop: 28, overflow: "hidden", borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 24, backgroundColor: "#eef8eb", padding: 20 }, photo: { position: "absolute", width: "100%", height: "100%" }, cameraGlyph: { color: "#367e45", fontSize: 52 }, photoPrompt: { marginTop: 12, color: "#1d492c", fontSize: 18, fontWeight: "800" }, photoHint: { marginTop: 6, color: "#718075", textAlign: "center", fontSize: 13, lineHeight: 19 }, row: { flexDirection: "row", gap: 10, marginTop: 14 }, half: { flex: 1 }, primaryButton: { alignItems: "center", borderRadius: 14, backgroundColor: "#173d2a", paddingVertical: 14 }, primaryText: { color: "#fff", fontWeight: "800" }, secondaryButton: { alignItems: "center", borderWidth: 1, borderColor: "#bfd7b9", borderRadius: 14, backgroundColor: "#fff", paddingVertical: 14 }, secondaryText: { color: "#286d3b", fontWeight: "800" }, scanButton: { alignItems: "center", marginTop: 12, borderRadius: 14, backgroundColor: "#3d8c4c", paddingVertical: 16 }, disabled: { opacity: 0.42 }, scanText: { color: "#fff", fontSize: 16, fontWeight: "800" }, status: { marginTop: 12, color: "#6d7b70", textAlign: "center", fontSize: 13 }, resultPhoto: { width: "100%", aspectRatio: 1, borderRadius: 24, marginBottom: 25 }, badge: { alignSelf: "flex-start", marginTop: 15, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 }, goodBadge: { backgroundColor: "#e0f3da" }, warnBadge: { backgroundColor: "#fff0e9" }, badgeText: { fontSize: 13, fontWeight: "800" }, goodText: { color: "#256c38" }, warnText: { color: "#a25143" }, guidanceCard: { marginTop: 20, borderWidth: 1, borderColor: "#dce8d8", borderRadius: 20, backgroundColor: "#fff", padding: 18 }, cardLabel: { color: "#718075", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, guidance: { marginTop: 8, color: "#274033", fontSize: 16, lineHeight: 24, fontWeight: "700" }, tip: { marginTop: 10, color: "#617166", fontSize: 14, lineHeight: 20 }, alternatives: { marginTop: 18 }, alternative: { alignSelf: "flex-start", marginTop: 8, borderRadius: 10, backgroundColor: "#e9eee7", color: "#5e6e62", paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 }, disclaimer: { marginTop: 20, color: "#77847a", fontSize: 12, lineHeight: 18 },
});

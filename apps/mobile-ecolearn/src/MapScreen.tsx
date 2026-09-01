import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "./supabase";

type Site = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
  services?: string[];
  sourceUrl?: string;
  provider?: string;
};
const categories = [
  ["recycling", "Recycling"],
  ["battery", "Batteries"],
  ["electronics", "Electronics"],
  ["hazardous", "Hazardous"],
  ["compost", "Yard waste"],
  ["textile", "Textiles"],
] as const;
const milesFromKm = (kilometers: number) => kilometers * 0.621371;

export function MapScreen({
  initialItem,
  searchRequestId,
  onInitialSearchHandled,
}: {
  initialItem?: string;
  searchRequestId?: number;
  onInitialSearchHandled?: () => void;
}) {
  const [siteType, setSiteType] = useState("recycling");
  const [itemQuery, setItemQuery] = useState(initialItem ?? "");
  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const handledSearchRequest = useRef<number | null>(null);

  useEffect(() => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { ...location, latitudeDelta: 0.18, longitudeDelta: 0.18 },
      350,
    );
  }, [location, sites]);

  const search = useCallback(async (itemOverride?: string) => {
    const officialItem = (itemOverride ?? itemQuery).trim();
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Location permission needed",
        "Allow location access to search for nearby Delaware disposal sites.",
      );
    setBusy(true);
    setNotice(null);
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coordinates = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setLocation(coordinates);
      const { data, error } = await supabase.functions.invoke(
        "find-disposal-sites",
        {
          body: {
            ...coordinates,
            ...(officialItem ? { item: officialItem } : { type: siteType }),
          },
        },
      );
      if (error) throw error;
      const results = (data?.sites ?? []) as Site[];
      setSites(results);
      setSelected(null);
      setSearchedFor(officialItem || categories.find(([value]) => value === siteType)?.[1] || "Recycling");
      setNotice(data?.notice ?? null);
      if (!results.length)
        Alert.alert(
          "No nearby matches",
          officialItem
            ? `No mapped locations were returned for ${officialItem}. Review its official protocol or try a broader service category.`
            : "Try a different service or check the official DSWA facility directory.",
        );
    } catch {
      Alert.alert(
        "Nearby search is unavailable",
        "EcoLearn could not load locations. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [itemQuery, siteType]);

  useEffect(() => {
    if (!initialItem || searchRequestId == null || handledSearchRequest.current === searchRequestId) return;
    handledSearchRequest.current = searchRequestId;
    setItemQuery(initialItem);
    onInitialSearchHandled?.();
    void search(initialItem);
  }, [initialItem, onInitialSearchHandled, search, searchRequestId]);

  const focus = (site: Site) => {
    setSelected(site.id);
    mapRef.current?.animateToRegion(
      {
        latitude: site.latitude,
        longitude: site.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      350,
    );
  };

  return (
    <>
      <Text style={s.kicker}>DELAWARE DISPOSAL MAP</Text>
      <Text style={s.title}>Find the right place. Fast.</Text>
      <Text style={s.body}>
        Choose a service, view nearby options, and verify accepted materials and
        hours before traveling.
      </Text>
      <View style={s.privacy}>
        <Ionicons name="shield-checkmark-outline" size={19} color="#276f3c" />
        <Text style={s.privacyText}>
          EcoLearn requests precise location only when you tap search. You can
          choose approximate location in your device settings. It is not saved.
        </Text>
      </View>
      <Text style={s.fieldLabel}>ITEM OR MATERIAL</Text>
      <View style={s.itemInputRow}>
        <Ionicons name="search" size={18} color="#738078" />
        <TextInput
          value={itemQuery}
          onChangeText={setItemQuery}
          onSubmitEditing={() => void search()}
          placeholder="Try “aluminum cans”"
          returnKeyType="search"
          autoCorrect
          style={s.itemInput}
          accessibilityLabel="Item or material for nearby location search"
        />
        {itemQuery ? (
          <Pressable onPress={() => { setItemQuery(""); setSearchedFor(null); }} accessibilityLabel="Clear item search">
            <Ionicons name="close-circle" size={20} color="#879289" />
          </Pressable>
        ) : null}
      </View>
      <Text style={s.orLabel}>{itemQuery ? "OR CHOOSE A BROADER SERVICE" : "CHOOSE A SERVICE"}</Text>
      <View style={s.chips}>
        {categories.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => { setSiteType(value); setItemQuery(""); setSearchedFor(null); }}
            style={[s.chip, !itemQuery && siteType === value && s.chipActive]}
          >
            <Text style={[s.chipText, !itemQuery && siteType === value && s.chipTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        disabled={busy}
        style={[s.searchButton, busy && s.disabled]}
        onPress={() => void search()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={s.searchText}>Find nearby locations</Text>
          </>
        )}
      </Pressable>
      {searchedFor && !busy ? <Text style={s.queryStatus}>Nearby results for {searchedFor}</Text> : null}
      {location && (
        <MapView
          ref={mapRef}
          style={s.map}
          initialRegion={{
            ...location,
            latitudeDelta: 0.35,
            longitudeDelta: 0.35,
          }}
          showsUserLocation
          showsMyLocationButton
          accessibilityLabel={`Nearby disposal map with ${sites.length} locations`}
        >
          {sites.map((site, index) => (
            <Marker
              key={site.id}
              coordinate={{
                latitude: site.latitude,
                longitude: site.longitude,
              }}
              title={`${index + 1}. ${site.name}`}
              description={`${site.type} · ${milesFromKm(site.distanceKm).toFixed(1)} miles away`}
              pinColor={selected === site.id ? "#e38b24" : "#28763f"}
              onPress={() => setSelected(site.id)}
            />
          ))}
        </MapView>
      )}
      {notice && <Text style={s.notice}>{notice}</Text>}
      {sites.map((site, index) => (
        <View
          key={site.id}
          style={[s.site, selected === site.id && s.siteSelected]}
        >
          <Pressable onPress={() => focus(site)}>
            <Text style={s.siteTitle}>
              {index + 1}. {site.name}
            </Text>
            <Text style={s.siteMeta}>
              {site.address ?? site.type} · {milesFromKm(site.distanceKm).toFixed(1)} miles away
            </Text>
            {site.services?.length ? (
              <Text style={s.services}>{site.services.join(" · ")}</Text>
            ) : null}
          </Pressable>
          <View style={s.actions}>
            <Pressable
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`,
                )
              }
            >
              <Text style={s.link}>Directions ↗</Text>
            </Pressable>
            {site.sourceUrl && (
              <Pressable onPress={() => void Linking.openURL(site.sourceUrl!)}>
                <Text style={s.link}>Verify details ↗</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  kicker: {
    color: "#43834e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginTop: 6,
  },
  title: {
    color: "#173d2a",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.3,
    marginTop: 8,
  },
  body: { color: "#68766c", fontSize: 15, lineHeight: 23, marginTop: 9 },
  privacy: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: "#edf6e9",
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
  },
  privacyText: { color: "#405c48", flex: 1, fontSize: 12, lineHeight: 18 },
  fieldLabel: { color: "#6d796f", fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 20 },
  itemInputRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#d7e1d4",
    borderRadius: 15,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    marginTop: 8,
  },
  itemInput: { flex: 1, color: "#173d2a", fontSize: 14, fontWeight: "700" },
  orLabel: { color: "#879188", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginTop: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  chip: {
    borderWidth: 1,
    borderColor: "#d7e1d4",
    borderRadius: 99,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#173d2a", borderColor: "#173d2a" },
  chipText: { color: "#55645a", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  searchButton: {
    marginTop: 14,
    backgroundColor: "#173d2a",
    borderRadius: 15,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  searchText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.6 },
  queryStatus: { color: "#366f43", fontSize: 12, fontWeight: "800", marginTop: 12 },
  map: { height: 310, borderRadius: 22, marginTop: 18, overflow: "hidden" },
  notice: { color: "#78694e", fontSize: 11, lineHeight: 17, marginTop: 10 },
  site: {
    borderWidth: 1,
    borderColor: "#dfe5dc",
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 11,
  },
  siteSelected: { borderColor: "#438a50", backgroundColor: "#f4faf1" },
  siteTitle: { color: "#173d2a", fontSize: 16, fontWeight: "900" },
  siteMeta: { color: "#69766d", marginTop: 5, lineHeight: 19 },
  services: { color: "#53675a", fontSize: 11, lineHeight: 17, marginTop: 7 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 12 },
  link: { color: "#26723d", fontWeight: "800", fontSize: 13 },
});

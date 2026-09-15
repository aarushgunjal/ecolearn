import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "./supabase";

type Space = {
  id: string;
  scope: "community" | "classroom";
  name: string;
  delete_after: string;
};
export function DeletedSpaces({
  revision,
  onRestored,
}: {
  revision: unknown;
  onRestored: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await supabase.rpc("ecolearn_get_deleted_spaces");
      if (r.error) throw r.error;
      setSpaces(r.data as Space[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load deleted spaces.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (open) void load();
  }, [open, revision, load]);
  const restore = async (space: Space) => {
    setBusy(space.id);
    setError("");
    try {
      const r = await supabase.rpc("ecolearn_restore_space", {
        p_scope: space.scope,
        p_scope_id: space.id,
      });
      if (r.error) throw r.error;
      await onRestored();
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not restore this space.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Text style={s.title}>Recently deleted {open ? "−" : "+"}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={s.body}>
            Restore spaces within seven days. Restoring a community brings back
            its classrooms and content. Classrooms deleted separately keep their
            own recovery period.
          </Text>
          {!!error && (
            <>
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
              <Pressable onPress={() => void load()}>
                <Text style={s.link}>Retry</Text>
              </Pressable>
            </>
          )}
          {loading ? (
            <Text style={s.body}>Loading deleted spaces...</Text>
          ) : spaces.length === 0 && !error ? (
            <Text style={s.body}>No spaces awaiting deletion.</Text>
          ) : (
            spaces.map((space) => (
              <View key={space.id} style={s.row}>
                <Text style={s.title}>{space.name}</Text>
                <Text style={s.body}>
                  {space.scope} · Recover before{" "}
                  {new Date(space.delete_after).toLocaleString()}
                </Text>
                <Pressable
                  disabled={busy !== null}
                  onPress={() => void restore(space)}
                >
                  <Text style={s.link}>
                    {busy === space.id
                      ? "Restoring..."
                      : `Restore ${space.name}`}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 20,
    gap: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#dde6da",
    borderRadius: 18,
    backgroundColor: "white",
  },
  title: { fontWeight: "700", color: "#173d2a", fontSize: 16 },
  body: { fontSize: 13, lineHeight: 20, color: "#58675d" },
  error: { color: "#a33c34" },
  row: { gap: 8, paddingVertical: 12 },
  link: { color: "#24633a", fontWeight: "700", paddingVertical: 8 },
});

import { useEffect, useState, useSyncExternalStore } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  createActivityScopeStore,
  type ActivityScope,
} from "../../../packages/learning/activity-scope";
import { supabase } from "./supabase";

export const learningSpace = createActivityScopeStore();
export function LearningSpace() {
  const selected = useSyncExternalStore(
    learningSpace.subscribe,
    learningSpace.get,
  );
  const [spaces, setSpaces] = useState<NonNullable<ActivityScope>[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void supabase.rpc("ecolearn_get_hub").then(({ data, error }) => {
      if (!live) return;
      if (error) {
        setError(
          "Could not load learning spaces. Reopen this screen to retry.",
        );
        return;
      }
      const hub = data as {
        communities?: { id: string; name: string; role: string }[];
        classrooms?: {
          id: string;
          name: string;
          school_name: string;
          role: string;
        }[];
      };
      const next: NonNullable<ActivityScope>[] = [
        ...(hub?.communities ?? [])
          .filter((c) => c.role !== "admin")
          .map((c) => ({
            scope: "community" as const,
            id: c.id,
            name: c.name,
          })),
        ...(hub?.classrooms ?? [])
          .filter((c) => c.role === "student")
          .map((c) => ({
            scope: "classroom" as const,
            id: c.id,
            name: `${c.school_name} / ${c.name}`,
          })),
      ];
      setSpaces(next);
      if (
        learningSpace.get() &&
        !next.some((s) => s.id === learningSpace.get()?.id)
      )
        learningSpace.set(null);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 14,
        backgroundColor: "#fff",
        marginBottom: 18,
        gap: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose learning space"
        onPress={() => setOpen(true)}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text style={{ color: "#173d2a", fontWeight: "700" }}>
          Learning for: {selected?.name ?? "Personal learning"} ▾
        </Text>
      </Pressable>
      <Text style={{ color: "#58675d", fontSize: 12 }}>
        {selected
          ? "New XP counts here and in your personal total. Classroom XP also counts toward its school."
          : "Choose a space to contribute new activity to it."}
      </Text>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        presentationStyle="pageSheet"
      >
        <ScrollView contentContainerStyle={{ padding: 28, gap: 12 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 24, fontWeight: "700" }}
          >
            Learning space
          </Text>
          {[null, ...spaces].map((s) => (
            <Pressable
              key={s?.id ?? "personal"}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected?.id === s?.id }}
              onPress={() => {
                learningSpace.set(s);
                setOpen(false);
              }}
              style={{
                minHeight: 52,
                padding: 16,
                borderRadius: 12,
                backgroundColor: "#edf5e9",
              }}
            >
              <Text>{s?.name ?? "Personal learning"}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setOpen(false)} style={{ minHeight: 44 }}>
            <Text>Cancel</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

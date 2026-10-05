import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "./supabase";
import type { StudentPreviewData } from "../../../packages/learning/student-preview";
export function StudentPreview({
  classroomId,
  onClose,
}: {
  classroomId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StudentPreviewData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void supabase
      .rpc("ecolearn_preview_classroom", { p_classroom_id: classroomId })
      .then((r) => {
        if (!live) return;
        if (r.error) setError(r.error.message);
        else setData(r.data as StudentPreviewData);
      });
    return () => {
      live = false;
    };
  }, [classroomId]);
  const card = {
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
    gap: 12,
  } as const;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ ...card, backgroundColor: "#edf7e8" }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 22, fontWeight: "700" }}
        >
          Student preview
        </Text>
        <Text>
          Class content as a learner sees it. This preview is read-only and
          never records XP or student progress.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ fontWeight: "700" }}>Exit preview</Text>
        </Pressable>
      </View>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {!data && !error && <Text>Loading classroom preview…</Text>}
      {data && (
        <>
          <Text style={{ fontSize: 24, fontWeight: "700" }}>{data.name}</Text>
          <Text>
            {data.school} · {data.grade}
          </Text>
          <View style={card}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              Your assignments
            </Text>
            {data.assignments.length === 0 && <Text>No assignments yet.</Text>}
            {data.assignments.map((a) => (
              <View key={a.id} style={card}>
                <Text style={{ fontWeight: "700" }}>{a.title}</Text>
                <Text>{a.lesson_title}</Text>
                {!!a.due_at && (
                  <Text>Due {new Date(a.due_at).toLocaleString()}</Text>
                )}
                <Text>
                  Students can open this lesson and submit their own answer.
                </Text>
              </View>
            ))}
          </View>
          <View style={card}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              Announcements
            </Text>
            {data.announcements.length === 0 && (
              <Text>No announcements yet.</Text>
            )}
            {data.announcements.map((a) => (
              <View key={a.id} style={card}>
                <Text style={{ fontWeight: "700" }}>{a.title}</Text>
                <Text>{a.body}</Text>
              </View>
            ))}
          </View>
          <View style={card}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>
              Community events
            </Text>
            {data.events.length === 0 && <Text>No upcoming events.</Text>}
            {data.events.map((e) => (
              <View key={e.id} style={card}>
                <Text style={{ fontWeight: "700" }}>{e.title}</Text>
                <Text>{e.description}</Text>
                <Text>
                  {new Date(e.starts_at).toLocaleString()} · {e.location}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

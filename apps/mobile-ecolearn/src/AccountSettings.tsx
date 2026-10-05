import { AppDialog } from "./AppDialog";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "./supabase";
import { AdminSecurity } from "./AdminSecurity";

type Hub = {
  profile: { role: string; alias: string };
  communities: { role: string }[];
  classrooms: { role: string }[];
};
type Request = {
  user_id: string;
  organization: string;
  reason: string;
  status: string;
};
export function AccountSettings() {
  const [hub, setHub] = useState<Hub | null>(null);
  const [alias, setAlias] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [organization, setOrganization] = useState("");
  const [reason, setReason] = useState("");
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const [h, r] = await Promise.all([
      supabase.rpc("ecolearn_get_hub"),
      supabase
        .from("ecolearn_teacher_requests")
        .select("user_id,organization,reason,status")
        .order("created_at"),
    ]);
    if (h.error || r.error)
      throw new Error("Could not load account settings. Please retry.");
    const next = h.data as Hub;
    setHub(next);
    setAlias(next.profile.alias);
    setRequests((r.data ?? []) as Request[]);
    setError("");
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  const run = async (
    name: string,
    params: Record<string, unknown>,
    success: string,
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc(name, params);
      if (r.error) throw new Error(r.error.message);
      await refresh();
      AppDialog.alert(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  };
  const teacher = Boolean(hub && hub.profile.role !== "student");
  const managed =
    (hub?.communities.filter((c) => ["owner", "manager"].includes(c.role))
      .length ?? 0) +
    (hub?.classrooms.filter((c) => c.role === "teacher").length ?? 0);
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>
        Account settings
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!hub ? (
        <Pressable
          onPress={() => void refresh().catch((e) => setError(e.message))}
        >
          <Text style={s.link}>Load account settings</Text>
        </Pressable>
      ) : (
        <>
          <Text style={s.body}>
            {teacher ? "Educator account" : "Student account"}
          </Text>
          <Text style={s.body}>Community display name</Text>
          <TextInput
            accessibilityLabel="Community display name"
            style={s.input}
            value={alias}
            onChangeText={setAlias}
            maxLength={40}
          />
          <Pressable
            disabled={busy || alias.trim().length < 2 || Boolean(error)}
            style={s.button}
            onPress={() =>
              void run(
                "ecolearn_set_profile",
                { p_alias: alias, p_role: teacher ? "teacher" : "student" },
                "Display name saved",
              )
            }
          >
            <Text style={s.white}>Save community name</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: teacherOpen }}
            onPress={() => setTeacherOpen(!teacherOpen)}
          >
            <Text style={s.link}>Teacher access</Text>
          </Pressable>
          {teacherOpen && (
            <View style={s.stack}>
              {teacher ? (
                <>
                  <Text style={s.body}>
                    Use Student preview in Community to see your classroom
                    without changing account permissions.
                  </Text>
                  {hub.profile.role !== "admin" && (
                    <>
                      <Text style={s.body}>
                        {managed
                          ? "Leave or delete your active managed spaces before changing to a student account. Deleted spaces do not block this change."
                          : "Changing to a student account removes teacher access. You will need approval again to restore deleted spaces."}
                      </Text>
                      <Pressable
                        disabled={busy || managed > 0}
                        onPress={() =>
                          AppDialog.alert(
                            "Change to a student account?",
                            "Give up teacher access? Your personal learning progress is kept.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Confirm student account",
                                onPress: () =>
                                  void run(
                                    "ecolearn_set_profile",
                                    { p_alias: alias, p_role: "student" },
                                    "Account changed to student",
                                  ),
                              },
                            ],
                          )
                        }
                      >
                        <Text style={[s.link, managed > 0 && { opacity: 0.5 }]}>
                          Change to a student account
                        </Text>
                      </Pressable>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={s.body}>
                    Use a private teacher invitation from your school owner, or
                    request approval from an EcoLearn administrator.
                  </Text>
                  {requests.some((r) => r.status === "pending") ? (
                    <Text style={s.body}>Your request is awaiting review.</Text>
                  ) : (
                    <>
                      <Text style={s.body}>School or organization</Text>
                      <TextInput
                        accessibilityLabel="School or organization"
                        style={s.input}
                        value={organization}
                        onChangeText={setOrganization}
                        maxLength={120}
                      />
                      <Text style={s.body}>Your teaching role</Text>
                      <TextInput
                        accessibilityLabel="Your teaching role"
                        style={s.input}
                        multiline
                        value={reason}
                        onChangeText={setReason}
                        maxLength={1000}
                        placeholder="Describe who you teach and how you will use EcoLearn."
                      />
                      <Pressable
                        disabled={
                          busy ||
                          organization.trim().length < 2 ||
                          reason.trim().length < 10
                        }
                        style={s.button}
                        onPress={() =>
                          void run(
                            "ecolearn_request_teacher_access",
                            { p_organization: organization, p_reason: reason },
                            "Teacher access requested",
                          )
                        }
                      >
                        <Text style={s.white}>Request teacher access</Text>
                      </Pressable>
                    </>
                  )}
                </>
              )}
              {hub.profile.role === "admin" && (
                <>
                  <Text style={s.title}>Pending teacher requests</Text>
                  {requests.filter((r) => r.status === "pending").length ===
                    0 && <Text>No pending requests.</Text>}
                  {requests
                    .filter((r) => r.status === "pending")
                    .map((r) => (
                      <View key={r.user_id} style={s.card}>
                        <Text style={s.title}>{r.organization}</Text>
                        <Text style={s.body}>{r.reason}</Text>
                        {[true, false].map((approve) => (
                          <Pressable
                            key={String(approve)}
                            disabled={busy}
                            onPress={() =>
                              AppDialog.alert(
                                `${approve ? "Approve" : "Decline"} teacher access?`,
                                r.organization,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Confirm",
                                    onPress: () =>
                                      void run(
                                        "ecolearn_review_teacher_access",
                                        {
                                          p_user_id: r.user_id,
                                          p_approve: approve,
                                        },
                                        "Request reviewed",
                                      ),
                                  },
                                ],
                              )
                            }
                          >
                            <Text style={s.link}>
                              {approve ? "Approve request" : "Decline request"}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                </>
              )}
            </View>
          )}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: securityOpen }}
        onPress={() => setSecurityOpen(!securityOpen)}
      >
        <Text style={s.link}>Security settings</Text>
      </Pressable>
      {securityOpen && (
        <>
          <Text style={s.body}>
            Administrator verification protects platform management. Normal
            learning does not require an authenticator.
          </Text>
          <AdminSecurity
            onVerified={() => void refresh().catch((e) => setError(e.message))}
          />
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 20,
    marginVertical: 16,
    borderRadius: 18,
    backgroundColor: "#fff",
    gap: 12,
  },
  stack: { gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#173d2a" },
  body: { fontSize: 14, lineHeight: 21, color: "#58675d" },
  input: {
    borderWidth: 1,
    borderColor: "#cbdcc5",
    borderRadius: 12,
    padding: 14,
    color: "#173d2a",
  },
  button: {
    minHeight: 48,
    backgroundColor: "#173d2a",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  white: { color: "#fff", fontWeight: "700" },
  link: {
    minHeight: 44,
    paddingVertical: 12,
    color: "#24633a",
    fontWeight: "600",
  },
  error: { color: "#a33c34" },
});

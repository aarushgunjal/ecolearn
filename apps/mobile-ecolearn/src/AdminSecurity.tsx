import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "./supabase";

type Factor = { id: string; friendly_name?: string };
type Enrollment = { id: string; secret: string; uri: string };

export function AdminSecurity({
  promptOnly = false,
  onVerified,
}: {
  promptOnly?: boolean;
  onVerified?: () => void;
}) {
  const [admin, setAdmin] = useState(false);
  const [verified, setVerified] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const access = await supabase.rpc("ecolearn_admin_access");
    if (access.error)
      throw new Error("Could not check administrator security. Please retry.");
    const status = access.data as { is_admin: boolean; verified: boolean };
    setAdmin(status.is_admin);
    setVerified(status.verified);
    if (!status.is_admin) return;
    const list = await supabase.auth.mfa.listFactors();
    if (list.error) throw list.error;
    setFactors(list.data.totp);
    setFactorId((current) =>
      list.data.totp.some((f) => f.id === current)
        ? current
        : (list.data.totp[0]?.id ?? ""),
    );
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const enroll = () =>
    run(async () => {
      const r = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "EcoLearn",
        friendlyName: `Authenticator ${new Date().toISOString()}`,
      });
      if (r.error) throw r.error;
      setEnrollment({
        id: r.data.id,
        secret: r.data.totp.secret,
        uri: r.data.totp.uri,
      });
      setCode("");
    });
  const verify = () =>
    run(async () => {
      const r = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment?.id ?? factorId,
        code,
      });
      if (r.error) throw r.error;
      setEnrollment(null);
      setCode("");
      await refresh();
      onVerified?.();
    });
  const cancel = () =>
    run(async () => {
      if (enrollment) {
        const r = await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
        if (r.error) throw r.error;
      }
      setEnrollment(null);
      setCode("");
    });
  if ((!admin && !error) || (promptOnly && verified)) return null;
  return (
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="header">
        Administrator security
      </Text>
      <Text style={s.body}>
        {verified
          ? "Two-factor authentication is active for this session."
          : "Verify with an authenticator app to manage all communities. Your regular learning account remains available."}
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!admin && !!error && (
        <Pressable disabled={busy} onPress={() => void run(refresh)}>
          <Text style={s.link}>Retry security check</Text>
        </Pressable>
      )}
      {admin && (
        <>
          {enrollment && (
            <View style={s.stack}>
              <Pressable
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    try {
                      await Linking.openURL(enrollment.uri);
                    } catch {
                      throw new Error(
                        "Open your authenticator and enter the setup key below.",
                      );
                    }
                  })
                }
              >
                <Text style={s.link}>Open authenticator app</Text>
              </Pressable>
              <Text style={s.body}>
                Or add a time-based code manually using this setup key:
              </Text>
              <Text
                selectable
                accessibilityLabel="Authenticator setup key"
                style={s.secret}
              >
                {enrollment.secret}
              </Text>
              <Text style={s.body}>
                Keep a backup in your authenticator or add a second
                authenticator after setup. This key is shown only during setup.
              </Text>
            </View>
          )}
          {(!verified || enrollment) && (enrollment || factors.length > 0) && (
            <View style={s.stack}>
              {!enrollment &&
                factors.length > 1 &&
                factors.map((f) => (
                  <Pressable
                    key={f.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: factorId === f.id }}
                    onPress={() => setFactorId(f.id)}
                  >
                    <Text style={s.link}>
                      {factorId === f.id ? "● " : "○ "}
                      {f.friendly_name ?? "Authenticator"}
                    </Text>
                  </Pressable>
                ))}
              <Text style={s.body}>Authenticator code</Text>
              <TextInput
                accessibilityLabel="Authenticator code"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                style={s.input}
              />
              <Pressable
                disabled={busy || code.length !== 6}
                onPress={() => void verify()}
                style={[s.button, (busy || code.length !== 6) && s.disabled]}
              >
                <Text style={s.buttonText}>
                  {busy
                    ? "Checking..."
                    : enrollment
                      ? "Enable authenticator"
                      : "Verify administrator access"}
                </Text>
              </Pressable>
              {enrollment && (
                <Pressable disabled={busy} onPress={() => void cancel()}>
                  <Text style={s.link}>Cancel setup</Text>
                </Pressable>
              )}
            </View>
          )}
          {!enrollment && (verified || factors.length === 0) && (
            <Pressable
              disabled={busy}
              onPress={() => void enroll()}
              style={[s.button, busy && s.disabled]}
            >
              <Text style={s.buttonText}>
                {factors.length
                  ? "Add backup authenticator"
                  : "Set up authenticator"}
              </Text>
            </Pressable>
          )}
          {verified &&
            !enrollment &&
            factors.length > 1 &&
            factors.map((f) => (
              <View key={f.id} style={s.stack}>
                <Text style={s.body}>{f.friendly_name ?? "Authenticator"}</Text>
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const r = await supabase.auth.mfa.unenroll({
                        factorId: f.id,
                      });
                      if (r.error) throw r.error;
                      await refresh();
                    })
                  }
                >
                  <Text style={s.error}>Remove authenticator</Text>
                </Pressable>
              </View>
            ))}
          {!verified && factors.length > 0 && (
            <Text style={s.body}>
              Lost your authenticator? Use your backup authenticator. If both
              are unavailable, contact support for account recovery.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbdcc5",
    gap: 12,
    marginVertical: 16,
  },
  title: { color: "#173d2a", fontSize: 18, fontWeight: "700" },
  body: { color: "#58675d", fontSize: 14, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: "#cbdcc5",
    padding: 14,
    borderRadius: 10,
    color: "#173d2a",
  },
  stack: { gap: 12 },
  secret: {
    color: "#173d2a",
    fontSize: 14,
    padding: 12,
    backgroundColor: "#f4f8f1",
  },
  link: { color: "#24633a", fontWeight: "600", paddingVertical: 8 },
  error: { color: "#a33c34" },
  button: {
    backgroundColor: "#173d2a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "700" },
  disabled: { opacity: 0.5 },
});

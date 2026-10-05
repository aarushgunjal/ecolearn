import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { AccessibilityInfo, findNodeHandle, Keyboard, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, type AlertButton, type AlertOptions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { createDialogQueue } from "../../../packages/learning/dialog-queue";

type Dialog = { title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions };
const queue = createDialogQueue<Dialog>();
export const AppDialog = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    Keyboard.dismiss();
    queue.add({ title, message, buttons: buttons?.length ? buttons : [{ text: "Got it" }], options });
  },
};

export function DialogRoot({ children }: { children: ReactNode }) {
  const active = useSyncExternalStore(queue.subscribe, queue.get);
  const heading = useRef<Text>(null);
  const dialog = active?.value;
  const destructive = dialog?.buttons.some(button => button.style === "destructive");
  const dismiss = () => {
    if (!active || !dialog) return;
    const cancel = dialog.buttons.find(button => button.style === "cancel");
    if (!cancel && !dialog.options?.cancelable) return;
    if (!queue.take(active.id)) return;
    cancel?.onPress?.();
    dialog.options?.onDismiss?.();
  };
  return <View style={s.root}>
    <View style={s.root} accessibilityElementsHidden={!!active} importantForAccessibility={active ? "no-hide-descendants" : "auto"}>{children}</View>
    <Modal visible={!!active} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}
      onShow={() => { const node = findNodeHandle(heading.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }}>
      <SafeAreaView style={s.backdrop}>
        {active && dialog && <View style={s.card} accessibilityViewIsModal>
          <ScrollView bounces={false} contentContainerStyle={s.content}>
            <View style={[s.icon, destructive && s.dangerIcon]}><Ionicons name={destructive ? "alert-circle-outline" : "leaf-outline"} size={26} color={destructive ? "#a13325" : "#286c3d"} /></View>
            <Text ref={heading} accessible accessibilityRole="header" style={s.title}>{dialog.title}</Text>
            {!!dialog.message && <Text selectable style={s.message}>{dialog.message}</Text>}
            <View style={s.actions}>{dialog.buttons.map((button, index) => <Pressable key={`${active.id}-${index}`} accessibilityRole="button"
              style={({ pressed }) => [s.button, button.style === "cancel" ? s.cancel : button.style === "destructive" ? s.danger : s.primary, pressed && s.pressed]}
              onPress={() => { if (queue.take(active.id)) button.onPress?.(); }}>
              <Text style={[s.buttonText, button.style === "cancel" && s.cancelText]}>{button.text ?? "Continue"}</Text>
            </Pressable>)}</View>
          </ScrollView>
        </View>}
      </SafeAreaView>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(12,31,23,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  card: { width: "100%", maxWidth: 440, maxHeight: "90%", borderRadius: 24, backgroundColor: "#fff", overflow: "hidden", elevation: 8, boxShadow: "0 16px 48px rgba(0,0,0,0.18)" },
  content: { padding: 24 },
  icon: { backgroundColor: "#edf5e9", width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  dangerIcon: { backgroundColor: "#fff0eb" },
  title: { fontSize: 24, lineHeight: 31, fontWeight: "700", color: "#173d2a" },
  message: { fontSize: 17, lineHeight: 26, color: "#52665a", marginTop: 12 },
  actions: { gap: 10, marginTop: 24 },
  button: { minHeight: 52, borderRadius: 14, padding: 14, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#286c3d" }, danger: { backgroundColor: "#a13325" }, cancel: { backgroundColor: "#eef2ec" },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center" }, cancelText: { color: "#294b38" }, pressed: { opacity: 0.75 },
});

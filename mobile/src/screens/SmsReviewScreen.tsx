import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, parseDate } from "../api";
import { Category } from "../types";
import { parseSms } from "../lib/smsParser";
import { getPending, rememberCategory, recalledCategory, enqueue, remove, type PendingSms } from "../lib/smsQueue";
import Dot from "../components/Dot";

/** Paste a bank SMS, and it's parsed into a card below — the same card
 *  every pending message gets, so pasting several in a row before
 *  confirming any of them works exactly the same as confirming one right
 *  away. Nothing is logged until you tap "Log it" on that card. */
export default function SmsReviewScreen() {
  const t = useTheme();
  const [text, setText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSms[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [items, cats] = await Promise.all([getPending(), api.categories.list("expense")]);
    setCategories(cats);

    const picks: Record<string, number> = {};
    for (const item of items) {
      picks[item.id] = (await recalledCategory(item.merchant)) ?? cats[0]?.id ?? 0;
    }
    setChosen((prev) => ({ ...picks, ...prev }));
    setPending(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function addFromPaste() {
    const body = text.trim();
    if (!body) return;
    setPasteError(null);

    const parsed = parseSms(body);
    if (!parsed) {
      setPasteError(
        "Didn't recognise this as a bank debit message. Double-check you copied the whole text, or log it manually from Add."
      );
      return;
    }

    const added = await enqueue(parsed);
    setText("");
    if (!added) {
      setPasteError("Already added — that exact message is sitting below.");
      return;
    }
    await load();
  }

  async function confirm(item: PendingSms) {
    const categoryId = chosen[item.id];
    if (!categoryId) return Alert.alert("Pick a category first.");
    setBusyId(item.id);
    try {
      await api.transactions.create({
        category_id: categoryId,
        description: item.merchant,
        amount: item.amount,
        is_paid: true,
        occurred_on: item.occurredOn,
      });
      await rememberCategory(item.merchant, categoryId);
      await remove(item.id);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err: any) {
      Alert.alert("Couldn't log that", err.message || "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  function dismiss(item: PendingSms) {
    Alert.alert("Dismiss this?", `Rs ${item.amount.toLocaleString()} at ${item.merchant} won't be logged.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Dismiss",
        style: "destructive",
        onPress: async () => {
          await remove(item.id);
          setPending((prev) => prev.filter((p) => p.id !== item.id));
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Log from SMS</Text>
      <Text style={{ color: t.inkMuted, fontSize: 12.5, marginBottom: 14, lineHeight: 17 }}>
        Copy a debit-card or purchase alert from your messages app, paste it below, and pick a category —
        that's the whole flow. Nothing is logged until you tap "Log it".
      </Text>

      <View style={[styles.pasteCard, { backgroundColor: t.page2 }]}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (pasteError) setPasteError(null);
          }}
          placeholder="Paste the bank SMS here…"
          placeholderTextColor={t.inkMuted}
          multiline
          style={[styles.pasteInput, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
        />
        {pasteError && <Text style={{ color: t.status.critical, fontSize: 11.5, marginTop: 8 }}>{pasteError}</Text>}
        <Pressable
          onPress={addFromPaste}
          disabled={!text.trim()}
          style={[styles.pasteButton, { backgroundColor: t.accent, opacity: text.trim() ? 1 : 0.5 }]}
        >
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 13.5 }}>Add</Text>
        </Pressable>
      </View>

      {pending.length > 0 && (
        <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>
          Waiting to be logged ({pending.length})
        </Text>
      )}

      {pending.map((item) => (
        <Card
          key={item.id}
          item={item}
          categories={categories}
          categoryId={chosen[item.id]}
          onPickCategory={(id) => setChosen((prev) => ({ ...prev, [item.id]: id }))}
          expanded={!!expanded[item.id]}
          onToggleExpand={() => setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
          busy={busyId === item.id}
          onConfirm={() => confirm(item)}
          onDismiss={() => dismiss(item)}
        />
      ))}
    </ScrollView>
  );
}

function Card({
  item,
  categories,
  categoryId,
  onPickCategory,
  expanded,
  onToggleExpand,
  busy,
  onConfirm,
  onDismiss,
}: {
  item: PendingSms;
  categories: Category[];
  categoryId: number | undefined;
  onPickCategory: (id: number) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const t = useTheme();
  const dateLabel = parseDate(item.occurredOn).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <View style={[styles.card, { backgroundColor: t.page2 }]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontSize: 17, fontWeight: "700", fontFamily: fonts.mono }}>
            Rs {item.amount.toLocaleString()}
          </Text>
          <Text style={{ color: t.ink, fontSize: 13.5, marginTop: 2 }} numberOfLines={1}>
            {item.merchant}
          </Text>
          <Text style={{ color: t.inkMuted, fontSize: 11, marginTop: 2 }}>
            {item.bank} · {dateLabel}
          </Text>
        </View>
        <Pressable onPress={onToggleExpand} hitSlop={8}>
          <Ionicons name={expanded ? "chevron-up" : "information-circle-outline"} size={18} color={t.inkMuted} />
        </Pressable>
      </View>

      {expanded && (
        <Text style={{ color: t.inkMuted, fontSize: 11, marginTop: 8, lineHeight: 16 }}>{item.raw}</Text>
      )}

      <Text style={[styles.label, { color: t.inkMuted }]}>Category</Text>
      {categories.length === 0 ? (
        <Text style={{ color: t.inkMuted, fontSize: 12 }}>No expense categories yet — add one on the web.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((c) => {
            const selected = c.id === categoryId;
            return (
              <Pressable
                key={c.id}
                onPress={() => onPickCategory(c.id)}
                style={[styles.chip, { borderColor: selected ? t.accent : t.rule, backgroundColor: selected ? t.page : "transparent" }]}
              >
                <Dot color={t.categoryColor(c.color)} size={7} />
                <Text style={{ color: t.ink, fontSize: 12, fontWeight: selected ? "600" : "400" }}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.buttonRow}>
        <Pressable
          onPress={onConfirm}
          disabled={busy || !categoryId}
          style={[styles.button, { backgroundColor: t.accent, opacity: busy || !categoryId ? 0.6 : 1 }]}
        >
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 13.5 }}>{busy ? "Logging…" : "Log it"}</Text>
        </Pressable>
        <Pressable onPress={onDismiss} disabled={busy} style={styles.dismissButton}>
          <Text style={{ color: t.inkMuted, fontSize: 13.5 }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40, gap: 12 },
  title: { fontSize: 22 },
  pasteCard: { borderRadius: 14, padding: 14, marginBottom: 4 },
  pasteInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 13, minHeight: 90, textAlignVertical: "top" },
  pasteButton: { marginTop: 10, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 },
  card: { borderRadius: 14, padding: 15 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 14, marginBottom: 7 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11, marginRight: 7 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  button: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  dismissButton: { paddingVertical: 11, paddingHorizontal: 6 },
});

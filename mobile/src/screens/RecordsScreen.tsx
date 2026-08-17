import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Modal, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, money } from "../api";
import { Field, RecordRow, Section } from "../types";
import RecordForm from "../components/RecordForm";

// Everything after the title line, so a row shows a little context.
function summarise(section: Section, record: RecordRow) {
  return section.fields
    .slice(1)
    .map((f) => formatValue(f, record))
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function formatValue(field: Field, record: RecordRow): string {
  const value = record.data?.[field.key];
  if (value === undefined || value === null || value === "") return "";
  switch (field.type) {
    case "money":
      return money(value);
    case "boolean":
      return value ? field.name : "";
    case "date":
      return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    case "relation":
      return record.relations?.[field.key]?.label ?? "";
    case "longtext":
      return String(value).length > 30 ? String(value).slice(0, 30) + "…" : String(value);
    default:
      return String(value);
  }
}

export default function RecordsScreen({ route, navigation }: any) {
  const t = useTheme();
  const section: Section = route.params.section;
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: section.name });
  }, [navigation, section.name]);

  const load = useCallback(
    async (q: string) => {
      try {
        setRecords(await api.records.list(section.id, q.trim() ? { q: q.trim() } : {}));
        setError(null);
      } catch (err: any) {
        setError(err.message || "Couldn't load records.");
      }
    },
    [section.id]
  );

  useFocusEffect(
    useCallback(() => {
      load(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function openAdd() {
    setEditing(null);
    setValues({});
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(record: RecordRow) {
    setEditing(record);
    setValues({ ...record.data });
    setFormError(null);
    setFormOpen(true);
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.records.update(editing.id, values);
      else await api.records.create(section.id, values);
      setFormOpen(false);
      await load(query);
    } catch (err: any) {
      setFormError(err.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  function remove(record: RecordRow) {
    Alert.alert(`Delete "${record.title}"?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.records.remove(record.id);
            await load(query);
          } catch (err: any) {
            Alert.alert("Couldn't delete", err.message);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={styles.header}>
        <View style={[styles.searchRow, { borderColor: t.rule, backgroundColor: t.page }]}>
          <Ionicons name="search" size={15} color={t.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${section.name.toLowerCase()}`}
            placeholderTextColor={t.inkMuted}
            style={[styles.searchInput, { color: t.ink }]}
          />
        </View>
        <Pressable onPress={openAdd} style={[styles.addBtn, { backgroundColor: t.accent }]}>
          <Ionicons name="add" size={20} color={t.accentInk} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load(query);
          setRefreshing(false);
        }} tintColor={t.accent} />}
      >
        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

        {!error && records.length === 0 && (
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>
            {query ? "Nothing matches your search." : `No ${section.name.toLowerCase()} yet — tap + to add one.`}
          </Text>
        )}

        {records.map((r) => {
          const sub = summarise(section, r);
          return (
            <Pressable
              key={r.id}
              onPress={() => openEdit(r)}
              onLongPress={() => remove(r)}
              style={[styles.card, { backgroundColor: t.page2 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{r.title}</Text>
                {!!sub && (
                  <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={15} color={t.inkMuted} />
            </Pressable>
          );
        })}

        {records.length > 0 && (
          <Text style={{ color: t.inkMuted, fontSize: 11, textAlign: "center", marginTop: 8 }}>
            Tap to edit · long-press to delete
          </Text>
        )}
      </ScrollView>

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={{ flex: 1, backgroundColor: t.paper }}>
          <View style={[styles.modalHeader, { borderColor: t.rule }]}>
            <Pressable onPress={() => setFormOpen(false)} hitSlop={8}>
              <Text style={{ color: t.inkMuted, fontSize: 14 }}>Cancel</Text>
            </Pressable>
            <Text style={{ color: t.ink, fontSize: 16, fontWeight: "600", fontFamily: fonts.display }}>
              {editing ? "Edit" : "New"} {section.name.replace(/s$/, "")}
            </Text>
            <Pressable onPress={save} disabled={saving} hitSlop={8}>
              <Text style={{ color: t.accent, fontSize: 14, fontWeight: "600", opacity: saving ? 0.5 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
            {formError && (
              <Text style={{ color: t.status.critical, fontSize: 12.5, marginBottom: 14 }}>{formError}</Text>
            )}
            <RecordForm
              fields={section.fields}
              values={values}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  searchRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  list: { padding: 18, paddingTop: 8, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 52, borderBottomWidth: 1 },
});

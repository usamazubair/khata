import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../theme";
import { api } from "../api";
import { Field, RecordRow } from "../types";
import Dot from "./Dot";

const SWATCHES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

/** Renders one input per field definition — the mobile counterpart of the
 *  dashboard's generic form. */
export default function RecordForm({
  fields,
  values,
  onChange,
}: {
  fields: Field[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}) {
  const t = useTheme();
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const [relationChoices, setRelationChoices] = useState<Record<number, RecordRow[]>>({});

  // Relation dropdowns need the target section's records to show names.
  useEffect(() => {
    const targets = [
      ...new Set(
        fields.filter((f) => f.type === "relation" && f.options?.section_id).map((f) => f.options.section_id!)
      ),
    ];
    targets.forEach(async (sectionId) => {
      if (relationChoices[sectionId]) return;
      try {
        const rows = await api.records.list(sectionId);
        setRelationChoices((prev) => ({ ...prev, [sectionId]: rows }));
      } catch {
        setRelationChoices((prev) => ({ ...prev, [sectionId]: [] }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const inputStyle = [styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }];

  return (
    <View>
      {fields.map((field) => {
        const value = values[field.key];
        const label = `${field.name}${field.required ? " *" : ""}`;

        return (
          <View key={field.id} style={styles.fieldRow}>
            <Text style={[styles.label, { color: t.inkMuted }]}>{label}</Text>

            {(field.type === "text" || field.type === "longtext") && (
              <TextInput
                value={value ?? ""}
                onChangeText={(v) => onChange(field.key, v)}
                placeholder={field.type === "longtext" ? "…" : field.name}
                placeholderTextColor={t.inkMuted}
                multiline={field.type === "longtext"}
                style={[...inputStyle, field.type === "longtext" && { minHeight: 72, textAlignVertical: "top" }]}
              />
            )}

            {(field.type === "number" || field.type === "money") && (
              <TextInput
                value={value === null || value === undefined ? "" : String(value)}
                onChangeText={(v) => onChange(field.key, v.replace(/[^0-9.\-]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={t.inkMuted}
                style={inputStyle}
              />
            )}

            {field.type === "boolean" && (
              <View style={styles.switchRow}>
                <Text style={{ color: t.ink, fontSize: 14 }}>{value ? "Yes" : "No"}</Text>
                <Switch
                  value={!!value}
                  onValueChange={(v) => onChange(field.key, v)}
                  trackColor={{ true: t.accent, false: t.rule }}
                />
              </View>
            )}

            {field.type === "date" && (
              <>
                <Pressable onPress={() => setDatePickerFor(field.key)} style={inputStyle}>
                  <Text style={{ color: value ? t.ink : t.inkMuted, fontSize: 14 }}>
                    {value
                      ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                      : "Pick a date"}
                  </Text>
                </Pressable>
                {datePickerFor === field.key && (
                  <DateTimePicker
                    value={value ? new Date(value) : new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={(_, selected) => {
                      setDatePickerFor(Platform.OS === "ios" ? field.key : null);
                      if (selected) onChange(field.key, selected.toISOString().slice(0, 10));
                    }}
                  />
                )}
              </>
            )}

            {field.type === "select" && (
              <View style={styles.chipWrap}>
                {(field.options?.choices || []).map((choice) => {
                  const selected = value === choice;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => onChange(field.key, selected ? null : choice)}
                      style={[
                        styles.chip,
                        { borderColor: selected ? t.accent : t.rule, backgroundColor: selected ? t.page : "transparent" },
                      ]}
                    >
                      <Text style={{ color: t.ink, fontSize: 12, fontWeight: selected ? "600" : "400" }}>{choice}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {field.type === "color" && (
              <View style={styles.chipWrap}>
                {SWATCHES.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => onChange(field.key, hex)}
                    style={[
                      styles.swatch,
                      { backgroundColor: t.categoryColor(hex), borderColor: value === hex ? t.ink : "transparent" },
                    ]}
                  />
                ))}
              </View>
            )}

            {field.type === "relation" && (
              <View style={styles.chipWrap}>
                {(relationChoices[field.options?.section_id ?? -1] || []).map((row) => {
                  const selected = String(value) === String(row.id);
                  return (
                    <Pressable
                      key={row.id}
                      onPress={() => onChange(field.key, selected ? null : row.id)}
                      style={[
                        styles.chip,
                        { borderColor: selected ? t.accent : t.rule, backgroundColor: selected ? t.page : "transparent" },
                      ]}
                    >
                      <Text style={{ color: t.ink, fontSize: 12, fontWeight: selected ? "600" : "400" }}>{row.title}</Text>
                    </Pressable>
                  );
                })}
                {!(relationChoices[field.options?.section_id ?? -1] || []).length && (
                  <Text style={{ color: t.inkMuted, fontSize: 12, fontStyle: "italic" }}>
                    Nothing to link to yet.
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldRow: { marginBottom: 14 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
});

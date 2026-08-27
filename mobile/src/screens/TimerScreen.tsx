import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { ensurePermission } from "../lib/reminders";
import { fireTimerAlert } from "../lib/timerAlerts";
import ProgressBar from "../components/ProgressBar";

const MODES = ["EMOM", "Rest Timer"] as const;
type Mode = (typeof MODES)[number];
const PRESETS = [30, 45, 60, 90, 120];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Stepper({ value, onChange, step, min, label, t }: { value: number; onChange: (v: number) => void; step: number; min: number; label: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.stepperCol}>
      <Text style={{ color: t.inkMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{label}</Text>
      <View style={[styles.stepperRow, { borderColor: t.rule, backgroundColor: t.page2 }]}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.stepperBtn} hitSlop={8}>
          <Ionicons name="remove" size={17} color={t.ink} />
        </Pressable>
        <Text style={{ color: t.ink, fontSize: 17, fontFamily: fonts.mono, fontWeight: "600", minWidth: 44, textAlign: "center" }}>
          {value}
        </Text>
        <Pressable onPress={() => onChange(value + step)} style={styles.stepperBtn} hitSlop={8}>
          <Ionicons name="add" size={17} color={t.ink} />
        </Pressable>
      </View>
    </View>
  );
}

/** EMOM (every-minute-on-the-minute intervals) or a plain rest countdown --
 *  both just a repeating "count down, alert, repeat" loop underneath, so
 *  they share one ticking mechanism and differ only in what happens when
 *  the count hits zero: EMOM starts the next round automatically until
 *  the round count runs out, a rest timer just alerts once and stops. */
export default function TimerScreen() {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>("EMOM");

  const [emomInterval, setEmomInterval] = useState(60);
  const [emomRounds, setEmomRounds] = useState(10);
  const [round, setRound] = useState(1);

  const [restDuration, setRestDuration] = useState(60);
  const [customRest, setCustomRest] = useState("");

  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const duration = mode === "EMOM" ? emomInterval : restDuration;

  // Switching mode (or changing a duration/rounds input) resets a stopped
  // timer to match -- but never yanks the clock out from under a run in
  // progress.
  useEffect(() => {
    if (!running) {
      setRemaining(duration);
      setRound(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, emomInterval, restDuration]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;

        // Hit zero.
        if (mode === "EMOM") {
          setRound((prevRound) => {
            const next = prevRound + 1;
            if (next > emomRounds) {
              fireTimerAlert("EMOM complete", `All ${emomRounds} rounds done.`);
              setRunning(false);
              return prevRound;
            }
            fireTimerAlert("Next round", `Round ${next} of ${emomRounds}.`);
            return next;
          });
          return emomInterval;
        }

        fireTimerAlert("Rest over", "Time to get back to it.");
        setRunning(false);
        return restDuration;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode, emomInterval, emomRounds, restDuration]);

  async function start() {
    await ensurePermission(); // best-effort -- the timer still runs visually either way
    setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setRemaining(duration);
    setRound(1);
  }

  const progress = duration > 0 ? 1 - remaining / duration : 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={styles.container}>
        <View style={[styles.modeRow, { backgroundColor: t.page2 }]}>
          {MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                if (!running) setMode(m);
              }}
              style={[styles.modeSeg, mode === m && { backgroundColor: t.page }, running && mode !== m && { opacity: 0.4 }]}
            >
              <Text style={{ color: t.ink, fontSize: 13, fontWeight: mode === m ? "600" : "400" }}>{m}</Text>
            </Pressable>
          ))}
        </View>

        {mode === "EMOM" ? (
          <>
            <Text style={[styles.roundLabel, { color: t.inkMuted }]}>Round {round} of {emomRounds}</Text>
            <Text style={[styles.clock, { color: t.ink, fontFamily: fonts.mono }]}>{fmt(remaining)}</Text>
            <View style={styles.progressWrap}>
              <ProgressBar pct={progress * 100} color={t.accent} />
            </View>
            {!running && (
              <View style={styles.inputsRow}>
                <Stepper t={t} label="Seconds" value={emomInterval} step={5} min={5} onChange={setEmomInterval} />
                <Stepper t={t} label="Rounds" value={emomRounds} step={1} min={1} onChange={setEmomRounds} />
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.roundLabel, { color: t.inkMuted }]}>Rest between sets</Text>
            <Text style={[styles.clock, { color: t.ink, fontFamily: fonts.mono }]}>{fmt(remaining)}</Text>
            <View style={styles.progressWrap}>
              <ProgressBar pct={progress * 100} color={t.accent2} />
            </View>
            {!running && (
              <>
                <View style={styles.presetRow}>
                  {PRESETS.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => {
                        setRestDuration(p);
                        setCustomRest("");
                      }}
                      style={[styles.presetChip, { borderColor: restDuration === p ? t.accent2 : t.rule, backgroundColor: restDuration === p ? t.accent2 + "1a" : "transparent" }]}
                    >
                      <Text style={{ color: restDuration === p ? t.accent2 : t.ink, fontSize: 12.5, fontWeight: restDuration === p ? "600" : "400" }}>{p}s</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.customRow}>
                  <TextInput
                    value={customRest}
                    onChangeText={(v) => {
                      const digits = v.replace(/[^0-9]/g, "");
                      setCustomRest(digits);
                      if (digits) setRestDuration(Number(digits));
                    }}
                    placeholder="Custom seconds"
                    placeholderTextColor={t.inkMuted}
                    keyboardType="number-pad"
                    style={[styles.customInput, { borderColor: t.rule, color: t.ink, backgroundColor: t.page2 }]}
                  />
                </View>
              </>
            )}
          </>
        )}

        <View style={styles.controlsRow}>
          <Pressable onPress={reset} style={[styles.controlBtn, { backgroundColor: t.page2 }]}>
            <Ionicons name="refresh" size={20} color={t.ink} />
          </Pressable>
          <Pressable
            onPress={running ? pause : start}
            style={[styles.controlBtn, styles.mainBtn, { backgroundColor: mode === "EMOM" ? t.accent : t.accent2 }]}
          >
            <Ionicons name={running ? "pause" : "play"} size={26} color={t.accentInk} />
          </Pressable>
          <View style={styles.controlBtn} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 18, paddingTop: 24 },
  modeRow: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3, width: "100%", marginBottom: 24 },
  modeSeg: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 7 },
  roundLabel: { fontSize: 13, marginBottom: 14 },
  clock: { fontSize: 64, fontWeight: "600", marginBottom: 14 },
  progressWrap: { width: "100%", maxWidth: 280, marginBottom: 22 },
  inputsRow: { flexDirection: "row", gap: 28, marginTop: 8 },
  stepperCol: { alignItems: "center" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  stepperBtn: { padding: 4 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 },
  presetChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  customRow: { marginTop: 12, width: "100%", maxWidth: 220 },
  customInput: { borderWidth: 1, borderRadius: 10, padding: 11, fontSize: 13, textAlign: "center" },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: "auto", marginBottom: 20 },
  controlBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  mainBtn: { width: 68, height: 68, borderRadius: 34 },
});

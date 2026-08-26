import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

// Samsung's keyboard (and others) can grow a predictive-text/suggestion
// toolbar strip after the initial keyboardDidShow measurement, and Android
// doesn't fire a change-frame event the way iOS does to catch that -- so a
// fixed cushion on top of the measured height is the only way to cover it
// without a native module.
const ANDROID_SAFETY_MARGIN = 24;

/** How much bottom clearance is needed right now to keep something above
 *  both the keyboard (when it's open) and the system nav bar (when it
 *  isn't) -- tracked by hand instead of via KeyboardAvoidingView. Android's
 *  native resize/pan/height behaviors have proven unreliable across OEM
 *  skins (Samsung's One UI in particular) since edge-to-edge display became
 *  the Android default in Expo SDK 53+, and the keyboard's own reported
 *  height doesn't reliably include the nav bar's own inset underneath it. */
export function useKeyboardClearance(insets: Pick<EdgeInsets, "bottom">) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardHeight === 0) return insets.bottom;
  return Platform.OS === "android" ? keyboardHeight + insets.bottom + ANDROID_SAFETY_MARGIN : keyboardHeight;
}

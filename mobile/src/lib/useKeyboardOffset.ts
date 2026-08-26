import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/** How tall the keyboard currently is, in px, tracked by hand instead of via
 *  KeyboardAvoidingView. Android's native resize/pan/height behaviors have
 *  proven unreliable across OEM skins (Samsung's One UI in particular) since
 *  edge-to-edge display became the Android default in Expo SDK 53+ --
 *  listening to the keyboard's own show/hide events and shifting the layout
 *  by exactly that height works regardless of what the OS (or Expo Go's
 *  fixed manifest, which a project's app.json can't override) does with
 *  window insets. */
export function useKeyboardOffset() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

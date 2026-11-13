import { useEffect, useRef, useState } from "react";
import { homeScreen, parentScreen, type Screen } from "./navigation";
export function useNavigation() {
  const [screen, setScreen] = useState<Screen>(homeScreen);
  const current = useRef(screen);
  const session = useRef(crypto.randomUUID());
  const depth = useRef(0);
  const goingBack = useRef(false);
  useEffect(() => {
    history.replaceState(
      {
        ...history.state,
        orbitSession: session.current,
        orbitScreen: homeScreen,
        orbitDepth: 0,
      },
      "",
    );
    const back = (event: PopStateEvent) => {
      if (event.state?.orbitSession !== session.current) return;
      goingBack.current = false;
      depth.current = event.state.orbitDepth;
      show(event.state.orbitScreen);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  function show(next: Screen) {
    current.current = next;
    // Switch immediately; the incoming screen has a short compositor animation.
    setScreen(next);
  }
  function push(patch: Partial<Screen>) {
    const next = { ...current.current, ...patch };
    depth.current++;
    history.pushState(
      {
        orbitSession: session.current,
        orbitScreen: next,
        orbitDepth: depth.current,
      },
      "",
    );
    show(next);
  }
  // Swaps the current screen without a new history entry, so Back skips it.
  function replace(patch: Partial<Screen>) {
    const next = { ...current.current, ...patch };
    history.replaceState(
      {
        orbitSession: session.current,
        orbitScreen: next,
        orbitDepth: depth.current,
      },
      "",
    );
    show(next);
  }
  function back() {
    if (goingBack.current) return;
    if (depth.current > 0) { goingBack.current = true; history.back(); }
    else {
      const next = parentScreen(current.current);
      show(next);
    }
  }
  function root() {
    if (depth.current > 0) history.go(-depth.current);
    else {
      show(homeScreen);
    }
  }
  return { screen, push, replace, back, root };
}

export type Screen = {
  area: string | null;
  orbit?: boolean;
  calendar: boolean;
  task: boolean;
  addArea: boolean;
  removeArea?: boolean;
  editAreaIcon?: boolean;
  voice?: boolean;
};
export const homeScreen: Screen = {
  area: null,
  orbit: false,
  calendar: false,
  task: false,
  addArea: false,
};
export function parentScreen(screen: Screen): Screen {
  if (screen.editAreaIcon) return { ...screen, editAreaIcon: false };
  if (screen.removeArea) return { ...screen, removeArea: false };
  if (screen.task) return { ...screen, task: false };
  if (screen.voice) return { ...screen, voice: false };
  if (screen.addArea) return { ...screen, addArea: false };
  if (screen.calendar) return { ...screen, calendar: false };
  if (screen.area) return { ...screen, area: null };
  if (screen.orbit) return { ...screen, orbit: false };
  return { ...homeScreen };
}

// The switch between the day screen and the orbit melts out of the round button;
// every other change (dialogs and sheets) animates in CSS instead.
export type TransitionKind = "in" | "out" | "none";
export function transitionKind(from: Screen, to: Screen): TransitionKind {
  const before = !!from.orbit,
    after = !!to.orbit;
  return before === after ? "none" : after ? "in" : "out";
}

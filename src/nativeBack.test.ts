import { describe, it, expect, vi, afterEach } from "vitest";
import { dispatchAppBack } from "./nativeBack";
import { homeScreen, parentScreen } from "./navigation";
afterEach(() => vi.unstubAllGlobals());
function setup(dialogs: EventTarget[] = []) {
  const window = new EventTarget();
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", { querySelectorAll: () => dialogs });
  return window;
}
describe("native Back dispatch", () => {
  it("cancels only the topmost dialog and does not navigate the underlying screen", () => {
    const lower = Object.assign(new EventTarget(), { close: vi.fn() }),
      upper = Object.assign(new EventTarget(), { close: vi.fn() });
    setup([lower, upper]);
    const back = vi.fn();
    upper.addEventListener("cancel", (e) => e.preventDefault());
    expect(dispatchAppBack(back)).toBe(true);
    expect(lower.close).not.toHaveBeenCalled();
    expect(upper.close).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
  it("closes a native dialog without a custom cancel handler", () => {
    const dialog = Object.assign(new EventTarget(), { close: vi.fn() });
    setup([dialog]);
    dispatchAppBack(vi.fn());
    expect(dialog.close).toHaveBeenCalledOnce();
  });
  it("pops a calendar mode before touching app history", () => {
    const w = setup();
    const back = vi.fn();
    w.addEventListener("orbita:local-back", (e) => e.preventDefault());
    dispatchAppBack(back);
    expect(back).not.toHaveBeenCalled();
  });
  it("lets an overlay within the top dialog consume Back first", () => {
    const dialog = Object.assign(new EventTarget(), { close: vi.fn() });
    const w = setup([dialog]);
    w.addEventListener("orbita:overlay-back", (e) => {
      expect((e as CustomEvent).detail.dialog).toBe(dialog);
      e.preventDefault();
    });
    const back = vi.fn();
    dispatchAppBack(back);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
  it("uses application navigation when no overlay handles Back", () => {
    setup();
    const back = vi.fn();
    dispatchAppBack(back);
    expect(back).toHaveBeenCalledOnce();
  });
  it("has a real parent at every nested destination and remains at home at the root", () => {
    let screen = { ...homeScreen, orbit: true, area: "Работа", task: true };
    screen = parentScreen(screen) as typeof screen;
    expect(screen.task).toBe(false);
    expect(screen.area).toBe("Работа");
    screen = parentScreen(screen) as typeof screen;
    expect(screen.area).toBe(null);
    expect(screen.orbit).toBe(true);
    screen = parentScreen(screen) as typeof screen;
    expect(screen).toEqual(homeScreen);
    expect(parentScreen(homeScreen)).toEqual(homeScreen);
  });
});

it('chooses the focused top-layer dialog over DOM order',()=>{const upper=Object.assign(new EventTarget(),{close:vi.fn(),dataset:{}}),lower=Object.assign(new EventTarget(),{close:vi.fn(),dataset:{}});setup([upper,lower]);vi.stubGlobal('document',{querySelectorAll:()=>[upper,lower],activeElement:{closest:()=>upper}});const back=vi.fn();dispatchAppBack(back);expect(upper.close).toHaveBeenCalledOnce();expect(lower.close).not.toHaveBeenCalled();expect(back).not.toHaveBeenCalled();});
it('does not pass a repeated Back through a closing dialog',()=>{const upper=Object.assign(new EventTarget(),{close:vi.fn(),dataset:{exiting:'true'}});setup([upper]);const back=vi.fn();dispatchAppBack(back);expect(upper.close).not.toHaveBeenCalled();expect(back).not.toHaveBeenCalled();});

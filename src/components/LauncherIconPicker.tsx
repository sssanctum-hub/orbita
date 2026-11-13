import { useState } from "react";
type Choice = "classic" | "current";
type IconBridge = { launcherIcon?: () => string; setLauncherIcon?: (choice: Choice) => boolean };
export default function LauncherIconPicker() {
  const device = (window as Window & { OrbitaDevice?: IconBridge }).OrbitaDevice;
  const [choice, setChoice] = useState(() => device?.launcherIcon?.() ?? "current");
  const [message, setMessage] = useState("");
  if (!device?.setLauncherIcon) return null;
  return <section className="launcher-icon-picker">
    <h3>Иконка приложения</h3>
    <div role="group" aria-label="Выбор иконки приложения">
      {(["classic", "current"] as const).map(option => <button type="button" key={option}
        aria-pressed={choice === option} onClick={() => {
          if (device.setLauncherIcon?.(option)) { setChoice(option); setMessage("Иконка выбрана. Рабочий стол обновит её автоматически."); }
          else setMessage("Не удалось сменить иконку.");
        }}>
        <img src={"/launcher/" + option + ".png"} alt="" />
        {option === "classic" ? "Классическая" : "Спутник"}
      </button>)}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic } from "lucide-react";
import { areaLabel, type Area } from "../domain";
import { parseVoiceTask, type VoiceTask } from "../voiceTask";
type Props = {
  areas: Area[];
  defaultArea: Area;
  speech: boolean;
  recognize: () => Promise<string>;
  close: () => void;
  confirm: (task: VoiceTask & { area: Area }) => void;
};
const dateText = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
export default function VoiceInput({
  areas,
  defaultArea,
  speech,
  recognize,
  close,
  confirm,
}: Props) {
  const phrase = useRef<HTMLTextAreaElement>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const parsed = useMemo(
    () => (text.trim() ? parseVoiceTask(text, areas) : null),
    [text, areas],
  );
  async function listen() {
    setError("");
    setListening(true);
    try {
      const heard = (await recognize()).trim();
      if (heard) setText(heard);
      else setError("Речь не распознана. Попробуйте снова или воспользуйтесь микрофоном на клавиатуре.");
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setListening(false);
    }
  }
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="area-editor voice-input"
      aria-labelledby="voice-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!listening) close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed) confirm({ ...parsed, area: parsed.area || defaultArea });
        }}
      >
        <header>
          <button
            type="button"
            aria-label="Закрыть голосовой ввод"
            disabled={listening}
            onClick={close}
          >
            <ArrowLeft size={22} />
          </button>
          <h2 id="voice-title">Дело голосом</h2>
          <Mic size={24} />
        </header>
        <label>
          {speech ? "Что услышано" : "Фраза"}
          <textarea
            ref={phrase}
            rows={3}
            maxLength={500}
            placeholder="Например: завтра в 18:00 позвонить маме, напомни за час"
            value={text}
            disabled={listening}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {speech && (
          <button
            type="button"
            className="voice-listen"
            disabled={listening}
            aria-live="polite"
            onClick={() => void listen()}
          >
            <Mic size={20} />
            {listening ? "Слушаю…" : text ? "Сказать заново" : "Сказать"}
          </button>
        )}
        {!speech && (
          <p>
            Распознавание речи работает в приложении на Android. Здесь можно
            ввести фразу текстом и проверить разбор.
          </p>
        )}
        <button type="button" className="voice-listen" disabled={listening} onClick={() => phrase.current?.focus()}>Ввести с клавиатуры</button>
        <p>Если системное распознавание недоступно, нажмите микрофон на клавиатуре, если он есть.</p>
        {error && <p role="alert">{error}</p>}
        {parsed && (
          <dl className="voice-preview" aria-label="Что получится">
            <dt>Дело</dt>
            <dd>{parsed.title}</dd>
            <dt>Когда</dt>
            <dd>
              {parsed.due
                ? dateText(parsed.due) +
                  (parsed.dueTime ? ", " + parsed.dueTime : "")
                : "Без даты"}
            </dd>
            <dt>Напомнить</dt>
            <dd>
              {parsed.reminder
                ? new Date(parsed.reminder).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Нет"}
            </dd>
            <dt>Сфера</dt>
            <dd>{areaLabel(parsed.area || defaultArea)}</dd>
          </dl>
        )}
        <button
          className="task-save"
          type="submit"
          disabled={listening || !parsed}
        >
          Проверить и сохранить
        </button>
      </form>
    </dialog>
  );
}

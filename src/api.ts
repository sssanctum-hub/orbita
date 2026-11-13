import { loadWebData, storeWebData } from "./webStorage";
import { latestQueue } from "./latestQueue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { isFact, type Data } from "./domain";
export const desktop = isTauri();
function updateWidget(data: Data): Data {
  try {
    if (window.OrbitaDevice?.updateTasks) {
      const tasks = data.tasks.map(({ notes, images, links, subtasks, ...task }) => task);
      window.OrbitaDevice.updateTasks(JSON.stringify({ tasks, areaIcons: data.areaIcons || {} }));
    }
  }
  catch (error) { console.warn("Не удалось обновить виджет", error); }
  return data;
}
export const loadData = () => (desktop ? invoke<Data>("load_data") : loadWebData()).then(updateWidget);
export const storeData = (data: Data) => (desktop ? invoke<Data>("save_data", { data }) : storeWebData(data)).then(updateWidget);
export const exportData = () => desktop ? invoke<string>("export_data") : loadWebData().then(data => JSON.stringify(data));
export const runtimeStatus = async () => {
  const messages = desktop ? await invoke<string[]>("runtime_status") : [];
  const widgetError = window.OrbitaDevice?.widgetError?.();
  if (widgetError) messages.push("Не удалось обновить виджет: " + widgetError);
  return messages;
};

export const android = desktop && /Android/i.test(navigator.userAgent);
// Opens the Android speech dialog; an empty string means the user cancelled.
export const recognizeSpeech = () => invoke<string>("recognize_speech");
async function synchronizeAndroidRemindersNow(
  data: Data,
  ask = false,
): Promise<string[]> {
  if (!android) return [];
  const { isPermissionGranted, requestPermission } =
    await import("@tauri-apps/plugin-notification");
  const hasReminders = data.tasks.some(
    (task) =>
      !isFact(task) &&
      task.status !== "done" &&
      (task.reminder || task.birthday),
  );
  if (hasReminders && ask && !(await isPermissionGranted()))
    await requestPermission();
  return invoke<string[]>("sync_android_reminders");
}

const queuedSync = latestQueue<{ data: Data; ask: boolean }, string[]>(
  ({ data, ask }) => synchronizeAndroidRemindersNow(data, ask),
  (waiting, latest) => ({ data: latest.data, ask: waiting.ask || latest.ask }),
);
export const synchronizeAndroidReminders = (data: Data, ask = false) =>
  queuedSync({ data, ask });

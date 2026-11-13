use crate::{storage, Store};
use chrono::{DateTime, Utc};
use std::collections::HashSet;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::{Channel, NotificationExt, PermissionState, Schedule};
pub fn sync(app: &AppHandle) -> Result<Vec<String>, String> {
    static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _guard = LOCK.lock().map_err(|_| "Планировщик недоступен")?;
    let notification = app.notification();
    notification
        .create_channel(
            Channel::builder("orbit-reminders", "Дела и дни рождения")
                .description("Локальные напоминания Орбиты")
                .vibration(true)
                .build(),
        )
        .map_err(|e| e.to_string())?;
    let state = app.state::<Store>();
    let now = Utc::now();
    let data = {
        let db = state.0.lock().map_err(|_| "База недоступна")?;
        storage::load(&db)?
    };
    let plan = storage::android_plan(&data.tasks, now);
    if plan.is_empty() {
        // Plugin 2.6.0 cancel_all sends null, but Android requires CancelArgs.
        let ids = notification
            .pending()
            .map_err(|e| e.to_string())?
            .iter()
            .map(|item| item.id())
            .collect::<Vec<_>>();
        if !ids.is_empty() {
            notification.cancel(ids).map_err(|e| e.to_string())?;
        }
        return Ok(vec![]);
    }
    if notification.permission_state().map_err(|e| e.to_string())? != PermissionState::Granted {
        return Ok(vec![
            "Напоминания сохранены. Разрешите уведомления «Орбиты» в настройках Android.".into(),
        ]);
    }
    let pending = notification.pending().map_err(|e| e.to_string())?;
    let existing: HashSet<i32> = pending.iter().map(|item| item.id()).collect();
    let mut used = HashSet::new();
    let entries: Vec<_> = plan
        .into_iter()
        .map(|item| {
            let key = storage::delivery_key(&item);
            let mut id = (key.bytes().fold(2166136261u32, |hash, b| {
                (hash ^ u32::from(b)).wrapping_mul(16777619)
            }) & 0x7fffffff) as i32;
            while !used.insert(id) {
                id = if id == i32::MAX { 1 } else { id + 1 };
            }
            (item, id)
        })
        .collect();
    let stale = existing
        .iter()
        .filter(|id| !used.contains(*id))
        .copied()
        .collect::<Vec<_>>();
    if !stale.is_empty() {
        notification.cancel(stale).map_err(|e| e.to_string())?;
    }
    let mut registered = Vec::new();
    let scheduled: Result<(), String> = (|| {
        for (item, id) in entries {
            let at = DateTime::parse_from_rfc3339(&item.reminder)
                .map_err(|e| e.to_string())?
                .with_timezone(&Utc);
            if existing.contains(&id) {
                continue;
            }
            if at <= now {
                let db = state.0.lock().map_err(|_| "База недоступна")?;
                if storage::was_registered(&db, &storage::delivery_key(&item))? {
                    continue;
                }
            }
            let fire = at.max(Utc::now() + chrono::Duration::seconds(2));
            let schedule:Schedule=serde_json::from_value(serde_json::json!({"at":{"date":fire.to_rfc3339_opts(chrono::SecondsFormat::Millis,true),"repeating":false,"allowWhileIdle":true}})).map_err(|e|e.to_string())?;
            notification
                .builder()
                .id(id)
                .channel_id("orbit-reminders")
                .title("Орбита")
                .body(&item.title)
                .auto_cancel()
                .schedule(schedule)
                .show()
                .map_err(|e| e.to_string())?;
            registered.push(item);
        }
        Ok(())
    })();
    // Persist successful registrations together, including a partially failed run.
    if !registered.is_empty() {
        let mut db = state.0.lock().map_err(|_| "База недоступна")?;
        storage::mark_delivered(&mut db, &registered, now)?;
    }
    scheduled?;
    Ok(vec![])
}

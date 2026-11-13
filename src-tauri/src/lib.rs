mod images;
#[cfg(target_os = "android")]
mod android_reminders;
#[cfg(target_os = "android")]
mod android_speech;
mod storage;
#[cfg(desktop)]
use std::sync::atomic::Ordering;
use std::sync::{atomic::AtomicBool, Mutex};
use storage::{Data, Result};
use tauri::{Manager, State};
struct Store(Mutex<rusqlite::Connection>);
struct Runtime {
    messages: Mutex<Vec<String>>,
    tray: AtomicBool,
}
#[tauri::command]
async fn load_data(app: tauri::AppHandle) -> Result<Data> {
    tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let db = store.0.lock().map_err(|_| "База недоступна")?;
        storage::load(&db)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn save_data(app: tauri::AppHandle, data: Data) -> Result<Data> {
    tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let mut db = store.0.lock().map_err(|_| "База недоступна")?;
        let old = storage::load(&db)?;
        let saved = storage::save(&mut db, data)?;
        let dir=app.path().app_data_dir().map_err(|e|e.to_string())?.join("images");
        for image in old.tasks.iter().flat_map(|t|&t.images) {
          if !saved.tasks.iter().any(|t|t.images.iter().any(|i|i.id==image.id)) {images::remove(&dir,&image.id);}
        }
        Ok(saved)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn save_image(app:tauri::AppHandle, bytes:Vec<u8>)->Result<String>{
 tauri::async_runtime::spawn_blocking(move||{let dir=app.path().app_data_dir().map_err(|e|e.to_string())?.join("images");images::save(&dir,&bytes)}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn read_image(app:tauri::AppHandle, id:String)->Result<Vec<u8>>{
 tauri::async_runtime::spawn_blocking(move||{let dir=app.path().app_data_dir().map_err(|e|e.to_string())?.join("images");images::read(&dir,&id)}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn discard_image(app:tauri::AppHandle,id:String)->Result<()>{
 tauri::async_runtime::spawn_blocking(move||{
 let store=app.state::<Store>();let db=store.0.lock().map_err(|_|"База недоступна")?;let data=storage::load(&db)?;
 if !data.tasks.iter().any(|t|t.images.iter().any(|i|i.id==id)){let dir=app.path().app_data_dir().map_err(|e|e.to_string())?.join("images");images::remove(&dir,&id);}Ok(())
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn open_link(app:tauri::AppHandle,url:String)->Result<()>{
 let parsed=tauri::Url::parse(&url).map_err(|_|"Проверьте ссылку.")?;
 if !["http","https"].contains(&parsed.scheme()) || parsed.host_str().is_none() || !parsed.username().is_empty() || parsed.password().is_some(){return Err("Нужна ссылка http или https.".into());}
 #[cfg(target_os="android")]
 return android_speech::open_link(&app,&url).await;
 #[cfg(not(target_os="android"))]
 {let _=app;std::process::Command::new("rundll32.exe").arg("url.dll,FileProtocolHandler").arg(parsed.as_str()).spawn().map_err(|e|e.to_string())?;Ok(())}
}
#[tauri::command]
async fn sync_android_reminders(app: tauri::AppHandle) -> Result<Vec<String>> {
    #[cfg(target_os = "android")]
    return tauri::async_runtime::spawn_blocking(move || android_reminders::sync(&app))
        .await
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(vec![])
    }
}
#[tauri::command]
async fn recognize_speech(app: tauri::AppHandle) -> Result<String> {
    #[cfg(target_os = "android")]
    return android_speech::recognize(&app).await;
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Голосовой ввод пока доступен только на Android.".into())
    }
}
#[tauri::command]
fn runtime_status(runtime: State<Runtime>) -> Result<Vec<String>> {
    Ok(runtime
        .messages
        .lock()
        .map_err(|_| "Состояние недоступно")?
        .clone())
}
#[tauri::command]
fn export_data(app: tauri::AppHandle, store: State<Store>) -> Result<String> {
    use std::io::Write;
    let db = store.0.lock().map_err(|_| "База недоступна")?;
    let data = storage::load(&db)?;
    drop(db);
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("exports");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("assistant-{}.json", uuid::Uuid::new_v4()));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    file.write_all(
        serde_json::to_string_pretty(&data)
            .map_err(|e| e.to_string())?
            .as_bytes(),
    )
    .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}
#[cfg(desktop)]
fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
#[cfg(target_os = "windows")]
fn show_orbit_overlay(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::{PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

    if let Some(window) = app.get_webview_window("orbit-overlay") {
        window.show()?;
        return window.set_focus();
    }
    let Some(main) = app.get_webview_window("main") else { return Ok(()) };
    let cursor = main.cursor_position()?;
    let Some(monitor) = main.monitor_from_point(cursor.x, cursor.y)?.or(main.primary_monitor()?) else {
        return Ok(());
    };
    let work = monitor.work_area();
    let scale = monitor.scale_factor();
    let width = ((680.0 * scale).round() as u32).min(work.size.width);
    let height = ((210.0 * scale).round() as u32).min(work.size.height);
    let window = WebviewWindowBuilder::new(app, "orbit-overlay", WebviewUrl::App("index.html?orbit-overlay=1".into()))
        .title("Кольцо Орбиты")
        .visible(false)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()?;
    let place = || -> tauri::Result<()> {
        window.set_position(PhysicalPosition::new(
            work.position.x + ((work.size.width - width) / 2) as i32,
            work.position.y + (work.size.height - height) as i32,
        ))?;
        window.set_size(PhysicalSize::new(width, height))?;
        window.show()?;
        window.set_focus()
    };
    if let Err(error) = place() {
        let _ = window.destroy();
        return Err(error);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_orbit_from_icon(app: &tauri::AppHandle) {
    if let Err(error) = show_orbit_overlay(app) {
        app.state::<Runtime>().messages.lock().unwrap()
            .push(format!("Не удалось открыть кольцо: {error}"));
        show(app);
    }
}

#[tauri::command]
async fn finish_orbit_overlay(app: tauri::AppHandle, open_main: bool) -> std::result::Result<(), String> {
    #[cfg(target_os = "windows")]
    if let Some(window) = app.get_webview_window("orbit-overlay") {
        window.destroy().map_err(|error| error.to_string())?;
        if open_main { show(&app); }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (app, open_main);
    Ok(())
}

#[cfg(desktop)]
fn setup_desktop(app: &tauri::AppHandle) -> std::result::Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::TrayIconBuilder,
    };
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let open = MenuItem::with_id(app, "open", "Открыть органайзер", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Завершить работу", true, None::<&str>)?;
    #[cfg(target_os = "windows")]
    let overlay = MenuItem::with_id(app, "orbit-overlay", "Кольцо поверх окон", true, None::<&str>)?;
    #[cfg(target_os = "windows")]
    let menu = Menu::with_items(app, &[&open, &overlay, &quit])?;
    #[cfg(not(target_os = "windows"))]
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let tray = TrayIconBuilder::new()
        .tooltip("Орбита — ваши дела")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show(app),
            #[cfg(target_os = "windows")]
            "orbit-overlay" => open_orbit_from_icon(app),
            "quit" => app.exit(0),
            _ => {}
        });
    #[cfg(target_os = "windows")]
    let tray = tray.show_menu_on_left_click(false).on_tray_icon_event(|tray, event| {
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
        if matches!(event, TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }) {
            open_orbit_from_icon(tray.app_handle());
        }
    });
    let tray = if let Some(icon) = app.default_window_icon() { tray.icon(icon.clone()) } else { tray };
    tray.build(app)?;
    app.state::<Runtime>().tray.store(true, Ordering::Relaxed);
    if let Err(e) = app
        .global_shortcut()
        .on_shortcut("Ctrl+Shift+Space", |app, _, event| {
            if event.state == ShortcutState::Pressed {
                show(app)
            }
        })
    {
        app.state::<Runtime>()
            .messages
            .lock()
            .unwrap()
            .push(format!("Горячая клавиша недоступна: {e}"));
    }
    #[cfg(target_os = "windows")]
    if let Err(error) = app.global_shortcut().on_shortcut("Ctrl+Alt+Shift+O", |app, _, event| {
        if event.state == ShortcutState::Pressed {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || { if let Some(window) = handle.get_webview_window("orbit-overlay") { let _ = window.destroy(); } else { open_orbit_from_icon(&handle); } });
        }
    }) {
        app.state::<Runtime>().messages.lock().unwrap()
            .push(format!("Горячая клавиша кольца недоступна: {error}"));
    }
    Ok(())
}
#[cfg(desktop)]
fn start_scheduler(app: &tauri::AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        use tauri_plugin_notification::NotificationExt;
        loop {
            let store = handle.state::<Store>();
            if let Ok(mut db) = store.0.lock() {
                let now = chrono::Utc::now();
                match storage::pending(&db, now) {
                    Ok(tasks) if !tasks.is_empty() => {
                        let body = if tasks.len() == 1 {
                            tasks[0].title.clone()
                        } else {
                            format!("Накопилось напоминаний: {}. Откройте органайзер и проверьте сроки.",tasks.len())
                        };
                        let delivered = handle
                            .notification()
                            .builder()
                            .title("Пора вернуться к делам")
                            .body(body)
                            .show();
                        if delivered.is_ok() {
                            if let Err(e) = storage::mark_delivered(&mut db, &tasks, now) {
                                handle
                                    .state::<Runtime>()
                                    .messages
                                    .lock()
                                    .unwrap()
                                    .push(format!("Не удалось сохранить доставку: {e}"));
                                // Stop instead of repeatedly displaying already submitted notifications.
                                break;
                            }
                        } else {
                            let runtime = handle.state::<Runtime>();
                            if let Ok(mut messages) = runtime.messages.lock() {
                                let message="Не удалось передать уведомление Windows. Проверьте разрешение уведомлений.".to_string();
                                if !messages.contains(&message) {
                                    messages.push(message);
                                }
                            };
                        }
                    }
                    Err(_) => {
                        let runtime = handle.state::<Runtime>();
                        if let Ok(mut messages) = runtime.messages.lock() {
                            let message =
                                "Планировщик не смог прочитать напоминания из базы.".to_string();
                            if !messages.contains(&message) {
                                messages.push(message);
                            }
                        };
                    }
                    _ => {}
                }
            }
            std::thread::sleep(std::time::Duration::from_secs(15));
        }
    });
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            #[cfg(target_os = "windows")]
            open_orbit_from_icon(app);
            #[cfg(not(target_os = "windows"))]
            show(app);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(android_speech::init());
    builder
        .plugin(tauri_plugin_notification::init())
        .manage(Runtime {
            messages: Mutex::new(Vec::new()),
            tray: AtomicBool::new(false),
        })
        .setup(|app| {
            let path = app.path().app_data_dir()?;
            std::fs::create_dir_all(&path)?;
            app.manage(Store(Mutex::new(
                storage::open(&path.join("assistant.sqlite")).map_err(std::io::Error::other)?,
            )));
            #[cfg(desktop)]
            if let Err(e) = setup_desktop(app.handle()) {
                app.state::<Runtime>()
                    .messages
                    .lock()
                    .unwrap()
                    .push(format!(
                        "Трей недоступен; закрытие окна завершит приложение: {e}"
                    ));
            }
            #[cfg(desktop)]
            start_scheduler(app.handle());
            #[cfg(target_os = "windows")]
            open_orbit_from_icon(app.handle());
            Ok(())
        })
        .on_window_event(|_window, _event| {
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                if _window.label() == "main" && _window
                    .app_handle()
                    .state::<Runtime>()
                    .tray
                    .load(Ordering::Relaxed)
                {
                    if _window.hide().is_ok() {
                        api.prevent_close();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_image, read_image, discard_image, open_link,
            load_data,
            save_data,
            export_data,
            runtime_status,
            sync_android_reminders,
            recognize_speech,
            finish_orbit_overlay
        ])
        .run(tauri::generate_context!())
        .expect("Ошибка запуска приложения");
}

use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Manager, Runtime,
};
pub struct Speech<R: Runtime>(PluginHandle<R>);
#[derive(serde::Deserialize)]
struct Recognized {
    text: String,
}
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("speech")
        .setup(|app, api| {
            let handle =
                api.register_android_plugin("ru.personalassistant.desktop", "SpeechPlugin")?;
            app.manage(Speech(handle));
            Ok(())
        })
        .build()
}
/// Opens the system speech dialog and waits for the user to finish.
pub async fn recognize<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let speech = app.state::<Speech<R>>();
    speech
        .0
        .run_mobile_plugin_async::<Recognized>("recognize", ())
        .await
        .map(|result| result.text)
        .map_err(|e| e.to_string())
}

pub async fn open_link<R: Runtime>(app:&AppHandle<R>,url:&str)->Result<(),String>{
 let speech=app.state::<Speech<R>>();speech.0.run_mobile_plugin_async::<serde_json::Value>("openLink",serde_json::json!({"url":url})).await.map(|_|()).map_err(|e|e.to_string())
}

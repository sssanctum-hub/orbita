# Иконка приложения

`app-icon.png` — исходное изображение, предоставленное пользователем.
`icon-manifest.json` сохраняет исходный голубой фон адаптивной иконки Android.

Перегенерация ресурсов Android и desktop из корня проекта:

```bat
.tools\node\node.exe node_modules\@tauri-apps\cli\tauri.js icon assets/icon-manifest.json
```

package ru.personalassistant.desktop

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import android.net.Uri
import app.tauri.annotation.InvokeArg
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

// Uses the system speech dialog, so the app itself never records audio and
// needs no RECORD_AUDIO permission.
@InvokeArg
class OpenLinkArgs { var url: String = "" }

@TauriPlugin
class SpeechPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun openLink(invoke: Invoke) {
    val args = invoke.parseArgs(OpenLinkArgs::class.java)
    val uri = Uri.parse(args.url)
    if ((uri.scheme != "https" && uri.scheme != "http") || uri.host.isNullOrEmpty() || uri.userInfo != null) { invoke.reject("Проверьте ссылку."); return }
    try { activity.startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); invoke.resolve(JSObject()) }
    catch (e: ActivityNotFoundException) { invoke.reject("Не найден браузер для ссылки.") }
  }

  @Command
  fun recognize(invoke: Invoke) {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      putExtra(RecognizerIntent.EXTRA_PROMPT, "Скажите дело")
    }
    if (intent.resolveActivity(activity.packageManager) == null) {
      invoke.reject("На телефоне не найдена служба распознавания речи.")
      return
    }
    try {
      startActivityForResult(invoke, intent, "recognized")
    } catch (e: ActivityNotFoundException) {
      invoke.reject("На телефоне не найдена служба распознавания речи.")
    }
  }

  @ActivityCallback
  fun recognized(invoke: Invoke, result: ActivityResult) {
    val text = if (result.resultCode == Activity.RESULT_OK)
      result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull().orEmpty()
    else ""
    if (result.resultCode != Activity.RESULT_OK && result.resultCode != Activity.RESULT_CANCELED) {
      invoke.reject("Служба Android не смогла распознать речь. Можно продиктовать фразу через клавиатуру.")
      return
    }
    invoke.resolve(JSObject().put("text", text))
  }
}

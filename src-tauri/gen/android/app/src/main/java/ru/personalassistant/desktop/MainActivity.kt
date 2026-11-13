package ru.personalassistant.desktop

import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  // Wry falls back to closing the Activity when WebView history is empty.
  override val handleBackNavigation: Boolean = false
  private var orbitWebView: WebView? = null
  @Volatile private var titleEditing = false
  private var lastBackAt = 0L

  inner class DeviceFeedback {
    @JavascriptInterface
    fun launcherIcon(): String {
      val classic = android.content.ComponentName(packageName, "$packageName.LauncherClassic")
      return if (packageManager.getComponentEnabledSetting(classic) ==
        android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED) "classic" else "current"
    }

    @JavascriptInterface
    fun setLauncherIcon(choice: String): Boolean {
      if (choice != "classic" && choice != "current") return false
      val enable = android.content.ComponentName(packageName, "$packageName.Launcher" + if (choice == "classic") "Classic" else "Current")
      val disable = android.content.ComponentName(packageName, "$packageName.Launcher" + if (choice == "classic") "Current" else "Classic")
      val flag = android.content.pm.PackageManager.DONT_KILL_APP
      val on = android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED
      val off = android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED
      return try {
        if (Build.VERSION.SDK_INT >= 33) {
          packageManager.setComponentEnabledSettings(listOf(
            android.content.pm.PackageManager.ComponentEnabledSetting(enable, on, flag),
            android.content.pm.PackageManager.ComponentEnabledSetting(disable, off, flag)
          ))
        } else {
          packageManager.setComponentEnabledSetting(enable, on, flag)
          packageManager.setComponentEnabledSetting(disable, off, flag)
        }
        true
      } catch (_: Exception) { false }
    }

    @JavascriptInterface
    fun updateTasks(json: String) {
      try {
        TodayWidget.save(this@MainActivity, json)
      } catch (error: Exception) {
        // A launcher/RemoteViews failure must never escape the WebView bridge.
        TodayWidget.reportFailure(this@MainActivity, error)
      }
    }
    @JavascriptInterface
    fun widgetError(): String = getSharedPreferences("today_widget", MODE_PRIVATE).getString("error", "").orEmpty()
    @JavascriptInterface
    fun setTitleEditing(active: Boolean) { titleEditing = active }
    @JavascriptInterface
    fun showKeyboard() {
      orbitWebView?.post {
        val webView = orbitWebView ?: return@post
        webView.evaluateJavascript("document.activeElement?.matches('.task-title-field textarea') === true") { active ->
          if (active == "true") {
            webView.requestFocus()
            val input = getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
            input.showSoftInput(webView, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
          }
        }
      }
    }

    @JavascriptInterface
    fun haptic(kind: String) {
      orbitWebView?.post {
        val feedback = when {
          kind == "success" && Build.VERSION.SDK_INT >= 30 -> HapticFeedbackConstants.CONFIRM
          kind == "sphere" && Build.VERSION.SDK_INT >= 34 -> HapticFeedbackConstants.SEGMENT_FREQUENT_TICK
          kind == "sphere" && Build.VERSION.SDK_INT < 27 -> return@post
          (kind == "selection" || kind == "sphere") && Build.VERSION.SDK_INT >= 27 -> HapticFeedbackConstants.TEXT_HANDLE_MOVE
          else -> HapticFeedbackConstants.CLOCK_TICK
        }
        orbitWebView?.performHapticFeedback(feedback)
      }
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    orbitWebView = webView
    webView.setOnLongClickListener { titleEditing }
    webView.addJavascriptInterface(DeviceFeedback(), "OrbitaDevice")
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    val content = findViewById<View>(android.R.id.content)
    // Resize the WebView once per IME state change, not on every animation frame.
    // The editor animates its own bounded height; the calendar behind it stays contained.
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
      val bottom = maxOf(bars.bottom, keyboard.bottom)
      if (view.paddingLeft != bars.left || view.paddingTop != bars.top || view.paddingRight != bars.right || view.paddingBottom != bottom) {
        view.setPadding(bars.left, bars.top, bars.right, bottom)
      }
      WindowInsetsCompat.CONSUMED
    }
    ViewCompat.requestApplyInsets(content)
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val now = android.os.SystemClock.uptimeMillis()
        if (now - lastBackAt < 220) return
        lastBackAt = now
        val webView = orbitWebView ?: return
        val insets = ViewCompat.getRootWindowInsets(webView)
        if (insets?.isVisible(WindowInsetsCompat.Type.ime()) == true) {
          WindowInsetsControllerCompat(window, webView).hide(WindowInsetsCompat.Type.ime())
          return
        }
        webView.evaluateJavascript("window.__orbitaBack?.()", null)
        // Stay in the app at its root. Home / app switcher retain their system behavior.
      }
    })
  }

  override fun onDestroy() {
    orbitWebView?.removeJavascriptInterface("OrbitaDevice")
    titleEditing = false
    orbitWebView = null
    super.onDestroy()
  }
}

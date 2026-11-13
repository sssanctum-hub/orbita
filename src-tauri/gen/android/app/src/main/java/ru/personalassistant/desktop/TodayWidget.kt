package ru.personalassistant.desktop

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import android.os.Bundle

/** Date calculations use UTC noon so daylight saving never changes day distances. */
object WidgetTasks {
    data class Entry(val title: String, val time: String, val area: String, val event: Boolean, val icon: String = "")
    fun rotated(entries: List<Entry>, offset: Int): List<Entry> {
        if (entries.isEmpty()) return entries
        val start = Math.floorMod(offset, entries.size)
        return entries.drop(start) + entries.take(start)
    }
    private fun calendar(key: String): Calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
        time = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply {
            timeZone = TimeZone.getTimeZone("UTC")
            isLenient = false
        }.parse(key)!!
    }
    private fun delta(a: String, b: String) = ((calendar(b).timeInMillis - calendar(a).timeInMillis) / 86400000).toInt()
    private fun weekday(c: Calendar) = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7
    private fun repeats(t: JSONObject, date: String): Boolean {
        val due = t.optString("due")
        val until = t.optString("repeatUntil")
        if (due.isEmpty() || date < due || (until.isNotEmpty() && date > until)) return false
        val base = t.optString("repeatAnchor").ifEmpty { due }
        val interval = t.optInt("repeatInterval", 1).coerceAtLeast(1)
        val days = delta(base, date)
        if (days < 0) return false
        val a = calendar(base)
        val b = calendar(date)
        return when (t.optString("repeat")) {
            "daily" -> days % interval == 0
            "weekly" -> {
                val weekdays = t.optJSONArray("repeatWeekdays") ?: JSONArray().put(weekday(calendar(due)))
                (days + weekday(a)) / 7 % interval == 0 &&
                    (0 until weekdays.length()).any { weekdays.optInt(it) == weekday(b) }
            }
            "monthly" -> {
                val months = (b.get(Calendar.YEAR) - a.get(Calendar.YEAR)) * 12 + b.get(Calendar.MONTH) - a.get(Calendar.MONTH)
                months >= 0 && months % interval == 0 && b.get(Calendar.DAY_OF_MONTH) ==
                    minOf(t.optInt("repeatDay", a.get(Calendar.DAY_OF_MONTH)), b.getActualMaximum(Calendar.DAY_OF_MONTH))
            }
            else -> false
        }
    }
    fun rows(json: String, today: String): List<String> = entries(json, today).map {
        (if (it.time.isEmpty()) "○  " else "${it.time}  ") + it.title
    }
    fun entries(json: String, today: String): List<Entry> {
        val root = JSONObject(json)
        val tasks = root.getJSONArray("tasks")
        val parents = (0 until tasks.length()).map { tasks.getJSONObject(it).optString("previousId") }.toSet()
        return (0 until tasks.length()).map { tasks.getJSONObject(it) }.mapNotNull { t ->
            if (t.optString("kind") == "fact" || t.optString("status") == "done") return@mapNotNull null
            val due = t.optString("due")
            val start = t.optString("start")
            val birthday = t.optJSONObject("birthday")
            val event = t.optString("kind") == "event" && birthday == null
            val repeating = t.optString("repeat").isNotEmpty() && !parents.contains(t.optString("id")) && birthday == null
            var occurs = false
            var time = if (event) t.optString("startTime") else t.optString("dueTime")
            if (repeating) {
                val span = if (event && start.isNotEmpty() && due.isNotEmpty()) delta(start, due).coerceIn(0, 366) else 0
                val completed = t.optJSONArray("repeatCompleted") ?: JSONArray()
                // Repeating intervals are anchored to their end date, as in the calendar.
                for (offset in 0..span) {
                    val end = calendar(today).apply { add(Calendar.DAY_OF_MONTH, offset) }
                    val key = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(end.time)
                    if (repeats(t, key) && !(0 until completed.length()).any { completed.optString(it) == key }) {
                        occurs = true
                        if (event && offset < span) time = "00:00"
                        break
                    }
                }
            } else if (birthday != null) {
                val day = calendar(today)
                val month = birthday.optInt("month")
                day.set(Calendar.DAY_OF_MONTH, 1)
                day.set(Calendar.MONTH, month - 1)
                occurs = today.substring(5, 7).toInt() == month && today.substring(8).toInt() ==
                    minOf(birthday.optInt("day"), day.getActualMaximum(Calendar.DAY_OF_MONTH))
            } else {
                occurs = if (event) start.isNotEmpty() && start <= today && today <= due else due == today
                if (event && today != start) time = "00:00"
                val reminder = t.optString("reminder")
                if (reminder.isNotEmpty()) {
                    val parsed = try {
                        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.ROOT).parse(reminder)
                    } catch (_: Exception) { null }
                    if (parsed != null && SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(parsed) == today) occurs = true
                }
            }
            if (!occurs) null else Entry(t.optString("title"), time, t.optString("area"), event,
                root.optJSONObject("areaIcons")?.optString(t.optString("area")).orEmpty())
        }.sortedWith(compareBy<Entry> { it.time.ifEmpty { "99:99" } }.thenBy { it.title })
    }
}

open class TodayWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { refresh(context) }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { refresh(context) }
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action in listOf(Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED)) refresh(context)
    }
    companion object {
        @android.annotation.TargetApi(31)
        fun collection(context: Context, entries: List<WidgetTasks.Entry>, rowLayout: Int = R.layout.today_widget_row, image: (WidgetTasks.Entry) -> Uri): RemoteViews.RemoteCollectionItems {
            val items = RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(false).setViewTypeCount(1)
            entries.forEachIndexed { index, entry ->
                val row = RemoteViews(context.packageName, rowLayout)
                row.setImageViewUri(R.id.widget_row, image(entry))
                row.setContentDescription(R.id.widget_row, listOf(entry.title, entry.area, entry.time.ifEmpty { "Без времени" }).joinToString(". "))
                items.addItem(index.toLong(), row)
            }
            return items.build()
        }
        fun reportFailure(context: Context, error: Exception) {
            android.util.Log.e("OrbitaWidget", "Widget update failed", error)
            context.getSharedPreferences("today_widget", Context.MODE_PRIVATE).edit()
                .putString("error", "${error.javaClass.simpleName}: ${error.message.orEmpty().take(300)}").apply()
        }
        fun save(context: Context, json: String) {
            JSONObject(json).getJSONArray("tasks")
            if (context.getSharedPreferences("today_widget", Context.MODE_PRIVATE).edit().putString("tasks", json).commit()) refresh(context)
        }
        fun data(context: Context): String? = context.getSharedPreferences("today_widget", Context.MODE_PRIVATE).getString("tasks", null)
        fun today() = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())
        fun width(manager: AppWidgetManager, id: Int) = manager.getAppWidgetOptions(id)
            .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 330).coerceIn(220, 800)
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = listOf(TodayWidget::class.java to false, DrumWidget::class.java to true).flatMap { (provider, drum) ->
                manager.getAppWidgetIds(ComponentName(context, provider)).map { it to drum }
            }
            var failed = false
            for ((id, drum) in ids) {
              try {
                val views = RemoteViews(context.packageName, if (drum) R.layout.today_widget_drum else R.layout.today_widget)
                val width = width(manager, id)
                val renderer = WidgetRenderer(context)
                views.setImageViewBitmap(R.id.widget_title, renderer.header(width, Date()))
                views.setContentDescription(R.id.widget_title, SimpleDateFormat("d MMMM yyyy, EEEE", Locale("ru")).format(Date()))
                val entries = data(context)?.let { WidgetTasks.entries(it, today()) }.orEmpty()
                val count = entries.size
                views.setImageViewBitmap(R.id.widget_footer, renderer.footer(width, count))
                views.setContentDescription(R.id.widget_footer, "Орбита. Дел на сегодня: $count")
                views.setTextViewText(R.id.widget_empty, if (data(context) == null) "Откройте Орбиту для загрузки дел" else "На сегодня дел нет")
                val listIds = if (drum) listOf(R.id.widget_drum_top, R.id.widget_drum_middle, R.id.widget_drum_bottom) else listOf(R.id.widget_list)
                val heightKey = if (context.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE)
                    AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT
                val visibleSlots = ((manager.getAppWidgetOptions(id).getInt(heightKey, 280) - 136) / 44).coerceIn(1, 3)
                listIds.forEachIndexed { slot, listId ->
                    val items = if (drum) WidgetTasks.rotated(entries, slot) else entries
                    val service = Intent(context, TodayWidgetService::class.java).apply {
                        data = Uri.parse("orbita-widget://today/$id/$width/$slot/$drum")
                        putExtra("width", width); putExtra("slot", slot); putExtra("drum", drum)
                    }
                    if (android.os.Build.VERSION.SDK_INT >= 31) {
                        views.setRemoteAdapter(listId, collection(context, items,
                            if (drum) R.layout.today_widget_drum_row else R.layout.today_widget_row) { entry ->
                            WidgetImages.row(context, width - 32, entry, renderer)
                        })
                    } else views.setRemoteAdapter(listId, service)
                    if (drum) {
                        views.setViewVisibility(listId, if (slot < count && slot < visibleSlots) android.view.View.VISIBLE else android.view.View.GONE)
                        views.setDisplayedChild(listId, 0)
                    } else views.setEmptyView(listId, R.id.widget_empty)
                }
                if (drum) views.setViewVisibility(R.id.widget_empty, if (count == 0) android.view.View.VISIBLE else android.view.View.GONE)
                val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                views.setOnClickPendingIntent(R.id.widget_title, open)
                views.setOnClickPendingIntent(R.id.widget_footer, open)
                views.setOnClickPendingIntent(R.id.widget_empty, open)
                manager.updateAppWidget(id, views)
                if (android.os.Build.VERSION.SDK_INT < 31) listIds.forEach { manager.notifyAppWidgetViewDataChanged(id, it) }
              } catch (error: Exception) {
                failed = true
                reportFailure(context, error)
                // Avoid retrying the bitmap renderer while recovering from its failure.
                try {
                    val fallback = RemoteViews(context.packageName, R.layout.today_widget_fallback)
                    val rows = data(context)?.let { WidgetTasks.rows(it, today()) }.orEmpty()
                    fallback.setTextViewText(R.id.widget_fallback_text, "Сегодня · Орбита\n\n" + rows.joinToString("\n"))
                    val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                    fallback.setOnClickPendingIntent(R.id.widget_fallback_text, open)
                    manager.updateAppWidget(id, fallback)
                } catch (fallbackError: Exception) { reportFailure(context, fallbackError) }
              }
            }
            if (!failed) context.getSharedPreferences("today_widget", Context.MODE_PRIVATE).edit().remove("error").apply()
        }
    }
}

class TodayWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = object : RemoteViewsFactory {
        private var rows = emptyList<WidgetTasks.Entry>()
        private val width = intent.getIntExtra("width", 330).coerceIn(220, 800)
        private val drum = intent.getBooleanExtra("drum", false)
        private val slot = intent.getIntExtra("slot", 0)
        private val renderer by lazy { WidgetRenderer(applicationContext) }
        override fun onCreate() { onDataSetChanged() }
        override fun onDataSetChanged() {
            rows = try { TodayWidget.data(applicationContext)?.let { WidgetTasks.entries(it, TodayWidget.today()) } ?: emptyList() }
            catch (_: Exception) { listOf(WidgetTasks.Entry("Откройте Орбиту для обновления дел", "", "", false)) }
            if (drum) rows = WidgetTasks.rotated(rows, slot)
        }
        override fun getCount() = rows.size
        override fun getViewAt(position: Int): RemoteViews {
            val row = rows.getOrNull(position) ?: WidgetTasks.Entry("", "", "", false)
            return try {
                RemoteViews(packageName, if (drum) R.layout.today_widget_drum_row else R.layout.today_widget_row).apply {
                    setImageViewUri(R.id.widget_row, WidgetImages.row(applicationContext, width - 32, row, renderer))
                    setContentDescription(R.id.widget_row, listOf(row.title, row.area, row.time.ifEmpty { "Без времени" }).joinToString(". "))
                }
            } catch (error: Exception) {
                TodayWidget.reportFailure(applicationContext, error)
                RemoteViews(packageName, R.layout.today_widget_fallback).apply {
                    setTextViewText(R.id.widget_fallback_text, listOf(row.time, row.title).filter { it.isNotEmpty() }.joinToString("  "))
                }
            }
        }
        override fun getLoadingView(): RemoteViews? = null
        override fun getViewTypeCount() = 2
        override fun getItemId(position: Int) = position.toLong()
        override fun hasStableIds() = false
        override fun onDestroy() { rows = emptyList() }
    }
}

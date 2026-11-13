package ru.personalassistant.desktop

import android.content.Context
import android.graphics.*
import android.text.TextPaint
import android.text.TextUtils
import androidx.core.graphics.PathParser
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.min
import kotlin.math.sqrt

/** Bitmap text preserves the bundled typefaces inside a launcher's RemoteViews process.
 * Images are bounded to their display size; only header/footer are in the widget update.
 * List rows are exposed through cached content URIs, not attached bitmap payloads.
 */
class WidgetRenderer(private val context: Context) {
    private val regular = Typeface.createFromAsset(context.assets, "widget/InterTight-Regular.ttf")
    private val semibold = Typeface.createFromAsset(context.assets, "widget/InterTight-SemiBold.ttf")
    private val glyphs = JSONObject(context.assets.open("widget/glyphs.json").bufferedReader().use { it.readText() })
    private val icons = JSONObject(context.assets.open("widget/icons.json").bufferedReader().use { it.readText() })
    private val ink = Color.rgb(17, 18, 21)
    private val muted = Color.rgb(88, 108, 119)
    private fun paint(size: Float, color: Int = ink, bold: Boolean = false) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size; this.color = color; typeface = if (bold) semibold else regular
    }
    private fun bitmap(width: Int, height: Int, draw: (Canvas) -> Unit): Bitmap {
        // Keep physical pixels proportional to density, capped for large tablets.
        val scale = min(context.resources.displayMetrics.density.coerceIn(1f, 2f),
            sqrt(800000f / (width * 136f * 4f)))
        val result = Bitmap.createBitmap((width * scale).toInt().coerceAtLeast(1), (height * scale).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        result.density = (160 * scale).toInt()
        val canvas = Canvas(result)
        canvas.scale(scale, scale)
        draw(canvas)
        return result
    }
    private fun dots(canvas: Canvas, text: String, x: Float, y: Float, pitch: Float) {
        val p = paint(12f)
        text.uppercase(Locale("ru")).forEachIndexed { index, letter ->
            val glyph = glyphs.optJSONArray(letter.toString()) ?: return@forEachIndexed
            for (row in 0..6) for (column in 0..4) {
                if (glyph.getString(row)[column] == '#') canvas.drawCircle(
                    x + (index * 6 + column + .5f) * pitch, y + (row + .5f) * pitch, pitch * .4f, p)
            }
        }
    }
    private fun icon(canvas: Canvas, name: String, x: Float, y: Float, size: Float, color: Int = ink) {
        val nodes = icons.optJSONArray(name) ?: icons.getJSONArray("circle")
        val stroke = paint(12f, color).apply { style = Paint.Style.STROKE; strokeWidth = 1.7f; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
        canvas.save(); canvas.translate(x, y); canvas.scale(size / 24, size / 24)
        for (i in 0 until nodes.length()) {
            val node = nodes.getJSONArray(i)
            val a = node.getJSONObject(1)
            fun n(key: String, default: Double = 0.0) = a.optDouble(key, default).toFloat()
            when (node.getString(0)) {
                "path" -> try {
                    PathParser.createPathFromPathData(a.getString("d"))?.let { canvas.drawPath(it, stroke) }
                } catch (error: RuntimeException) {
                    android.util.Log.e("OrbitaWidget", "Invalid icon path: $name", error)
                    canvas.drawCircle(12f, 12f, 8f, stroke)
                }
                "circle" -> canvas.drawCircle(n("cx"), n("cy"), n("r"), stroke)
                "ellipse" -> canvas.drawOval(n("cx") - n("rx"), n("cy") - n("ry"), n("cx") + n("rx"), n("cy") + n("ry"), stroke)
                "rect" -> canvas.drawRoundRect(n("x"), n("y"), n("x") + n("width"), n("y") + n("height"), n("rx"), n("ry", a.optDouble("rx", 0.0)), stroke)
                "line" -> canvas.drawLine(n("x1"), n("y1"), n("x2"), n("y2"), stroke)
                "polyline", "polygon" -> {
                    val points = a.getString("points").trim().split(Regex("[ ,]+"))
                    val path = Path()
                    points.chunked(2).forEachIndexed { j, pair ->
                        if (pair.size == 2) { if (j == 0) path.moveTo(pair[0].toFloat(), pair[1].toFloat()) else path.lineTo(pair[0].toFloat(), pair[1].toFloat()) }
                    }
                    if (node.getString(0) == "polygon") path.close()
                    canvas.drawPath(path, stroke)
                }
            }
        }
        canvas.restore()
    }
    fun header(width: Int, now: Date): Bitmap = bitmap(width, 94) { canvas ->
        val pitch = if (width < 280) 4.5f else if (width < 330) 6f else 7f
        val top = 22f
        val left = 18f
        val numberBottom = top + 6.9f * pitch
        dots(canvas, SimpleDateFormat("dd", Locale.ROOT).format(now), left, top, pitch)
        val dateX = left + 11 * pitch + 12
        val right = width - (if (width < 280) 52f else 62f)
        val available = (right - dateX).coerceAtLeast(60f)
        val weekday = SimpleDateFormat("EEEE", Locale("ru")).format(now).uppercase(Locale("ru"))
        val dayPitch = min(2.9f, available / (weekday.length * 6 - 1))
        dots(canvas, weekday, dateX, top + (pitch - dayPitch) * .1f, dayPitch)
        val monthPaint = paint(if (width < 280) 10f else 12f, muted)
        val month = SimpleDateFormat("d MMMM yyyy", Locale("ru")).format(now).substringAfter(' ').uppercase(Locale("ru"))
        val todayPaint = paint(if (width < 280) 9f else 11f, Color.WHITE)
        val pillWidth = todayPaint.measureText("СЕГОДНЯ") + 14
        val pillRight = right
        canvas.drawRoundRect(pillRight - pillWidth, numberBottom - 18, pillRight, numberBottom, 9f, 9f, paint(12f, Color.rgb(36, 82, 236)))
        canvas.drawText("СЕГОДНЯ", pillRight - pillWidth + 7, numberBottom - 9 - (todayPaint.ascent() + todayPaint.descent()) / 2, todayPaint)
        val bounds = Rect(); monthPaint.getTextBounds(month, 0, month.length, bounds)
        val caption = TextUtils.ellipsize(month, monthPaint, (available - pillWidth - 8).coerceAtLeast(0f), TextUtils.TruncateAt.END).toString()
        canvas.drawText(caption, dateX, numberBottom - bounds.bottom, monthPaint)
        // The icon's centre is exactly the centre of the 32dp corner arc.
        canvas.drawCircle(width - 32f, 32f, 15f, paint(12f))
        icon(canvas, "orbit", width - 40f, 24f, 16f, Color.WHITE)
    }
    private val areas = mapOf(
        "Работа" to Pair("#6b9bdf", "briefcase-business"), "Фриланс" to Pair("#b08cdb", "laptop"),
        "Квартира" to Pair("#6fc2a5", "house"), "Еда" to Pair("#e9a16c", "utensils"),
        "Любовь" to Pair("#d989b6", "heart"), "Спорт" to Pair("#6bbdd9", "dumbbell"),
        "Родные" to Pair("#e4bd68", "users"), "Здоровье" to Pair("#89c78e", "heart-pulse"),
        "Покупки" to Pair("#c69cce", "shopping-bag"), "Финансы" to Pair("#63b9b2", "wallet"),
        "Учёба" to Pair("#8e9fe0", "book-open"), "Преподавание" to Pair("#d59d83", "presentation"),
        "Аспирантура" to Pair("#aa9bd9", "graduation-cap"), "Дни рождения" to Pair("#ee9a97", "cake"),
        "Личное" to Pair("#edb18d", "heart"))
    private val choices = mapOf("work" to "briefcase-business", "home" to "house", "food" to "utensils",
        "sport" to "dumbbell", "family" to "users", "health" to "heart-pulse", "shopping" to "shopping-bag",
        "money" to "wallet", "book" to "book-open", "teaching" to "presentation", "study" to "graduation-cap",
        "travel" to "plane", "nature" to "trees", "photo" to "camera", "pet" to "paw-print", "games" to "gamepad-2", "flower" to "flower-2")
    fun row(width: Int, entry: WidgetTasks.Entry): Bitmap = bitmap(width, 36) { canvas ->
        val area = areas[entry.area]
        val sphereColor = area?.first?.let { Color.parseColor(it) } ?: Color.HSVToColor(floatArrayOf((entry.area.hashCode().toLong() and 0xffffffffL).rem(360).toFloat(), .4f, .85f))
        canvas.drawRoundRect(0f, 0f, width.toFloat(), 36f, 10f, 10f, paint(12f, sphereColor))
        canvas.drawCircle(22f, 18f, 14f, paint(12f, 0x66ffffff))
        val iconName = if (entry.icon.isNotEmpty()) choices[entry.icon] ?: entry.icon else area?.second ?: "circle"
        icon(canvas, iconName, 13.5f, 9.5f, 17f, Color.rgb(32, 57, 64))
        val outline = paint(12f, 0x66708080).apply { style = Paint.Style.STROKE; strokeWidth = 1.3f }
        canvas.drawCircle(width - 19f, 18f, 11f, outline)
        val timePaint = paint(12f)
        val timeWidth = if (entry.time.isEmpty()) 0f else timePaint.measureText(entry.time) + 14
        val timeRight = width - 42f
        if (entry.time.isNotEmpty()) {
            canvas.drawRoundRect(timeRight - timeWidth, 6f, timeRight, 30f, 7f, 7f, outline)
            canvas.drawText(entry.time, timeRight - timeWidth + 7, 18 - (timePaint.ascent() + timePaint.descent()) / 2, timePaint)
        }
        val titlePaint = paint(14f, bold = true)
        val title = TextUtils.ellipsize(entry.title, titlePaint, (width - 94 - timeWidth).coerceAtLeast(10f), TextUtils.TruncateAt.END).toString()
        canvas.drawText(title, 44f, 18 - (titlePaint.ascent() + titlePaint.descent()) / 2, titlePaint)
    }
    fun footer(width: Int, count: Int): Bitmap = bitmap(width, 42) { canvas ->
        canvas.drawText("ОРБИТА", 20f, 24f, paint(11f, Color.rgb(23, 45, 53)))
        val p = paint(12f, muted)
        val ending = if (count % 100 in 11..14) "дел" else when (count % 10) { 1 -> "дело"; 2, 3, 4 -> "дела"; else -> "дел" }
        val label = "$count $ending на сегодня"
        canvas.drawText(label, width - 20 - p.measureText(label), 24f, p)
    }
}

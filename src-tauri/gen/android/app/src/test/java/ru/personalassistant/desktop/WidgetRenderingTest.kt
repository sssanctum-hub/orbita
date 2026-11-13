package ru.personalassistant.desktop

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Bundle
import android.os.Parcel
import android.widget.FrameLayout
import android.widget.RemoteViews
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.Date

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class WidgetRenderingTest {
    @Test fun drumLayoutHasSlowUpwardLoopingAnimations() {
        val context = RuntimeEnvironment.getApplication()
        val root = RemoteViews(context.packageName, R.layout.today_widget_drum).apply(context, FrameLayout(context))
        for (id in listOf(R.id.widget_drum_top, R.id.widget_drum_middle, R.id.widget_drum_bottom)) {
            val flipper = root.findViewById<android.widget.AdapterViewFlipper>(id)
            org.junit.Assert.assertEquals(5000, flipper.flipInterval)
            org.junit.Assert.assertEquals(1800L, flipper.inAnimation.duration)
            org.junit.Assert.assertEquals(1800L, flipper.outAnimation.duration)
            assertTrue(flipper.isAutoStart)
            flipper.adapter = android.widget.ArrayAdapter(context, android.R.layout.simple_list_item_1, listOf("A", "B", "C"))
            flipper.displayedChild = 2
            flipper.showNext()
            org.junit.Assert.assertEquals(0, flipper.displayedChild)
        }
    }
    @Test fun everyPackagedIconPathParsesOnAndroid() {
        val context = RuntimeEnvironment.getApplication()
        val icons = org.json.JSONObject(context.assets.open("widget/icons.json").bufferedReader().use { it.readText() })
        for (name in icons.keys()) {
            val nodes = icons.getJSONArray(name)
            for (i in 0 until nodes.length()) {
                val node = nodes.getJSONArray(i)
                if (node.getString(0) == "path") {
                    val path = node.getJSONObject(1).getString("d")
                    assertTrue("Invalid path in $name", androidx.core.graphics.PathParser.createPathFromPathData(path) != null)
                }
            }
        }
    }
    @Test
    @Config(sdk = [31])
    fun longCollectionUsesImageUrisInsteadOfAccumulatingBitmaps() {
        val context = RuntimeEnvironment.getApplication()
        val renderer = WidgetRenderer(context)
        val views = RemoteViews(context.packageName, R.layout.today_widget)
        views.setImageViewBitmap(R.id.widget_title, renderer.header(330, Date()))
        views.setImageViewBitmap(R.id.widget_footer, renderer.footer(330, 100))
        val entries = (0 until 100).map { WidgetTasks.Entry("Дело $it", "10:00", "Работа", false) }
        // FileProvider path canonicalisation assumes Android's '/' separator; provide
        // platform URIs here so this collection regression also runs on Windows JVMs.
        val items = TodayWidget.collection(context, entries) { entry ->
            android.net.Uri.parse("content://${context.packageName}.fileprovider/widget/${entry.title.hashCode()}.png")
        }
        org.junit.Assert.assertEquals(100, items.itemCount)
        views.setRemoteAdapter(R.id.widget_list, items)
        val parcel = Parcel.obtain()
        try {
            views.writeToParcel(parcel, 0)
            assertTrue("Long widget payload must stay under the binder limit", parcel.dataSize() < 1000000)
        } finally { parcel.recycle() }
    }
    @Test fun rendersHeaderFooterAndCardsUsingPackagedAssets() {
        val context = RuntimeEnvironment.getApplication()
        val renderer = WidgetRenderer(context)
        for (width in listOf(220, 280, 330, 364, 800)) {
            val header = renderer.header(width, Date())
            val footer = renderer.footer(width, 4)
            assertTrue(header.allocationByteCount + footer.allocationByteCount <= 810000)
            val row = renderer.row(width - 32, WidgetTasks.Entry("Подготовить презентацию", "10:00", "Работа", false))
            assertTrue(row.width > 0)
            renderer.row(width - 32, WidgetTasks.Entry("Встреча", "12:30", "Работа", true))
        }
    }
    @Test fun updatedRemoteViewsCanBeApplied() {
        val context = RuntimeEnvironment.getApplication()
        val renderer = WidgetRenderer(context)
        val views = RemoteViews(context.packageName, R.layout.today_widget)
        views.setImageViewBitmap(R.id.widget_title, renderer.header(330, Date()))
        views.setImageViewBitmap(R.id.widget_footer, renderer.footer(330, 4))
        views.apply(context, FrameLayout(context))
        val row = RemoteViews(context.packageName, R.layout.today_widget_row)
        row.setImageViewBitmap(R.id.widget_row, renderer.row(298, WidgetTasks.Entry("Дело", "", "Покупки", false)))
        row.apply(context, FrameLayout(context))
    }
}

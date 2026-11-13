package ru.personalassistant.desktop

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetTasksTest {
    @Test fun drumSlotsWrapWithoutLosingTasks() {
        val entries = listOf("A", "B", "C").map { WidgetTasks.Entry(it, "", "", false) }
        assertEquals(listOf("B", "C", "A"), WidgetTasks.rotated(entries, 1).map { it.title })
        assertEquals(listOf("C", "A", "B"), WidgetTasks.rotated(entries, 2).map { it.title })
        assertEquals(entries, WidgetTasks.rotated(entries, 3))
        assertEquals(emptyList<WidgetTasks.Entry>(), WidgetTasks.rotated(emptyList(), 1))
        assertEquals(entries.take(1), WidgetTasks.rotated(entries.take(1), 2))
    }
    @Test fun keepsCardMetadataAndCustomSphereIcon() {
        val event = task("Встреча").put("kind", "event").put("start", "2026-11-02")
            .put("startTime", "12:30").put("area", "Работа")
        val json = JSONObject().put("tasks", JSONArray().put(event))
            .put("areaIcons", JSONObject().put("Работа", "star"))
        assertEquals(listOf(WidgetTasks.Entry("Встреча", "12:30", "Работа", true, "star")),
            WidgetTasks.entries(json.toString(), "2026-11-02"))
    }
    private fun task(title: String, due: String = "2026-11-02") = JSONObject()
        .put("id", title).put("title", title).put("due", due).put("status", "todo")
    private fun rows(date: String = "2026-11-02", vararg tasks: JSONObject) =
        WidgetTasks.rows(JSONObject().put("tasks", JSONArray(tasks.toList())).toString(), date)

    @Test fun filtersAndOrdersTodaysPendingTasks() {
        assertEquals(listOf("09:00  Утро", "○  Сегодня"), rows("2026-11-02",
            task("Сегодня"), task("Завтра", "2026-11-03"), task("Вчера", "2026-11-01"),
            task("Готово").put("status", "done"), task("Факт").put("kind", "fact"),
            task("Утро").put("dueTime", "09:00")))
    }
    @Test fun changesDateWithoutOpeningApp() {
        val daily = task("Каждый день", "2026-10-01").put("repeat", "daily")
        assertEquals(listOf("○  Каждый день"), rows("2026-11-03", daily))
        daily.put("repeatCompleted", JSONArray().put("2026-11-03"))
        assertEquals(emptyList<String>(), rows("2026-11-03", daily))
        assertEquals(listOf("○  Каждый день"), rows("2026-11-04", daily))
    }
    @Test fun respectsWeeklyIntervalsAndEndDate() {
        val weekly = task("Раз в две недели", "2026-10-19").put("repeat", "weekly").put("repeatInterval", 2)
            .put("repeatWeekdays", JSONArray().put(0)).put("repeatUntil", "2026-11-10")
        assertEquals(listOf("○  Раз в две недели"), rows("2026-11-02", weekly))
        assertEquals(emptyList<String>(), rows("2026-11-09", weekly))
        assertEquals(emptyList<String>(), rows("2026-11-16", weekly))
    }
    @Test fun clampsMonthlyRepeatAndLeapBirthday() {
        val monthly = task("Месяц", "2026-01-31").put("repeat", "monthly")
        assertEquals(listOf("○  Месяц"), rows("2026-02-28", monthly))
        val birthday = task("День рождения").put("birthday", JSONObject().put("month", 2).put("day", 29))
        assertEquals(listOf("○  День рождения"), rows("2027-02-28", birthday))
        assertEquals(emptyList<String>(), rows("2028-02-28", birthday))
        assertEquals(listOf("○  День рождения"), rows("2028-02-29", birthday))
    }
    @Test fun includesMiddleOfRepeatingEvent() {
        val event = task("Поездка", "2026-10-27").put("kind", "event").put("start", "2026-10-25")
            .put("startTime", "10:00").put("repeat", "weekly")
        assertEquals(listOf("00:00  Поездка"), rows("2026-11-02", event))
        assertEquals(listOf("10:00  Поездка"), rows("2026-11-01", event))
    }
    @Test fun olderSeriesCopiesDoNotRepeat() {
        val old = task("Старое", "2026-10-01").put("repeat", "daily")
        val latest = task("Новое").put("previousId", "Старое").put("repeat", "daily")
        assertEquals(listOf("○  Новое"), rows("2026-11-02", old, latest))
    }
}

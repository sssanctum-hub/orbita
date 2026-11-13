package ru.personalassistant.desktop

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.security.MessageDigest

/** Row images travel by content URI, so a long list does not accumulate bitmap
 * payloads when Android converts the collection into one RemoteViews update. */
object WidgetImages {
    @Synchronized
    fun row(context: Context, width: Int, entry: WidgetTasks.Entry, renderer: WidgetRenderer): Uri {
        val key = MessageDigest.getInstance("SHA-256").digest("strips-v1|$width|$entry".toByteArray())
            .joinToString("") { "%02x".format(it) }
        val directory = File(context.cacheDir, "widget_images").apply { mkdirs() }
        val file = File(directory, "$key.png")
        if (!file.exists()) {
            val bitmap = renderer.row(width, entry)
            try {
                file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
            } catch (error: Exception) { file.delete(); throw error }
            finally { bitmap.recycle() }
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        for (launcher in context.packageManager.queryIntentActivities(home, 0)) {
            context.grantUriPermission(launcher.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return uri
    }
}

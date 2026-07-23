package com.neubofy.veto.utils

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import com.neubofy.veto.data.Settings
import com.neubofy.veto.data.SettingsRepository
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

object DashboardSync {
    private val TAG = DashboardSync::class.java.simpleName

    fun uploadTokenIfPaired(context: Context) {
        val settings = SettingsRepository.getInstance(context)
        val url = settings.get(Settings.SET_FMDSERVER_URL) as String
        val userId = settings.get(Settings.SET_FMDSERVER_ID) as String

        if (url.isEmpty() || userId.isEmpty()) {
            context.log().i(TAG, "Dashboard not paired. Skipping token upload.")
            return
        }

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                context.log().w(TAG, "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }

            val token = task.result
            uploadTokenToServer(context, url, userId, token)
        }
    }

    private fun uploadTokenToServer(context: Context, dashboardUrl: String, userId: String, fcmToken: String) {
        Thread {
            try {
                val apiUrl = if (dashboardUrl.endsWith("/")) "${dashboardUrl}api/device/link" else "$dashboardUrl/api/device/link"
                val url = URL(apiUrl)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true

                val jsonParam = JSONObject()
                jsonParam.put("userId", userId)
                jsonParam.put("fcmToken", fcmToken)

                val out = OutputStreamWriter(connection.outputStream)
                out.write(jsonParam.toString())
                out.close()

                val responseCode = connection.responseCode
                if (responseCode in 200..299) {
                    context.log().i(TAG, "Successfully synced FCM token to Dashboard")
                } else {
                    context.log().e(TAG, "Failed to sync FCM token. Server returned $responseCode")
                }
            } catch (e: Exception) {
                context.log().e(TAG, "Error syncing FCM token", e)
            }
        }.start()
    }
}

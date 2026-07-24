package com.neubofy.veto.services

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.neubofy.veto.utils.log

class VetoFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private val TAG = VetoFirebaseMessagingService::class.java.simpleName
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        log().i(TAG, "New Firebase token received: $token")
        
        // Save to Firestore via Next.js Dashboard API if paired
        com.neubofy.veto.utils.DashboardSync.uploadTokenIfPaired(this)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        log().i(TAG, "Received FCM message from: ${remoteMessage.from}")

        // Check if message contains a data payload.
        if (remoteMessage.data.isNotEmpty()) {
            log().i(TAG, "Message data payload: ${remoteMessage.data}")
            
            val commandStr = remoteMessage.data["command"]
            if (commandStr != null) {
                // Prepend trigger word so the parser accepts it
                val settings = com.neubofy.veto.data.SettingsRepository.getInstance(this)
                val triggerWord = settings.get(com.neubofy.veto.data.Settings.SET_FMD_COMMAND) as String
                val fullCommand = "$triggerWord $commandStr"

                log().i(TAG, "Enqueuing FCM command execution: $fullCommand")

                val inputData = androidx.work.workDataOf(
                    com.neubofy.veto.workers.CommandExecutionWorker.KEY_COMMAND to fullCommand,
                    com.neubofy.veto.workers.CommandExecutionWorker.KEY_TRANSPORT_TYPE to com.neubofy.veto.workers.CommandExecutionWorker.TRANS_NEXTJS_SERVER,
                    com.neubofy.veto.workers.CommandExecutionWorker.KEY_DESTINATION to "FCM Server",
                )
                val workRequest = androidx.work.OneTimeWorkRequestBuilder<com.neubofy.veto.workers.CommandExecutionWorker>()
                    .setInputData(inputData)
                    .build()
                androidx.work.WorkManager.getInstance(this).enqueue(workRequest)
            } else {
                log().w(TAG, "FCM data payload did not contain a 'command' key")
            }
        }
    }
}

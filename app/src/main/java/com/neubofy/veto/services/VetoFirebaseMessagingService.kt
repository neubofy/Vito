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
        
        // TODO: Save to Firestore if user is authenticated
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        log().i(TAG, "Received FCM message from: ${remoteMessage.from}")

        // Check if message contains a data payload.
        if (remoteMessage.data.isNotEmpty()) {
            log().i(TAG, "Message data payload: ${remoteMessage.data}")
            
            // Extract the command
            val command = remoteMessage.data["command"]
            
            when (command) {
                "LOCATE" -> {
                    log().i(TAG, "Executing LOCATE command via FCM")
                    // Trigger location worker
                }
                "RING" -> {
                    log().i(TAG, "Executing RING command via FCM")
                    // Trigger ring worker
                }
                "WIPE" -> {
                    log().i(TAG, "Executing WIPE command via FCM")
                    // Trigger wipe worker
                }
                else -> {
                    log().w(TAG, "Unknown command received: $command")
                }
            }
        }
    }
}

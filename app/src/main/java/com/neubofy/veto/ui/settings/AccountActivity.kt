package com.neubofy.veto.ui.settings

import android.os.Bundle
import android.widget.TextView
import com.google.android.material.button.MaterialButton
import com.google.android.material.snackbar.Snackbar
import com.google.firebase.messaging.FirebaseMessaging
import com.neubofy.veto.R
import com.neubofy.veto.ui.FmdActivity
import com.neubofy.veto.utils.log

class AccountActivity : FmdActivity() {

    companion object {
        private val TAG = AccountActivity::class.java.simpleName
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account)

        val btnAuth = findViewById<MaterialButton>(R.id.btnAuthenticate)
        val tvStatus = findViewById<TextView>(R.id.tvConnectionStatus)

        // TODO: Implement actual Firebase Auth UI here.
        // For now, simply fetch the FCM token to verify Firebase is working.
        
        btnAuth.setOnClickListener {
            btnAuth.isEnabled = false
            tvStatus.text = "Fetching FCM Token..."
            
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                btnAuth.isEnabled = true
                if (!task.isSuccessful) {
                    log().w(TAG, "Fetching FCM registration token failed: ${task.exception?.message}")
                    tvStatus.text = "Error fetching token."
                    return@addOnCompleteListener
                }

                // Get new FCM registration token
                val token = task.result
                log().i(TAG, "FCM Token: $token")
                tvStatus.text = "Token: $token\n\nFirebase is connected!"
                
                Snackbar.make(btnAuth, "FCM Token retrieved successfully.", Snackbar.LENGTH_LONG).show()
            }
        }
    }
}

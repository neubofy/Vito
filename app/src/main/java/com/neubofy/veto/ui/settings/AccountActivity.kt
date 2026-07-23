package com.neubofy.veto.ui.settings

import android.os.Bundle
import android.widget.TextView
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.snackbar.Snackbar
import com.neubofy.veto.R
import com.neubofy.veto.data.Settings
import com.neubofy.veto.data.SettingsRepository
import com.neubofy.veto.ui.FmdActivity
import com.neubofy.veto.utils.DashboardSync
import com.neubofy.veto.utils.log

class AccountActivity : FmdActivity() {

    companion object {
        private val TAG = AccountActivity::class.java.simpleName
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account)

        val etDashboardUrl = findViewById<TextInputEditText>(R.id.etDashboardUrl)
        val etUserId = findViewById<TextInputEditText>(R.id.etUserId)
        val btnSavePairing = findViewById<MaterialButton>(R.id.btnSavePairing)
        val tvStatus = findViewById<TextView>(R.id.tvConnectionStatus)

        val settings = SettingsRepository.getInstance(this)
        
        // Load existing
        val currentUrl = settings.get(Settings.SET_FMDSERVER_URL) as String
        val currentUserId = settings.get(Settings.SET_FMDSERVER_ID) as String
        if (currentUrl.isNotEmpty()) etDashboardUrl.setText(currentUrl)
        if (currentUserId.isNotEmpty()) etUserId.setText(currentUserId)

        if (currentUrl.isNotEmpty() && currentUserId.isNotEmpty()) {
            tvStatus.text = "Device is Paired!"
        }
        
        btnSavePairing.setOnClickListener {
            val url = etDashboardUrl.text.toString().trim()
            val userId = etUserId.text.toString().trim()

            if (url.isEmpty() || userId.isEmpty()) {
                Snackbar.make(btnSavePairing, "Please fill out both fields.", Snackbar.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Save to repository (reusing legacy setting keys for simplicity)
            settings.set(Settings.SET_FMDSERVER_URL, url)
            settings.set(Settings.SET_FMDSERVER_ID, userId)

            tvStatus.text = "Pairing... Sending FCM Token to Dashboard"
            
            // Sync it
            DashboardSync.uploadTokenIfPaired(this)

            Snackbar.make(btnSavePairing, "Pairing saved! Token is syncing in background.", Snackbar.LENGTH_LONG).show()
            tvStatus.text = "Device is Paired!"
            
            // Go back
            finish()
        }
    }
}

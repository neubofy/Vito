package com.neubofy.veto.ui.settings

import android.os.Bundle
import com.neubofy.veto.R
import com.neubofy.veto.ui.VetoActivity

class SettingsActivity : VetoActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.settings_container, SettingsFragment())
                .commit()
        }
    }
}

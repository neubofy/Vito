package com.neubofy.veto.permissions

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager.PERMISSION_GRANTED
import androidx.annotation.StringRes
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.neubofy.veto.R

class PhoneStatePermission : Permission() {
    @get:StringRes
    override val name = R.string.perm_phone_state_name
    @get:StringRes
    override val description = R.string.perm_phone_state_desc

    val REQUEST_CODE = 8071

    override fun isGranted(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_PHONE_STATE
        ) == PERMISSION_GRANTED
    }

    override fun request(activity: Activity) {
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.READ_PHONE_STATE),
            REQUEST_CODE
        )
    }
}

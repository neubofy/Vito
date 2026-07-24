package com.neubofy.veto.commands

import android.content.Context
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import com.neubofy.veto.R
import com.neubofy.veto.permissions.LocationPermission
import com.neubofy.veto.transports.Transport
import com.neubofy.veto.utils.NetworkUtils
import com.neubofy.veto.utils.WifiScan
import com.neubofy.veto.utils.getSsidCompat
import kotlinx.coroutines.CompletableDeferred


class StatsCommand(context: Context) : Command(context) {

    override val keyword = "stats"
    override val usage = "stats"

    @get:DrawableRes
    override val icon = R.drawable.ic_cell_wifi

    @get:StringRes
    override val shortDescription = R.string.cmd_stats_description_short

    override val longDescription = R.string.cmd_stats_description_long

    override val requiredPermissions = listOf(LocationPermission())

    override suspend fun <T> executeInternal(
        args: List<String>,
        transport: Transport<T>,
    ) {
        val ips = NetworkUtils.getIps(context)
        val ipsString = ips.joinToString(", ")

        // Hardware details
        val manufacturer = android.os.Build.MANUFACTURER
        val model = android.os.Build.MODEL
        val androidVersion = android.os.Build.VERSION.RELEASE
        val sdkLevel = android.os.Build.VERSION.SDK_INT

        // Battery details
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
        val batteryPct = bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)

        // Telephony details (SIM/IMEI)
        var imei = "Unknown"
        var networkOperator = "Unknown"
        var phoneNumber = "Unknown"
        
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as android.telephony.TelephonyManager
        if (androidx.core.app.ActivityCompat.checkSelfPermission(context, android.Manifest.permission.READ_PHONE_STATE) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    imei = tm.imei ?: "Unknown"
                } else {
                    @Suppress("DEPRECATION")
                    imei = tm.deviceId ?: "Unknown"
                }
                networkOperator = tm.networkOperatorName ?: "Unknown"
                @Suppress("MissingPermission")
                phoneNumber = tm.line1Number ?: "Unknown"
            } catch (e: Exception) {
                // Ignore
            }
        }

        val deferred = CompletableDeferred<Unit>()

        WifiScan(context, { scanResults ->
            val wifisString =
                scanResults.joinToString(", ") { sr -> "${sr.getSsidCompat()}" }

            val reply = """
                Model: $manufacturer $model
                OS: Android $androidVersion (SDK $sdkLevel)
                Battery: $batteryPct%
                IMEI: $imei
                SIM Network: $networkOperator
                Phone Number: $phoneNumber
                IPs: $ipsString
                WiFi: $wifisString
            """.trimIndent()

            transport.send(context, reply)
            deferred.complete(Unit)
        }).startWifiScan()

        deferred.await()
    }
}

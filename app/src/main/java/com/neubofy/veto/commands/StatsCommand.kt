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
        val ipsString = ips.joinToString("\n\n")

        val deferred = CompletableDeferred<Unit>()

        WifiScan(context, { scanResults ->
            val wifisString =
                scanResults.joinToString("\n\n") { sr -> "SSID: ${sr.getSsidCompat()}\nBSSID: ${sr.BSSID}" }

            val reply = context.getString(R.string.cmd_stats_response, ipsString, wifisString)

            transport.send(context, reply)
            deferred.complete(Unit)
        }).startWifiScan()

        deferred.await()
    }
}

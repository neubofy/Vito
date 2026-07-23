package com.neubofy.veto.services

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.neubofy.veto.data.Settings
import com.neubofy.veto.data.SettingsRepository
import com.neubofy.veto.utils.Utils
import com.neubofy.veto.utils.log
import com.neubofy.veto.workers.CommandExecutionWorker

/*
 * This used to be a long-running service that keep a context open to register an intent filer
 * for ACTION_BATTERY_LOW for BatteryLowReceiver to run.
 *
 * Since this can 1) have negative battery impact, and 2) is less reliable,
 * this current implementation attempt simply schedules a periodic job that checks the
 * current battery level and exits immediately if not low.
 */
class FmdBatteryLowService : FmdJobService() {

    override val TAG = FmdBatteryLowService::class.simpleName

    companion object {
        const val JOB_ID: Int = 110

        private const val INTERVAL_MILLIS = 30 * 60 * 1000L
        private const val FLEX_MILLIS = 10 * 60 * 1000L

        private const val THRESHOLD_PERCENTAGE_LOW = 20

        private const val UPLOAD_MIN_INTERVAL_MILLIS = 45 * 60 * 1000 // 45 mins

        @JvmStatic
        fun scheduleJobNow(context: Context) {
            val serviceComponent = ComponentName(context, FmdBatteryLowService::class.java)
            val builder = JobInfo.Builder(JOB_ID, serviceComponent)
            builder.setPersisted(true)
            builder.setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            builder.setPeriodic(INTERVAL_MILLIS, FLEX_MILLIS)
            val jobScheduler = context.getSystemService(JobScheduler::class.java)
            jobScheduler.schedule(builder.build())
        }

        @JvmStatic
        fun cancelJob(context: Context) {
            val jobScheduler = context.getSystemService(JobScheduler::class.java)
            jobScheduler.cancel(JOB_ID)
        }
    }

    override fun onStartJob(params: JobParameters?): Boolean {
        super.onStartJob(params)

        val settings = SettingsRepository.getInstance(this)
        if (!settings.serverAccountExists()) {
            this.log().w(TAG, "Server account no longer exists. Stopping BATTERY_LOW uploading.")
            cancelJob(this) // Stop periodic rescheduling
            jobFinished()
            return false
        }

        val batteryLevel = Utils.getBatteryLevel(this)
        if (batteryLevel < THRESHOLD_PERCENTAGE_LOW) {
            handleLowBatteryUpload(this)
        }
        jobFinished()
        return false
    }

    override fun onStopJob(params: JobParameters?): Boolean {
        super.onStopJob(params)
        return false // let it be rescheduled using the normal period
    }

    private fun handleLowBatteryUpload(context: Context) {
        val settings = SettingsRepository.getInstance(context)
        context.log().i(TAG, "Handling low battery")

        if (!(settings.get(Settings.SET_FMD_LOW_BAT_SEND) as Boolean)) {
            context.log().i(TAG, "Disabled in settings, not uploading location.")
            return
        }

        // Gson quirk: Gson may interpret long values as doubles.
        // This workaround ensures that the value is interpreted as a long.
        val lastUpload = (settings.get(Settings.SET_LAST_LOW_BAT_UPLOAD) as Number).toLong()
        val now = System.currentTimeMillis()

        // Don't upload too often
        if (lastUpload + UPLOAD_MIN_INTERVAL_MILLIS < now) {
            context.log().i(TAG, "Low battery: uploading location.")
            settings.set(Settings.SET_LAST_LOW_BAT_UPLOAD, now)
            scheduleCommand(context)
        } else {
            context.log().i(TAG, "Last low battery upload too recent, skipping.")
        }
    }

    private fun scheduleCommand(context: Context) {
        val settings = SettingsRepository.getInstance(context)
        val fmdTriggerWord = settings.get(Settings.SET_FMD_COMMAND) as String

        val inputData = workDataOf(
            CommandExecutionWorker.KEY_COMMAND to "$fmdTriggerWord locate",
            CommandExecutionWorker.KEY_TRANSPORT_TYPE to CommandExecutionWorker.TRANS_FMD_SERVER,
            CommandExecutionWorker.KEY_DESTINATION to "Low battery upload",
        )
        val workRequest = OneTimeWorkRequestBuilder<CommandExecutionWorker>()
            .setInputData(inputData)
            .build()
        WorkManager.getInstance(context).enqueue(workRequest)
    }
}
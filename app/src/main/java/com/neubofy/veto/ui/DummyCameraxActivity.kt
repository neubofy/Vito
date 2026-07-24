package com.neubofy.veto.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Size
import android.view.Surface
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.concurrent.futures.await
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.neubofy.veto.databinding.ActivityDummyCameraxBinding
import com.neubofy.veto.utils.CypherUtils
import com.neubofy.veto.utils.imageToByteArray
import com.neubofy.veto.utils.log
import kotlinx.coroutines.launch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors


class DummyCameraxActivity : AppCompatActivity() {

    private lateinit var viewBinding: ActivityDummyCameraxBinding
    private lateinit var cameraExecutor: ExecutorService
    private var cameraExtra: Int = CAMERA_BACK
    private var shouldFlash: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!hasCameraPermission()) {
            this.log().w(TAG, "Camera permission is missing. Not taking picture.")
            finish()
        }
        viewBinding = ActivityDummyCameraxBinding.inflate(layoutInflater)
        setContentView(viewBinding.root)

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.O) {
            // On SDK >= 27 we have the flags in the AndroidManifest
            @Suppress("Deprecation")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }

        cameraExecutor = Executors.newSingleThreadExecutor()
    }

    override fun onResume() {
        super.onResume()
        cameraExtra = intent.extras?.getInt(EXTRA_CAMERA) ?: CAMERA_BACK
        shouldFlash = intent.extras?.getBoolean(EXTRA_FLASH) ?: false

        lifecycleScope.launch {
            takePhoto()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            baseContext, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private suspend fun takePhoto() {
        val flashMode = if (shouldFlash && cameraExtra == CAMERA_BACK) {
            ImageCapture.FLASH_MODE_ON
        } else if (shouldFlash && cameraExtra == CAMERA_FRONT) {
            ImageCapture.FLASH_MODE_SCREEN
        } else {
            ImageCapture.FLASH_MODE_OFF
        }

        val cameraProvider = ProcessCameraProvider.getInstance(this).await()
        val builder = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .setFlashMode(flashMode)
            .setTargetRotation(Surface.ROTATION_0)
            // Set the resolution to 720 x 1280, aka "720p" (flipped because it is in portrait).
            // Or lower, if this resolution is not available.
            // This should be large enough for most use cases.
            // By default CameraX uses the highest resolution, but then the images are large, making the upload slow.
            .setResolutionSelector(
                ResolutionSelector.Builder().setResolutionStrategy(
                    ResolutionStrategy(
                        Size(720, 1280),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER
                    )
                ).build()
            )

        if (shouldFlash && cameraExtra == CAMERA_FRONT) {
            // https://android-developers.googleblog.com/2024/12/whats-new-in-camerax-140-and-jetpack-compose-support.html
            viewBinding.screenFlashView.isVisible = true
            viewBinding.screenFlashView.setScreenFlashWindow(this.window)
            viewBinding.screenFlashView.screenFlash?.let {
                builder.setScreenFlash(it)
            }
        }

        val imageCapture = builder.build()

        val cameraSelector =
            if (cameraExtra == CAMERA_FRONT) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA

        cameraProvider.unbindAll()
        try {
            cameraProvider.bindToLifecycle(this, cameraSelector, imageCapture)
            // Wait for the camera hardware to physically turn on and open the session
            // Otherwise, takePicture throws ImageCaptureException ERROR_CAMERA_CLOSED (3)
            kotlinx.coroutines.delay(1500L)
        } catch (e: IllegalArgumentException) {
            e.printStackTrace()
            this.log().e(
                TAG,
                "Cannot take picture: bindToLifecycle failed, see the stacktrace. message=${e.message} cause=${e.cause}"
            )
            return
        }

        imageCapture.takePicture(
            cameraExecutor,
            object : ImageCapture.OnImageCapturedCallback() {
                @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
                override fun onCaptureSuccess(image: ImageProxy) {
                    super.onCaptureSuccess(image)
                    val img = image.image
                    if (img == null) {
                        applicationContext.log().w(TAG, "Captured image was null!")
                        finish()
                        return
                    }
                    val imgBytes = imageToByteArray(img)
                    uploadPhotoAndFinish(imgBytes)
                }

                override fun onError(exception: ImageCaptureException) {
                    super.onError(exception)
                    applicationContext.log()
                        .w(TAG, "Failed to take picture: ${exception.imageCaptureError}")
                }
            })
    }

    private fun uploadPhotoAndFinish(imgBytes: ByteArray) {
        val settings = com.neubofy.veto.data.SettingsRepository.getInstance(this)
        val dashboardUrl = settings.get(com.neubofy.veto.data.Settings.SET_VetoSERVER_URL) as String
        if (dashboardUrl.isEmpty()) {
            this.log().w(TAG, "Dashboard not paired. Skipping photo upload.")
            finish()
            return
        }

        val currentUser = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser
        if (currentUser == null) {
            this.log().e(TAG, "User not authenticated. Cannot sync photo.")
            finish()
            return
        }

        currentUser.getIdToken(false).addOnCompleteListener { task ->
            val idToken = task.result?.token
            if (!task.isSuccessful || idToken == null) {
                this.log().e(TAG, "Failed to get Firebase Auth token: ${task.exception?.message}")
                finish()
                return@addOnCompleteListener
            }

            Thread {
                try {
                    val apiUrl = if (dashboardUrl.endsWith("/")) "${dashboardUrl}api/upload" else "$dashboardUrl/api/upload"
                    val url = java.net.URL(apiUrl)
                    val connection = url.openConnection() as java.net.HttpURLConnection
                    connection.requestMethod = "POST"
                    connection.doOutput = true
                    
                    val boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
                    connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                    connection.setRequestProperty("Authorization", "Bearer $idToken")

                    val out = java.io.DataOutputStream(connection.outputStream)
                    
                    val commandName = intent.extras?.getString(EXTRA_COMMAND) ?: "camera"
                    out.writeBytes("--$boundary\r\n")
                    out.writeBytes("Content-Disposition: form-data; name=\"command\"\r\n\r\n")
                    out.writeBytes(commandName + "\r\n")
                    
                    out.writeBytes("--$boundary\r\n")
                    out.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"photo.jpg\"\r\n")
                    out.writeBytes("Content-Type: image/jpeg\r\n\r\n")
                    out.write(imgBytes)
                    out.writeBytes("\r\n--$boundary--\r\n")
                    out.flush()
                    out.close()

                    val ctx = applicationContext
                    val responseCode = connection.responseCode
                    if (responseCode in 200..299) {
                        this.log().i(TAG, "Successfully uploaded photo to Dashboard")
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            android.widget.Toast.makeText(ctx, "Photo uploaded successfully!", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        val err = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                        this.log().e(TAG, "Failed to upload photo. Server returned $responseCode: $err")
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            android.widget.Toast.makeText(ctx, "Upload failed ($responseCode). Check logs.", android.widget.Toast.LENGTH_LONG).show()
                        }
                    }
                } catch (e: Exception) {
                    val ctx = applicationContext
                    this.log().e(TAG, "Error uploading photo: ${e.message}")
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        android.widget.Toast.makeText(ctx, "Upload error: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
                    }
                }
            }.start()

            // Finish immediately so the camera UI closes, upload happens in background thread
            finish()
        }
    }

    companion object {
        val TAG = DummyCameraxActivity::class.simpleName

        const val EXTRA_COMMAND = "EXTRA_COMMAND"
        const val EXTRA_CAMERA = "EXTRA_CAMERA"
        const val EXTRA_FLASH = "EXTRA_FLASH"
        const val CAMERA_BACK = 0
        const val CAMERA_FRONT = 1
    }
}

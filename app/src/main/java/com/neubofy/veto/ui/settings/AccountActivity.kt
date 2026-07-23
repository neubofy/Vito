package com.neubofy.veto.ui.settings

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.material.button.MaterialButton
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.neubofy.veto.R
import com.neubofy.veto.data.Settings
import com.neubofy.veto.data.SettingsRepository
import com.neubofy.veto.ui.FmdActivity
import com.neubofy.veto.utils.DashboardSync
import com.neubofy.veto.utils.log

class AccountActivity : FmdActivity() {

    private lateinit var googleSignInClient: GoogleSignInClient
    private lateinit var auth: FirebaseAuth
    private lateinit var tvStatus: TextView
    private lateinit var btnGoogleSignIn: MaterialButton
    private lateinit var etDashboardUrl: TextInputEditText

    companion object {
        private val TAG = AccountActivity::class.java.simpleName
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account)

        etDashboardUrl = findViewById(R.id.etDashboardUrl)
        btnGoogleSignIn = findViewById(R.id.btnGoogleSignIn)
        tvStatus = findViewById(R.id.tvConnectionStatus)
        auth = FirebaseAuth.getInstance()

        val settings = SettingsRepository.getInstance(this)
        
        // Load existing
        val currentUrl = settings.get(Settings.SET_FMDSERVER_URL) as String
        val currentUserId = settings.get(Settings.SET_FMDSERVER_ID) as String
        if (currentUrl.isNotEmpty()) etDashboardUrl.setText(currentUrl)

        if (currentUrl.isNotEmpty() && currentUserId.isNotEmpty()) {
            val email = auth.currentUser?.email ?: "Unknown"
            tvStatus.text = "Device is Paired!\nLogged in as $email"
            btnGoogleSignIn.text = "Relink Device"
        }

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        val googleSignInLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                try {
                    val account = task.getResult(ApiException::class.java)
                    firebaseAuthWithGoogle(account.idToken!!)
                } catch (e: ApiException) {
                    log().e(TAG, "Google sign in failed: \${e.message}")
                    Snackbar.make(btnGoogleSignIn, "Google sign in failed: \${e.message}", Snackbar.LENGTH_LONG).show()
                    tvStatus.text = "Sign in failed"
                }
            } else {
                tvStatus.text = "Sign in cancelled"
            }
        }

        btnGoogleSignIn.setOnClickListener {
            val url = etDashboardUrl.text.toString().trim()
            if (url.isEmpty()) {
                Snackbar.make(btnGoogleSignIn, "Please enter a Dashboard URL.", Snackbar.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            settings.set(Settings.SET_FMDSERVER_URL, url)
            tvStatus.text = "Signing in with Google..."
            val signInIntent = googleSignInClient.signInIntent
            googleSignInLauncher.launch(signInIntent)
        }
    }

    private fun firebaseAuthWithGoogle(idToken: String) {
        tvStatus.text = "Authenticating with Firebase..."
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    val user = auth.currentUser
                    if (user != null) {
                        val settings = SettingsRepository.getInstance(this)
                        settings.set(Settings.SET_FMDSERVER_ID, user.uid)

                        tvStatus.text = "Pairing... Sending FCM Token to Dashboard"
                        DashboardSync.uploadTokenIfPaired(this)

                        Snackbar.make(btnGoogleSignIn, "Paired! Connected as \${user.email}", Snackbar.LENGTH_LONG).show()
                        tvStatus.text = "Device is Paired!\nLogged in as \${user.email}"
                        
                        finish()
                    }
                } else {
                    val e = task.exception
                    log().w(TAG, "Firebase sign in failed: \${e?.message}")
                    Snackbar.make(btnGoogleSignIn, "Firebase Authentication Failed.", Snackbar.LENGTH_LONG).show()
                    tvStatus.text = "Firebase Auth Failed"
                }
            }
    }
}

package com.neubofy.veto.ui.settings

import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.neubofy.veto.R
import com.neubofy.veto.databinding.ActivityAboutBinding
import io.noties.markwon.Markwon
import io.noties.markwon.image.coil.CoilImagesPlugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

class AboutActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAboutBinding

    companion object {
        const val ABOUT_MD_URL = "https://raw.githubusercontent.com/pawanwashudev-official/Veto/main/README.md"
        private const val TAG = "AboutActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAboutBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val toolbar = binding.toolbar
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        try {
            val pInfo = packageManager.getPackageInfo(packageName, 0)
            val version = pInfo.versionName
            binding.tvVersion.text = "Version \$version"
        } catch (e: PackageManager.NameNotFoundException) {
            Log.e(TAG, "Error getting version: \${e.message}")
            binding.tvVersion.text = "Version Unknown"
        }

        loadAboutContent()
    }

    private fun loadAboutContent() {
        val prefs = getSharedPreferences("about_cache", MODE_PRIVATE)
        val cachedContent = prefs.getString("markdown_content", null)

        val markwon = Markwon.builder(this)
            .usePlugin(CoilImagesPlugin.create(this))
            .build()

        if (cachedContent != null) {
            markwon.setMarkdown(binding.tvMarkdownContent, cachedContent)
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val content = URL(ABOUT_MD_URL).readText()
                withContext(Dispatchers.Main) {
                    markwon.setMarkdown(binding.tvMarkdownContent, content)
                    prefs.edit().putString("markdown_content", content).apply()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading markdown: \${e.message}")
            }
        }
    }
}

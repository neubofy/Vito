package com.neubofy.veto.ui.settings

import android.app.LocaleConfig
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.annotation.RequiresApi
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.jakewharton.processphoenix.ProcessPhoenix
import com.neubofy.veto.R
import com.neubofy.veto.data.Settings
import com.neubofy.veto.data.SettingsRepository
import com.neubofy.veto.databinding.ActivityAppearanceBinding
import com.neubofy.veto.ui.FmdActivity
import com.neubofy.veto.ui.UiUtil.Companion.setupEdgeToEdgeAppBar
import com.neubofy.veto.ui.UiUtil.Companion.setupEdgeToEdgeScrollView
import com.neubofy.veto.utils.APP_LANGUAGES
import java.util.Locale

class AppearanceActivity : FmdActivity() {

    private lateinit var viewBinding: ActivityAppearanceBinding
    private lateinit var settings: SettingsRepository

    private val colorSpectrum = intArrayOf(
        0xD4AF37, // Gold
        0xFFD700, // Bright Gold
        0xFF5722, // Orange
        0xE91E63, // Pink
        0x9C27B0, // Purple
        0x2196F3, // Blue
        0x00BCD4, // Cyan
        0x4CAF50, // Green
        0x8BC34A, // Light Green
        0xCDDC39, // Lime
        0xFFEB3B, // Yellow
        0xFFC107, // Amber
        0x795548, // Brown
        0x9E9E9E, // Grey
        0x607D8B  // Blue Grey
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        settings = SettingsRepository.getInstance(this)

        viewBinding = ActivityAppearanceBinding.inflate(layoutInflater)
        setContentView(viewBinding.root)

        setupEdgeToEdgeAppBar(findViewById(R.id.appBar))
        setupEdgeToEdgeScrollView(findViewById(R.id.scrollView))
        
        setupColorSpectrum()
    }

    override fun onResume() {
        super.onResume()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            setupLanguageAndroid13AndAfter()
        } else {
            setupLanguageAndroid12AndBefore()
        }

        setupTheme()
        setupDynamicColors()
    }

    private fun setupColorSpectrum() {
        val container = viewBinding.colorSpectrumContainer
        val currentCustomColor = settings.get(Settings.SET_CUSTOM_COLOR) as Int
        
        val size = (48 * resources.displayMetrics.density).toInt()
        val margin = (8 * resources.displayMetrics.density).toInt()

        for (colorInt in colorSpectrum) {
            val colorView = View(this)
            val params = LinearLayout.LayoutParams(size, size)
            params.setMargins(margin, 0, margin, 0)
            colorView.layoutParams = params

            val shape = GradientDrawable()
            shape.shape = GradientDrawable.OVAL
            shape.setColor(Color.parseColor(String.format("#%06X", 0xFFFFFF and colorInt)))
            
            if (colorInt == currentCustomColor) {
                shape.setStroke(4, Color.WHITE)
            }
            
            colorView.background = shape
            colorView.setOnClickListener {
                settings.set(Settings.SET_CUSTOM_COLOR, colorInt)
                ProcessPhoenix.triggerRebirth(this)
            }
            container.addView(colorView)
        }
    }

    fun setupLanguageAndroid12AndBefore() {
        val availableLocales = APP_LANGUAGES.map { Locale.forLanguageTag(it) }
        setupLanguagePicker(availableLocales.toMutableList())
    }

    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
    fun setupLanguageAndroid13AndAfter() {
        val supportedLocales = LocaleConfig(this).supportedLocales!!
        val locales = mutableListOf<Locale>()
        for (i in 0 until supportedLocales.size()) {
            locales.add(supportedLocales.get(i))
        }
        setupLanguagePicker(locales)
    }

    fun setupLanguagePicker(locales: MutableList<Locale>) {
        locales.sortBy { it.displayName }
        val currentLocale = AppCompatDelegate.getApplicationLocales()
        viewBinding.textViewLanguage.text =
            currentLocale.get(0)?.displayLanguage?.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
                ?: getString(R.string.appearance_language_system_default)

        var checkedIdx = locales.indexOfFirst {
            it.toLanguageTag() == currentLocale.toLanguageTags()
        }
        checkedIdx += 1

        val names = locales.map { it.displayName.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() } }.toMutableList()
        names.add(0, getString(R.string.appearance_language_system_default))

        viewBinding.buttonEditLanguage.setOnClickListener {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.appearance_language_choose)
                .setSingleChoiceItems(names.toTypedArray(), checkedIdx) { _, idx ->
                    val newLocale = if (idx == 0) {
                        LocaleListCompat.getEmptyLocaleList()
                    } else {
                        val tag = locales[idx - 1].toLanguageTag()
                        LocaleListCompat.forLanguageTags(tag)
                    }
                    AppCompatDelegate.setApplicationLocales(newLocale)
                }
                .show()
        }
    }

    fun setupTheme() {
        val current = settings.get(Settings.SET_THEME) as String
        val resId = if (current == Settings.VAL_THEME_LIGHT) {
            R.string.appearance_theme_light
        } else if (current == Settings.VAL_THEME_DARK) {
            R.string.appearance_theme_dark
        } else {
            R.string.appearance_theme_follow_system
        }
        viewBinding.textViewTheme.text = getString(resId)
        setupThemePicker(current)
    }

    fun setupThemePicker(current: String) {
        val options = arrayOf(
            Settings.VAL_THEME_FOLLOW_SYSTEM,
            Settings.VAL_THEME_LIGHT,
            Settings.VAL_THEME_DARK
        )
        val optionsStrings = arrayOf(
            getString(R.string.appearance_theme_follow_system),
            getString(R.string.appearance_theme_light),
            getString(R.string.appearance_theme_dark),
        )
        val checkedIdx = options.indexOfFirst { it == current }

        viewBinding.buttonEditTheme.setOnClickListener {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.appearance_theme_choose)
                .setSingleChoiceItems(optionsStrings, checkedIdx) { _, idx ->
                    if (idx != checkedIdx) {
                        val new = options[idx]
                        settings.set(Settings.SET_THEME, new)
                        recreate()
                    }
                }
                .show()
        }
    }

    fun setupDynamicColors() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            viewBinding.switchDynamicColors.visibility = View.GONE
        }
        val isChecked = settings.get(Settings.SET_DYNAMIC_COLORS) as Boolean
        viewBinding.switchDynamicColors.isChecked = isChecked
        viewBinding.switchDynamicColors.setOnCheckedChangeListener { _, newChecked ->
            if (newChecked != isChecked) {
                settings.set(Settings.SET_DYNAMIC_COLORS, newChecked)
                ProcessPhoenix.triggerRebirth(this)
            }
        }
    }
}

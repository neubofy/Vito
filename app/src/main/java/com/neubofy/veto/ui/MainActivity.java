package com.neubofy.veto.ui;

import static com.neubofy.veto.ui.SetupWarningsActivityKt.shouldShowSetupWarnings;
import static com.neubofy.veto.ui.UiUtil.setupEdgeToEdgeAppBar;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;

import androidx.annotation.NonNull;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import com.neubofy.veto.BuildConfig;
import com.neubofy.veto.R;
import com.neubofy.veto.data.Settings;
import com.neubofy.veto.data.SettingsRepository;
import com.neubofy.veto.services.TempContactExpiredService;
import com.neubofy.veto.ui.home.MainPageFragment;
import com.neubofy.veto.ui.onboarding.UpdateboardingModernCryptoActivity;
import com.neubofy.veto.ui.settings.SettingsActivity;
import kotlin.Unit;

public class MainActivity extends FmdActivity {

    SettingsRepository settings;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_main);

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setOnMenuItemClickListener(this::onOptionsItemSelected);
        setSupportActionBar(toolbar);

        setupEdgeToEdgeAppBar(findViewById(R.id.appBar));

        settings = SettingsRepository.Companion.getInstance(this);
        settings.load();

        if (((Integer) settings.get(Settings.SET_APP_CRASHED_LOG_ENTRY)) == 1) {
            startActivity(new Intent(this, CrashedActivity.class));
            finish();
            return;
        }

        if (!(Boolean) settings.get(Settings.SET_UPDATEBOARDING_MODERN_CRYPTO_COMPLETED)) {
            startActivity(new Intent(this, UpdateboardingModernCryptoActivity.class));
            finish();
            return;
        }

        if (savedInstanceState == null) {
            getSupportFragmentManager().beginTransaction()
                    .replace(R.id.fragment_container, new MainPageFragment())
                    .commit();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        TempContactExpiredService.scheduleJob(this, 0);
        invalidateOptionsMenu();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.main_app_bar, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.menuItemSetupWarnings) {
            startActivity(new Intent(this, SetupWarningsActivity.class));
            return true;
        } else if (item.getItemId() == R.id.menuItemSettings) {
            // Need to wrap SettingsFragment in an activity or handle it
            startActivity(new Intent(this, SettingsActivity.class));
            return true;
        }
        return super.onOptionsItemSelected(item);
    }


}

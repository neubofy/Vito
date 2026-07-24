package com.neubofy.veto.ui.settings;

import static com.neubofy.veto.commands.CommandHandlerKt.availableCommands;
import static com.neubofy.veto.ui.UiUtil.setupEdgeToEdgeAppBar;
import static com.neubofy.veto.ui.UiUtil.setupEdgeToEdgeScrollView;
import static com.neubofy.veto.utils.CypherUtils.MIN_PASSWORD_LENGTH;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import com.neubofy.veto.R;
import com.neubofy.veto.data.EncryptedSettingsRepository;
import com.neubofy.veto.data.Settings;
import com.neubofy.veto.data.SettingsRepository;
import com.neubofy.veto.ui.VetoActivity;
import com.neubofy.veto.ui.common.PasswordSetDialog;
import kotlin.Unit;

public class VetoConfigActivity extends VetoActivity implements CompoundButton.OnCheckedChangeListener, TextWatcher {

    private SettingsRepository settings;
    private EncryptedSettingsRepository encSettings;

    private CheckBox checkBoxDeviceWipe;
    private CheckBox checkBoxAccessViaPin;
    private Button buttonEnterPin;
    private Button buttonSelectRingtone;
    private Button buttonDeletePassword;
    private EditText editTextLockScreenMessage;
    private EditText editTextVetoCommand;
    
    private com.google.android.material.materialswitch.MaterialSwitch switchAutoUpload;
    private Button buttonManualLocate;

    int colorEnabled;
    int colorDisabled;
    int textColorEnabled;
    int textColorDisabled;

    private static final int REQUEST_CODE_RINGTONE = 5;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_veto_config);

        setupEdgeToEdgeAppBar(findViewById(R.id.appBar));
        setupEdgeToEdgeScrollView(findViewById(R.id.scrollView));

        settings = SettingsRepository.Companion.getInstance(this);
        encSettings = EncryptedSettingsRepository.Companion.getInstance(this);

        checkBoxDeviceWipe = findViewById(R.id.checkBoxWipeData);
        checkBoxDeviceWipe.setChecked((Boolean) settings.get(Settings.SET_WIPE_ENABLED));
        checkBoxDeviceWipe.setOnCheckedChangeListener(this);

        checkBoxAccessViaPin = findViewById(R.id.checkBoxVetoviaPin);
        checkBoxAccessViaPin.setChecked((Boolean) settings.get(Settings.SET_ACCESS_VIA_PIN));
        checkBoxAccessViaPin.setOnCheckedChangeListener(this);

        editTextLockScreenMessage = findViewById(R.id.editTextTextLockScreenMessage);
        editTextLockScreenMessage.setText((String) settings.get(Settings.SET_LOCKSCREEN_MESSAGE));
        editTextLockScreenMessage.addTextChangedListener(this);

        colorEnabled = getColor(R.color.colorPrimary);
        colorDisabled = getColor(R.color.md_theme_error);
        textColorEnabled = getColor(R.color.md_theme_onPrimary);
        textColorDisabled = getColor(R.color.md_theme_onError);

        buttonEnterPin = findViewById(R.id.buttonEnterPin);
        buttonEnterPin.setOnClickListener(this::onEnterPinClicked);
        updatePinButton();

        buttonSelectRingtone = findViewById(R.id.buttonSelectRingTone);
        buttonSelectRingtone.setOnClickListener(this::onSelectRingtoneClicked);

        editTextVetoCommand = findViewById(R.id.editTextVetoCommand);
        editTextVetoCommand.setText((String) settings.get(Settings.SET_Veto_COMMAND));
        editTextVetoCommand.addTextChangedListener(this);

        buttonDeletePassword = findViewById(R.id.buttonDeletePassword);
        buttonDeletePassword.setOnClickListener(this::onEnterDeletePasswordClicked);
        updateDeletePasswordButton();

        switchAutoUpload = findViewById(R.id.switchAutoUpload);
        android.widget.CompoundButton.OnCheckedChangeListener autoUploadListener = new android.widget.CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(android.widget.CompoundButton buttonView, boolean isChecked) {
                if (isChecked) {
                    CharSequence[] options = new CharSequence[]{"15 Minutes", "30 Minutes", "1 Hour", "2 Hours", "6 Hours"};
                    int[] values = new int[]{15, 30, 60, 120, 360};
                    
                    int currentVal = (int) settings.get(Settings.SET_VetoSERVER_UPDATE_TIME);
                    int defaultSelection = 0;
                    for (int i = 0; i < values.length; i++) {
                        if (values[i] == currentVal) {
                            defaultSelection = i;
                            break;
                        }
                    }

                    new com.google.android.material.dialog.MaterialAlertDialogBuilder(VetoConfigActivity.this)
                        .setTitle("Select Update Interval")
                        .setCancelable(false)
                        .setSingleChoiceItems(options, defaultSelection, (dialog, which) -> {
                            settings.set(Settings.SET_VetoSERVER_UPDATE_TIME, values[which]);
                            startAutoLoc();
                            dialog.dismiss();
                        })
                        .setNegativeButton("Cancel", (dialog, which) -> {
                            switchAutoUpload.setOnCheckedChangeListener(null);
                            switchAutoUpload.setChecked(false);
                            switchAutoUpload.setOnCheckedChangeListener(this);
                        })
                        .show();
                } else {
                    stopAutoLoc();
                }
            }
        };

        switchAutoUpload.setChecked(isAutoLocActive());
        switchAutoUpload.setOnCheckedChangeListener(autoUploadListener);

        buttonManualLocate = findViewById(R.id.buttonManualLocate);
        buttonManualLocate.setOnClickListener(v -> manualUpdateLocation());
    }

    private boolean isAutoLocActive() {
        try {
            return androidx.work.WorkManager.getInstance(this)
                .getWorkInfosForUniqueWork(com.neubofy.veto.commands.AutoLocCommand.WORK_NAME)
                .get()
                .stream()
                .anyMatch(info -> info.getState() == androidx.work.WorkInfo.State.ENQUEUED || info.getState() == androidx.work.WorkInfo.State.RUNNING);
        } catch (Exception e) {
            return false;
        }
    }

    private void startAutoLoc() {
        try {
            int intervalMinutes = (int) settings.get(Settings.SET_VetoSERVER_UPDATE_TIME);
            String locateCommand = settings.get(Settings.SET_Veto_COMMAND).toString() + " locate gps";

            androidx.work.Data inputData = new androidx.work.Data.Builder()
                .putString(com.neubofy.veto.workers.CommandExecutionWorker.KEY_COMMAND, locateCommand)
                .putString(com.neubofy.veto.workers.CommandExecutionWorker.KEY_TRANSPORT_TYPE, com.neubofy.veto.workers.CommandExecutionWorker.TRANS_Veto_SERVER)
                .putString(com.neubofy.veto.workers.CommandExecutionWorker.KEY_DESTINATION, "Background_Upload")
                .build();

            androidx.work.PeriodicWorkRequest periodicWork = new androidx.work.PeriodicWorkRequest.Builder(
                com.neubofy.veto.workers.CommandExecutionWorker.class,
                intervalMinutes,
                java.util.concurrent.TimeUnit.MINUTES
            ).setInputData(inputData).build();

            androidx.work.WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                com.neubofy.veto.commands.AutoLocCommand.WORK_NAME,
                androidx.work.ExistingPeriodicWorkPolicy.UPDATE,
                periodicWork
            );
            Toast.makeText(this, "Background Location Upload Started", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Error starting: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            switchAutoUpload.setChecked(false);
        }
    }

    private void stopAutoLoc() {
        androidx.work.WorkManager.getInstance(this).cancelUniqueWork(com.neubofy.veto.commands.AutoLocCommand.WORK_NAME);
        Toast.makeText(this, "Background Location Upload Stopped", Toast.LENGTH_SHORT).show();
    }

    private void manualUpdateLocation() {
        Toast.makeText(this, "Locating...", Toast.LENGTH_SHORT).show();
        SettingsRepository settings = SettingsRepository.Companion.getInstance(this);
        String locateCommand = (String) settings.get(com.neubofy.veto.data.Settings.SET_Veto_COMMAND) + " locate gps";
        
        androidx.work.Data inputData = new androidx.work.Data.Builder()
                .putString(com.neubofy.veto.workers.CommandExecutionWorker.KEY_COMMAND, locateCommand)
                .putString(com.neubofy.veto.workers.CommandExecutionWorker.KEY_TRANSPORT_TYPE, com.neubofy.veto.workers.CommandExecutionWorker.TRANS_Veto_SERVER)
                .putString(com.neubofy.veto.workers.CommandExecutionWorker.KEY_DESTINATION, "Manual_Upload")
                .build();

        androidx.work.WorkRequest workRequest = new androidx.work.OneTimeWorkRequest.Builder(com.neubofy.veto.workers.CommandExecutionWorker.class)
                .setInputData(inputData)
                .build();

        androidx.work.WorkManager.getInstance(this).enqueue(workRequest);
    }

    @Override
    public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
        if (buttonView == checkBoxDeviceWipe) {
            settings.set(Settings.SET_WIPE_ENABLED, isChecked);
            updateDeletePasswordButton();
        } else if (buttonView == checkBoxAccessViaPin) {
            settings.set(Settings.SET_ACCESS_VIA_PIN, isChecked);
            updatePinButton();
        }
    }

    @Override
    public void beforeTextChanged(CharSequence s, int start, int count, int after) {
        // unused
    }

    @Override
    public void onTextChanged(CharSequence s, int start, int before, int count) {
        // unused
    }

    @Override
    public void afterTextChanged(Editable edited) {
        if (edited == editTextLockScreenMessage.getText()) {
            settings.set(Settings.SET_LOCKSCREEN_MESSAGE, edited.toString());
        } else if (edited == editTextVetoCommand.getText()) {
            if (edited.toString().isEmpty()) {
                Toast.makeText(this, getString(R.string.Toast_Empty_LCLDCommand), Toast.LENGTH_LONG).show();
                settings.set(Settings.SET_Veto_COMMAND, "veto");
            } else {
                settings.set(Settings.SET_Veto_COMMAND, edited.toString().toLowerCase());
            }
        }
    }

    private void onEnterPinClicked(View v) {
        Context context = v.getContext();
        View pinLayout = getLayoutInflater().inflate(R.layout.dialog_pin, null);

        EditText editTextPin = pinLayout.findViewById(R.id.editTextPin);

        new MaterialAlertDialogBuilder(context)
                .setTitle(getString(R.string.Settings_Enter_Pin))
                .setView(pinLayout)
                .setPositiveButton(getString(R.string.Ok), new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int whichButton) {
                        String pin = editTextPin.getText().toString();

                        if (pin.isBlank()) {
                            encSettings.setVetoPin(null);
                        }
                        // The PIN must not match a command keyword.
                        // Otherwise, we cannot (easily) distinguish between the PIN and the command.
                        // Also, it would be a weak PIN anyway.
                        else if (
                                availableCommands(context).stream().anyMatch(cmd -> cmd.getKeyword().equals(pin))
                        ) {
                            Toast.makeText(context, R.string.pin_match_command_keyword, Toast.LENGTH_LONG).show();
                        } else if (pin.length() < MIN_PASSWORD_LENGTH) {
                            Toast.makeText(context, R.string.pin_min_length, Toast.LENGTH_LONG).show();
                        } else {
                            encSettings.setVetoPin(pin);
                        }

                        updatePinButton();
                    }
                })
                .show();
    }

    private void onEnterDeletePasswordClicked(View v) {
        new PasswordSetDialog(v.getContext(), (newPassword) -> {
            encSettings.setDeletePassword(newPassword);
            updateDeletePasswordButton();
            return Unit.INSTANCE;
        }).show();
    }

    private void onSelectRingtoneClicked(View v) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, getString(R.string.Settings_Select_Ringtone));
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse((String) settings.get(Settings.SET_RINGER_TONE)));
        try {
            this.startActivityForResult(intent, REQUEST_CODE_RINGTONE);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, getString(R.string.Settings_no_ringtone_picker), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(final int requestCode, final int resultCode, final Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        if (resultCode == Activity.RESULT_OK && requestCode == REQUEST_CODE_RINGTONE) {
            Uri uri = intent.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
            settings.set(Settings.SET_RINGER_TONE, uri.toString());
        }
    }

    private void updatePinButton() {
        String pin = encSettings.getVetoPin();
        if (pin == null || pin.isBlank()) {
            buttonEnterPin.setBackgroundColor(colorDisabled);
            buttonEnterPin.setTextColor(textColorDisabled);
            buttonEnterPin.setText(R.string.Settings_Set_Pin);
        } else {
            buttonEnterPin.setBackgroundColor(colorEnabled);
            buttonEnterPin.setTextColor(textColorEnabled);
            buttonEnterPin.setText(R.string.Settings_Change_Pin);
        }
    }

    private void updateDeletePasswordButton() {
        boolean enabled = (boolean) settings.get(Settings.SET_WIPE_ENABLED);
        String password = encSettings.getDeletePassword();
        boolean isPasswordEmpty = password == null || password.isBlank();

        TextView textViewDeletePasswordWarning = findViewById(R.id.textViewDeletePasswordWarning);

        if (isPasswordEmpty) {
            buttonDeletePassword.setBackgroundColor(colorDisabled);
            buttonDeletePassword.setTextColor(textColorDisabled);
            buttonDeletePassword.setText(R.string.password_set);
        } else {
            buttonDeletePassword.setBackgroundColor(colorEnabled);
            buttonDeletePassword.setTextColor(textColorEnabled);
            buttonDeletePassword.setText(R.string.password_change);
        }

        if (enabled && isPasswordEmpty) {
            textViewDeletePasswordWarning.setVisibility(View.VISIBLE);
        } else {
            textViewDeletePasswordWarning.setVisibility(View.GONE);
        }
    }

}
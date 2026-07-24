package com.neubofy.veto.ui.settings;

import static com.neubofy.veto.ui.UiUtil.setupEdgeToEdge;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import com.neubofy.veto.R;
import com.neubofy.veto.data.AllowlistRepository;
import com.neubofy.veto.data.Contact;
import com.neubofy.veto.data.Settings;
import com.neubofy.veto.data.SettingsRepository;
import com.neubofy.veto.ui.FmdActivity;
import com.neubofy.veto.ui.allowlist.AllowlistAdapter;
import kotlin.Unit;


public class AllowlistActivity extends FmdActivity {

    private AllowlistRepository allowlistRepository;
    private SettingsRepository settings;

    private AllowlistAdapter allowlistAdapter;

    private TextView textWhitelistEmpty;

    private static final int REQUEST_CODE = 6438;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_allowlist);

        setupEdgeToEdge(findViewById(android.R.id.content));

        allowlistRepository = AllowlistRepository.Companion.getInstance(this);
        settings = SettingsRepository.Companion.getInstance(this);

        allowlistAdapter = new AllowlistAdapter(this::onDeleteContact);
        RecyclerView recyclerView = findViewById(R.id.recycler_allowlist);
        recyclerView.setAdapter(allowlistAdapter);

        textWhitelistEmpty = findViewById(R.id.whitelistEmpty);
        findViewById(R.id.buttonAddContact).setOnClickListener(this::onAddContactClicked);
        findViewById(R.id.buttonAddPhoneNumber).setOnClickListener(this::onAddPhoneNumberClicked);

        updateScreen();
    }

    private void updateScreen() {
        if (allowlistRepository.getList().isEmpty()) {
            textWhitelistEmpty.setVisibility(View.VISIBLE);
        } else {
            textWhitelistEmpty.setVisibility(View.GONE);
        }

        allowlistAdapter.submitContactList(allowlistRepository.getList());
    }

    private void onAddPhoneNumberClicked(View v) {
        Context context = v.getContext();
        View layout = getLayoutInflater().inflate(R.layout.dialog_phone_number, null);
        EditText nameInput = layout.findViewById(R.id.editTextName);
        EditText phoneNumberInput = layout.findViewById(R.id.editTextPhoneNumber);

        new MaterialAlertDialogBuilder(context)
                .setTitle(context.getString(R.string.allowlist_add_phone_number))
                .setView(layout)
                .setPositiveButton(getString(R.string.add), (dialog, whichButton) -> {
                    String name = nameInput.getText().toString();
                    String number = phoneNumberInput.getText().toString();
                    Contact dummyContact = Contact.from(context, name, number);
                    addContactToAllowList(dummyContact);
                })
                .setNegativeButton(getString(R.string.cancel), null)
                .show();
    }

    private void onAddContactClicked(View v) {
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(intent, REQUEST_CODE);
        } catch (ActivityNotFoundException e) {
            intent = new Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(intent, REQUEST_CODE);
            } catch (ActivityNotFoundException e2) {
                Toast.makeText(this, getString(R.string.WhiteList_no_contact_picker), Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onActivityResult(int reqCode, int resultCode, Intent data) {
        super.onActivityResult(reqCode, resultCode, data);
        switch (reqCode) {
            case (REQUEST_CODE):
                if (resultCode == Activity.RESULT_OK) {
                    // Multiple items selected
                    ClipData clipData = data.getClipData();
                    if (clipData != null) {
                        int count = clipData.getItemCount();
                        for (int i = 0; i < count; i++) {
                            ClipData.Item item = clipData.getItemAt(i);
                            Uri uri = item.getUri();
                            if (uri != null) {
                                addContactFromUri(uri);
                            }
                        }
                    }

                    // Single item selected
                    Uri uri = data.getData();
                    if (uri != null) {
                        addContactFromUri(uri);
                    }
                }
                break;
            default:
                throw new IllegalStateException("Unexpected value: " + reqCode);
        }
    }

    private void addContactFromUri(Uri uri) {
        String[] projection = new String[]{
                ContactsContract.Contacts.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
        };
        Cursor cursor = getContentResolver().query(uri, projection, null, null, null);

        if (cursor == null || !cursor.moveToFirst()) {
            if (cursor != null) cursor.close();
            // cursor is empty
            return;
        }
        try {
            do {
                int nameIdx = cursor.getColumnIndex(ContactsContract.Data.DISPLAY_NAME);
                int numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                
                String cName = nameIdx >= 0 ? cursor.getString(nameIdx) : "";
                String cNumber = numIdx >= 0 ? cursor.getString(numIdx) : "";

                Contact contact = Contact.from(this, cName, cNumber);
                if (contact != null) {
                    addContactToAllowList(contact);
                }
            } while (cursor.moveToNext());
        } finally {
            cursor.close();
        }
    }

    private void addContactToAllowList(@Nullable Contact contact) {
        if (contact == null) {
            Toast.makeText(this, R.string.allowlist_invalid_number, Toast.LENGTH_LONG).show();
        } else {
            if (!allowlistRepository.contains(contact)) {
                allowlistRepository.add(contact);
                updateScreen();

                if (!(Boolean) settings.get(Settings.SET_FIRST_TIME_CONTACT_ADDED)) {
                    String keyword = (String) settings.get(Settings.SET_FMD_COMMAND);
                    String message = getString(R.string.tip_first_contact_added, keyword, keyword, keyword);
                    new MaterialAlertDialogBuilder(this)
                            .setMessage(message)
                            .setCancelable(false)
                            .setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                                public void onClick(DialogInterface dialog, int which) {
                                    settings.set(Settings.SET_FIRST_TIME_CONTACT_ADDED, true);
                                }
                            })
                            .show();
                }
            } else {
                Toast.makeText(this, R.string.Toast_Duplicate_contact, Toast.LENGTH_LONG).show();
            }
        }
    }

    private Unit onDeleteContact(String phoneNumber) {
        allowlistRepository.remove(phoneNumber);
        updateScreen();
        // make Kotlin-interop happy
        return null;
    }

}
package com.neubofy.veto.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import com.neubofy.veto.R
import com.neubofy.veto.commands.availableCommands
import com.neubofy.veto.data.Settings
import com.neubofy.veto.data.SettingsRepository
import com.neubofy.veto.ui.TaggedFragment

class SmsCommandsFragment : TaggedFragment() {

    override fun getStaticTag() = "SmsCommandsFragment"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_sms_commands, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val settings = SettingsRepository.getInstance(requireContext())
        val prefix = settings.get(Settings.SET_FMD_COMMAND) as String

        val textAllowed = view.findViewById<TextView>(R.id.text_sms_format_allowed)
        textAllowed.text = "From Allowed Contact:\n$prefix [command]"

        val textUnrecognized = view.findViewById<TextView>(R.id.text_sms_format_unrecognized)
        textUnrecognized.text = "From Unrecognized Contact:\n$prefix [PIN] [command]"

        val commandListAdapter = CommandListAdapter(activity as AppCompatActivity)
        val recyclerView = view.findViewById<RecyclerView>(R.id.recycler_commands)
        recyclerView.adapter = commandListAdapter

        commandListAdapter.submitList(availableCommands(requireContext()))
    }
}

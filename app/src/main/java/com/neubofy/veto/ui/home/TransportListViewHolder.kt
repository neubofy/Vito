package com.neubofy.veto.ui.home

import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.neubofy.veto.R
import com.neubofy.veto.transports.Transport
import com.neubofy.veto.ui.setupPermissionsList


class TransportListViewHolder(
    private val activity: AppCompatActivity,
    itemView: View,
) : RecyclerView.ViewHolder(itemView) {

    fun bind(item: Transport<*>) {
        val context = itemView.context

        itemView.findViewById<TextView>(R.id.title).apply {
            text = context.getString(item.title)
            val drawable = ContextCompat.getDrawable(context, item.icon)
            setCompoundDrawablesRelativeWithIntrinsicBounds(drawable, null, null, null)
        }

        itemView.findViewById<TextView>(R.id.description).text = item.description

        val authString = item.descriptionAuth
        if (authString == null) {
            itemView.findViewById<View>(R.id.description_auth).visibility = View.GONE
        } else {
            itemView.findViewById<TextView>(R.id.description_auth).text = authString
            itemView.findViewById<View>(R.id.description_auth).visibility = View.VISIBLE
        }

        val noteString = item.descriptionNote
        if (noteString == null) {
            itemView.findViewById<View>(R.id.description_note).visibility = View.GONE
        } else {
            itemView.findViewById<TextView>(R.id.description_note).text = noteString
            itemView.findViewById<View>(R.id.description_note).visibility = View.VISIBLE
        }

        val permReqTitle = itemView.findViewById<TextView>(R.id.permissions_required_title)
        val permReqList = itemView.findViewById<LinearLayout>(R.id.permissions_required_list)
        setupPermissionsList(activity, permReqTitle, permReqList, item.requiredPermissions, true)

        setupActions(item)
    }

    private fun setupActions(item: Transport<*>) {
        val context = itemView.context

        val actions = item.actions
        val actionsLayout = itemView.findViewById<LinearLayout>(R.id.actions_list)

        if (actions.isEmpty()) {
            actionsLayout.visibility = View.GONE
        } else {
            actionsLayout.visibility = View.VISIBLE
            actionsLayout.removeAllViews()

            val inflater = LayoutInflater.from(context)
            for (a in actions) {
                val view = inflater.inflate(R.layout.item_transport_action, actionsLayout, true)
                view.findViewById<Button>(R.id.action_button).apply {
                    text = context.getString(a.titleResourceId)
                    setOnClickListener { _ -> a.run(activity) }
                }
            }
        }
    }
}

"use strict";

module.exports = [
  { id: "home_title", render: (ctx) =>
    `# 🎫 Ticket System ${ctx.animada}\nHii! I'm Ayami ${ctx.corao} and I'll help you set up support on your server!` },
  { id: "btn_panels", render: (ctx) => `📋 Panels (${ctx.count})` },
  { id: "btn_new_panel", render: () => "✨ New Panel" },

  { id: "no_panels_title", render: (ctx) => `# 📋 Your Panels ${ctx.emburrada}\nNo panels yet... shall we create the first one?` },
  { id: "panels_title", render: (ctx) => `# 📋 Your Panels (${ctx.count}) ${ctx.feliz}\n${ctx.list}` },
  { id: "select_which_panel", render: () => "✨ Which panel do you want to see?" },
  { id: "panel_hub_multi", render: () => "Select Menu" },
  { id: "panel_hub_single", render: () => "Single button" },
  { id: "panel_option_desc", render: (ctx) => `${ctx.staffCount} staff • ${ctx.hubLabel}` },
  { id: "btn_back", render: () => "⬅️ Back" },

  { id: "modal_create_panel_title", render: () => "Create Ticket Panel ✨" },
  { id: "modal_panel_id_label", render: () => "Panel ID (no spaces)" },
  { id: "modal_panel_id_placeholder", render: () => "support, reports, partnerships..." },
  { id: "invalid_id", render: () => "❌ Invalid ID!" },
  { id: "panel_id_exists", render: (ctx) => `${ctx.emburrada} A panel with ID **${ctx.panelId}** already exists.` },

  { id: "panel_not_found", render: (ctx) => `# ${ctx.emduvida} I couldn't find that panel...\nIt might have been deleted!` },
  { id: "opt_edit_embed", render: () => "🎨 Edit Embed" },
  { id: "opt_create_embed", render: () => "✨ Create Embed" },
  { id: "opt_embed_desc", render: () => "The look of your panel" },
  { id: "opt_channel_category", render: () => "📌 Channel & Category" },
  { id: "opt_configured", render: () => "Already set up" },
  { id: "opt_not_configured", render: () => "Not set up yet" },
  { id: "opt_staff_name", render: () => "👥 Staff & Name" },
  { id: "opt_staff_name_desc", render: () => "Who handles it and what the ticket is called" },
  { id: "opt_creation_type", render: () => "⚙️ Creation Type" },
  { id: "opt_modal", render: () => "📋 Modal" },
  { id: "opt_active", render: () => "Active" },
  { id: "opt_inactive", render: () => "Inactive" },
  { id: "opt_seqform", render: () => "📝 Sequential Form" },
  { id: "opt_autorole", render: () => "🏷️ Auto-Role" },
  { id: "opt_transcript", render: () => "📄 Transcript" },
  { id: "opt_selecthub", render: () => "🧩 Select Menu" },
  { id: "opt_selecthub_desc", render: (ctx) => `${ctx.count} option(s)` },
  { id: "opt_messages", render: () => "💬 Messages" },
  { id: "opt_messages_desc", render: () => "Make it all yours!" },
  { id: "select_what_configure", render: () => "✨ What do you want to configure?" },
  { id: "btn_publish", render: () => "🚀 Publish" },
  { id: "btn_delete", render: () => "🗑️ Delete" },
  { id: "embed_ready", render: () => "ready!" },
  { id: "embed_missing", render: () => "still needs to be created" },
  { id: "no_channel_chosen", render: () => "not chosen" },
  { id: "no_staff_yet", render: () => "no one yet" },
  { id: "panel_header", render: (ctx) =>
    `# 🎫 ${ctx.panelId} ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> 🎨 Embed: ${ctx.embedStatus}\n` +
    `> 📌 Channel: ${ctx.channelStatus}\n` +
    `> 👥 Staff: ${ctx.staffStatus}` +
    (ctx.cv2Active ? `\n> 🧱 Layout: **Components V2** (configured on the Dashboard — edit it there)` : '') },
  { id: "embed_updated", render: (ctx) => `${ctx.curtida} It turned out lovely!` },
  { id: "embed_removed", render: (ctx) => `${ctx.emduvida} Removed the embed.` },
  { id: "embed_title_prefix", render: (ctx) => `Embed — ${ctx.panelId}` },

  { id: "confirm_delete_title", render: (ctx) => `# ${ctx.assustada} Delete this panel?\nAre you sure? This can't be undone...` },
  { id: "btn_confirm_delete", render: () => "✅ Yes, delete" },
  { id: "btn_cancel", render: () => "❌ Cancel" },

  { id: "publish_no_channel", render: (ctx) => `${ctx.emduvida} Pick a channel first, okay?` },
  { id: "publish_no_embed", render: (ctx) => `${ctx.emduvida} You still need to create the embed!` },
  { id: "select_service_type_placeholder", render: () => "Select the type of support" },
  { id: "open_ticket_button", render: () => "🎫 Open Ticket" },
  { id: "publish_success", render: (ctx) => `${ctx.festa} All set! Published in <#${ctx.channelId}>~` },

  { id: "destino_channel_placeholder", render: () => "📌 Channel where the panel will be sent" },
  { id: "destino_category_placeholder", render: () => "📂 Category where tickets will be created" },
  { id: "destino_title", render: (ctx) =>
    `# 📌 Channel & Category ${ctx.feliz}\n` +
    `> 📢 Channel: ${ctx.channelStatus}\n` +
    `> 📂 Category: ${ctx.categoryStatus}` },
  { id: "destino_none_channel", render: () => "none yet" },
  { id: "destino_none_category", render: () => "none yet" },

  { id: "staff_role_select_placeholder", render: () => "👥 Add staff role" },
  { id: "btn_clear_staff", render: () => "🧹 Clear Staff" },
  { id: "btn_ticket_name", render: () => "✏️ Ticket Name" },
  { id: "ask_ticket_name", render: (ctx) => `${ctx.pensando} What should the ticket be called?\nUse \`{count}\` for the number. E.g.: \`ticket-{count}\`` },
  { id: "staff_title", render: (ctx) =>
    `# 👥 Staff & Name ${ctx.feliz}\n` +
    `> 🛡️ Staff: ${ctx.staffStatus}\n` +
    `> 🏷️ Name: \`${ctx.name}\`` },

  { id: "tipo_label_channel", render: () => "📁 Text Channel" },
  { id: "tipo_label_thread_public", render: () => "🧵 Public Thread" },
  { id: "tipo_label_thread_private", render: () => "🔒 Private Thread" },
  { id: "tipo_select_placeholder", render: () => "Select creation type" },
  { id: "tipo_current_label", render: () => "✅ Current" },
  { id: "tipo_title", render: (ctx) => `# ⚙️ Creation Type ${ctx.feliz}\nHow is the ticket created? Current: ${ctx.current}` },

  { id: "modal_no_fields", render: () => "_No fields added_" },
  { id: "modal_field_short", render: () => "short" },
  { id: "modal_field_paragraph", render: () => "paragraph" },
  { id: "modal_field_required_tag", render: () => " *required*" },
  { id: "btn_toggle_modal_off", render: () => "⏸️ Disable Modal" },
  { id: "btn_toggle_modal_on", render: () => "▶️ Enable Modal" },
  { id: "btn_modal_title", render: () => "✏️ Modal Title" },
  { id: "ask_modal_title", render: (ctx) => `${ctx.pensando} What's the modal's title?` },
  { id: "btn_add_field", render: () => "➕ Add Field" },
  { id: "btn_remove_field", render: () => "🗑️ Remove Last Field" },
  { id: "modal_title_default", render: () => "Support Form" },
  { id: "modal_header", render: (ctx) =>
    `# 📋 Modal ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `Shows up when someone clicks Open Ticket!\n` +
    `> Status: ${ctx.status}\n` +
    `> Title: \`${ctx.title}\`\n\n` +
    `**Fields (${ctx.count}/5):**\n${ctx.list}` },
  { id: "modal_header_option", render: (ctx) =>
    `# 📋 Modal — ${ctx.optionLabel} ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> Status: ${ctx.status}\n` +
    `> Title: \`${ctx.title}\`\n\n` +
    `**Fields (${ctx.count}/5):**\n${ctx.list}` },
  { id: "status_on", render: () => "🟢 Active" },
  { id: "status_off", render: () => "🔴 Inactive" },

  { id: "add_field_modal_title", render: () => "Add Modal Field" },
  { id: "field_label_label", render: () => "Field question/label" },
  { id: "field_placeholder_label", render: () => "Placeholder (optional)" },
  { id: "field_style_label", render: () => "Style: short or paragraph" },
  { id: "field_style_placeholder", render: () => "short" },
  { id: "field_required_label", render: () => "Required? (yes/no)" },
  { id: "field_required_placeholder", render: () => "yes" },
  { id: "field_added", render: (ctx) => `${ctx.curtida} Field added!` },

  { id: "seq_no_questions", render: () => "_No questions added_" },
  { id: "seq_question_required_tag", render: () => " *required*" },
  { id: "btn_toggle_form_off", render: () => "⏸️ Disable Form" },
  { id: "btn_toggle_form_on", render: () => "▶️ Enable Form" },
  { id: "btn_add_question", render: () => "➕ Add Question" },
  { id: "btn_remove_question", render: () => "🗑️ Remove Last" },
  { id: "timeout_30s", render: () => "30 seconds" },
  { id: "timeout_1m", render: () => "1 minute" },
  { id: "timeout_2m", render: () => "2 minutes" },
  { id: "timeout_5m", render: () => "5 minutes" },
  { id: "timeout_10m", render: () => "10 minutes" },
  { id: "timeout_custom", render: () => "✏️ Custom (type it in)" },
  { id: "timeout_select_placeholder", render: (ctx) => `⏱️ Time per question — Current: ${ctx.seconds}s` },
  { id: "ask_custom_seconds", render: (ctx) => `${ctx.pensando} How many **seconds** will the user have to answer each question? *(5 to 600)*` },
  { id: "invalid_seconds", render: (ctx) => `${ctx.emduvida} Invalid value! Use between 5 and 600 seconds.` },
  { id: "send_mode_only_ticket", render: () => "🎫 Only in the ticket" },
  { id: "send_mode_log_channel", render: () => "📋 Log channel" },
  { id: "selected_label", render: () => "Selected" },
  { id: "send_mode_select_placeholder", render: () => "📤 Where should answers be sent?" },
  { id: "log_channel_select_placeholder", render: () => "📋 Log channel for answers" },
  { id: "seq_header", render: (ctx) =>
    `# 📝 Sequential Form ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `I'll ask the questions in chat, one at a time!\n` +
    `> Status: ${ctx.status}\n` +
    `> Time per question: ${ctx.seconds}s\n` +
    `> Summary goes to: ${ctx.destination}\n\n` +
    `**Questions (${ctx.count}/${ctx.max}):**\n${ctx.list}` },
  { id: "seq_header_option", render: (ctx) =>
    `# 📝 Sequential Form — ${ctx.optionLabel} ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> Status: ${ctx.status}\n` +
    `> Time per question: ${ctx.seconds}s\n` +
    `> Summary goes to: ${ctx.destination}\n\n` +
    `**Questions (${ctx.count}/${ctx.max}):**\n${ctx.list}` },
  { id: "seq_dest_own_ticket", render: () => "🎫 the ticket itself" },
  { id: "question_added", render: (ctx) => `${ctx.curtida} Question added!` },

  { id: "question_type_select_placeholder", render: () => "What type is this question?" },
  { id: "qtype_short_label", render: () => "📝 Short text" },
  { id: "qtype_short_desc", render: () => "Answer up to ~100 characters" },
  { id: "qtype_long_label", render: () => "📄 Long text" },
  { id: "qtype_long_desc", render: () => "Answer up to 2000 characters" },
  { id: "qtype_number_label", render: () => "🔢 Number" },
  { id: "qtype_number_desc", render: () => "Only accepts numbers" },
  { id: "qtype_yesno_label", render: () => "✅ Yes/No" },
  { id: "qtype_yesno_desc", render: () => "Yes or no answer" },
  { id: "qtype_select_label", render: () => "📋 Select" },
  { id: "qtype_select_desc", render: () => "Pick 1 option from a list (Premium)" },
  { id: "qtype_multiple_label", render: () => "☑️ Multiple choice" },
  { id: "qtype_multiple_desc", render: () => "Pick several options from a list (Premium)" },
  { id: "qtype_checkbox_label", render: () => "🔲 Checkbox" },
  { id: "qtype_checkbox_desc", render: () => "Tick 0+ options (Premium)" },
  { id: "qtype_member_label", render: () => "👤 Member select" },
  { id: "qtype_member_desc", render: () => "Pick a server member (Premium)" },
  { id: "qtype_role_label", render: () => "🏷️ Role select" },
  { id: "qtype_role_desc", render: () => "Pick a server role (Premium)" },
  { id: "qtype_channel_label", render: () => "📌 Channel select" },
  { id: "qtype_channel_desc", render: () => "Pick a server channel (Premium)" },
  { id: "qtype_attachment_label", render: () => "📎 Attachment" },
  { id: "qtype_attachment_desc", render: () => "Send a file/image (Premium)" },
  { id: "question_limit_reached", render: (ctx) =>
    `Question limit for the ${ctx.planEmoji} ${ctx.planName} plan reached (${ctx.max}). Subscribe to a bigger plan at /premium to add more.` },
  { id: "advanced_question_limit_reached", render: (ctx) =>
    `Advanced question limit (select/multiple choice/checkbox/attachment/member/role/channel) for the ${ctx.planEmoji} ${ctx.planName} plan reached (${ctx.max}). Subscribe to a bigger plan at /premium to unlock more.` },
  { id: "flow_intermediate_title", render: () => "📋 What type is this question?" },
  { id: "infinity_symbol", render: () => "∞" },

  { id: "add_question_modal_title", render: () => "Add Question" },
  { id: "question_text_label", render: () => "Question text" },
  { id: "question_options_label", render: () => "Options (comma-separated)" },
  { id: "question_options_placeholder", render: () => "E.g.: Question, Bug, Suggestion, Report" },
  { id: "question_required_label", render: () => "Required? (yes/no)" },
  { id: "question_required_placeholder", render: () => "yes" },

  { id: "role_type_select_label", render: (ctx) => `Type for the <@&${ctx.roleId}> role` },
  { id: "role_permanent_label", render: () => "♾️ Permanent" },
  { id: "role_permanent_desc", render: () => "The role stays forever" },
  { id: "role_temp_select_label", render: () => "⏱️ Temporary" },
  { id: "role_temp_desc", render: () => "Removed after X minutes" },
  { id: "role_linked_select_label", render: () => "🔗 Linked to the Ticket" },
  { id: "role_linked_desc", render: () => "Removed when the ticket closes" },
  { id: "ask_role_duration", render: (ctx) => `${ctx.pensando} In how many **minutes** should the <@&${ctx.roleId}> role be removed?` },
  { id: "invalid_value", render: (ctx) => `${ctx.emduvida} Invalid value!` },
  { id: "role_behavior_title", render: (ctx) => `# 🏷️ This role is... ${ctx.pensando}\nHow should the <@&${ctx.roleId}> role behave?` },
  { id: "autorole_add_role_placeholder", render: () => "➕ Add automatic role (given when opening the ticket)" },
  { id: "btn_remove_role", render: () => "🗑️ Remove Last" },
  { id: "btn_toggle_off", render: () => "⏸️ Disable" },
  { id: "btn_toggle_on", render: () => "▶️ Enable" },
  { id: "no_roles", render: () => "_No roles set up_" },
  { id: "role_temp_result_label", render: (ctx) => `⏱️ Temporary (${ctx.minutes}min)` },
  { id: "role_linked_result_label", render: () => "🔗 Linked (removed when the ticket closes)" },
  { id: "autorole_header", render: (ctx) =>
    `# 🏷️ Auto-Role ${ctx.feliz}\n` +
    `I give an automatic role to whoever opens a ticket!\n` +
    `> Status: ${ctx.status}\n\n` +
    `> ♾️ Permanent — stays forever\n` +
    `> ⏱️ Temporary — removed after X minutes\n` +
    `> 🔗 Linked — removed when the ticket closes\n\n` +
    `**Roles:**\n${ctx.list}` },

  { id: "transcript_channel_placeholder", render: () => "📌 Channel to save transcripts" },
  { id: "btn_dm_toggle_off", render: () => "🔕 Don't send DM" },
  { id: "btn_dm_toggle_on", render: () => "🔔 Send DM to user" },
  { id: "transcript_header", render: (ctx) =>
    `# 📄 Transcript ${ctx.feliz}\n` +
    `I keep a history of the conversation when the ticket closes!\n` +
    `> Status: ${ctx.status}\n` +
    `> Channel: ${ctx.channel}\n` +
    `> Send by DM: ${ctx.dm}` },
  { id: "dm_yes", render: () => "✅ Yes" },
  { id: "dm_no", render: () => "❌ No" },

  { id: "msg_field_ticket_title", render: () => "🎫 Ticket Created — Title" },
  { id: "msg_field_ticket_desc", render: () => "🎫 Ticket Created — Description" },
  { id: "msg_field_close_btn", render: () => "🔒 Close Button Text" },
  { id: "msg_field_closing", render: () => "🔒 Closing Message" },
  { id: "msg_field_modal_answers", render: () => "📋 Modal Answers Title" },
  { id: "msg_field_seq_start_title", render: () => "📝 Sequential Form — Start Title" },
  { id: "msg_field_seq_start_desc", render: () => "📝 Sequential Form — Start Description" },
  { id: "msg_field_seq_cancel", render: () => "📝 Sequential Form — Cancelled Message" },
  { id: "msg_field_seq_summary", render: () => "📝 Sequential Form — Summary Title" },
  { id: "msg_field_transcript_title", render: () => "📄 Transcript — Channel Title" },
  { id: "msg_field_transcript_dm_title", render: () => "📄 Transcript — DM Title" },
  { id: "msg_field_transcript_dm_desc", render: () => "📄 Transcript — DM Description" },
  { id: "select_message_placeholder", render: () => "Choose message to edit" },
  { id: "msg_custom_label", render: () => "✏️ Custom" },
  { id: "msg_default_label", render: () => "— Ayami's default" },
  { id: "btn_reset_all", render: () => "🧹 Reset All to Default" },
  { id: "messages_header", render: (ctx) =>
    `# 💬 Messages ${ctx.carinho}\n` +
    `Make it all yours! Anything you don't touch, I'll handle~\n\n${ctx.statusList}` },
  { id: "msg_status_custom_icon", render: () => "✏️" },
  { id: "msg_status_default_icon", render: () => "⚪" },

  { id: "edit_message_field_label", render: (ctx) => `Text${ctx.vars ? ` (vars: ${ctx.vars})` : ''}` },
  { id: "edit_message_placeholder", render: () => "Leave empty to use Ayami's default text" },

  { id: "btn_toggle_hub_off", render: () => "⏸️ Disable Select Hub" },
  { id: "btn_toggle_hub_on", render: () => "▶️ Enable Select Hub" },
  { id: "btn_select_text", render: () => "✏️ Select Text" },
  { id: "ask_select_placeholder", render: (ctx) => `${ctx.pensando} What text should show on the select menu (placeholder)?` },
  { id: "btn_add_option", render: () => "➕ Create Option" },
  { id: "edit_existing_option_desc", render: () => "Configure staff, modal, form and embed for this option" },
  { id: "select_configure_existing_placeholder", render: () => "⚙️ Configure an existing option" },
  { id: "btn_remove_option", render: () => "🗑️ Remove Last Option" },
  { id: "selecthub_header", render: (ctx) =>
    `# 🧩 Select Menu ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `Instead of a single button, I show several support options!\n` +
    `Each with its own staff, modal and form ${ctx.feliz}\n\n` +
    `> Status: ${ctx.status}\n\n` +
    `**Options (${ctx.count}/25):**\n${ctx.list}` },
  { id: "no_options", render: () => "_No options created_" },

  { id: "new_option_modal_title", render: () => "New Select Option" },
  { id: "option_name_label", render: () => "Option name" },
  { id: "option_desc_label", render: () => "Description (optional)" },
  { id: "option_emoji_label", render: () => "Emoji (optional)" },
  { id: "option_created", render: (ctx) => `${ctx.festa} Option **${ctx.label}** created! Set it up below.` },

  { id: "option_not_found", render: () => "❌ Option not found." },
  { id: "option_header", render: (ctx) =>
    `# ${ctx.optionEmoji} ${ctx.optionLabel} ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> 🎨 Embed: ${ctx.embedStatus}\n` +
    `> 🛡️ Staff: ${ctx.staffStatus}\n` +
    `> 🏷️ Name: \`${ctx.name}\`` },
  { id: "welcome_embed_updated", render: (ctx) => `${ctx.curtida} Welcome embed updated!` },
  { id: "welcome_embed_removed", render: (ctx) => `${ctx.emduvida} Embed removed.` },
  { id: "welcome_embed_title_prefix", render: (ctx) => `Welcome Embed — ${ctx.optionLabel}` },
  { id: "staff_role_option_placeholder", render: () => "👥 Add staff role for this option" },
  { id: "ask_option_ticket_name", render: (ctx) => `${ctx.pensando} What should tickets created by this option be named? Use \`{count}\` for the number.` },
  { id: "btn_modal_status", render: (ctx) => `📋 Modal (${ctx.status})` },
  { id: "btn_seqform_status", render: (ctx) => `📝 Sequential Form (${ctx.status})` },
  { id: "btn_delete_option", render: () => "🗑️ Delete Option" },
  { id: "option_deleted", render: (ctx) => `${ctx.chorando} Option **${ctx.label}** deleted.` },

  { id: "panel_not_found_short", render: () => "❌ Panel not found." },
  { id: "modal_answer_title_default", render: () => "Support Form" },
  { id: "default_ticket_created_title", render: () => "🎫 Ticket Created" },
  { id: "default_ticket_created_desc", render: () =>
    "Hi {user}! Your request has been received.\nA staff member will reply shortly." },
  { id: "default_close_button_label", render: () => "Close Ticket" },
  { id: "default_modal_answers_title", render: () => "📋 Form Answers" },
  { id: "default_seq_intro_title", render: () => "📋 Support Form" },
  { id: "default_seq_intro_desc", render: () =>
    "Hi {user}! I'll ask you a few questions.\nYou have {timeout}s to answer each one." },
  { id: "default_seq_cancelled", render: () => "⚠️ Form closed." },
  { id: "default_seq_summary_title", render: () => "✅ Answers Received" },
  { id: "ticket_created_success", render: (ctx) => `${ctx.feliz} Ticket created in <#${ctx.channelId}>!` },

  { id: "default_closing_message", render: () => "⛔ This ticket will close in 10 seconds..." },
  { id: "default_transcript_title", render: () => "📄 Transcript" },
  { id: "default_transcript_dm_title", render: () => "📄 Your Transcript" },
  { id: "default_transcript_dm_desc", render: () => "Here's the history of your support chat, {user}!" },
  { id: "eb_default_title", render: () => "🎨 Embed Editor" },
  { id: "eb_field_select_placeholder", render: () => "✏️ Edit embed field…" },
  { id: "eb_field_title", render: () => "Title" },
  { id: "eb_field_description", render: () => "Description" },
  { id: "eb_field_url", render: () => "Title URL" },
  { id: "eb_field_author_name", render: () => "Author Name" },
  { id: "eb_field_author_icon", render: () => "Author Icon URL" },
  { id: "eb_field_author_url", render: () => "Author URL" },
  { id: "eb_field_footer_text", render: () => "Footer Text" },
  { id: "eb_field_footer_icon", render: () => "Footer Icon URL" },
  { id: "eb_field_thumbnail", render: () => "Thumbnail URL" },
  { id: "eb_field_image", render: () => "Image URL" },
  { id: "eb_edit_prefix", render: () => "Edit" },
  { id: "eb_fields_manage_placeholder", render: () => "📊 Manage Fields…" },
  { id: "eb_add_field_label", render: () => "➕ Add Field" },
  { id: "eb_add_field_desc", render: (ctx) => `Current: ${ctx.count}/25` },
  { id: "eb_remove_field_label", render: () => "🗑️ Remove Last" },
  { id: "eb_add_field_modal_title", render: () => "Add Field" },
  { id: "eb_field_name_label", render: () => "Field name" },
  { id: "eb_field_value_label", render: () => "Field value" },
  { id: "eb_field_inline_label", render: () => "Inline? (yes/no)" },
  { id: "eb_field_inline_placeholder", render: () => "no" },
  { id: "eb_color_select_placeholder", render: () => "🎨 Choose color…" },
  { id: "eb_color_blue_ayami", render: () => "🔵 Ayami Blue" },
  { id: "eb_color_blue_hair", render: () => "💙 Hair Blue" },
  { id: "eb_color_dark_blue", render: () => "🌙 Dark Blue" },
  { id: "eb_color_gold", render: () => "⭐ Gold" },
  { id: "eb_color_pink", render: () => "🌸 Pink" },
  { id: "eb_color_green", render: () => "🟢 Green" },
  { id: "eb_color_red", render: () => "🔴 Red" },
  { id: "eb_color_yellow", render: () => "🟡 Yellow" },
  { id: "eb_color_orange", render: () => "🟠 Orange" },
  { id: "eb_color_purple", render: () => "🟣 Purple" },
  { id: "eb_color_black", render: () => "⚫ Black" },
  { id: "eb_color_custom", render: () => "🎨 Custom HEX" },
  { id: "eb_custom_hex_modal_title", render: () => "Custom HEX Color" },
  { id: "eb_hex_label", render: () => "HEX (e.g.: FF5733)" },
  { id: "eb_hex_placeholder", render: () => "FF5733" },
  { id: "eb_confirm_label", render: () => "✅ Confirm embed" },
  { id: "eb_remove_label", render: () => "🗑️ Remove embed" },
  { id: "eb_cancel_label", render: () => "✖️ Cancel" },
  { id: "eb_builder_content", render: (ctx) => `🎨 **${ctx.title}** — the preview below is exactly how the embed will look!` },
  { id: "eb_blank_placeholder", render: () => "*Blank embed — start by picking a field to edit below* 👇" },

  { id: "sq_answer_invalid", render: (ctx) => `⚠️ <@${ctx.userId}> Invalid answer. Please try again.` },
  { id: "sq_attachment_prompt", render: () => "_Send a file or image as your answer._" },
  { id: "sq_attachment_required", render: (ctx) => `⚠️ <@${ctx.userId}> Send a file/image as your answer (or type \`cancelar\` to cancel).` },
  { id: "sq_question_footer", render: (ctx) => `Question ${ctx.index} of ${ctx.total}` },
  { id: "sq_question_footer_component", render: (ctx) => `Question ${ctx.index} of ${ctx.total} · answer using the menu below` },
  { id: "sq_component_placeholder", render: () => "Choose an option..." },
  { id: "sq_completed_title", render: () => "✅ Questions Answered!" },
  { id: "sq_completed_desc", render: () => "Got it all down! Now just wait for the team to reach out~ 🌸" },
  { id: "sq_log_new_form", render: (ctx) => `📥 New form from <@${ctx.userId}> — ticket: <#${ctx.channelId}>` },
  { id: "sq_answered_by_footer", render: (ctx) => `Answered by ${ctx.userId}` },
  { id: "sq_yes", render: () => "Yes" },
  { id: "sq_no", render: () => "No" },
  { id: "sq_hint_number", render: () => "_Answer with a number_" },
  { id: "sq_hint_yesno", render: () => "_Answer with **Yes** or **No**_" },
  { id: "sq_hint_short", render: () => "_Short answer (up to 100 characters)_" },
  { id: "sq_attachment_link_label", render: () => "attachment" },

  { id: "tr_locale_tag", render: () => "en-US" },
  { id: "tr_summary_desc", render: (ctx) => `Channel: **${ctx.channelName}**\nClosed by: <@${ctx.closedBy}>\nMessages: **${ctx.count}**` },
  { id: "tr_dm_desc_default", render: (ctx) => `Your ticket **#${ctx.channelName}** has been closed.\nThe transcript is attached.` },
  { id: "tr_html_title_prefix", render: () => "Transcript" },
  { id: "tr_closed_by_label", render: () => "Closed by" },
  { id: "tr_messages_label", render: (ctx) => `${ctx.count} message(s)` },
  { id: "tr_generated_at_label", render: () => "Generated at" },
  { id: "tr_footer_generated", render: () => "Transcript generated automatically" },
  { id: "tr_txt_header_title", render: () => "=== TRANSCRIPT ===" },
  { id: "tr_txt_channel_label", render: () => "Channel" },
  { id: "tr_txt_closed_by_label", render: () => "Closed by" },
  { id: "tr_txt_messages_label", render: () => "Messages" },
  { id: "tr_txt_generated_label", render: () => "Generated at" },
  { id: "tr_embed_tag", render: () => "EMBED" },
  { id: "tr_attachment_tag", render: () => "ATTACHMENT" },
  { id: "tr_unknown_user", render: () => "Unknown" },
];

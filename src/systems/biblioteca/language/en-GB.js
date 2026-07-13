"use strict";

module.exports = [
  /* ── Action/condition labels (used in the install wizard) ── */
  { id: "action_send_message", render: () => "💬 Send message" },
  { id: "action_send_dm", render: () => "📩 Send DM" },
  { id: "action_reply_message", render: () => "↩️ Reply to message" },
  { id: "action_delete_message", render: () => "🗑️ Delete message" },
  { id: "action_delete_bot_message", render: () => "🗑️ Delete bot message" },
  { id: "action_give_role", render: () => "🏷️ Give role" },
  { id: "action_remove_role", render: () => "🏷️ Remove role" },
  { id: "action_give_temp_role", render: () => "⏱️ Temporary role" },
  { id: "action_toggle_role", render: () => "🔄 Toggle role" },
  { id: "action_has_role", render: () => "👤 Has role" },
  { id: "action_not_has_role", render: () => "👤 Doesn't have role" },
  { id: "action_lock_channel", render: () => "🔒 Lock channel" },
  { id: "action_unlock_channel", render: () => "🔓 Unlock channel" },
  { id: "action_delete_channel", render: () => "❌ Delete channel" },
  { id: "action_rename_channel", render: () => "✏️ Rename channel" },
  { id: "action_is_channel", render: () => "📌 Specific channel" },
  { id: "action_not_channel", render: () => "📌 Not this channel" },

  /* ── Wizard config fields ── */
  { id: "field_channel", render: () => "📌 Channel" },
  { id: "field_role", render: () => "🏷️ Role" },

  { id: "desc_send_message_channel", render: () => "Mention or send the ID of the channel where messages will be sent." },
  { id: "desc_delete_bot_message_channel", render: () => "Mention or send the ID of the channel where the bot's message is." },
  { id: "desc_delete_channel", render: () => "Mention or send the ID of the channel to be deleted." },
  { id: "desc_rename_channel", render: () => "Mention or send the ID of the channel to be renamed." },
  { id: "desc_lock_channel", render: () => "Mention or send the ID of the channel to lock." },
  { id: "desc_lock_role", render: () => "Mention or send the ID of the role that will be blocked (leave empty for @everyone)." },
  { id: "desc_unlock_channel", render: () => "Mention or send the ID of the channel to unlock." },
  { id: "desc_unlock_role", render: () => "Mention or send the ID of the role (leave empty for @everyone)." },
  { id: "desc_give_role", render: () => "Mention or send the ID of the role to give." },
  { id: "desc_remove_role", render: () => "Mention or send the ID of the role to remove." },
  { id: "desc_give_temp_role", render: () => "Mention or send the ID of the temporary role." },
  { id: "desc_toggle_role", render: () => "Mention or send the ID of the role to toggle." },
  { id: "desc_check_role", render: () => "Mention or send the ID of the role to check." },
  { id: "desc_is_channel", render: () => "Mention or send the ID of the specific channel." },
  { id: "desc_not_channel", render: () => "Mention or send the ID of the channel to ignore." },
  { id: "desc_trigger_message", render: () => "Mention or send the channel ID to filter the trigger by (leave blank for any channel)." },
  { id: "desc_trigger_generic", render: () => "Mention or send the channel ID to filter the trigger by." },
  { id: "trigger_skip_suffix", render: () => "\nSend `-` to skip filtering by channel." },

  { id: "trigger_label_generic", render: (ctx) => `🎯 Trigger (${ctx.flowName})` },
  { id: "condition_suffix", render: (ctx) => `${ctx.label} — condition (${ctx.flowName})` },
  { id: "action_suffix", render: (ctx) => `${ctx.label} (${ctx.flowName})` },
  { id: "unnamed_flow", render: (ctx) => `Flow ${ctx.n}` },

  /* ── Install wizard ── */
  { id: "no_permission_install", render: (ctx) =>
    `# ${ctx.eBrava} No permission\nYou need the **Manage Server** permission to install systems.` },

  { id: "install_configuring", render: (ctx) =>
    `# ${ctx.ePensando} Setting up — ${ctx.entryName}\n` +
    `This system needs **${ctx.count} setting(s)** before it can be installed.\n\n` +
    `Reply to the next messages in this channel.\n` +
    `You have **2 minutes** per answer.\n\n` +
    `> Send \`-\` to skip (when possible) or \`cancelar\` to abort.` },

  { id: "install_question_for", render: () => "For" },
  { id: "install_question_flow", render: () => "Flow" },
  { id: "install_question_footer", render: () => "Send `-` to skip • `cancelar` to abort" },

  { id: "install_timeout_title", render: (ctx) => `${ctx.eSonolenta} Time's up` },
  { id: "install_timeout_desc", render: () => "The install was cancelled due to inactivity. Feel free to try again anytime~" },

  { id: "install_cancelled_title", render: (ctx) => `${ctx.eEmburrada} Install cancelled` },
  { id: "install_cancelled_desc", render: () => "No worries, install it whenever you like~" },

  { id: "install_success", render: (ctx) =>
    `# ${ctx.eFesta} ${ctx.entryName} installed!\n**${ctx.count}** flow(s) created on this server!` },
  { id: "install_config_applied", render: (ctx) => `**Settings applied:**\n${ctx.lines}` },
  { id: "install_no_config", render: () => "_No configuration needed_" },
  { id: "install_not_set", render: () => "_not set_" },
  { id: "install_error", render: (ctx) => `# ${ctx.eAssustada} Install error\n${ctx.message}` },
  /* ── General command / errors ── */
  { id: "unknown_subcommand", render: (ctx) => `# ${ctx.eAssustada} Unknown subcommand\nI didn't recognize that command. Try again!` },
  { id: "generic_error", render: (ctx) => `# ${ctx.eAssustada} Something went wrong...\n${ctx.message}` },
  { id: "generic_error_fallback", render: () => "An unexpected error occurred. Sorry about that!" },
  { id: "entry_not_found", render: (ctx) => `# ${ctx.eEmduvida} Entry not found\nI couldn't find anything with that ID. Double check it and try again~` },
  { id: "entry_not_found_short", render: (ctx) => `# ${ctx.eEmduvida} Entry not found\nI couldn't find anything with that ID~` },
  { id: "not_author", render: (ctx) => `# ${ctx.eBrava} No permission\nYou're not the author of this entry.` },
  { id: "fallback_user", render: (ctx) => `User ${ctx.suffix}` },
  { id: "fallback_anon", render: () => "Anonymous" },
  { id: "no_ratings", render: () => "☆☆☆☆☆ _no ratings_" },
  { id: "not_configured", render: () => "Not configured" },

  /* ── /biblioteca pesquisar ── */
  { id: "no_results_title", render: (ctx) => `# ${ctx.eEmduvida} No results found` },
  { id: "no_results_desc", render: () => "I couldn't find any flow with those filters.\nTry different terms or remove a few filters~" },

  { id: "sort_installs", render: () => "📥 Most installed" },
  { id: "sort_rating", render: () => "⭐ Top rated" },
  { id: "sort_trending", render: () => "🔥 Trending" },
  { id: "sort_recent", render: () => "🕐 Most recent" },

  { id: "search_filters_label", render: () => "Filters" },
  { id: "search_order_label", render: () => "Order" },
  { id: "search_title", render: (ctx) => `# ${ctx.eAnimada} Flow Library\n${ctx.filterLine}${ctx.sortLine}` },
  { id: "search_no_desc", render: () => "No description" },
  { id: "search_installs_label", render: (ctx) => `📥 ${ctx.count} installs` },
  { id: "search_select_placeholder", render: () => "✨ Select to view details~" },
  { id: "search_prev", render: () => "◀ Previous" },
  { id: "search_next", render: () => "Next ▶" },
  { id: "search_footer", render: (ctx) => `-# ${ctx.total} result${ctx.total !== 1 ? 's' : ''} • Page ${ctx.page} of ${ctx.pages}` },

  /* ── /biblioteca ver (detail) ── */
  { id: "detail_no_desc", render: () => "_No description_" },
  { id: "detail_author", render: () => "👤 **Author:**" },
  { id: "detail_category", render: () => "📂 **Category:**" },
  { id: "detail_installs", render: () => "📥 **Installs:**" },
  { id: "detail_rating", render: (ctx) => `⭐ **Rating:** ${ctx.stars} (${ctx.count} ratings)` },
  { id: "detail_flows", render: () => "🔗 **Flows:**" },
  { id: "detail_config", render: () => "🔧 **Settings:**" },
  { id: "detail_config_fields", render: (ctx) => `${ctx.count} field(s)` },
  { id: "detail_config_none", render: () => "_None needed_" },
  { id: "detail_tags", render: () => "🏷️ **Tags:**" },
  { id: "detail_no_tags", render: () => "_No tags_" },
  { id: "detail_id", render: () => "🆔 **ID:**" },
  { id: "btn_install", render: () => "📥 Install" },
  { id: "btn_rate", render: () => "⭐ Rate" },
  { id: "btn_view_author", render: () => "👤 View Author" },

  /* ── /biblioteca publicar ── */
  { id: "no_flows_title", render: (ctx) => `# ${ctx.eEmburrada} No flows` },
  { id: "no_flows_publish_desc", render: () => "Create at least one flow before publishing to the library~" },
  { id: "no_flows_update_desc", render: () => "Create at least one flow before updating~" },

  { id: "publish_title", render: (ctx) => `# ${ctx.eAnimada} Publish to Library\n**Author:** ${ctx.authorName}\n\nAdd the flows that will be part of this system, then hit **Publish** when ready!` },
  { id: "selected_flows_label", render: (ctx) => `**📦 Selected flows (${ctx.count}):**\n${ctx.list}` },
  { id: "no_flow_added", render: () => "_No flow added yet_" },
  { id: "add_flow_publish_placeholder", render: () => "✨ Add flow to the system~" },
  { id: "add_flow_update_placeholder", render: () => "✨ Add flow to the new version~" },
  { id: "btn_remove_last", render: () => "➖ Remove last" },
  { id: "btn_publish", render: () => "📤 Publish" },
  { id: "publish_limit_footer", render: () => "-# You can add up to 25 flows per publication" },

  { id: "modal_publish_title", render: () => "Publish to Library" },
  { id: "modal_field_system_name", render: () => "System name" },
  { id: "modal_field_system_name_ph", render: () => "E.g.: Advanced XP System" },
  { id: "modal_field_short_desc", render: () => "Short description" },
  { id: "modal_field_short_desc_ph", render: () => "Complete leveling system with XP..." },
  { id: "modal_field_full_desc", render: () => "Full description (optional)" },
  { id: "modal_field_full_desc_ph", render: () => "Explain how it works in detail..." },
  { id: "modal_field_category", render: () => "Category" },
  { id: "modal_field_category_ph", render: () => "Moderation, Economy, RPG..." },
  { id: "modal_field_tags", render: () => "Tags (comma-separated)" },
  { id: "modal_field_tags_ph", render: () => "xp, level, rank, reward" },

  { id: "invalid_category", render: (ctx) => `# ${ctx.eEmduvida} Invalid category\nAvailable categories are:\n${ctx.list}` },
  { id: "publish_success", render: (ctx) =>
    `# ${ctx.eFesta} Published successfully!\n**${ctx.entryName}** is now available in the library!\n\n` +
    `> 🆔 **ID:** \`${ctx.libId}\`\n> 📦 **Flows:** ${ctx.flowCount}\n> 🔧 **Config fields:** ${ctx.fieldCount}` },
  { id: "publish_error", render: (ctx) => `# ${ctx.eAssustada} Publish error\n${ctx.message}` },

  { id: "announce_title", render: (ctx) => `# ${ctx.emoji} New library publication!\n**${ctx.entryName}** was published by **${ctx.authorName}**.\n\n${ctx.shortDesc}` },
  /* ── /biblioteca atualizar ── */
  { id: "update_panel_title", render: (ctx) =>
    `# ${ctx.ePensando} Update — ${ctx.entryName}\nCurrent version: \`${ctx.version}\`\n\nSelect the flows for the new version, then hit **Confirm update**~` },
  { id: "btn_confirm_update", render: () => "🔄 Confirm update" },
  { id: "modal_update_title", render: () => "New Version" },
  { id: "modal_field_new_version", render: (ctx) => `New version (current: ${ctx.current})` },
  { id: "modal_field_new_version_ph", render: () => "2.0.0" },
  { id: "modal_field_changelog", render: () => "What changed?" },
  { id: "modal_field_changelog_ph", render: () => "New features, fixes..." },
  { id: "update_success", render: (ctx) =>
    `# ${ctx.eFesta} Updated to v${ctx.version}!\n**${ctx.entryName}** was updated with **${ctx.flowCount}** flow(s).\nInstallers will be notified via DM~` },
  { id: "update_error", render: (ctx) => `# ${ctx.eAssustada} Update error\n${ctx.message}` },

  /* ── /biblioteca editar ── */
  { id: "modal_edit_title", render: (ctx) => `Edit — ${ctx.name}` },
  { id: "modal_field_name", render: () => "Name" },
  { id: "modal_field_short_desc_edit", render: () => "Short description" },
  { id: "modal_field_full_desc_edit", render: () => "Full description" },
  { id: "modal_field_category_edit", render: () => "Category" },
  { id: "modal_field_tags_edit", render: () => "Tags (comma)" },
  { id: "edit_success", render: (ctx) => `# ${ctx.eFeliz} Entry updated!\nThe info was saved successfully~` },
  { id: "edit_error", render: (ctx) => `# ${ctx.eAssustada} Edit error\n${ctx.message}` },

  /* ── /biblioteca apagar ── */
  { id: "delete_confirm_title", render: (ctx) =>
    `# ${ctx.eAssustada} Confirm deletion\nAre you sure you want to remove **${ctx.entryName}** from the library?\n\n` +
    `**This can't be undone.**\nExisting installs on servers won't be affected.` },
  { id: "btn_confirm_delete", render: () => "✅ Confirm deletion" },
  { id: "btn_cancel", render: () => "❌ Cancel" },
  { id: "delete_success", render: (ctx) => `# ${ctx.eEmburrada} Entry removed\n**${ctx.entryName}** was removed from the library.` },
  { id: "delete_error", render: (ctx) => `# ${ctx.eAssustada} Delete error\n${ctx.message}` },
  { id: "delete_cancelled", render: (ctx) => `# ${ctx.eFeliz} Cancelled!\nThe entry stays in the library~` },

  /* ── /biblioteca minhas ── */
  { id: "my_pubs_empty", render: (ctx) => `# ${ctx.ePensando} My Publications\nYou haven't published anything to the library yet.\nUse \`/biblioteca publicar\` to get started~!` },
  { id: "my_pubs_title", render: (ctx) => `# ${ctx.eCurtida} My Publications (${ctx.count})\n${ctx.lines}` },
  { id: "my_pubs_installs", render: (ctx) => `📥 ${ctx.count} installs` },
  { id: "manage_select_placeholder", render: () => "✨ Select to manage~" },
  { id: "manage_select_footer", render: () => "-# Select an entry to manage it" },

  { id: "manage_last_changelog", render: (ctx) => `\n**Latest changelog:** ${ctx.changelog}` },
  { id: "manage_history_none", render: () => "_No history_" },
  { id: "manage_no_changelog", render: () => "no changelog" },
  { id: "manage_stats", render: (ctx) => `> 📊 **Stats:** 📥 ${ctx.installs} installs  •  👍 ${ctx.likes}  •  ⭐ ${ctx.rating}\n> 🆔 **ID:** \`${ctx.libId}\`` },
  { id: "manage_history_label", render: (ctx) => `**📜 History:**\n${ctx.history}` },
  { id: "btn_edit", render: () => "✏️ Edit" },
  { id: "btn_update_version", render: () => "🔄 Update version" },
  { id: "btn_delete", render: () => "🗑️ Delete" },
  { id: "btn_back", render: () => "⬅️ Back" },

  /* ── /biblioteca perfil ── */
  { id: "profile_no_bio", render: () => "_No bio_" },
  { id: "profile_publications", render: () => "📦 **Publications:**" },
  { id: "profile_installs", render: () => "📥 **Installs:**" },
  { id: "profile_likes", render: () => "👍 **Likes:**" },
  { id: "profile_rating", render: () => "⭐ **Rating:**" },
  { id: "profile_followers", render: () => "👥 **Followers:**" },
  { id: "profile_top_flows", render: (ctx) => `**🏆 Top Flows:**\n${ctx.list}` },
  { id: "profile_no_pubs", render: () => "_No publications_" },
  { id: "btn_follow", render: () => "➕ Follow" },
  { id: "btn_unfollow", render: () => "➖ Unfollow" },

  /* ── /biblioteca destaques ── */
  { id: "highlights_title", render: () => "Weekly Highlights" },
  { id: "highlights_trending", render: (ctx) => `**📈 Trending**\n${ctx.list}` },
  { id: "highlights_installs", render: (ctx) => `**📥 Most installed**\n${ctx.list}` },
  { id: "highlights_rated", render: (ctx) => `**⭐ Top rated**\n${ctx.list}` },
  { id: "highlights_recent", render: (ctx) => `**🕐 Most recent**\n${ctx.list}` },
  { id: "highlights_none", render: () => "_None_" },
  { id: "highlights_by", render: () => "by" },

  /* ── /biblioteca ver → rate (modal) ── */
  { id: "modal_rate_title", render: () => "Rate flow" },
  { id: "modal_field_rating", render: () => "Rating (1 to 5)" },
  { id: "invalid_rating", render: (ctx) => `# ${ctx.eEmduvida} Invalid rating\nEnter a number between 1 and 5~` },
  { id: "rate_success", render: (ctx) =>
    `# ${ctx.eCorao} Rating saved!\nYou gave **${ctx.rating} ⭐** to this flow.\nNew average: **${ctx.avg} ⭐** (${ctx.count} ratings)` },

  /* ── triggers ── */
  { id: "trigger_message_created", render: () => "💬 Message created" },
  { id: "trigger_member_joined", render: () => "👋 Member joined" },
  { id: "trigger_button_clicked", render: () => "🖱️ Button clicked" },
  { id: "trigger_scheduled", render: () => "🕐 Scheduled" },
];

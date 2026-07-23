"use strict";

module.exports = [
  { id: "action_send_message", render: () => "💬 Enviar mensagem" },
  { id: "action_send_dm", render: () => "📩 Enviar DM" },
  { id: "action_reply_message", render: () => "↩️ Responder mensagem" },
  { id: "action_delete_message", render: () => "🗑️ Apagar mensagem" },
  { id: "action_delete_bot_message", render: () => "🗑️ Apagar mensagem do bot" },
  { id: "action_give_role", render: () => "🏷️ Dar cargo" },
  { id: "action_remove_role", render: () => "🏷️ Remover cargo" },
  { id: "action_give_temp_role", render: () => "⏱️ Cargo temporário" },
  { id: "action_toggle_role", render: () => "🔄 Alternar cargo" },
  { id: "action_has_role", render: () => "👤 Possui cargo" },
  { id: "action_not_has_role", render: () => "👤 Não possui cargo" },
  { id: "action_lock_channel", render: () => "🔒 Trancar canal" },
  { id: "action_unlock_channel", render: () => "🔓 Destrancar canal" },
  { id: "action_delete_channel", render: () => "❌ Apagar canal" },
  { id: "action_rename_channel", render: () => "✏️ Renomear canal" },
  { id: "action_is_channel", render: () => "📌 Canal específico" },
  { id: "action_not_channel", render: () => "📌 Não é canal" },

  { id: "field_channel", render: () => "📌 Canal" },
  { id: "field_role", render: () => "🏷️ Cargo" },

  { id: "desc_send_message_channel", render: () => "Mencione ou envie o ID do canal onde as mensagens serão enviadas." },
  { id: "desc_delete_bot_message_channel", render: () => "Mencione ou envie o ID do canal onde a mensagem do bot está." },
  { id: "desc_delete_channel", render: () => "Mencione ou envie o ID do canal a ser deletado." },
  { id: "desc_rename_channel", render: () => "Mencione ou envie o ID do canal a ser renomeado." },
  { id: "desc_lock_channel", render: () => "Mencione ou envie o ID do canal a ser trancado." },
  { id: "desc_lock_role", render: () => "Mencione ou envie o ID do cargo que terá o acesso bloqueado (vazio = @everyone)." },
  { id: "desc_unlock_channel", render: () => "Mencione ou envie o ID do canal a ser destrancado." },
  { id: "desc_unlock_role", render: () => "Mencione ou envie o ID do cargo (vazio = @everyone)." },
  { id: "desc_give_role", render: () => "Mencione ou envie o ID do cargo a ser dado." },
  { id: "desc_remove_role", render: () => "Mencione ou envie o ID do cargo a ser removido." },
  { id: "desc_give_temp_role", render: () => "Mencione ou envie o ID do cargo temporário." },
  { id: "desc_toggle_role", render: () => "Mencione ou envie o ID do cargo a ser alternado." },
  { id: "desc_check_role", render: () => "Mencione ou envie o ID do cargo a verificar." },
  { id: "desc_is_channel", render: () => "Mencione ou envie o ID do canal específico." },
  { id: "desc_not_channel", render: () => "Mencione ou envie o ID do canal a ignorar." },
  { id: "desc_trigger_message", render: () => "Mencione ou envie o ID do canal filtro do trigger (deixe em branco para qualquer canal)." },
  { id: "desc_trigger_generic", render: () => "Mencione ou envie o ID do canal filtro do trigger." },
  { id: "trigger_skip_suffix", render: () => "\nEnvie `-` para não filtrar por canal." },

  { id: "trigger_label_generic", render: (ctx) => `🎯 Trigger (${ctx.flowName})` },
  { id: "condition_suffix", render: (ctx) => `${ctx.label} — condição (${ctx.flowName})` },
  { id: "action_suffix", render: (ctx) => `${ctx.label} (${ctx.flowName})` },
  { id: "unnamed_flow", render: (ctx) => `Fluxo ${ctx.n}` },

  { id: "no_permission_install", render: (ctx) =>
    `# ${ctx.eBrava} Sem permissão\nVocê precisa da permissão **Gerenciar Servidor** para instalar sistemas.` },

  { id: "install_configuring", render: (ctx) =>
    `# ${ctx.ePensando} Configurando — ${ctx.entryName}\n` +
    `Esse sistema precisa de **${ctx.count} configuração(ões)** antes de instalar.\n\n` +
    `Responda as próximas mensagens neste canal.\n` +
    `Você tem **2 minutos** para cada resposta.\n\n` +
    `> Envie \`-\` para pular (quando possível) ou \`cancelar\` para abortar.` },

  { id: "install_question_for", render: () => "Para" },
  { id: "install_question_flow", render: () => "Fluxo" },
  { id: "install_question_footer", render: () => "Envie `-` para pular • `cancelar` para abortar" },

  { id: "install_timeout_title", render: (ctx) => `${ctx.eSonolenta} Tempo esgotado` },
  { id: "install_timeout_desc", render: () => "A instalação foi cancelada por inatividade. Pode tentar de novo quando quiser~" },

  { id: "install_cancelled_title", render: (ctx) => `${ctx.eEmburrada} Instalação cancelada` },
  { id: "install_cancelled_desc", render: () => "Tudo bem, pode instalar quando quiser~" },

  { id: "install_success", render: (ctx) =>
    `# ${ctx.eFesta} ${ctx.entryName} instalado!\n**${ctx.count}** fluxo(s) criado(s) neste servidor!` },
  { id: "install_config_applied", render: (ctx) => `**Configurações aplicadas:**\n${ctx.lines}` },
  { id: "install_no_config", render: () => "_Nenhuma configuração necessária_" },
  { id: "install_not_set", render: () => "_não definido_" },
  { id: "install_error", render: (ctx) => `# ${ctx.eAssustada} Erro na instalação\n${ctx.message}` },

  { id: "unknown_subcommand", render: (ctx) => `# ${ctx.eAssustada} Subcomando desconhecido\nNão reconheci esse comando. Tente novamente!` },
  { id: "generic_error", render: (ctx) => `# ${ctx.eAssustada} Algo deu errado...\n${ctx.message}` },
  { id: "generic_error_fallback", render: () => "Ocorreu um erro inesperado. Me desculpe!" },
  { id: "entry_not_found", render: (ctx) => `# ${ctx.eEmduvida} Entrada não encontrada\nNão encontrei nada com esse ID. Confere se digitou certinho~` },
  { id: "entry_not_found_short", render: (ctx) => `# ${ctx.eEmduvida} Entrada não encontrada\nNão encontrei nada com esse ID~` },
  { id: "not_author", render: (ctx) => `# ${ctx.eBrava} Sem permissão\nVocê não é o autor desta entrada.` },
  { id: "fallback_user", render: (ctx) => `Usuário ${ctx.suffix}` },
  { id: "fallback_anon", render: () => "Anônimo" },
  { id: "no_ratings", render: () => "☆☆☆☆☆ _sem avaliações_" },
  { id: "not_configured", render: () => "Não configurado" },

  { id: "no_results_title", render: (ctx) => `# ${ctx.eEmduvida} Nenhum resultado encontrado` },
  { id: "no_results_desc", render: () => "Não encontrei nenhum fluxo com esses filtros.\nTente outros termos ou remova alguns filtros~" },

  { id: "sort_installs", render: () => "📥 Mais instalados" },
  { id: "sort_rating", render: () => "⭐ Melhor avaliados" },
  { id: "sort_trending", render: () => "🔥 Tendência" },
  { id: "sort_recent", render: () => "🕐 Mais recentes" },

  { id: "search_filters_label", render: () => "Filtros" },
  { id: "search_order_label", render: () => "Ordem" },
  { id: "search_title", render: (ctx) => `# ${ctx.eAnimada} Biblioteca de Fluxos\n${ctx.filterLine}${ctx.sortLine}` },
  { id: "search_no_desc", render: () => "Sem descrição" },
  { id: "search_installs_label", render: (ctx) => `📥 ${ctx.count} instalações` },
  { id: "search_select_placeholder", render: () => "✨ Selecione para ver detalhes~" },
  { id: "search_prev", render: () => "◀ Anterior" },
  { id: "search_next", render: () => "Próxima ▶" },
  { id: "search_footer", render: (ctx) => `-# ${ctx.total} resultado${ctx.total !== 1 ? 's' : ''} • Página ${ctx.page} de ${ctx.pages}` },

  { id: "detail_no_desc", render: () => "_Sem descrição_" },
  { id: "detail_author", render: () => "👤 **Autor:**" },
  { id: "detail_category", render: () => "📂 **Categoria:**" },
  { id: "detail_installs", render: () => "📥 **Instalações:**" },
  { id: "detail_rating", render: (ctx) => `⭐ **Avaliação:** ${ctx.stars} (${ctx.count} avaliações)` },
  { id: "detail_flows", render: () => "🔗 **Fluxos:**" },
  { id: "detail_config", render: () => "🔧 **Configurações:**" },
  { id: "detail_config_fields", render: (ctx) => `${ctx.count} campo(s)` },
  { id: "detail_config_none", render: () => "_Nenhuma necessária_" },
  { id: "detail_tags", render: () => "🏷️ **Tags:**" },
  { id: "detail_no_tags", render: () => "_Sem tags_" },
  { id: "detail_id", render: () => "🆔 **ID:**" },
  { id: "btn_install", render: () => "📥 Instalar" },
  { id: "btn_rate", render: () => "⭐ Avaliar" },
  { id: "btn_view_author", render: () => "👤 Ver Autor" },

  { id: "no_flows_title", render: (ctx) => `# ${ctx.eEmburrada} Sem fluxos` },
  { id: "no_flows_publish_desc", render: () => "Crie pelo menos um fluxo antes de publicar na biblioteca~" },
  { id: "no_flows_update_desc", render: () => "Crie pelo menos um fluxo antes de atualizar~" },

  { id: "publish_title", render: (ctx) => `# ${ctx.eAnimada} Publicar na Biblioteca\n**Autor:** ${ctx.authorName}\n\nAdicione os fluxos que farão parte deste sistema e clique em **Publicar** quando estiver pronto!` },
  { id: "selected_flows_label", render: (ctx) => `**📦 Fluxos selecionados (${ctx.count}):**\n${ctx.list}` },
  { id: "no_flow_added", render: () => "_Nenhum fluxo adicionado ainda_" },
  { id: "add_flow_publish_placeholder", render: () => "✨ Adicionar fluxo ao sistema~" },
  { id: "add_flow_update_placeholder", render: () => "✨ Adicionar fluxo à nova versão~" },
  { id: "btn_remove_last", render: () => "➖ Remover último" },
  { id: "btn_publish", render: () => "📤 Publicar" },
  { id: "publish_limit_footer", render: () => "-# Você pode adicionar até 25 fluxos por publicação" },

  { id: "modal_publish_title", render: () => "Publicar na Biblioteca" },
  { id: "modal_field_system_name", render: () => "Nome do sistema" },
  { id: "modal_field_system_name_ph", render: () => "Ex: Sistema de XP Avançado" },
  { id: "modal_field_short_desc", render: () => "Descrição curta" },
  { id: "modal_field_short_desc_ph", render: () => "Sistema completo de XP com níveis..." },
  { id: "modal_field_full_desc", render: () => "Descrição completa (opcional)" },
  { id: "modal_field_full_desc_ph", render: () => "Explique o funcionamento detalhado..." },
  { id: "modal_field_category", render: () => "Categoria" },
  { id: "modal_field_category_ph", render: () => "Moderação, Economia, RPG..." },
  { id: "modal_field_tags", render: () => "Tags (separadas por vírgula)" },
  { id: "modal_field_tags_ph", render: () => "xp, level, rank, recompensa" },

  { id: "invalid_category", render: (ctx) => `# ${ctx.eEmduvida} Categoria inválida\nAs categorias disponíveis são:\n${ctx.list}` },
  { id: "publish_success", render: (ctx) =>
    `# ${ctx.eFesta} Publicado com sucesso!\n**${ctx.entryName}** já está disponível na biblioteca!\n\n` +
    `> 🆔 **ID:** \`${ctx.libId}\`\n> 📦 **Fluxos:** ${ctx.flowCount}\n> 🔧 **Campos de configuração:** ${ctx.fieldCount}` },
  { id: "publish_error", render: (ctx) => `# ${ctx.eAssustada} Erro ao publicar\n${ctx.message}` },

  { id: "announce_title", render: (ctx) => `# ${ctx.emoji} Nova publicação na Biblioteca!\n**${ctx.entryName}** foi publicado por **${ctx.authorName}**.\n\n${ctx.shortDesc}` },

  { id: "update_panel_title", render: (ctx) =>
    `# ${ctx.ePensando} Atualizar — ${ctx.entryName}\nVersão atual: \`${ctx.version}\`\n\nSelecione os fluxos da nova versão e clique em **Confirmar atualização**~` },
  { id: "btn_confirm_update", render: () => "🔄 Confirmar atualização" },
  { id: "modal_update_title", render: () => "Nova Versão" },
  { id: "modal_field_new_version", render: (ctx) => `Nova versão (atual: ${ctx.current})` },
  { id: "modal_field_new_version_ph", render: () => "2.0.0" },
  { id: "modal_field_changelog", render: () => "O que mudou?" },
  { id: "modal_field_changelog_ph", render: () => "Novos recursos, correções..." },
  { id: "update_success", render: (ctx) =>
    `# ${ctx.eFesta} Atualizado para v${ctx.version}!\n**${ctx.entryName}** foi atualizado com **${ctx.flowCount}** fluxo(s).\nOs instaladores serão notificados via DM~` },
  { id: "update_error", render: (ctx) => `# ${ctx.eAssustada} Erro ao atualizar\n${ctx.message}` },

  { id: "modal_edit_title", render: (ctx) => `Editar — ${ctx.name}` },
  { id: "modal_field_name", render: () => "Nome" },
  { id: "modal_field_short_desc_edit", render: () => "Descrição curta" },
  { id: "modal_field_full_desc_edit", render: () => "Descrição completa" },
  { id: "modal_field_category_edit", render: () => "Categoria" },
  { id: "modal_field_tags_edit", render: () => "Tags (vírgula)" },
  { id: "edit_success", render: (ctx) => `# ${ctx.eFeliz} Entrada atualizada!\nAs informações foram salvas com sucesso~` },
  { id: "edit_error", render: (ctx) => `# ${ctx.eAssustada} Erro ao editar\n${ctx.message}` },

  { id: "delete_confirm_title", render: (ctx) =>
    `# ${ctx.eAssustada} Confirmar exclusão\nTem certeza que quer remover **${ctx.entryName}** da biblioteca?\n\n` +
    `**Essa ação não pode ser desfeita.**\nInstalações existentes nos servidores não serão afetadas.` },
  { id: "btn_confirm_delete", render: () => "✅ Confirmar exclusão" },
  { id: "btn_cancel", render: () => "❌ Cancelar" },
  { id: "delete_success", render: (ctx) => `# ${ctx.eEmburrada} Entrada removida\n**${ctx.entryName}** foi removida da biblioteca.` },
  { id: "delete_error", render: (ctx) => `# ${ctx.eAssustada} Erro ao apagar\n${ctx.message}` },
  { id: "delete_cancelled", render: (ctx) => `# ${ctx.eFeliz} Cancelado!\nA entrada continua na biblioteca~` },

  { id: "my_pubs_empty", render: (ctx) => `# ${ctx.ePensando} Minhas Publicações\nVocê ainda não publicou nada na biblioteca.\nUse \`/biblioteca publicar\` para começar~!` },
  { id: "my_pubs_title", render: (ctx) => `# ${ctx.eCurtida} Minhas Publicações (${ctx.count})\n${ctx.lines}` },
  { id: "my_pubs_installs", render: (ctx) => `📥 ${ctx.count} instalações` },
  { id: "manage_select_placeholder", render: () => "✨ Selecione para gerenciar~" },
  { id: "manage_select_footer", render: () => "-# Selecione uma entrada para gerenciá-la" },

  { id: "manage_last_changelog", render: (ctx) => `\n**Último changelog:** ${ctx.changelog}` },
  { id: "manage_history_none", render: () => "_Nenhum histórico_" },
  { id: "manage_no_changelog", render: () => "sem changelog" },
  { id: "manage_stats", render: (ctx) => `> 📊 **Stats:** 📥 ${ctx.installs} instalações  •  👍 ${ctx.likes}  •  ⭐ ${ctx.rating}\n> 🆔 **ID:** \`${ctx.libId}\`` },
  { id: "manage_history_label", render: (ctx) => `**📜 Histórico:**\n${ctx.history}` },
  { id: "btn_edit", render: () => "✏️ Editar" },
  { id: "btn_update_version", render: () => "🔄 Atualizar versão" },
  { id: "btn_delete", render: () => "🗑️ Apagar" },
  { id: "btn_back", render: () => "⬅️ Voltar" },

  { id: "profile_no_bio", render: () => "_Sem bio_" },
  { id: "profile_publications", render: () => "📦 **Publicações:**" },
  { id: "profile_installs", render: () => "📥 **Instalações:**" },
  { id: "profile_likes", render: () => "👍 **Likes:**" },
  { id: "profile_rating", render: () => "⭐ **Avaliação:**" },
  { id: "profile_followers", render: () => "👥 **Seguidores:**" },
  { id: "profile_top_flows", render: (ctx) => `**🏆 Top Fluxos:**\n${ctx.list}` },
  { id: "profile_no_pubs", render: () => "_Nenhuma publicação_" },
  { id: "btn_follow", render: () => "➕ Seguir" },
  { id: "btn_unfollow", render: () => "➖ Deixar de seguir" },

  { id: "highlights_title", render: () => "Destaques da Semana" },
  { id: "highlights_trending", render: (ctx) => `**📈 Tendência**\n${ctx.list}` },
  { id: "highlights_installs", render: (ctx) => `**📥 Mais instalados**\n${ctx.list}` },
  { id: "highlights_rated", render: (ctx) => `**⭐ Melhor avaliados**\n${ctx.list}` },
  { id: "highlights_recent", render: (ctx) => `**🕐 Mais recentes**\n${ctx.list}` },
  { id: "highlights_none", render: () => "_Nenhum_" },
  { id: "highlights_by", render: () => "por" },

  { id: "modal_rate_title", render: () => "Avaliar fluxo" },
  { id: "modal_field_rating", render: () => "Nota de 1 a 5" },
  { id: "invalid_rating", render: (ctx) => `# ${ctx.eEmduvida} Nota inválida\nInforme um número entre 1 e 5~` },
  { id: "rate_success", render: (ctx) =>
    `# ${ctx.eCorao} Avaliação registrada!\nVocê deu **${ctx.rating} ⭐** para este fluxo.\nNova média: **${ctx.avg} ⭐** (${ctx.count} avaliações)` },

  { id: "trigger_message_created", render: () => "💬 Mensagem criada" },
  { id: "trigger_member_joined", render: () => "👋 Membro entrou" },
  { id: "trigger_button_clicked", render: () => "🖱️ Botão clicado" },
  { id: "trigger_scheduled", render: () => "🕐 Agendado" },
];

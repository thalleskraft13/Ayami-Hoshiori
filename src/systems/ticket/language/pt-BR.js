"use strict";

module.exports = [
  { id: "home_title", render: (ctx) =>
    `# 🎫 Sistema de Tickets ${ctx.animada}\nOii! Eu sou a Ayami ${ctx.corao} e vou te ajudar a montar o atendimento do servidor!` },
  { id: "btn_panels", render: (ctx) => `📋 Painéis (${ctx.count})` },
  { id: "btn_new_panel", render: () => "✨ Novo Painel" },

  { id: "no_panels_title", render: (ctx) => `# 📋 Seus Painéis ${ctx.emburrada}\nNenhum painel ainda... vamos criar o primeiro?` },
  { id: "panels_title", render: (ctx) => `# 📋 Seus Painéis (${ctx.count}) ${ctx.feliz}\n${ctx.list}` },
  { id: "select_which_panel", render: () => "✨ Qual painel você quer ver?" },
  { id: "panel_hub_multi", render: () => "Select Menu" },
  { id: "panel_hub_single", render: () => "Botão único" },
  { id: "panel_option_desc", render: (ctx) => `${ctx.staffCount} staff • ${ctx.hubLabel}` },
  { id: "btn_back", render: () => "⬅️ Voltar" },

  { id: "modal_create_panel_title", render: () => "Criar Painel de Ticket ✨" },
  { id: "modal_panel_id_label", render: () => "ID do painel (sem espaços)" },
  { id: "modal_panel_id_placeholder", render: () => "suporte, denuncias, parcerias..." },
  { id: "invalid_id", render: () => "❌ ID inválido!" },
  { id: "panel_id_exists", render: (ctx) => `${ctx.emburrada} Já existe um painel com ID **${ctx.panelId}**.` },

  { id: "panel_not_found", render: (ctx) => `# ${ctx.emduvida} Não achei esse painel...\nPode ter sido apagado!` },
  { id: "opt_edit_embed", render: () => "🎨 Editar Embed" },
  { id: "opt_create_embed", render: () => "✨ Criar Embed" },
  { id: "opt_embed_desc", render: () => "A carinha do seu painel" },
  { id: "opt_channel_category", render: () => "📌 Canal & Categoria" },
  { id: "opt_configured", render: () => "Já configurado" },
  { id: "opt_not_configured", render: () => "Ainda não configurado" },
  { id: "opt_staff_name", render: () => "👥 Staff & Nome" },
  { id: "opt_staff_name_desc", render: () => "Quem atende e como o ticket se chama" },
  { id: "opt_creation_type", render: () => "⚙️ Tipo de Criação" },
  { id: "opt_modal", render: () => "📋 Modal" },
  { id: "opt_active", render: () => "Ativo" },
  { id: "opt_inactive", render: () => "Inativo" },
  { id: "opt_seqform", render: () => "📝 Form Sequencial" },
  { id: "opt_autorole", render: () => "🏷️ Auto-Cargo" },
  { id: "opt_transcript", render: () => "📄 Transcript" },
  { id: "opt_selecthub", render: () => "🧩 Select Menu" },
  { id: "opt_selecthub_desc", render: (ctx) => `${ctx.count} opção(ões)` },
  { id: "opt_messages", render: () => "💬 Mensagens" },
  { id: "opt_messages_desc", render: () => "Deixe tudo com a sua cara!" },
  { id: "select_what_configure", render: () => "✨ O que você quer configurar?" },
  { id: "btn_publish", render: () => "🚀 Publicar" },
  { id: "btn_delete", render: () => "🗑️ Excluir" },
  { id: "embed_ready", render: () => "pronta!" },
  { id: "embed_missing", render: () => "falta criar" },
  { id: "no_channel_chosen", render: () => "não escolhido" },
  { id: "no_staff_yet", render: () => "ninguém ainda" },
  { id: "panel_header", render: (ctx) =>
    `# 🎫 ${ctx.panelId} ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> 🎨 Embed: ${ctx.embedStatus}\n` +
    `> 📌 Canal: ${ctx.channelStatus}\n` +
    `> 👥 Staff: ${ctx.staffStatus}` +
    (ctx.cv2Active ? `\n> 🧱 Layout: **Components V2** (configurado pela Dashboard — edite lá)` : '') },
  { id: "embed_updated", render: (ctx) => `${ctx.curtida} Ficou linda!` },
  { id: "embed_removed", render: (ctx) => `${ctx.emduvida} Tirei a embed.` },
  { id: "embed_title_prefix", render: (ctx) => `Embed — ${ctx.panelId}` },

  { id: "confirm_delete_title", render: (ctx) => `# ${ctx.assustada} Excluir o painel?\nTem certeza? Não vai dar pra desfazer depois...` },
  { id: "btn_confirm_delete", render: () => "✅ Sim, excluir" },
  { id: "btn_cancel", render: () => "❌ Cancelar" },

  { id: "publish_no_channel", render: (ctx) => `${ctx.emduvida} Escolhe um canal antes, tá bom?` },
  { id: "publish_no_embed", render: (ctx) => `${ctx.emduvida} Falta criar a embed primeiro!` },
  { id: "select_service_type_placeholder", render: () => "Selecione o tipo de atendimento" },
  { id: "open_ticket_button", render: () => "🎫 Abrir Ticket" },
  { id: "publish_success", render: (ctx) => `${ctx.festa} Prontinho! Publiquei em <#${ctx.channelId}>~` },

  { id: "destino_channel_placeholder", render: () => "📌 Canal onde o painel será enviado" },
  { id: "destino_category_placeholder", render: () => "📂 Categoria onde os tickets serão criados" },
  { id: "destino_title", render: (ctx) =>
    `# 📌 Canal & Categoria ${ctx.feliz}\n` +
    `> 📢 Canal: ${ctx.channelStatus}\n` +
    `> 📂 Categoria: ${ctx.categoryStatus}` },
  { id: "destino_none_channel", render: () => "nenhum ainda" },
  { id: "destino_none_category", render: () => "nenhuma ainda" },

  { id: "staff_role_select_placeholder", render: () => "👥 Adicionar cargo staff" },
  { id: "btn_clear_staff", render: () => "🧹 Limpar Staff" },
  { id: "btn_ticket_name", render: () => "✏️ Nome do Ticket" },
  { id: "ask_ticket_name", render: (ctx) => `${ctx.pensando} Como o ticket vai se chamar?\nUse \`{count}\` pro número. Ex: \`ticket-{count}\`` },
  { id: "staff_title", render: (ctx) =>
    `# 👥 Staff & Nome ${ctx.feliz}\n` +
    `> 🛡️ Staff: ${ctx.staffStatus}\n` +
    `> 🏷️ Nome: \`${ctx.name}\`` },

  { id: "tipo_label_channel", render: () => "📁 Canal de Texto" },
  { id: "tipo_label_thread_public", render: () => "🧵 Thread Pública" },
  { id: "tipo_label_thread_private", render: () => "🔒 Thread Privada" },
  { id: "tipo_select_placeholder", render: () => "Selecionar tipo de criação" },
  { id: "tipo_current_label", render: () => "✅ Atual" },
  { id: "tipo_title", render: (ctx) => `# ⚙️ Tipo de Criação ${ctx.feliz}\nComo o ticket é criado? Atual: ${ctx.current}` },

  { id: "modal_no_fields", render: () => "_Nenhum campo adicionado_" },
  { id: "modal_field_short", render: () => "curto" },
  { id: "modal_field_paragraph", render: () => "parágrafo" },
  { id: "modal_field_required_tag", render: () => " *obrigatório*" },
  { id: "btn_toggle_modal_off", render: () => "⏸️ Desativar Modal" },
  { id: "btn_toggle_modal_on", render: () => "▶️ Ativar Modal" },
  { id: "btn_modal_title", render: () => "✏️ Título do Modal" },
  { id: "ask_modal_title", render: (ctx) => `${ctx.pensando} Qual o título do modal?` },
  { id: "btn_add_field", render: () => "➕ Adicionar Campo" },
  { id: "btn_remove_field", render: () => "🗑️ Remover Último Campo" },
  { id: "modal_title_default", render: () => "Formulário de Atendimento" },
  { id: "modal_header", render: (ctx) =>
    `# 📋 Modal ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `Aparece quando alguém clica em Abrir Ticket!\n` +
    `> Status: ${ctx.status}\n` +
    `> Título: \`${ctx.title}\`\n\n` +
    `**Campos (${ctx.count}/5):**\n${ctx.list}` },
  { id: "modal_header_option", render: (ctx) =>
    `# 📋 Modal — ${ctx.optionLabel} ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> Status: ${ctx.status}\n` +
    `> Título: \`${ctx.title}\`\n\n` +
    `**Campos (${ctx.count}/5):**\n${ctx.list}` },
  { id: "status_on", render: () => "🟢 Ativo" },
  { id: "status_off", render: () => "🔴 Inativo" },

  { id: "add_field_modal_title", render: () => "Adicionar Campo do Modal" },
  { id: "field_label_label", render: () => "Pergunta/Label do campo" },
  { id: "field_placeholder_label", render: () => "Placeholder (opcional)" },
  { id: "field_style_label", render: () => "Estilo: curto ou paragrafo" },
  { id: "field_style_placeholder", render: () => "curto" },
  { id: "field_required_label", render: () => "Obrigatório? (sim/não)" },
  { id: "field_required_placeholder", render: () => "sim" },
  { id: "field_added", render: (ctx) => `${ctx.curtida} Campo adicionado!` },

  { id: "seq_no_questions", render: () => "_Nenhuma pergunta adicionada_" },
  { id: "seq_question_required_tag", render: () => " *obrigatória*" },
  { id: "btn_toggle_form_off", render: () => "⏸️ Desativar Form" },
  { id: "btn_toggle_form_on", render: () => "▶️ Ativar Form" },
  { id: "btn_add_question", render: () => "➕ Adicionar Pergunta" },
  { id: "btn_remove_question", render: () => "🗑️ Remover Última" },
  { id: "timeout_30s", render: () => "30 segundos" },
  { id: "timeout_1m", render: () => "1 minuto" },
  { id: "timeout_2m", render: () => "2 minutos" },
  { id: "timeout_5m", render: () => "5 minutos" },
  { id: "timeout_10m", render: () => "10 minutos" },
  { id: "timeout_custom", render: () => "✏️ Personalizado (digitar)" },
  { id: "timeout_select_placeholder", render: (ctx) => `⏱️ Tempo por pergunta — Atual: ${ctx.seconds}s` },
  { id: "ask_custom_seconds", render: (ctx) => `${ctx.pensando} Quantos **segundos** o usuário terá para responder cada pergunta? *(5 a 600)*` },
  { id: "invalid_seconds", render: (ctx) => `${ctx.emduvida} Valor inválido! Use entre 5 e 600 segundos.` },
  { id: "send_mode_only_ticket", render: () => "🎫 Só no ticket" },
  { id: "send_mode_log_channel", render: () => "📋 Canal de log" },
  { id: "selected_label", render: () => "Selecionado" },
  { id: "send_mode_select_placeholder", render: () => "📤 Onde mandar as respostas?" },
  { id: "log_channel_select_placeholder", render: () => "📋 Canal de log das respostas" },
  { id: "seq_header", render: (ctx) =>
    `# 📝 Form Sequencial ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `Eu faço as perguntas no chat, uma de cada vez!\n` +
    `> Status: ${ctx.status}\n` +
    `> Tempo por pergunta: ${ctx.seconds}s\n` +
    `> Resumo vai pra: ${ctx.destination}\n\n` +
    `**Perguntas (${ctx.count}/${ctx.max}):**\n${ctx.list}` },
  { id: "seq_header_option", render: (ctx) =>
    `# 📝 Form Sequencial — ${ctx.optionLabel} ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> Status: ${ctx.status}\n` +
    `> Tempo por pergunta: ${ctx.seconds}s\n` +
    `> Resumo vai pra: ${ctx.destination}\n\n` +
    `**Perguntas (${ctx.count}/${ctx.max}):**\n${ctx.list}` },
  { id: "seq_dest_own_ticket", render: () => "🎫 o próprio ticket" },
  { id: "question_added", render: (ctx) => `${ctx.curtida} Pergunta adicionada!` },

  { id: "question_type_select_placeholder", render: () => "Qual o tipo dessa pergunta?" },
  { id: "qtype_short_label", render: () => "📝 Texto curto" },
  { id: "qtype_short_desc", render: () => "Resposta em até ~100 caracteres" },
  { id: "qtype_long_label", render: () => "📄 Texto longo" },
  { id: "qtype_long_desc", render: () => "Resposta em até 2000 caracteres" },
  { id: "qtype_number_label", render: () => "🔢 Número" },
  { id: "qtype_number_desc", render: () => "Aceita apenas números" },
  { id: "qtype_yesno_label", render: () => "✅ Sim/Não" },
  { id: "qtype_yesno_desc", render: () => "Resposta sim ou não" },
  { id: "qtype_select_label", render: () => "📋 Seleção" },
  { id: "qtype_select_desc", render: () => "Escolher 1 opção de uma lista (Premium)" },
  { id: "qtype_multiple_label", render: () => "☑️ Múltipla escolha" },
  { id: "qtype_multiple_desc", render: () => "Escolher várias opções de uma lista (Premium)" },
  { id: "qtype_checkbox_label", render: () => "🔲 Checkbox" },
  { id: "qtype_checkbox_desc", render: () => "Marcar 0+ opções (Premium)" },
  { id: "qtype_member_label", render: () => "👤 Seleção de membro" },
  { id: "qtype_member_desc", render: () => "Escolher um membro do servidor (Premium)" },
  { id: "qtype_role_label", render: () => "🏷️ Seleção de cargo" },
  { id: "qtype_role_desc", render: () => "Escolher um cargo do servidor (Premium)" },
  { id: "qtype_channel_label", render: () => "📌 Seleção de canal" },
  { id: "qtype_channel_desc", render: () => "Escolher um canal do servidor (Premium)" },
  { id: "qtype_attachment_label", render: () => "📎 Anexo" },
  { id: "qtype_attachment_desc", render: () => "Enviar um arquivo/imagem (Premium)" },
  { id: "question_limit_reached", render: (ctx) =>
    `Limite de perguntas do plano ${ctx.planEmoji} ${ctx.planName} atingido (${ctx.max}). Assine um plano maior em /premium para adicionar mais.` },
  { id: "advanced_question_limit_reached", render: (ctx) =>
    `Limite de perguntas avançadas (seleção/múltipla escolha/checkbox/anexo/membro/cargo/canal) do plano ${ctx.planEmoji} ${ctx.planName} atingido (${ctx.max}). Assine um plano maior em /premium para desbloquear mais.` },
  { id: "flow_intermediate_title", render: () => "📋 Qual o tipo dessa pergunta?" },
  { id: "infinity_symbol", render: () => "∞" },

  { id: "add_question_modal_title", render: () => "Adicionar Pergunta" },
  { id: "question_text_label", render: () => "Texto da pergunta" },
  { id: "question_options_label", render: () => "Opções (separadas por vírgula)" },
  { id: "question_options_placeholder", render: () => "Ex: Dúvida, Bug, Sugestão, Denúncia" },
  { id: "question_required_label", render: () => "Obrigatória? (sim/não)" },
  { id: "question_required_placeholder", render: () => "sim" },

  { id: "role_type_select_label", render: (ctx) => `Tipo do cargo <@&${ctx.roleId}>` },
  { id: "role_permanent_label", render: () => "♾️ Permanente" },
  { id: "role_permanent_desc", render: () => "O cargo fica para sempre" },
  { id: "role_temp_select_label", render: () => "⏱️ Temporário" },
  { id: "role_temp_desc", render: () => "Removido após X minutos" },
  { id: "role_linked_select_label", render: () => "🔗 Vinculado ao Ticket" },
  { id: "role_linked_desc", render: () => "Removido quando o ticket fechar" },
  { id: "ask_role_duration", render: (ctx) => `${ctx.pensando} Em quantos **minutos** o cargo <@&${ctx.roleId}> deve ser removido?` },
  { id: "invalid_value", render: (ctx) => `${ctx.emduvida} Valor inválido!` },
  { id: "role_behavior_title", render: (ctx) => `# 🏷️ Esse cargo é... ${ctx.pensando}\nComo o cargo <@&${ctx.roleId}> deve se comportar?` },
  { id: "autorole_add_role_placeholder", render: () => "➕ Adicionar cargo automático (dado ao abrir o ticket)" },
  { id: "btn_remove_role", render: () => "🗑️ Remover Último" },
  { id: "btn_toggle_off", render: () => "⏸️ Desativar" },
  { id: "btn_toggle_on", render: () => "▶️ Ativar" },
  { id: "no_roles", render: () => "_Nenhum cargo configurado_" },
  { id: "role_temp_result_label", render: (ctx) => `⏱️ Temporário (${ctx.minutes}min)` },
  { id: "role_linked_result_label", render: () => "🔗 Vinculado (some quando o ticket fecha)" },
  { id: "autorole_header", render: (ctx) =>
    `# 🏷️ Auto-Cargo ${ctx.feliz}\n` +
    `Dou um cargo automático pra quem abre o ticket!\n` +
    `> Status: ${ctx.status}\n\n` +
    `> ♾️ Permanente — fica pra sempre\n` +
    `> ⏱️ Temporário — some depois de X minutos\n` +
    `> 🔗 Vinculado — some quando o ticket fecha\n\n` +
    `**Cargos:**\n${ctx.list}` },

  { id: "transcript_channel_placeholder", render: () => "📌 Canal para salvar transcripts" },
  { id: "btn_dm_toggle_off", render: () => "🔕 Não enviar DM" },
  { id: "btn_dm_toggle_on", render: () => "🔔 Enviar DM ao usuário" },
  { id: "transcript_header", render: (ctx) =>
    `# 📄 Transcript ${ctx.feliz}\n` +
    `Guardo um histórico da conversa quando o ticket fecha!\n` +
    `> Status: ${ctx.status}\n` +
    `> Canal: ${ctx.channel}\n` +
    `> Mandar por DM: ${ctx.dm}` },
  { id: "dm_yes", render: () => "✅ Sim" },
  { id: "dm_no", render: () => "❌ Não" },

  { id: "msg_field_ticket_title", render: () => "🎫 Ticket Criado — Título" },
  { id: "msg_field_ticket_desc", render: () => "🎫 Ticket Criado — Descrição" },
  { id: "msg_field_close_btn", render: () => "🔒 Texto do Botão Fechar" },
  { id: "msg_field_closing", render: () => "🔒 Mensagem ao Fechar" },
  { id: "msg_field_modal_answers", render: () => "📋 Título das Respostas do Modal" },
  { id: "msg_field_seq_start_title", render: () => "📝 Form Sequencial — Título Início" },
  { id: "msg_field_seq_start_desc", render: () => "📝 Form Sequencial — Descrição Início" },
  { id: "msg_field_seq_cancel", render: () => "📝 Form Sequencial — Mensagem Cancelado" },
  { id: "msg_field_seq_summary", render: () => "📝 Form Sequencial — Título do Resumo" },
  { id: "msg_field_transcript_title", render: () => "📄 Transcript — Título no canal" },
  { id: "msg_field_transcript_dm_title", render: () => "📄 Transcript — Título na DM" },
  { id: "msg_field_transcript_dm_desc", render: () => "📄 Transcript — Descrição na DM" },
  { id: "select_message_placeholder", render: () => "Escolher mensagem para editar" },
  { id: "msg_custom_label", render: () => "✏️ Personalizada" },
  { id: "msg_default_label", render: () => "— Padrão da Ayami" },
  { id: "btn_reset_all", render: () => "🧹 Restaurar Todas ao Padrão" },
  { id: "messages_header", render: (ctx) =>
    `# 💬 Mensagens ${ctx.carinho}\n` +
    `Deixa tudo com a sua cara! O que não mexer, eu cuido~\n\n${ctx.statusList}` },
  { id: "msg_status_custom_icon", render: () => "✏️" },
  { id: "msg_status_default_icon", render: () => "⚪" },

  { id: "edit_message_field_label", render: (ctx) => `Texto${ctx.vars ? ` (vars: ${ctx.vars})` : ''}` },
  { id: "edit_message_placeholder", render: () => "Deixe vazio para usar o texto padrão da Ayami" },

  { id: "btn_toggle_hub_off", render: () => "⏸️ Desativar Select Hub" },
  { id: "btn_toggle_hub_on", render: () => "▶️ Ativar Select Hub" },
  { id: "btn_select_text", render: () => "✏️ Texto do Select" },
  { id: "ask_select_placeholder", render: (ctx) => `${ctx.pensando} Qual o texto exibido no select menu (placeholder)?` },
  { id: "btn_add_option", render: () => "➕ Criar Opção" },
  { id: "edit_existing_option_desc", render: () => "Configurar staff, modal, form e embed desta opção" },
  { id: "select_configure_existing_placeholder", render: () => "⚙️ Configurar uma opção existente" },
  { id: "btn_remove_option", render: () => "🗑️ Remover Última Opção" },
  { id: "selecthub_header", render: (ctx) =>
    `# 🧩 Select Menu ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `Em vez de um botão só, mostro várias opções de atendimento!\n` +
    `Cada uma com seu próprio staff, modal e formulário ${ctx.feliz}\n\n` +
    `> Status: ${ctx.status}\n\n` +
    `**Opções (${ctx.count}/25):**\n${ctx.list}` },
  { id: "no_options", render: () => "_Nenhuma opção criada_" },

  { id: "new_option_modal_title", render: () => "Nova Opção do Select" },
  { id: "option_name_label", render: () => "Nome da opção" },
  { id: "option_desc_label", render: () => "Descrição (opcional)" },
  { id: "option_emoji_label", render: () => "Emoji (opcional)" },
  { id: "option_created", render: (ctx) => `${ctx.festa} Opção **${ctx.label}** criada! Configure-a abaixo.` },

  { id: "option_not_found", render: () => "❌ Opção não encontrada." },
  { id: "option_header", render: (ctx) =>
    `# ${ctx.optionEmoji} ${ctx.optionLabel} ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> 🎨 Embed: ${ctx.embedStatus}\n` +
    `> 🛡️ Staff: ${ctx.staffStatus}\n` +
    `> 🏷️ Nome: \`${ctx.name}\`` },
  { id: "welcome_embed_updated", render: (ctx) => `${ctx.curtida} Embed de boas-vindas atualizada!` },
  { id: "welcome_embed_removed", render: (ctx) => `${ctx.emduvida} Embed removida.` },
  { id: "welcome_embed_title_prefix", render: (ctx) => `Embed de Boas-Vindas — ${ctx.optionLabel}` },
  { id: "staff_role_option_placeholder", render: () => "👥 Adicionar cargo staff desta opção" },
  { id: "ask_option_ticket_name", render: (ctx) => `${ctx.pensando} Nome dos tickets criados por esta opção? Use \`{count}\` para o número.` },
  { id: "btn_modal_status", render: (ctx) => `📋 Modal (${ctx.status})` },
  { id: "btn_seqform_status", render: (ctx) => `📝 Form Sequencial (${ctx.status})` },
  { id: "btn_delete_option", render: () => "🗑️ Excluir Opção" },
  { id: "option_deleted", render: (ctx) => `${ctx.chorando} Opção **${ctx.label}** excluída.` },

  { id: "panel_not_found_short", render: () => "❌ Painel não encontrado." },
  { id: "modal_answer_title_default", render: () => "Formulário de Atendimento" },
  { id: "default_ticket_created_title", render: () => "🎫 Ticket Criado" },
  { id: "default_ticket_created_desc", render: () =>
    "Olá {user}! Sua solicitação foi recebida.\nUm membro da equipe responderá em breve." },
  { id: "default_close_button_label", render: () => "Fechar Ticket" },
  { id: "default_modal_answers_title", render: () => "📋 Respostas do Formulário" },
  { id: "default_seq_intro_title", render: () => "📋 Formulário de Atendimento" },
  { id: "default_seq_intro_desc", render: () =>
    "Olá {user}! Vou te fazer algumas perguntas.\nVocê tem {timeout}s para responder cada uma." },
  { id: "default_seq_cancelled", render: () => "⚠️ Formulário encerrado." },
  { id: "default_seq_summary_title", render: () => "✅ Respostas Recebidas" },
  { id: "ticket_created_success", render: (ctx) => `${ctx.feliz} Ticket criado em <#${ctx.channelId}>!` },

  { id: "default_closing_message", render: () => "⛔ Este ticket será fechado em 10 segundos..." },
  { id: "default_transcript_title", render: () => "📄 Transcript" },
  { id: "default_transcript_dm_title", render: () => "📄 Seu Transcript" },
  { id: "default_transcript_dm_desc", render: () => "Aqui está o histórico do seu atendimento, {user}!" },
  { id: "eb_default_title", render: () => "🎨 Editor de Embed" },
  { id: "eb_field_select_placeholder", render: () => "✏️ Editar campo da embed…" },
  { id: "eb_field_title", render: () => "Título" },
  { id: "eb_field_description", render: () => "Descrição" },
  { id: "eb_field_url", render: () => "URL do Título" },
  { id: "eb_field_author_name", render: () => "Author Nome" },
  { id: "eb_field_author_icon", render: () => "Author Icon URL" },
  { id: "eb_field_author_url", render: () => "Author URL" },
  { id: "eb_field_footer_text", render: () => "Footer Texto" },
  { id: "eb_field_footer_icon", render: () => "Footer Icon URL" },
  { id: "eb_field_thumbnail", render: () => "Thumbnail URL" },
  { id: "eb_field_image", render: () => "Image URL" },
  { id: "eb_edit_prefix", render: () => "Editar" },
  { id: "eb_fields_manage_placeholder", render: () => "📊 Gerenciar Fields…" },
  { id: "eb_add_field_label", render: () => "➕ Adicionar Field" },
  { id: "eb_add_field_desc", render: (ctx) => `Atual: ${ctx.count}/25` },
  { id: "eb_remove_field_label", render: () => "🗑️ Remover Última" },
  { id: "eb_add_field_modal_title", render: () => "Adicionar Field" },
  { id: "eb_field_name_label", render: () => "Nome do field" },
  { id: "eb_field_value_label", render: () => "Valor do field" },
  { id: "eb_field_inline_label", render: () => "Inline? (sim/não)" },
  { id: "eb_field_inline_placeholder", render: () => "não" },
  { id: "eb_color_select_placeholder", render: () => "🎨 Escolher cor…" },
  { id: "eb_color_blue_ayami", render: () => "🔵 Azul Ayami" },
  { id: "eb_color_blue_hair", render: () => "💙 Azul Cabelo" },
  { id: "eb_color_dark_blue", render: () => "🌙 Azul Escuro" },
  { id: "eb_color_gold", render: () => "⭐ Dourado" },
  { id: "eb_color_pink", render: () => "🌸 Rosa" },
  { id: "eb_color_green", render: () => "🟢 Verde" },
  { id: "eb_color_red", render: () => "🔴 Vermelho" },
  { id: "eb_color_yellow", render: () => "🟡 Amarelo" },
  { id: "eb_color_orange", render: () => "🟠 Laranja" },
  { id: "eb_color_purple", render: () => "🟣 Roxo" },
  { id: "eb_color_black", render: () => "⚫ Preto" },
  { id: "eb_color_custom", render: () => "🎨 HEX Personalizado" },
  { id: "eb_custom_hex_modal_title", render: () => "Cor HEX Personalizada" },
  { id: "eb_hex_label", render: () => "HEX (ex: FF5733)" },
  { id: "eb_hex_placeholder", render: () => "FF5733" },
  { id: "eb_confirm_label", render: () => "✅ Confirmar embed" },
  { id: "eb_remove_label", render: () => "🗑️ Remover embed" },
  { id: "eb_cancel_label", render: () => "✖️ Cancelar" },
  { id: "eb_builder_content", render: (ctx) => `🎨 **${ctx.title}** — o preview abaixo é exatamente como a embed vai ficar!` },
  { id: "eb_blank_placeholder", render: () => "*Embed em branco — comece escolhendo um campo para editar abaixo* 👇" },

  { id: "sq_answer_invalid", render: (ctx) => `⚠️ <@${ctx.userId}> Resposta inválida. Tente novamente.` },
  { id: "sq_attachment_prompt", render: () => "_Envie um arquivo ou imagem como resposta._" },
  { id: "sq_attachment_required", render: (ctx) => `⚠️ <@${ctx.userId}> Envie um arquivo/imagem como resposta (ou digite \`cancelar\`).` },
  { id: "sq_question_footer", render: (ctx) => `Pergunta ${ctx.index} de ${ctx.total}` },
  { id: "sq_question_footer_component", render: (ctx) => `Pergunta ${ctx.index} de ${ctx.total} · responda pelo menu abaixo` },
  { id: "sq_component_placeholder", render: () => "Escolha uma opção..." },
  { id: "sq_completed_title", render: () => "✅ Perguntas Respondidas!" },
  { id: "sq_completed_desc", render: () => "Já anotei tudo! Agora é só esperar a equipe te chamar~ 🌸" },
  { id: "sq_log_new_form", render: (ctx) => `📥 Novo formulário de <@${ctx.userId}> — ticket: <#${ctx.channelId}>` },
  { id: "sq_answered_by_footer", render: (ctx) => `Respondido por ${ctx.userId}` },
  { id: "sq_yes", render: () => "Sim" },
  { id: "sq_no", render: () => "Não" },
  { id: "sq_hint_number", render: () => "_Responda com um número_" },
  { id: "sq_hint_yesno", render: () => "_Responda com **Sim** ou **Não**_" },
  { id: "sq_hint_short", render: () => "_Resposta curta (até 100 caracteres)_" },
  { id: "sq_attachment_link_label", render: () => "anexo" },

  { id: "tr_locale_tag", render: () => "pt-BR" },
  { id: "tr_summary_desc", render: (ctx) => `Canal: **${ctx.channelName}**\nFechado por: <@${ctx.closedBy}>\nMensagens: **${ctx.count}**` },
  { id: "tr_dm_desc_default", render: (ctx) => `Seu ticket **#${ctx.channelName}** foi fechado.\nSegue o transcript em anexo.` },
  { id: "tr_html_title_prefix", render: () => "Transcript" },
  { id: "tr_closed_by_label", render: () => "Fechado por" },
  { id: "tr_messages_label", render: (ctx) => `${ctx.count} mensagem(s)` },
  { id: "tr_generated_at_label", render: () => "Gerado em" },
  { id: "tr_footer_generated", render: () => "Transcript gerado automaticamente" },
  { id: "tr_txt_header_title", render: () => "=== TRANSCRIPT ===" },
  { id: "tr_txt_channel_label", render: () => "Canal" },
  { id: "tr_txt_closed_by_label", render: () => "Fechado por" },
  { id: "tr_txt_messages_label", render: () => "Mensagens" },
  { id: "tr_txt_generated_label", render: () => "Gerado em" },
  { id: "tr_embed_tag", render: () => "EMBED" },
  { id: "tr_attachment_tag", render: () => "ANEXO" },
  { id: "tr_unknown_user", render: () => "Desconhecido" },
];

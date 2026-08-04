"use strict";

module.exports = [
  { id: "home_title", render: (ctx) =>
    `# 🎫 Sistema de Tickets ${ctx.animada}\n¡Hola! Soy Ayami ${ctx.corao} y te voy a ayudar a montar la atención de tu servidor!` },
  { id: "btn_panels", render: (ctx) => `📋 Paneles (${ctx.count})` },
  { id: "btn_new_panel", render: () => "✨ Nuevo Panel" },

  { id: "no_panels_title", render: (ctx) => `# 📋 Tus Paneles ${ctx.emburrada}\nAún no hay paneles... ¿creamos el primero?` },
  { id: "panels_title", render: (ctx) => `# 📋 Tus Paneles (${ctx.count}) ${ctx.feliz}\n${ctx.list}` },
  { id: "select_which_panel", render: () => "✨ ¿Qué panel quieres ver?" },
  { id: "panel_hub_multi", render: () => "Menú de selección" },
  { id: "panel_hub_single", render: () => "Botón único" },
  { id: "panel_option_desc", render: (ctx) => `${ctx.staffCount} staff • ${ctx.hubLabel}` },
  { id: "btn_back", render: () => "⬅️ Volver" },

  { id: "modal_create_panel_title", render: () => "Crear Panel de Ticket ✨" },
  { id: "modal_panel_id_label", render: () => "ID del panel (sin espacios)" },
  { id: "modal_panel_id_placeholder", render: () => "soporte, denuncias, colaboraciones..." },
  { id: "invalid_id", render: () => "❌ ¡ID inválido!" },
  { id: "panel_id_exists", render: (ctx) => `${ctx.emburrada} Ya existe un panel con ID **${ctx.panelId}**.` },

  { id: "panel_not_found", render: (ctx) => `# ${ctx.emduvida} No encontré ese panel...\n¡Puede que haya sido eliminado!` },
  { id: "opt_edit_embed", render: () => "🎨 Editar Embed" },
  { id: "opt_create_embed", render: () => "✨ Crear Embed" },
  { id: "opt_embed_desc", render: () => "La carita de tu panel" },
  { id: "opt_channel_category", render: () => "📌 Canal y Categoría" },
  { id: "opt_configured", render: () => "Ya configurado" },
  { id: "opt_not_configured", render: () => "Aún sin configurar" },
  { id: "opt_staff_name", render: () => "👥 Staff y Nombre" },
  { id: "opt_staff_name_desc", render: () => "Quién atiende y cómo se llama el ticket" },
  { id: "opt_creation_type", render: () => "⚙️ Tipo de Creación" },
  { id: "opt_modal", render: () => "📋 Modal" },
  { id: "opt_active", render: () => "Activo" },
  { id: "opt_inactive", render: () => "Inactivo" },
  { id: "opt_seqform", render: () => "📝 Formulario Secuencial" },
  { id: "opt_autorole", render: () => "🏷️ Auto-Rol" },
  { id: "opt_transcript", render: () => "📄 Transcripción" },
  { id: "opt_selecthub", render: () => "🧩 Menú de Selección" },
  { id: "opt_selecthub_desc", render: (ctx) => `${ctx.count} opción(es)` },
  { id: "opt_messages", render: () => "💬 Mensajes" },
  { id: "opt_messages_desc", render: () => "¡Personalízalo todo a tu gusto!" },
  { id: "select_what_configure", render: () => "✨ ¿Qué quieres configurar?" },
  { id: "btn_publish", render: () => "🚀 Publicar" },
  { id: "btn_delete", render: () => "🗑️ Eliminar" },
  { id: "embed_ready", render: () => "¡lista!" },
  { id: "embed_missing", render: () => "falta crearla" },
  { id: "no_channel_chosen", render: () => "sin elegir" },
  { id: "no_staff_yet", render: () => "nadie todavía" },
  { id: "panel_header", render: (ctx) =>
    `# 🎫 ${ctx.panelId} ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> 🎨 Embed: ${ctx.embedStatus}\n` +
    `> 📌 Canal: ${ctx.channelStatus}\n` +
    `> 👥 Staff: ${ctx.staffStatus}` +
    (ctx.cv2Active ? `\n> 🧱 Diseño: **Components V2** (configurado en el Dashboard — edítalo ahí)` : '') },
  { id: "embed_updated", render: (ctx) => `${ctx.curtida} ¡Quedó preciosa!` },
  { id: "embed_removed", render: (ctx) => `${ctx.emduvida} Quité la embed.` },
  { id: "embed_title_prefix", render: (ctx) => `Embed — ${ctx.panelId}` },

  { id: "confirm_delete_title", render: (ctx) => `# ${ctx.assustada} ¿Eliminar el panel?\n¿Seguro? Después no se puede deshacer...` },
  { id: "btn_confirm_delete", render: () => "✅ Sí, eliminar" },
  { id: "btn_cancel", render: () => "❌ Cancelar" },

  { id: "publish_no_channel", render: (ctx) => `${ctx.emduvida} Elige un canal primero, ¿vale?` },
  { id: "publish_no_embed", render: (ctx) => `${ctx.emduvida} ¡Aún te falta crear la embed!` },
  { id: "select_service_type_placeholder", render: () => "Selecciona el tipo de atención" },
  { id: "open_ticket_button", render: () => "🎫 Abrir Ticket" },
  { id: "publish_success", render: (ctx) => `${ctx.festa} ¡Listo! Publicado en <#${ctx.channelId}>~` },

  { id: "destino_channel_placeholder", render: () => "📌 Canal donde se enviará el panel" },
  { id: "destino_category_placeholder", render: () => "📂 Categoría donde se crearán los tickets" },
  { id: "destino_title", render: (ctx) =>
    `# 📌 Canal y Categoría ${ctx.feliz}\n` +
    `> 📢 Canal: ${ctx.channelStatus}\n` +
    `> 📂 Categoría: ${ctx.categoryStatus}` },
  { id: "destino_none_channel", render: () => "ninguno todavía" },
  { id: "destino_none_category", render: () => "ninguna todavía" },

  { id: "staff_role_select_placeholder", render: () => "👥 Añadir rol de staff" },
  { id: "btn_clear_staff", render: () => "🧹 Limpiar Staff" },
  { id: "btn_ticket_name", render: () => "✏️ Nombre del Ticket" },
  { id: "ask_ticket_name", render: (ctx) => `${ctx.pensando} ¿Cómo se va a llamar el ticket?\nUsa \`{count}\` para el número. Ej: \`ticket-{count}\`` },
  { id: "staff_title", render: (ctx) =>
    `# 👥 Staff y Nombre ${ctx.feliz}\n` +
    `> 🛡️ Staff: ${ctx.staffStatus}\n` +
    `> 🏷️ Nombre: \`${ctx.name}\`` },

  { id: "tipo_label_channel", render: () => "📁 Canal de Texto" },
  { id: "tipo_label_thread_public", render: () => "🧵 Hilo Público" },
  { id: "tipo_label_thread_private", render: () => "🔒 Hilo Privado" },
  { id: "tipo_select_placeholder", render: () => "Seleccionar tipo de creación" },
  { id: "tipo_current_label", render: () => "✅ Actual" },
  { id: "tipo_title", render: (ctx) => `# ⚙️ Tipo de Creación ${ctx.feliz}\n¿Cómo se crea el ticket? Actual: ${ctx.current}` },

  { id: "modal_no_fields", render: () => "_Ningún campo añadido_" },
  { id: "modal_field_short", render: () => "corto" },
  { id: "modal_field_paragraph", render: () => "párrafo" },
  { id: "modal_field_required_tag", render: () => " *obligatorio*" },
  { id: "btn_toggle_modal_off", render: () => "⏸️ Desactivar Modal" },
  { id: "btn_toggle_modal_on", render: () => "▶️ Activar Modal" },
  { id: "btn_modal_title", render: () => "✏️ Título del Modal" },
  { id: "ask_modal_title", render: (ctx) => `${ctx.pensando} ¿Cuál es el título del modal?` },
  { id: "btn_add_field", render: () => "➕ Añadir Campo" },
  { id: "btn_remove_field", render: () => "🗑️ Quitar Último Campo" },
  { id: "modal_title_default", render: () => "Formulario de Atención" },
  { id: "modal_header", render: (ctx) =>
    `# 📋 Modal ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `¡Aparece cuando alguien pulsa Abrir Ticket!\n` +
    `> Estado: ${ctx.status}\n` +
    `> Título: \`${ctx.title}\`\n\n` +
    `**Campos (${ctx.count}/5):**\n${ctx.list}` },
  { id: "modal_header_option", render: (ctx) =>
    `# 📋 Modal — ${ctx.optionLabel} ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> Estado: ${ctx.status}\n` +
    `> Título: \`${ctx.title}\`\n\n` +
    `**Campos (${ctx.count}/5):**\n${ctx.list}` },
  { id: "status_on", render: () => "🟢 Activo" },
  { id: "status_off", render: () => "🔴 Inactivo" },

  { id: "add_field_modal_title", render: () => "Añadir Campo del Modal" },
  { id: "field_label_label", render: () => "Pregunta/etiqueta del campo" },
  { id: "field_placeholder_label", render: () => "Placeholder (opcional)" },
  { id: "field_style_label", render: () => "Estilo: corto o párrafo" },
  { id: "field_style_placeholder", render: () => "corto" },
  { id: "field_required_label", render: () => "¿Obligatorio? (sí/no)" },
  { id: "field_required_placeholder", render: () => "sí" },
  { id: "field_added", render: (ctx) => `${ctx.curtida} ¡Campo añadido!` },

  { id: "seq_no_questions", render: () => "_Ninguna pregunta añadida_" },
  { id: "seq_question_required_tag", render: () => " *obligatoria*" },
  { id: "btn_toggle_form_off", render: () => "⏸️ Desactivar Formulario" },
  { id: "btn_toggle_form_on", render: () => "▶️ Activar Formulario" },
  { id: "btn_add_question", render: () => "➕ Añadir Pregunta" },
  { id: "btn_remove_question", render: () => "🗑️ Quitar Última" },
  { id: "timeout_30s", render: () => "30 segundos" },
  { id: "timeout_1m", render: () => "1 minuto" },
  { id: "timeout_2m", render: () => "2 minutos" },
  { id: "timeout_5m", render: () => "5 minutos" },
  { id: "timeout_10m", render: () => "10 minutos" },
  { id: "timeout_custom", render: () => "✏️ Personalizado (escribir)" },
  { id: "timeout_select_placeholder", render: (ctx) => `⏱️ Tiempo por pregunta — Actual: ${ctx.seconds}s` },
  { id: "ask_custom_seconds", render: (ctx) => `${ctx.pensando} ¿Cuántos **segundos** tendrá el usuario para responder cada pregunta? *(5 a 600)*` },
  { id: "invalid_seconds", render: (ctx) => `${ctx.emduvida} ¡Valor inválido! Usa entre 5 y 600 segundos.` },
  { id: "send_mode_only_ticket", render: () => "🎫 Solo en el ticket" },
  { id: "send_mode_log_channel", render: () => "📋 Canal de registro" },
  { id: "selected_label", render: () => "Seleccionado" },
  { id: "send_mode_select_placeholder", render: () => "📤 ¿A dónde enviar las respuestas?" },
  { id: "log_channel_select_placeholder", render: () => "📋 Canal de registro de respuestas" },
  { id: "seq_header", render: (ctx) =>
    `# 📝 Formulario Secuencial ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `¡Hago las preguntas en el chat, una por una!\n` +
    `> Estado: ${ctx.status}\n` +
    `> Tiempo por pregunta: ${ctx.seconds}s\n` +
    `> El resumen va a: ${ctx.destination}\n\n` +
    `**Preguntas (${ctx.count}/${ctx.max}):**\n${ctx.list}` },
  { id: "seq_header_option", render: (ctx) =>
    `# 📝 Formulario Secuencial — ${ctx.optionLabel} ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> Estado: ${ctx.status}\n` +
    `> Tiempo por pregunta: ${ctx.seconds}s\n` +
    `> El resumen va a: ${ctx.destination}\n\n` +
    `**Preguntas (${ctx.count}/${ctx.max}):**\n${ctx.list}` },
  { id: "seq_dest_own_ticket", render: () => "🎫 el propio ticket" },
  { id: "question_added", render: (ctx) => `${ctx.curtida} ¡Pregunta añadida!` },

  { id: "question_type_select_placeholder", render: () => "¿Qué tipo de pregunta es?" },
  { id: "qtype_short_label", render: () => "📝 Texto corto" },
  { id: "qtype_short_desc", render: () => "Respuesta de hasta ~100 caracteres" },
  { id: "qtype_long_label", render: () => "📄 Texto largo" },
  { id: "qtype_long_desc", render: () => "Respuesta de hasta 2000 caracteres" },
  { id: "qtype_number_label", render: () => "🔢 Número" },
  { id: "qtype_number_desc", render: () => "Solo acepta números" },
  { id: "qtype_yesno_label", render: () => "✅ Sí/No" },
  { id: "qtype_yesno_desc", render: () => "Respuesta sí o no" },
  { id: "qtype_select_label", render: () => "📋 Selección" },
  { id: "qtype_select_desc", render: () => "Elegir 1 opción de una lista (Premium)" },
  { id: "qtype_multiple_label", render: () => "☑️ Selección múltiple" },
  { id: "qtype_multiple_desc", render: () => "Elegir varias opciones de una lista (Premium)" },
  { id: "qtype_checkbox_label", render: () => "🔲 Casillas" },
  { id: "qtype_checkbox_desc", render: () => "Marcar 0 o más opciones (Premium)" },
  { id: "qtype_member_label", render: () => "👤 Selección de miembro" },
  { id: "qtype_member_desc", render: () => "Elegir un miembro del servidor (Premium)" },
  { id: "qtype_role_label", render: () => "🏷️ Selección de rol" },
  { id: "qtype_role_desc", render: () => "Elegir un rol del servidor (Premium)" },
  { id: "qtype_channel_label", render: () => "📌 Selección de canal" },
  { id: "qtype_channel_desc", render: () => "Elegir un canal del servidor (Premium)" },
  { id: "qtype_attachment_label", render: () => "📎 Adjunto" },
  { id: "qtype_attachment_desc", render: () => "Enviar un archivo/imagen (Premium)" },
  { id: "question_limit_reached", render: (ctx) =>
    `Límite de preguntas del plan ${ctx.planEmoji} ${ctx.planName} alcanzado (${ctx.max}). Suscríbete a un plan mayor en /premium para añadir más.` },
  { id: "advanced_question_limit_reached", render: (ctx) =>
    `Límite de preguntas avanzadas (selección/selección múltiple/casillas/adjunto/miembro/rol/canal) del plan ${ctx.planEmoji} ${ctx.planName} alcanzado (${ctx.max}). Suscríbete a un plan mayor en /premium para desbloquear más.` },
  { id: "flow_intermediate_title", render: () => "📋 ¿Qué tipo de pregunta es?" },
  { id: "infinity_symbol", render: () => "∞" },

  { id: "add_question_modal_title", render: () => "Añadir Pregunta" },
  { id: "question_text_label", render: () => "Texto de la pregunta" },
  { id: "question_options_label", render: () => "Opciones (separadas por comas)" },
  { id: "question_options_placeholder", render: () => "Ej: Duda, Bug, Sugerencia, Denuncia" },
  { id: "question_required_label", render: () => "¿Obligatoria? (sí/no)" },
  { id: "question_required_placeholder", render: () => "sí" },

  { id: "role_type_select_label", render: (ctx) => `Tipo del rol <@&${ctx.roleId}>` },
  { id: "role_permanent_label", render: () => "♾️ Permanente" },
  { id: "role_permanent_desc", render: () => "El rol se queda para siempre" },
  { id: "role_temp_select_label", render: () => "⏱️ Temporal" },
  { id: "role_temp_desc", render: () => "Se quita después de X minutos" },
  { id: "role_linked_select_label", render: () => "🔗 Vinculado al Ticket" },
  { id: "role_linked_desc", render: () => "Se quita cuando el ticket se cierra" },
  { id: "ask_role_duration", render: (ctx) => `${ctx.pensando} ¿En cuántos **minutos** debe quitarse el rol <@&${ctx.roleId}>?` },
  { id: "invalid_value", render: (ctx) => `${ctx.emduvida} ¡Valor inválido!` },
  { id: "role_behavior_title", render: (ctx) => `# 🏷️ Este rol es... ${ctx.pensando}\n¿Cómo debe comportarse el rol <@&${ctx.roleId}>?` },
  { id: "autorole_add_role_placeholder", render: () => "➕ Añadir rol automático (asignado al abrir el ticket)" },
  { id: "btn_remove_role", render: () => "🗑️ Quitar Último" },
  { id: "btn_toggle_off", render: () => "⏸️ Desactivar" },
  { id: "btn_toggle_on", render: () => "▶️ Activar" },
  { id: "no_roles", render: () => "_Ningún rol configurado_" },
  { id: "role_temp_result_label", render: (ctx) => `⏱️ Temporal (${ctx.minutes}min)` },
  { id: "role_linked_result_label", render: () => "🔗 Vinculado (desaparece cuando se cierra el ticket)" },
  { id: "autorole_header", render: (ctx) =>
    `# 🏷️ Auto-Rol ${ctx.feliz}\n` +
    `¡Doy un rol automático a quien abre un ticket!\n` +
    `> Estado: ${ctx.status}\n\n` +
    `> ♾️ Permanente — se queda para siempre\n` +
    `> ⏱️ Temporal — desaparece después de X minutos\n` +
    `> 🔗 Vinculado — desaparece cuando se cierra el ticket\n\n` +
    `**Roles:**\n${ctx.list}` },

  { id: "transcript_channel_placeholder", render: () => "📌 Canal para guardar transcripciones" },
  { id: "btn_dm_toggle_off", render: () => "🔕 No enviar MD" },
  { id: "btn_dm_toggle_on", render: () => "🔔 Enviar MD al usuario" },
  { id: "transcript_header", render: (ctx) =>
    `# 📄 Transcripción ${ctx.feliz}\n` +
    `¡Guardo un historial de la conversación cuando se cierra el ticket!\n` +
    `> Estado: ${ctx.status}\n` +
    `> Canal: ${ctx.channel}\n` +
    `> Enviar por MD: ${ctx.dm}` },
  { id: "dm_yes", render: () => "✅ Sí" },
  { id: "dm_no", render: () => "❌ No" },

  { id: "msg_field_ticket_title", render: () => "🎫 Ticket Creado — Título" },
  { id: "msg_field_ticket_desc", render: () => "🎫 Ticket Creado — Descripción" },
  { id: "msg_field_close_btn", render: () => "🔒 Texto del Botón Cerrar" },
  { id: "msg_field_closing", render: () => "🔒 Mensaje al Cerrar" },
  { id: "msg_field_modal_answers", render: () => "📋 Título de las Respuestas del Modal" },
  { id: "msg_field_seq_start_title", render: () => "📝 Formulario Secuencial — Título de Inicio" },
  { id: "msg_field_seq_start_desc", render: () => "📝 Formulario Secuencial — Descripción de Inicio" },
  { id: "msg_field_seq_cancel", render: () => "📝 Formulario Secuencial — Mensaje de Cancelado" },
  { id: "msg_field_seq_summary", render: () => "📝 Formulario Secuencial — Título del Resumen" },
  { id: "msg_field_transcript_title", render: () => "📄 Transcripción — Título en el canal" },
  { id: "msg_field_transcript_dm_title", render: () => "📄 Transcripción — Título en el MD" },
  { id: "msg_field_transcript_dm_desc", render: () => "📄 Transcripción — Descripción en el MD" },
  { id: "select_message_placeholder", render: () => "Elegir mensaje para editar" },
  { id: "msg_custom_label", render: () => "✏️ Personalizado" },
  { id: "msg_default_label", render: () => "— Predeterminado de Ayami" },
  { id: "btn_reset_all", render: () => "🧹 Restaurar Todos al Predeterminado" },
  { id: "messages_header", render: (ctx) =>
    `# 💬 Mensajes ${ctx.carinho}\n` +
    `¡Personalízalo todo a tu gusto! Lo que no toques, yo me encargo~\n\n${ctx.statusList}` },
  { id: "msg_status_custom_icon", render: () => "✏️" },
  { id: "msg_status_default_icon", render: () => "⚪" },

  { id: "edit_message_field_label", render: (ctx) => `Texto${ctx.vars ? ` (vars: ${ctx.vars})` : ''}` },
  { id: "edit_message_placeholder", render: () => "Déjalo vacío para usar el texto predeterminado de Ayami" },

  { id: "btn_toggle_hub_off", render: () => "⏸️ Desactivar Menú de Selección" },
  { id: "btn_toggle_hub_on", render: () => "▶️ Activar Menú de Selección" },
  { id: "btn_select_text", render: () => "✏️ Texto del Select" },
  { id: "ask_select_placeholder", render: (ctx) => `${ctx.pensando} ¿Qué texto se muestra en el menú de selección (placeholder)?` },
  { id: "btn_add_option", render: () => "➕ Crear Opción" },
  { id: "edit_existing_option_desc", render: () => "Configurar staff, modal, formulario y embed de esta opción" },
  { id: "select_configure_existing_placeholder", render: () => "⚙️ Configurar una opción existente" },
  { id: "btn_remove_option", render: () => "🗑️ Quitar Última Opción" },
  { id: "selecthub_header", render: (ctx) =>
    `# 🧩 Menú de Selección ${ctx.animada}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `¡En vez de un solo botón, muestro varias opciones de atención!\n` +
    `Cada una con su propio staff, modal y formulario ${ctx.feliz}\n\n` +
    `> Estado: ${ctx.status}\n\n` +
    `**Opciones (${ctx.count}/25):**\n${ctx.list}` },
  { id: "no_options", render: () => "_Ninguna opción creada_" },

  { id: "new_option_modal_title", render: () => "Nueva Opción del Select" },
  { id: "option_name_label", render: () => "Nombre de la opción" },
  { id: "option_desc_label", render: () => "Descripción (opcional)" },
  { id: "option_emoji_label", render: () => "Emoji (opcional)" },
  { id: "option_created", render: (ctx) => `${ctx.festa} ¡Opción **${ctx.label}** creada! Configúrala abajo.` },

  { id: "option_not_found", render: () => "❌ Opción no encontrada." },
  { id: "option_header", render: (ctx) =>
    `# ${ctx.optionEmoji} ${ctx.optionLabel} ${ctx.feliz}\n` +
    (ctx.successMsg ? `${ctx.successMsg}\n\n` : '') +
    `> 🎨 Embed: ${ctx.embedStatus}\n` +
    `> 🛡️ Staff: ${ctx.staffStatus}\n` +
    `> 🏷️ Nombre: \`${ctx.name}\`` },
  { id: "welcome_embed_updated", render: (ctx) => `${ctx.curtida} ¡Embed de bienvenida actualizada!` },
  { id: "welcome_embed_removed", render: (ctx) => `${ctx.emduvida} Embed eliminada.` },
  { id: "welcome_embed_title_prefix", render: (ctx) => `Embed de Bienvenida — ${ctx.optionLabel}` },
  { id: "staff_role_option_placeholder", render: () => "👥 Añadir rol de staff de esta opción" },
  { id: "ask_option_ticket_name", render: (ctx) => `${ctx.pensando} ¿Cómo se llamarán los tickets creados por esta opción? Usa \`{count}\` para el número.` },
  { id: "btn_modal_status", render: (ctx) => `📋 Modal (${ctx.status})` },
  { id: "btn_seqform_status", render: (ctx) => `📝 Formulario Secuencial (${ctx.status})` },
  { id: "btn_delete_option", render: () => "🗑️ Eliminar Opción" },
  { id: "option_deleted", render: (ctx) => `${ctx.chorando} Opción **${ctx.label}** eliminada.` },

  { id: "panel_not_found_short", render: () => "❌ Panel no encontrado." },
  { id: "modal_answer_title_default", render: () => "Formulario de Atención" },
  { id: "default_ticket_created_title", render: () => "🎫 Ticket Creado" },
  { id: "default_ticket_created_desc", render: () =>
    "¡Hola {user}! Tu solicitud fue recibida.\nUn miembro del staff te responderá en breve." },
  { id: "default_close_button_label", render: () => "Cerrar Ticket" },
  { id: "default_modal_answers_title", render: () => "📋 Respuestas del Formulario" },
  { id: "default_seq_intro_title", render: () => "📋 Formulario de Atención" },
  { id: "default_seq_intro_desc", render: () =>
    "¡Hola {user}! Te voy a hacer algunas preguntas.\nTienes {timeout}s para responder cada una." },
  { id: "default_seq_cancelled", render: () => "⚠️ Formulario cerrado." },
  { id: "default_seq_summary_title", render: () => "✅ Respuestas Recibidas" },
  { id: "ticket_created_success", render: (ctx) => `${ctx.feliz} ¡Ticket creado en <#${ctx.channelId}>!` },

  { id: "default_closing_message", render: () => "⛔ Este ticket se cerrará en 10 segundos..." },
  { id: "default_transcript_title", render: () => "📄 Transcripción" },
  { id: "default_transcript_dm_title", render: () => "📄 Tu Transcripción" },
  { id: "default_transcript_dm_desc", render: () => "¡Aquí está el historial de tu atención, {user}!" },
  { id: "eb_default_title", render: () => "🎨 Editor de Embed" },
  { id: "eb_field_select_placeholder", render: () => "✏️ Editar campo de la embed…" },
  { id: "eb_field_title", render: () => "Título" },
  { id: "eb_field_description", render: () => "Descripción" },
  { id: "eb_field_url", render: () => "URL del Título" },
  { id: "eb_field_author_name", render: () => "Nombre del Autor" },
  { id: "eb_field_author_icon", render: () => "Icono del Autor (URL)" },
  { id: "eb_field_author_url", render: () => "URL del Autor" },
  { id: "eb_field_footer_text", render: () => "Texto del Footer" },
  { id: "eb_field_footer_icon", render: () => "Icono del Footer (URL)" },
  { id: "eb_field_thumbnail", render: () => "URL de la Miniatura" },
  { id: "eb_field_image", render: () => "URL de la Imagen" },
  { id: "eb_edit_prefix", render: () => "Editar" },
  { id: "eb_fields_manage_placeholder", render: () => "📊 Gestionar Fields…" },
  { id: "eb_add_field_label", render: () => "➕ Añadir Field" },
  { id: "eb_add_field_desc", render: (ctx) => `Actual: ${ctx.count}/25` },
  { id: "eb_remove_field_label", render: () => "🗑️ Quitar Último" },
  { id: "eb_add_field_modal_title", render: () => "Añadir Field" },
  { id: "eb_field_name_label", render: () => "Nombre del field" },
  { id: "eb_field_value_label", render: () => "Valor del field" },
  { id: "eb_field_inline_label", render: () => "¿Inline? (sí/no)" },
  { id: "eb_field_inline_placeholder", render: () => "no" },
  { id: "eb_color_select_placeholder", render: () => "🎨 Elegir color…" },
  { id: "eb_color_blue_ayami", render: () => "🔵 Azul Ayami" },
  { id: "eb_color_blue_hair", render: () => "💙 Azul Cabello" },
  { id: "eb_color_dark_blue", render: () => "🌙 Azul Oscuro" },
  { id: "eb_color_gold", render: () => "⭐ Dorado" },
  { id: "eb_color_pink", render: () => "🌸 Rosa" },
  { id: "eb_color_green", render: () => "🟢 Verde" },
  { id: "eb_color_red", render: () => "🔴 Rojo" },
  { id: "eb_color_yellow", render: () => "🟡 Amarillo" },
  { id: "eb_color_orange", render: () => "🟠 Naranja" },
  { id: "eb_color_purple", render: () => "🟣 Morado" },
  { id: "eb_color_black", render: () => "⚫ Negro" },
  { id: "eb_color_custom", render: () => "🎨 HEX Personalizado" },
  { id: "eb_custom_hex_modal_title", render: () => "Color HEX Personalizado" },
  { id: "eb_hex_label", render: () => "HEX (ej: FF5733)" },
  { id: "eb_hex_placeholder", render: () => "FF5733" },
  { id: "eb_confirm_label", render: () => "✅ Confirmar embed" },
  { id: "eb_remove_label", render: () => "🗑️ Quitar embed" },
  { id: "eb_cancel_label", render: () => "✖️ Cancelar" },
  { id: "eb_builder_content", render: (ctx) => `🎨 **${ctx.title}** — ¡la vista previa de abajo es exactamente cómo quedará la embed!` },
  { id: "eb_blank_placeholder", render: () => "*Embed en blanco — empieza eligiendo un campo para editar abajo* 👇" },

  { id: "sq_answer_invalid", render: (ctx) => `⚠️ <@${ctx.userId}> Respuesta inválida. Inténtalo de nuevo.` },
  { id: "sq_attachment_prompt", render: () => "_Envía un archivo o imagen como respuesta._" },
  { id: "sq_attachment_required", render: (ctx) => `⚠️ <@${ctx.userId}> Envía un archivo/imagen como respuesta (o escribe \`cancelar\` para cancelar).` },
  { id: "sq_question_footer", render: (ctx) => `Pregunta ${ctx.index} de ${ctx.total}` },
  { id: "sq_question_footer_component", render: (ctx) => `Pregunta ${ctx.index} de ${ctx.total} · responde con el menú de abajo` },
  { id: "sq_component_placeholder", render: () => "Elige una opción..." },
  { id: "sq_completed_title", render: () => "✅ ¡Preguntas Respondidas!" },
  { id: "sq_completed_desc", render: () => "¡Ya lo anoté todo! Ahora solo falta esperar a que el equipo te contacte~ 🌸" },
  { id: "sq_log_new_form", render: (ctx) => `📥 Nuevo formulario de <@${ctx.userId}> — ticket: <#${ctx.channelId}>` },
  { id: "sq_answered_by_footer", render: (ctx) => `Respondido por ${ctx.userId}` },
  { id: "sq_yes", render: () => "Sí" },
  { id: "sq_no", render: () => "No" },
  { id: "sq_hint_number", render: () => "_Responde con un número_" },
  { id: "sq_hint_yesno", render: () => "_Responde con **Sí** o **No**_" },
  { id: "sq_hint_short", render: () => "_Respuesta corta (hasta 100 caracteres)_" },
  { id: "sq_attachment_link_label", render: () => "adjunto" },

  { id: "tr_locale_tag", render: () => "es-ES" },
  { id: "tr_summary_desc", render: (ctx) => `Canal: **${ctx.channelName}**\nCerrado por: <@${ctx.closedBy}>\nMensajes: **${ctx.count}**` },
  { id: "tr_dm_desc_default", render: (ctx) => `Tu ticket **#${ctx.channelName}** ha sido cerrado.\nAdjunto va la transcripción.` },
  { id: "tr_html_title_prefix", render: () => "Transcripción" },
  { id: "tr_closed_by_label", render: () => "Cerrado por" },
  { id: "tr_messages_label", render: (ctx) => `${ctx.count} mensaje(s)` },
  { id: "tr_generated_at_label", render: () => "Generado el" },
  { id: "tr_footer_generated", render: () => "Transcripción generada automáticamente" },
  { id: "tr_txt_header_title", render: () => "=== TRANSCRIPCIÓN ===" },
  { id: "tr_txt_channel_label", render: () => "Canal" },
  { id: "tr_txt_closed_by_label", render: () => "Cerrado por" },
  { id: "tr_txt_messages_label", render: () => "Mensajes" },
  { id: "tr_txt_generated_label", render: () => "Generado el" },
  { id: "tr_embed_tag", render: () => "EMBED" },
  { id: "tr_attachment_tag", render: () => "ADJUNTO" },
  { id: "tr_unknown_user", render: () => "Desconocido" },

  { id: "claim_status_none", render: () => "👤 **Responsable:** Nadie todavía" },
  { id: "claim_status_set", render: (ctx) => `👤 **Responsable:** <@${ctx.userId}>` },
  { id: "btn_claim", render: () => "🖐️ Asumir Ticket" },
  { id: "btn_unclaim", render: () => "🔓 Liberar Ticket" },
  { id: "btn_transfer", render: () => "🔄 Transferir" },
  { id: "claim_no_permission", render: () => "❌ No tienes permiso para asumir este ticket." },
  { id: "claim_already_claimed", render: (ctx) => `${ctx.emburrada} Este ticket ya fue asumido por <@${ctx.userId}>.` },
  { id: "claim_success", render: (ctx) => `${ctx.feliz} <@${ctx.userId}> asumió este ticket.` },
  { id: "unclaim_no_permission", render: () => "❌ No tienes permiso para liberar este ticket." },
  { id: "unclaim_not_claimed", render: () => "Este ticket todavía no tiene responsable." },
  { id: "unclaim_success", render: (ctx) => `🔓 <@${ctx.userId}> liberó este ticket.` },
  { id: "transfer_no_permission", render: () => "❌ No tienes permiso para transferir este ticket." },
  { id: "transfer_select_placeholder", render: () => "Selecciona el nuevo responsable" },
  { id: "transfer_same_user", render: () => "Ese usuario ya es el responsable de este ticket." },
  { id: "transfer_success", render: (ctx) => `🔄 <@${ctx.fromUserId}> transfirió el ticket a <@${ctx.toUserId}>.` },
  { id: "log_claim_title", render: () => "🖐️ Ticket asumido" },
  { id: "log_unclaim_title", render: () => "🔓 Ticket liberado" },
  { id: "log_transfer_title", render: () => "🔄 Responsable transferido" },
  { id: "log_field_channel", render: () => "Canal" },
  { id: "log_field_by", render: () => "Ejecutado por" },
  { id: "log_field_previous", render: () => "Responsable anterior" },
  { id: "log_field_new", render: () => "Nuevo responsable" },
  { id: "log_none", render: () => "Nadie" },

  { id: "participant_ticket_not_found", render: () => "❌ No se pudieron encontrar los datos de este ticket." },
  { id: "participant_add_no_permission", render: () => "❌ No tienes permiso para agregar participantes." },
  { id: "participant_remove_no_permission", render: () => "❌ No tienes permiso para eliminar participantes." },
  { id: "participant_add_placeholder", render: () => "Selecciona el miembro a agregar" },
  { id: "participant_remove_placeholder", render: () => "Selecciona el miembro a eliminar" },
  { id: "participant_cannot_add_bot", render: () => "❌ No puedes agregar al bot como participante." },
  { id: "participant_already_in", render: (ctx) => `<@${ctx.userId}> ya forma parte de este ticket.` },
  { id: "participant_add_success", render: (ctx) => `➕ <@${ctx.userId}> fue agregado al ticket.` },
  { id: "participant_cannot_remove_owner", render: () => "❌ No puedes eliminar al creador del ticket." },
  { id: "participant_cannot_remove_bot", render: () => "❌ No puedes eliminar al bot del ticket." },
  { id: "participant_remove_success", render: (ctx) => `➖ <@${ctx.userId}> fue eliminado del ticket.` },
  { id: "log_participant_add_title", render: () => "➕ Participante agregado" },
  { id: "log_participant_remove_title", render: () => "➖ Participante eliminado" },
  { id: "log_field_participant", render: () => "Participante" },
  { id: "btn_add_participant", render: () => "➕ Agregar Participante" },
  { id: "btn_remove_participant", render: () => "➖ Eliminar Participante" },
  { id: "btn_close", render: () => "🔒 Cerrar Ticket" },
  { id: "action_menu_title", render: () => "🎫 Acciones del Ticket" },

  { id: "faq_select_placeholder", render: () => "Selecciona una pregunta" },
  { id: "faq_open_ticket_button", render: () => "🎫 Abrir Ticket" },
  { id: "faq_close_button", render: () => "❌ Cerrar" },
  { id: "faq_closed_message", render: () => "¡Listo! Si lo necesitas, puedes abrir un ticket de nuevo." },
  { id: "faq_list_title", render: () => "❓ Preguntas Frecuentes" },
  { id: "faq_list_desc", render: () => "Tu duda ya podría tener respuesta aquí. Elige una pregunta abajo o abre un ticket directamente." },

  { id: "opt_template", render: () => "Biblioteca de Plantillas" },
  { id: "opt_template_desc", render: () => "Publicar o instalar plantillas de ticket" },
  { id: "btn_template_publish", render: () => "📦 Publicar como Plantilla" },
  { id: "btn_template_install", render: () => "📥 Instalar Plantilla" },
  { id: "modal_template_publish_title", render: () => "Publicar Plantilla" },
  { id: "modal_template_name_label", render: () => "Nombre de la plantilla" },
  { id: "modal_template_short_desc_label", render: () => "Descripción corta" },
  { id: "modal_template_tags_label", render: () => "Etiquetas" },
  { id: "modal_template_tags_placeholder", render: () => "soporte, ventas, comunidad" },
  { id: "template_publish_success", render: (ctx) => `✅ ¡Plantilla publicada! ID: \`${ctx.libId}\`` },
  { id: "template_publish_error", render: (ctx) => `❌ Error al publicar la plantilla: ${ctx.error}` },
  { id: "modal_template_install_title", render: () => "Instalar Plantilla" },
  { id: "modal_template_libid_label", render: () => "ID de la plantilla" },
  { id: "template_install_success", render: (ctx) => `✅ Plantilla instalada como nuevo panel: \`${ctx.panelId}\`` },
  { id: "template_install_error", render: (ctx) => `❌ Error al instalar la plantilla: ${ctx.error}` },
  { id: "template_menu_header", render: () => "## 📦 Biblioteca de Plantillas\nPublica este panel como plantilla reutilizable o instala una plantilla existente como nuevo panel." },

  { id: "opt_claim", render: () => "Responsable (Claim)" },
  { id: "opt_claim_desc", render: () => "Configurar quién puede asumir tickets" },
  { id: "opt_participants", render: () => "Participantes" },
  { id: "opt_participants_desc", render: () => "Configurar quién puede agregar/eliminar participantes" },
  { id: "opt_faq", render: () => "FAQ" },
  { id: "opt_faq_desc", render: () => "Preguntas frecuentes antes de abrir el ticket" },
  { id: "opt_actionmenu", render: () => "Menú de Acciones" },
  { id: "opt_actionmenu_desc", render: () => "Palabras clave que abren el menú de acciones" },

  { id: "btn_clear_roles", render: () => "🧹 Limpiar cargos" },
  { id: "claim_roles_placeholder", render: () => "Cargos que pueden asumir tickets" },
  { id: "claim_log_channel_placeholder", render: () => "Canal de registro de claim (opcional)" },
  { id: "claim_roles_none", render: () => "Todos los miembros del equipo" },
  { id: "claim_menu_header", render: (ctx) => `## 👤 Responsable del Ticket (Claim)\n**Estado:** ${ctx.status}\n**Cargos permitidos:** ${ctx.roles}\n**Canal de registro:** ${ctx.logChannel}` },

  { id: "participants_add_roles_placeholder", render: () => "Cargos que pueden agregar participantes" },
  { id: "participants_remove_roles_placeholder", render: () => "Cargos que pueden eliminar participantes" },
  { id: "participants_menu_header", render: (ctx) => `## 👥 Participantes\n**Pueden agregar:** ${ctx.addRoles}\n**Pueden eliminar:** ${ctx.removeRoles}` },

  { id: "faq_add_button", render: () => "➕ Agregar Pregunta" },
  { id: "faq_limit_reached", render: (ctx) => `❌ Límite de ${ctx.max} preguntas alcanzado para tu plan.` },
  { id: "modal_faq_add_title", render: () => "Nueva Pregunta Frecuente" },
  { id: "modal_faq_question_label", render: () => "Pregunta" },
  { id: "modal_faq_answer_label", render: () => "Respuesta" },
  { id: "faq_added_success", render: () => "✅ ¡Pregunta agregada!" },
  { id: "faq_remove_placeholder", render: () => "Selecciona una pregunta para eliminar" },
  { id: "faq_menu_header", render: (ctx) => `## ❓ FAQ Pre-Apertura\n**Estado:** ${ctx.status}\n**Preguntas:** ${ctx.count}/${ctx.max}` },

  { id: "actionmenu_add_button", render: () => "➕ Nueva Palabra Clave" },
  { id: "actionmenu_premium_required", render: () => "❌ Varias palabras clave son exclusivas del plan Lua Crescente." },
  { id: "modal_actionmenu_add_title", render: () => "Nueva Palabra Clave" },
  { id: "modal_actionmenu_keyword_label", render: () => "Palabra clave exacta" },
  { id: "actionmenu_added_success", render: () => "✅ ¡Palabra clave agregada!" },
  { id: "actionmenu_edit_placeholder", render: () => "Selecciona una palabra clave para editar" },
  { id: "actionmenu_menu_header", render: (ctx) => `## 🎫 Menú de Acciones\n**Estado:** ${ctx.status}\n**Palabras clave:** ${ctx.count}\n**Plan:** ${ctx.plan}` },
  { id: "actionmenu_plan_premium", render: () => "Lua Crescente (varias palabras clave)" },
  { id: "actionmenu_plan_free", render: () => "Gratuito (1 palabra clave fija)" },
  { id: "actionmenu_actions_placeholder", render: () => "Acciones disponibles en este menú" },
  { id: "actionmenu_roles_placeholder", render: () => "Cargos que pueden usar esta palabra clave" },
  { id: "actionmenu_autodelete_on", render: () => "🗑️ Eliminar mensaje: Activar" },
  { id: "actionmenu_autodelete_off", render: () => "🗑️ Eliminar mensaje: Desactivar" },
  { id: "actionmenu_delete_keyword", render: () => "❌ Eliminar Palabra Clave" },
  { id: "actionmenu_keyword_header", render: (ctx) => `## 🔑 Palabra clave: \`${ctx.keyword}\`\n**Acciones:** ${ctx.actions}\n**Cargos permitidos:** ${ctx.roles}\n**Eliminar mensaje automáticamente:** ${ctx.autoDelete}` },
];

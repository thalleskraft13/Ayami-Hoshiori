// src/System/InteractionManager.js

const crypto = require('crypto');
const DiscordRequest = require('../function/DiscordRequest');

class InteractionManager {

    constructor(client) {
        this.client = client;
        this.cache = new Map();
    }

    /* ===============================
       ID GENERATOR
    =============================== */
    _generateId() {
        return "temp_" + crypto.randomBytes(6).toString("hex");
    }

    _store(id, data, tempo) {
        this.cache.set(id, {
            ...data,
            expires: Date.now() + tempo
        });

        setTimeout(() => {
            this.cache.delete(id);
        }, tempo);
    }

    /* ===============================
       BUTTON
    =============================== */
    createButton({ user, tempo = 60000, funcao, data = {} }) {

        const id = this._generateId();

        this._store(id, { user, funcao }, tempo);

        return {
            type: 2,
            style: data.style ?? 1,
            label: data.label ?? "Botão",
            custom_id: id
        };
    }

    /* ===============================
       SELECT MENU
    =============================== */
    createSelect({ user, tempo = 60000, funcao, data = {} }) {

        const id = this._generateId();

        this._store(id, { user, funcao }, tempo);

        return {
            type: 3,
            custom_id: id,
            placeholder: data.placeholder ?? "Escolha...",
            min_values: data.min_values ?? 1,
            max_values: data.max_values ?? 1,
            options: data.options ?? []
        };
    }

    /* ===============================
       MODAL
    =============================== */
    createModal({ user, tempo = 60000, title, components, funcao }) {

        const id = this._generateId();

        this._store(id, { user, funcao, modal: true }, tempo);

        return {
            custom_id: id,
            title,
            components
        };
    }

    async showModal(interaction, modalData) {
        return DiscordRequest(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            {
                method: "POST",
                body: {
                    type: 9,
                    data: modalData
                }
            }
        );
    }

    /* ===============================
       DEFER (ESSENCIAL)
    =============================== */
    async defer(interaction) {
        return DiscordRequest(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            {
                method: "POST",
                body: { type: 6 } // DEFER UPDATE
            }
        );
    }

    /* ===============================
       HANDLE COMPONENT
    =============================== */
    async handleComponent(interaction) {

        const id = interaction.data?.custom_id;
        if (!id) return;

        try {

            /* ===============================
               🔥 BOTÕES PERMANENTES (FIXO)
            =============================== */
            let parsed = null;

try {
  parsed = JSON.parse(id);
} catch {
  parsed = null;
}

if (parsed?.t === "create_ticket") {
  
    try {
        interaction.data.panelId = parsed.p;
  return this.client.ticketSystem.create(interaction);

    } catch (err) {
        console.error("❌ Ticket Create Error:", err);

        // evita interação morta
        await DiscordRequest(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            {
                method: "POST",
                body: {
                    type: 4,
                    data: {
                        content: "❌ Erro ao criar ticket.",
                        flags: 64
                    }
                }
            }
        );
    }
    return;
}
if (id === "close_ticket") {
    return this.client.ticketSystem.close(interaction);
}

            /* ===============================
               🔥 TEMPORÁRIOS (SETUP)
            =============================== */
            const data = this.cache.get(id);
            if (!data) return;

            if (Date.now() > data.expires) {
                this.cache.delete(id);
                return;
            }

            if (data.user && interaction.member.user.id !== data.user)
                return;

            await data.funcao(interaction, this.client);

        } catch (err) {
            console.error("❌ Component Error:", err);

            // fallback resposta (evita travar interação)
            try {
                await DiscordRequest(
                    `/interactions/${interaction.id}/${interaction.token}/callback`,
                    {
                        method: "POST",
                        body: {
                            type: 4,
                            data: {
                                content: "❌ Ocorreu um erro.",
                                flags: 64
                            }
                        }
                    }
                );
            } catch {}
        }
    }

    /* ===============================
       HANDLE MODAL
    =============================== */
    async handleModal(interaction) {

        const id = interaction.data?.custom_id;
        if (!id?.startsWith("temp_")) return;

        const data = this.cache.get(id);
        if (!data || !data.modal) return;

        if (Date.now() > data.expires) {
            this.cache.delete(id);
            return;
        }

        if (data.user && interaction.member.user.id !== data.user)
            return;

        try {

            const fields = {};

            for (const row of interaction.data.components) {
                for (const comp of row.components) {
                    fields[comp.custom_id] = comp.value;
                }
            }

            await data.funcao(interaction, this.client, fields);

        } catch (err) {
            console.error("❌ Modal Error:", err);
        }
    }
}

module.exports = InteractionManager;
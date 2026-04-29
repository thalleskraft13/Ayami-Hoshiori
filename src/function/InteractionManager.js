const crypto = require('crypto');
const DiscordRequest = require('./DiscordRequest.js');
const ms = require("ms");

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
    createButton({ user, tempo = ms("10min"), funcao, data = {} }) {

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
    createSelect({ user, tempo = ms("10min"), funcao, data = {} }) {

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
    createModal({ user, tempo = ms("10min"), title, components, funcao }) {

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
                body: { type: 6 }
            }
        );
    }

    /* ===============================
       HANDLE COMPONENT
    =============================== */
    async handleComponent(interaction) {

        const id = interaction.data?.custom_id;
        if (!id) return;

        const replyUnavailable = async () => {
            try {
                await DiscordRequest(
                    `/interactions/${interaction.id}/${interaction.token}/callback`,
                    {
                        method: "POST",
                        body: {
                            type: 4,
                            data: {
                                content: "A interação já está indisponível... use o comando dnv...",
                                flags: 64
                            }
                        }
                    }
                );
            } catch {}
        };

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
                    await replyUnavailable();
                }
                return;
            }

            if (id === "close_ticket") {
                return this.client.ticketSystem.close(interaction);
            }

            /* ===============================
               🔥 TEMPORÁRIOS (CACHE)
            =============================== */

            const data = this.cache.get(id);

            if (!data) {
                return replyUnavailable();
            }

            if (Date.now() > data.expires) {
                this.cache.delete(id);
                return replyUnavailable();
            }

            if (data.user && interaction.member.user.id !== data.user) {
                return;
            }

            await data.funcao(interaction, this.client);

        } catch (err) {

            console.error("❌ Component Error:", err);

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

        if (!data || !data.modal) {
            try {
                await DiscordRequest(
                    `/interactions/${interaction.id}/${interaction.token}/callback`,
                    {
                        method: "POST",
                        body: {
                            type: 4,
                            data: {
                                content: "A interação já está indisponível... use o comando dnv...",
                                flags: 64
                            }
                        }
                    }
                );
            } catch {}
            return;
        }

        if (Date.now() > data.expires) {
            this.cache.delete(id);

            try {
                await DiscordRequest(
                    `/interactions/${interaction.id}/${interaction.token}/callback`,
                    {
                        method: "POST",
                        body: {
                            type: 4,
                            data: {
                                content: "A interação já está indisponível... use o comando dnv...",
                                flags: 64
                            }
                        }
                    }
                );
            } catch {}
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
const crypto = require('crypto');
const DiscordRequest = require('./DiscordRequest.js');
const ms = require("ms");

class InteractionManager {

    constructor(client) {
        this.client = client;
        this.cache = new Map();
    }

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

    _errorId() {
        return crypto.randomBytes(4).toString("hex");
    }

    async _reply(interaction, content) {
        return DiscordRequest(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            {
                method: "POST",
                body: {
                    type: 4,
                    data: {
                        content,
                        flags: 64
                    }
                }
            }
        );
    }

    async _replyError(interaction, err, context = "Erro interno") {

        const id = this._errorId();

        console.error(`[${id}] ${context}`, err);

        const msg =
            `Erro ao processar a interação\n\n` +
            `Contexto: **\`${context}\`**\n` +
            `ID do erro: **\`${id}\`**\n` +
            `Detalhe: \`\`\`\n${err?.message || "Desconhecido"}\n\`\`\``;

        try {
            await this._reply(interaction, msg);
        } catch {}
    }

    createButton({ user, tempo = ms("10min"), funcao, data = {} }) {

        const id = this._generateId();

        this._store(id, { user, funcao }, tempo);

        return {
            type: 2,
            style: data.style ?? 1,
            label: data.label ?? "Botao",
            custom_id: id
        };
    }

    createSelect({ user, tempo = ms("10min"), funcao, data = {} }) {

        const id = this._generateId();

        this._store(id, { user, funcao }, tempo);

        return {
            type: 3,
            custom_id: id,
            placeholder: data.placeholder ?? "Escolha uma opcao",
            min_values: data.min_values ?? 1,
            max_values: data.max_values ?? 1,
            options: data.options ?? []
        };
    }

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

    async defer(interaction) {
        return DiscordRequest(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            {
                method: "POST",
                body: { type: 6 }
            }
        );
    }

    async handleComponent(interaction) {

        const id = interaction.data?.custom_id;
        if (!id) return;

        const replyUnavailable = async () => {
            return this._reply(
                interaction,
                "Essa interação expirou ou não está mais disponível. Execute o comando novamente."
            );
        };

        try {

            let parsed = null;

            try {
                parsed = JSON.parse(id);
            } catch {}

            if (parsed?.t === "create_ticket") {
                try {
                    interaction.data.panelId = parsed.p;
                    return this.client.ticketSystem.create(interaction);
                } catch (err) {
                    return this._replyError(interaction, err, "Ticket Create");
                }
            }

            if (id === "close_ticket") {
                try {
                    return this.client.ticketSystem.close(interaction);
                } catch (err) {
                    return this._replyError(interaction, err, "Ticket Close");
                }
            }

            const data = this.cache.get(id);

            if (!data) return replyUnavailable();

            if (Date.now() > data.expires) {
                this.cache.delete(id);
                return replyUnavailable();
            }

            if (data.user && interaction.member.user.id !== data.user) {
                return this._reply(
                    interaction,
                    "Você não pode usar este componente."
                );
            }

            await data.funcao(interaction, this.client);

        } catch (err) {
            return this._replyError(interaction, err, "Component Handler");
        }
    }

    async handleModal(interaction) {

        const id = interaction.data?.custom_id;
        if (!id?.startsWith("temp_")) return;

        const data = this.cache.get(id);

        if (!data || !data.modal) {
            return this._reply(
                interaction,
                "Este formulário expirou. Execute novamente."
            );
        }

        if (Date.now() > data.expires) {
            this.cache.delete(id);
            return this._reply(
                interaction,
                "Este formulário expirou. Execute novamente."
            );
        }

        if (data.user && interaction.member.user.id !== data.user) {
            return this._reply(
                interaction,
                "Você não pode responder este formulário."
            );
        }

        try {

            const fields = {};

            for (const row of interaction.data.components) {
                for (const comp of row.components) {
                    fields[comp.custom_id] = comp.value;
                }
            }

            await data.funcao(interaction, this.client, fields);

        } catch (err) {
            return this._replyError(interaction, err, "Modal Handler");
        }
    }
}

module.exports = InteractionManager;
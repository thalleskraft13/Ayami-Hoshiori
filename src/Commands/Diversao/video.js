'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const MediaManager    = require("../../function/Manager/MediaManager");

module.exports = {
    data: {
        name: 'video',
        description: 'Comandos de vídeo',
        name_localizations: { 'en-US': 'video', 'en-GB': 'video', 'es-ES': 'video' },
        description_localizations: {
            'en-US': 'Video commands',
            'en-GB': 'Video commands',
            'es-ES': 'Comandos de vídeo',
        },
        type: 1,
        options: [{
            name: 'homer',
            description: 'Coloca o avatar ou uma imagem na cena do Homer',
            type: 1,
            options: [
                {
                    name: 'usuario',
                    description: 'Usuário cujo avatar será usado',
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    description: 'Envie uma imagem PNG ou JPEG',
                    type: 11,
                    required: false,
                }
            ],
        },{
            name: 'what',
            description: 'Coloca o avatar ou uma imagem em..WHAT?',
            type: 1,
            options: [
                {
                    name: 'usuario',
                    description: 'Usuário cujo avatar será usado',
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    description: 'Envie uma imagem PNG ou JPEG',
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'henrydanger',
            description: 'Coloca o avatar ou uma imagem no PC do Henry',
            type: 1,
            options: [
                {
                    name: 'usuario',
                    description: 'Usuário cujo avatar será usado',
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    description: 'Envie uma imagem PNG ou JPEG',
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'carta-da-jujuba',
            description: 'Coloca o avatar ou uma imagem na carta para Princesa Jujuba',
            type: 1,
            options: [
                {
                    name: 'usuario',
                    description: 'Usuário cujo avatar será usado',
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    description: 'Envie uma imagem PNG ou JPEG',
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'homelander',
            description: 'Coloca o avatar ou uma imagem na tela do Homerland',
            type: 1,
            options: [
                {
                    name: 'usuario',
                    description: 'Usuário cujo avatar será usado',
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    description: 'Envie uma imagem PNG ou JPEG',
                    type: 11,
                    required: false,
                }
            ]
        }]
    },

    async execute(interaction, client) {
        const subcommand = interaction.data.options[0].name;

        // Defer imediatamente — vídeo demora bem mais que imagem
        await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
            method: 'POST',
            body: { type: 5 }
        });

        try {
            if (subcommand === 'homer') return await _homer(interaction, client);
            if (subcommand === 'what') return await _what(interaction, client);
            if (subcommand === 'henrydanger') return await _henrydanger(interaction, client);
            if (subcommand === 'carta-da-jujuba') return await _cartadajujuba(interaction, client);
            if (subcommand === 'homelander') return await _homelander(interaction, client);
        } catch (err) {
            console.error(`[video/${subcommand}]`, err);
            await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
                method: 'POST',
                body: { content: '❌ Ocorreu um erro ao gerar o vídeo.' }
            });
        }
    }
};

// ─── /video homer ─────────────────────────────────────────────────────────────

async function _homer(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment    = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        if (!/\.(png|jpe?g)$/i.test(attachment.url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo: 8MB.');
        }

        const res    = await fetch(attachment.url);
        const buffer = Buffer.from(await res.arrayBuffer());

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user    = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl     = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza vídeo ───────────────────────────────────────────────────
    const buffer = await client.MediaManager.Video.Render({
        Template:    'homer',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'homer.mp4',
            data:        buffer,
            contentType: 'video/mp4',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /video what ─────────────────────────────────────────────────────────────

async function _what(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment    = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        if (!/\.(png|jpe?g)$/i.test(attachment.url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo: 8MB.');
        }

        const res    = await fetch(attachment.url);
        const buffer = Buffer.from(await res.arrayBuffer());

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user    = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl     = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza vídeo ───────────────────────────────────────────────────
    const buffer = await client.MediaManager.Video.Render({
        Template:    'what',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'what.mp4',
            data:        buffer,
            contentType: 'video/mp4',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /video Henry Danger ─────────────────────────────────────────────────────────────

async function _henrydanger(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl1    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment    = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        if (!/\.(png|jpe?g)$/i.test(attachment.url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo: 8MB.');
        }

        const res    = await fetch(attachment.url);
        const buffer = Buffer.from(await res.arrayBuffer());

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user    = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl1     = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl1  = _getAvatarURL(user);
    }

    // ── Renderiza vídeo ───────────────────────────────────────────────────
    const buffer = await client.MediaManager.Video.Render({
        Template:    'henrydanger',
        avatarUrl1,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'henrydanger.mp4',
            data:        buffer,
            contentType: 'video/mp4',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /video Carta da Jujuba ─────────────────────────────────────────────────────────────

async function _cartadajujuba(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl1    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment    = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        if (!/\.(png|jpe?g)$/i.test(attachment.url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo: 8MB.');
        }

        const res    = await fetch(attachment.url);
        const buffer = Buffer.from(await res.arrayBuffer());

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user    = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl1     = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl1  = _getAvatarURL(user);
    }

    // ── Renderiza vídeo ───────────────────────────────────────────────────
    const buffer = await client.MediaManager.Video.Render({
        Template:    'cartadajujuba',
        avatarUrl1,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'cartadajujuba.mp4',
            data:        buffer,
            contentType: 'video/mp4',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /video HomeLand ─────────────────────────────────────────────────────────────

async function _homelander(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl1    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment    = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        if (!/\.(png|jpe?g)$/i.test(attachment.url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo: 8MB.');
        }

        const res    = await fetch(attachment.url);
        const buffer = Buffer.from(await res.arrayBuffer());

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user    = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl1     = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl1  = _getAvatarURL(user);
    }

    // ── Renderiza vídeo ───────────────────────────────────────────────────
    const buffer = await client.MediaManager.Video.Render({
        Template:    'homelander',
        avatarUrl1,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'homelander.mp4',
            data:        buffer,
            contentType: 'video/mp4',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function _getAvatarURL(user) {
    if (!user?.avatar)
        return `https://cdn.discordapp.com/embed/avatars/0.png`;

    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=1024`;
}

function _isValidImage(buf) {
    const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    return isPng || isJpeg;
}

async function _reply(interaction, content) {
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        body: { content }
    });
}

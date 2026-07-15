'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const MediaManager   = require("../../function/Manager/MediaManager");

module.exports = {
    data: {
        name: 'imagem',
        description: 'Comandos de imagem',
        name_localizations: { 'en-US': 'image', 'en-GB': 'image', 'es-ES': 'imagen' },
        description_localizations: {
            'en-US': 'Image commands',
            'en-GB': 'Image commands',
            'es-ES': 'Comandos de imagen',
        },
        type: 1,
        options: [{
            name: 'cinema',
            description: 'Coloca o avatar ou uma imagem na tela do cinema',
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
            name: 'rezando',
            description: 'Coloca o avatar ou uma imagem na tela de TV rezando',
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
            name: 'jornal',
            description: 'Coloca o avatar ou uma imagem na tela de TV rezando',
            type: 1,
            options: [{
                    name: 'titulo',
                    description: 'Titulo da noticia',
                    type: 3,
                    required: true,
                },
                {
                    name: 'descrição',
                    description: 'Descrição da noticia',
                    type: 3,
                    required: true,
                },
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
              name: 'gohan',
            description: 'Coloca o avatar ou uma imagem nos oculos do Gohan',
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
            name: 'prisao',
            description: 'Coloca o avatar ou uma imagem em uma prisão',
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
            name: 'pinkiepie',
            description: 'Coloca o avatar ou uma imagem em uma decoração da Pinkiepie',
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
            name: 'planomaligno',
            description: 'Coloca o avatar ou uma imagem em plano maligno',
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

        // Defer imediatamente — renderização pode demorar
        await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
            method: 'POST',
            body: { type: 5 }
        });

        try {
            if (subcommand === 'cinema') return await _cinema(interaction, client);
            if (subcommand === 'rezando') return await _rezando(interaction, client);
            if (subcommand === 'jornal') return await _jornal(interaction, client);
            if (subcommand === 'gohan') return await _gohan(interaction, client);
            if (subcommand === 'prisao') return await _prisao(interaction, client);
            if (subcommand === 'pinkiepie') return await _pinkiepie(interaction, client);
            if (subcommand === 'planomaligno') return await _planomaligno(interaction, client);
        } catch (err) {
            console.error(`[imagem/${subcommand}]`, err);
            await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
                method: 'POST',
                body: { content: '❌ Ocorreu um erro ao gerar a imagem.' }
            });
        }
    }
};

// ─── /imagem cinema ───────────────────────────────────────────────────────────

async function _cinema(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        // Valida extensão antes de baixar
        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        // Valida tamanho declarado pelo Discord (em bytes)
        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        // Baixa o arquivo como Buffer
        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        // Valida magic bytes — garante que é PNG ou JPEG de verdade
        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        // Usa o avatar do autor da interação
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza ─────────────────────────────────────────────────────────
    const buffer = await client.MediaManager.Render({
        Template:    'cinema',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'cinema.png',
            data:        buffer,
            contentType: 'image/png',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}


// ─── /imagem rezando ───────────────────────────────────────────────────────────

async function _rezando(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        // Valida extensão antes de baixar
        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        // Valida tamanho declarado pelo Discord (em bytes)
        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        // Baixa o arquivo como Buffer
        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        // Valida magic bytes — garante que é PNG ou JPEG de verdade
        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        // Usa o avatar do autor da interação
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza ─────────────────────────────────────────────────────────
    const buffer = await client.MediaManager.Render({
        Template:    'rezando',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'rezando.png',
            data:        buffer,
            contentType: 'image/png',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /imagem jornal ───────────────────────────────────────────────────────────

async function _jornal(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const titulo = opts.find(o => o.name === 'titulo');
    const descricao = opts.find(o => o.name === 'descrição');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        // Valida extensão antes de baixar
        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        // Valida tamanho declarado pelo Discord (em bytes)
        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        // Baixa o arquivo como Buffer
        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        // Valida magic bytes — garante que é PNG ou JPEG de verdade
        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        // Usa o avatar do autor da interação
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza ─────────────────────────────────────────────────────────
    const buffer = await client.MediaManager.Render({
        Template:    'jornal',
        avatarUrl,
        avatarBuffer,
        titulo: titulo.value,
        descricao: descricao.value,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'jornal.png',
            data:        buffer,
            contentType: 'image/png',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /imagem gohan ───────────────────────────────────────────────────────────

async function _gohan(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        // Valida extensão antes de baixar
        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        // Valida tamanho declarado pelo Discord (em bytes)
        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        // Baixa o arquivo como Buffer
        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        // Valida magic bytes — garante que é PNG ou JPEG de verdade
        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        // Usa o avatar do autor da interação
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza ─────────────────────────────────────────────────────────
    const buffer = await client.MediaManager.Render({
        Template:    'gohan',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'gohan.png',
            data:        buffer,
            contentType: 'image/png',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /imagem prisao ───────────────────────────────────────────────────────────

async function _prisao(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        // Valida extensão antes de baixar
        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        // Valida tamanho declarado pelo Discord (em bytes)
        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        // Baixa o arquivo como Buffer
        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        // Valida magic bytes — garante que é PNG ou JPEG de verdade
        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        // Usa o avatar do autor da interação
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza ─────────────────────────────────────────────────────────
    const buffer = await client.MediaManager.Render({
        Template:    'prisao',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'prisao.png',
            data:        buffer,
            contentType: 'image/png',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /imagem pinkiepie ───────────────────────────────────────────────────────────

async function _pinkiepie(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        // Valida extensão antes de baixar
        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        // Valida tamanho declarado pelo Discord (em bytes)
        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        // Baixa o arquivo como Buffer
        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        // Valida magic bytes — garante que é PNG ou JPEG de verdade
        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        // Usa o avatar do autor da interação
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza ─────────────────────────────────────────────────────────
    const buffer = await client.MediaManager.Render({
        Template:    'pinkiepie',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'pinkiepie.png',
            data:        buffer,
            contentType: 'image/png',
        }],
        body: {
            content: `<@${interaction.member?.user?.id ?? interaction.user?.id}>`,
        }
    });
}

// ─── /imagem Plano Maligno ───────────────────────────────────────────────────────────

async function _planomaligno(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    // ── Prioridade: arquivo enviado > usuário mencionado > autor ──────────
    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        // Valida extensão antes de baixar
        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        // Valida tamanho declarado pelo Discord (em bytes)
        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        // Baixa o arquivo como Buffer
        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        // Valida magic bytes — garante que é PNG ou JPEG de verdade
        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        // Usa o avatar do autor da interação
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    // ── Renderiza ─────────────────────────────────────────────────────────
    const buffer = await client.MediaManager.Render({
        Template:    'planomaligno',
        avatarUrl,
        avatarBuffer,
    });

    // ── Envia ─────────────────────────────────────────────────────────────
    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        files: [{
            name:        'planomaligno.png',
            data:        buffer,
            contentType: 'image/png',
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
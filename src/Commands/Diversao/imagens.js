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
            name_localizations: { 'en-US': "cinema", 'en-GB': "cinema", 'es-ES': "cine" },
            description: 'Coloca o avatar ou uma imagem na tela do cinema',
            description_localizations: { 'en-US': "Puts the avatar or an image on the cinema screen", 'en-GB': "Puts the avatar or an image on the cinema screen", 'es-ES': "Coloca el avatar o una imagen en la pantalla de cine" },
            type: 1,
            options: [
                {
                    name: 'usuario',
                    name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
                    description: 'Usuário cujo avatar será usado',
                    description_localizations: { 'en-US': "User whose avatar will be used", 'en-GB': "User whose avatar will be used", 'es-ES': "Usuario cuyo avatar sera usado" },
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    name_localizations: { 'en-US': "file", 'en-GB': "file", 'es-ES': "archivo" },
                    description: 'Envie uma imagem PNG ou JPEG',
                    description_localizations: { 'en-US': "Send a PNG or JPEG image", 'en-GB': "Send a PNG or JPEG image", 'es-ES': "Envia una imagen PNG o JPEG" },
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'rezando',
            name_localizations: { 'en-US': "praying", 'en-GB': "praying", 'es-ES': "rezando" },
            description: 'Coloca o avatar ou uma imagem na tela de TV rezando',
            description_localizations: { 'en-US': "Puts the avatar or an image on the praying TV screen", 'en-GB': "Puts the avatar or an image on the praying TV screen", 'es-ES': "Coloca el avatar o una imagen en la pantalla de TV rezando" },
            type: 1,
            options: [
                {
                    name: 'usuario',
                    name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
                    description: 'Usuário cujo avatar será usado',
                    description_localizations: { 'en-US': "User whose avatar will be used", 'en-GB': "User whose avatar will be used", 'es-ES': "Usuario cuyo avatar sera usado" },
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    name_localizations: { 'en-US': "file", 'en-GB': "file", 'es-ES': "archivo" },
                    description: 'Envie uma imagem PNG ou JPEG',
                    description_localizations: { 'en-US': "Send a PNG or JPEG image", 'en-GB': "Send a PNG or JPEG image", 'es-ES': "Envia una imagen PNG o JPEG" },
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'jornal',
            name_localizations: { 'en-US': "newspaper", 'en-GB': "newspaper", 'es-ES': "periodico" },
            description: 'Coloca o avatar ou uma imagem na tela de TV rezando',
            description_localizations: { 'en-US': "Puts the avatar or an image on the praying TV screen", 'en-GB': "Puts the avatar or an image on the praying TV screen", 'es-ES': "Coloca el avatar o una imagen en la pantalla de TV rezando" },
            type: 1,
            options: [{
                    name: 'titulo',
                    name_localizations: { 'en-US': "title", 'en-GB': "title", 'es-ES': "titulo" },
                    description: 'Titulo da noticia',
                    description_localizations: { 'en-US': "News headline", 'en-GB': "News headline", 'es-ES': "Titulo de la noticia" },
                    type: 3,
                    required: true,
                },
                {
                    name: 'descrição',
                    name_localizations: { 'en-US': "description", 'en-GB': "description", 'es-ES': "descripcion" },
                    description: 'Descrição da noticia',
                    description_localizations: { 'en-US': "News description", 'en-GB': "News description", 'es-ES': "Descripcion de la noticia" },
                    type: 3,
                    required: true,
                },
                {
                    name: 'usuario',
                    name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
                    description: 'Usuário cujo avatar será usado',
                    description_localizations: { 'en-US': "User whose avatar will be used", 'en-GB': "User whose avatar will be used", 'es-ES': "Usuario cuyo avatar sera usado" },
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    name_localizations: { 'en-US': "file", 'en-GB': "file", 'es-ES': "archivo" },
                    description: 'Envie uma imagem PNG ou JPEG',
                    description_localizations: { 'en-US': "Send a PNG or JPEG image", 'en-GB': "Send a PNG or JPEG image", 'es-ES': "Envia una imagen PNG o JPEG" },
                    type: 11,
                    required: false,
                }
            ]
        },{
              name: 'gohan',
              name_localizations: { 'en-US': "gohan", 'en-GB': "gohan", 'es-ES': "gohan" },
            description: 'Coloca o avatar ou uma imagem nos oculos do Gohan',
            description_localizations: { 'en-US': "Puts the avatar or an image on Gohan's glasses", 'en-GB': "Puts the avatar or an image on Gohan's glasses", 'es-ES': "Coloca el avatar o una imagen en las gafas de Gohan" },
            type: 1,
            options: [
                {
                    name: 'usuario',
                    name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
                    description: 'Usuário cujo avatar será usado',
                    description_localizations: { 'en-US': "User whose avatar will be used", 'en-GB': "User whose avatar will be used", 'es-ES': "Usuario cuyo avatar sera usado" },
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    name_localizations: { 'en-US': "file", 'en-GB': "file", 'es-ES': "archivo" },
                    description: 'Envie uma imagem PNG ou JPEG',
                    description_localizations: { 'en-US': "Send a PNG or JPEG image", 'en-GB': "Send a PNG or JPEG image", 'es-ES': "Envia una imagen PNG o JPEG" },
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'prisao',
            name_localizations: { 'en-US': "prison", 'en-GB': "prison", 'es-ES': "prision" },
            description: 'Coloca o avatar ou uma imagem em uma prisão',
            description_localizations: { 'en-US': "Puts the avatar or an image in a prison", 'en-GB': "Puts the avatar or an image in a prison", 'es-ES': "Coloca el avatar o una imagen en una prision" },
            type: 1,
            options: [
                {
                    name: 'usuario',
                    name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
                    description: 'Usuário cujo avatar será usado',
                    description_localizations: { 'en-US': "User whose avatar will be used", 'en-GB': "User whose avatar will be used", 'es-ES': "Usuario cuyo avatar sera usado" },
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    name_localizations: { 'en-US': "file", 'en-GB': "file", 'es-ES': "archivo" },
                    description: 'Envie uma imagem PNG ou JPEG',
                    description_localizations: { 'en-US': "Send a PNG or JPEG image", 'en-GB': "Send a PNG or JPEG image", 'es-ES': "Envia una imagen PNG o JPEG" },
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'pinkiepie',
            name_localizations: { 'en-US': "pinkiepie", 'en-GB': "pinkiepie", 'es-ES': "pinkiepie" },
            description: 'Coloca o avatar ou uma imagem em uma decoração da Pinkiepie',
            description_localizations: { 'en-US': "Puts the avatar or an image in a Pinkie Pie decoration", 'en-GB': "Puts the avatar or an image in a Pinkie Pie decoration", 'es-ES': "Coloca el avatar o una imagen en una decoracion de Pinkie Pie" },
            type: 1,
            options: [
                {
                    name: 'usuario',
                    name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
                    description: 'Usuário cujo avatar será usado',
                    description_localizations: { 'en-US': "User whose avatar will be used", 'en-GB': "User whose avatar will be used", 'es-ES': "Usuario cuyo avatar sera usado" },
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    name_localizations: { 'en-US': "file", 'en-GB': "file", 'es-ES': "archivo" },
                    description: 'Envie uma imagem PNG ou JPEG',
                    description_localizations: { 'en-US': "Send a PNG or JPEG image", 'en-GB': "Send a PNG or JPEG image", 'es-ES': "Envia una imagen PNG o JPEG" },
                    type: 11,
                    required: false,
                }
            ]
        },{
            name: 'planomaligno',
            name_localizations: { 'en-US': "evilplan", 'en-GB': "evilplan", 'es-ES': "planmaligno" },
            description: 'Coloca o avatar ou uma imagem em plano maligno',
            description_localizations: { 'en-US': "Puts the avatar or an image in an evil plan", 'en-GB': "Puts the avatar or an image in an evil plan", 'es-ES': "Coloca el avatar o una imagen en un plan malvado" },
            type: 1,
            options: [
                {
                    name: 'usuario',
                    name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
                    description: 'Usuário cujo avatar será usado',
                    description_localizations: { 'en-US': "User whose avatar will be used", 'en-GB': "User whose avatar will be used", 'es-ES': "Usuario cuyo avatar sera usado" },
                    type: 6,
                    required: false,
                },
                {
                    name: 'arquivo',
                    name_localizations: { 'en-US': "file", 'en-GB': "file", 'es-ES': "archivo" },
                    description: 'Envie uma imagem PNG ou JPEG',
                    description_localizations: { 'en-US': "Send a PNG or JPEG image", 'en-GB': "Send a PNG or JPEG image", 'es-ES': "Envia una imagen PNG o JPEG" },
                    type: 11,
                    required: false,
                }
            ]
        }]
    },

    async execute(interaction, client) {
        const subcommand = interaction.data.options[0].name;

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


async function _cinema(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    const buffer = await client.MediaManager.Render({
        Template:    'cinema',
        avatarUrl,
        avatarBuffer,
    });

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



async function _rezando(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    const buffer = await client.MediaManager.Render({
        Template:    'rezando',
        avatarUrl,
        avatarBuffer,
    });

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


async function _jornal(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const titulo = opts.find(o => o.name === 'titulo');
    const descricao = opts.find(o => o.name === 'descrição');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    const buffer = await client.MediaManager.Render({
        Template:    'jornal',
        avatarUrl,
        avatarBuffer,
        titulo: titulo.value,
        descricao: descricao.value,
    });

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


async function _gohan(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    const buffer = await client.MediaManager.Render({
        Template:    'gohan',
        avatarUrl,
        avatarBuffer,
    });

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


async function _prisao(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    const buffer = await client.MediaManager.Render({
        Template:    'prisao',
        avatarUrl,
        avatarBuffer,
    });

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


async function _pinkiepie(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    const buffer = await client.MediaManager.Render({
        Template:    'pinkiepie',
        avatarUrl,
        avatarBuffer,
    });

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


async function _planomaligno(interaction, client) {
    const opts = interaction.data.options[0].options ?? [];

    const usuarioOpt = opts.find(o => o.name === 'usuario');
    const arquivoOpt = opts.find(o => o.name === 'arquivo');

    let avatarUrl    = null;
    let avatarBuffer = null;

    if (arquivoOpt) {
        const attachmentId = arquivoOpt.value;
        const attachment   = interaction.data.resolved?.attachments?.[attachmentId];

        if (!attachment) {
            return _reply(interaction, '❌ Não consegui ler o arquivo enviado.');
        }

        const url = attachment.url;
        if (!/\.(png|jpe?g)$/i.test(url.split('?')[0])) {
            return _reply(interaction, '❌ Apenas arquivos PNG ou JPEG são aceitos.');
        }

        if (attachment.size > 8_000_000) {
            return _reply(interaction, '❌ Arquivo muito grande. Máximo permitido: 8MB.');
        }

        const res    = await fetch(url);
        const raw    = await res.arrayBuffer();
        const buffer = Buffer.from(raw);

        if (!_isValidImage(buffer)) {
            return _reply(interaction, '❌ Arquivo inválido. Envie apenas PNG ou JPEG.');
        }

        avatarBuffer = buffer;

    } else if (usuarioOpt) {
        const userId = usuarioOpt.value;
        const user   = await DiscordRequest(`/users/${userId}`, { method: 'GET' });
        avatarUrl    = _getAvatarURL(user);

    } else {
        const user = interaction.member?.user ?? interaction.user;
        avatarUrl  = _getAvatarURL(user);
    }

    const buffer = await client.MediaManager.Render({
        Template:    'planomaligno',
        avatarUrl,
        avatarBuffer,
    });

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
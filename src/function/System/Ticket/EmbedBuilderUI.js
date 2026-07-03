'use strict';

const DiscordRequest = require('../../DiscordRequest.js');

const COLOR_GOLD = 0xFFD966;

/* ═══════════════════════════════════════════════════════════
   EmbedBuilderUI — criador de embed reutilizável (estilo Ayami)
   ═══════════════════════════════════════════════════════════

   Mesmo padrão usado no Logic Builder:
     1. Captura channelId + messageId da mensagem RAIZ antes de
        qualquer followUp ser criado (interação ainda intocada).
     2. Abre o painel builder como FOLLOWUP, com preview REAL
        (mensagem clássica de embed, já que CV2 não permite
        misturar com `embeds:[]`).
     3. Cada edição faz PATCH no followUp (preview ao vivo).
     4. Ao confirmar/remover: apaga o followUp e devolve o
        controle via callback `onDone(rootInteraction, embedObjOrNull)`,
        onde `rootInteraction` já está marcada com `__rootOverride`
        para que qualquer `editOriginal` subsequente edite a
        mensagem raiz de verdade (e não o followUp).

   Uso:
     const EmbedBuilderUI = require('.../EmbedBuilderUI.js');
     EmbedBuilderUI.open(interaction, client, {
       user, existingEmbed: panel.painelPrincipal,
       onDone: async (rootInteraction, embedObj) => {
         panel.painelPrincipal = embedObj;
         await save(guild);
         return someMenu(rootInteraction, ...);
       }
     });

   IMPORTANTE: `interaction` passado para `.open()` deve ser a
   interação do botão/select que ainda NÃO recebeu deferUpdate
   (precisamos ler `channel_id` e `message.id` dela intactos).
   ═══════════════════════════════════════════════════════════ */

const PRESET_COLORS = [
  { label: '🔵 Azul Ayami',        value: '7C8FFF' },
  { label: '💙 Azul Cabelo',       value: 'A9D6FF' },
  { label: '🌙 Azul Escuro',       value: '243B7A' },
  { label: '⭐ Dourado',           value: 'FFD966' },
  { label: '🌸 Rosa',              value: 'FFB6C8' },
  { label: '🟢 Verde',             value: '57F287' },
  { label: '🔴 Vermelho',          value: 'ED4245' },
  { label: '🟡 Amarelo',           value: 'FEE75C' },
  { label: '🟠 Laranja',           value: 'E67E22' },
  { label: '🟣 Roxo',              value: '9B59B6' },
  { label: '⚫ Preto',             value: '000000' },
  { label: '🎨 HEX Personalizado', value: 'custom' },
];

function cleanEmbed(e) {
  const out = {};
  if (e.title)            out.title       = e.title;
  if (e.description)      out.description = e.description;
  if (e.color != null)    out.color       = e.color;
  if (e.url)              out.url         = e.url;
  if (e.author?.name)     out.author      = { name: e.author.name, ...(e.author.icon_url ? { icon_url: e.author.icon_url } : {}), ...(e.author.url ? { url: e.author.url } : {}) };
  if (e.footer?.text)     out.footer      = { text: e.footer.text, ...(e.footer.icon_url ? { icon_url: e.footer.icon_url } : {}) };
  if (e.thumbnail?.url)   out.thumbnail   = { url: e.thumbnail.url };
  if (e.image?.url)       out.image       = { url: e.image.url };
  if (e.fields?.length)   out.fields      = e.fields;
  return out;
}

function buildLiveEmbed(embed) {
  const e = cleanEmbed(embed);
  if (!e.title && !e.description && !e.fields?.length && !e.image && !e.thumbnail && !e.author) {
    e.description = '*Embed em branco — comece escolhendo um campo para editar abaixo* 👇';
  }
  e.color = embed.color ?? COLOR_GOLD;
  return e;
}

/**
 * Reconhece a interação (DEFER_UPDATE) delegando ao InteractionManager
 * do framework, que mantém o Map `_states` sincronizado. Bater direto
 * no Discord por fora disso causava dessincronia: em caso de erro
 * subsequente, o fallback de erro do framework tentava reconhecer a
 * interação de novo (achando que ainda não tinha sido respondida) e
 * batia em "Unknown interaction" / "Unknown Webhook" (404).
 */
async function deferUpdate(interaction, client) {
  return client.interactions.defer(interaction);
}

async function followUp(interaction, client, data) {
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}`,
    { method: 'POST', body: data }
  );
}

async function deleteFollowUp(interaction, client, messageId) {
  return DiscordRequest(
    `/webhooks/${client.clientId}/${interaction.token}/messages/${messageId}`,
    { method: 'DELETE' }
  ).catch(() => {});
}

const EmbedBuilderUI = {

  /**
   * Abre o criador de embed.
   *
   * @param {object} interaction   Interação intocada (sem deferUpdate ainda)
   * @param {object} client
   * @param {object} opts
   * @param {string} opts.user             ID do usuário dono da interação
   * @param {object|null} opts.existingEmbed  Embed já existente (para editar) ou null
   * @param {string} [opts.title]          Título exibido no header do followUp
   * @param {function} opts.onDone         async (rootInteraction, embedObjOrNull) => any
   *        rootInteraction já vem com `__rootOverride: { channelId, messageId }`
   *        setado, pronto para qualquer `editOriginal`-like subsequente.
   */
  async open(interaction, client, opts) {
    const { user, existingEmbed = null, title = '🎨 Editor de Embed', onDone } = opts;

    // ── Captura definitiva da msg raiz (canal + id), ANTES do followUp ──
    const rootChannelId = interaction.channel_id || interaction.channel?.id;
    const rootMessageId = interaction.message?.id;

    await deferUpdate(interaction, client);

    const embed = existingEmbed
      ? JSON.parse(JSON.stringify(existingEmbed))
      : { title: '', description: '', color: COLOR_GOLD, url: '', author: { name: '', icon_url: '', url: '' }, footer: { text: '', icon_url: '' }, thumbnail: { url: '' }, image: { url: '' }, fields: [] };

    const renderBuilder = async (i, followUpMsgId) => {

      const editSel = client.interactions.createSelect({
        user,
        data: {
          placeholder: '✏️ Editar campo da embed…',
          options: [
            { label: 'Título',           value: 'title'        },
            { label: 'Descrição',        value: 'description'  },
            { label: 'URL do Título',    value: 'url'          },
            { label: 'Author Nome',      value: 'author_name'  },
            { label: 'Author Icon URL',  value: 'author_icon'  },
            { label: 'Author URL',       value: 'author_url'   },
            { label: 'Footer Texto',     value: 'footer_text'  },
            { label: 'Footer Icon URL',  value: 'footer_icon'  },
            { label: 'Thumbnail URL',    value: 'thumbnail'    },
            { label: 'Image URL',        value: 'image'        },
          ]
        },
        funcao: async (si) => {
          const MAP = {
            title:       ['Editar Título',          () => embed.title,           v => { embed.title           = v; }, false],
            description: ['Editar Descrição',       () => embed.description,     v => { embed.description     = v; }, true ],
            url:         ['Editar URL do Título',    () => embed.url,             v => { embed.url             = v; }, false],
            author_name: ['Editar Author Nome',      () => embed.author.name,     v => { embed.author.name     = v; }, false],
            author_icon: ['Editar Author Icon URL',  () => embed.author.icon_url, v => { embed.author.icon_url = v; }, false],
            author_url:  ['Editar Author URL',       () => embed.author.url,      v => { embed.author.url      = v; }, false],
            footer_text: ['Editar Footer Texto',     () => embed.footer.text,     v => { embed.footer.text     = v; }, false],
            footer_icon: ['Editar Footer Icon URL',  () => embed.footer.icon_url, v => { embed.footer.icon_url = v; }, false],
            thumbnail:   ['Editar Thumbnail URL',    () => embed.thumbnail.url,   v => { embed.thumbnail.url   = v; }, false],
            image:       ['Editar Image URL',        () => embed.image.url,       v => { embed.image.url       = v; }, false],
          };
          const [modalTitle, getter, setter, multi] = MAP[si.data.values[0]] || [];
          if (!modalTitle) return;
          const modal = client.interactions.createModal({
            user, title: modalTitle,
            components: [{ type: 1, components: [{ type: 4, custom_id: 'val', label: modalTitle, style: multi ? 2 : 1, required: false, value: getter() || '', max_length: multi ? 4000 : 256 }] }],
            funcao: async (mi, _, fields) => {
              setter(fields.val ?? '');
              await client.interactions._callback(mi, { type: 6 });
              return renderBuilder(mi, followUpMsgId);
            }
          });
          return client.interactions.showModal(si, modal);
        }
      });

      const fieldSel = client.interactions.createSelect({
        user,
        data: { placeholder: '📊 Gerenciar Fields…', options: [
          { label: '➕ Adicionar Field', value: 'add',   description: `Atual: ${embed.fields.length}/25` },
          { label: '🗑️ Remover Última',  value: 'remove' },
        ]},
        funcao: async (si) => {
          if (si.data.values[0] === 'remove') {
            if (!embed.fields.length) return;
            embed.fields.pop();
            await deferUpdate(si, client);
            return renderBuilder(si, followUpMsgId);
          }
          if (embed.fields.length >= 25) return;
          const modal = client.interactions.createModal({
            user, title: 'Adicionar Field',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'name',  label: 'Nome do field',  style: 1, required: true, max_length: 256 }] },
              { type: 1, components: [{ type: 4, custom_id: 'value', label: 'Valor do field', style: 2, required: true, max_length: 1024 }] },
              { type: 1, components: [{ type: 4, custom_id: 'inline', label: 'Inline? (sim/não)', style: 1, required: false, max_length: 5, placeholder: 'não' }] },
            ],
            funcao: async (mi, _, fields) => {
              embed.fields.push({ name: fields.name, value: fields.value, inline: ['sim', 's', 'yes', 'y'].includes((fields.inline || '').toLowerCase()) });
              await client.interactions._callback(mi, { type: 6 });
              return renderBuilder(mi, followUpMsgId);
            }
          });
          return client.interactions.showModal(si, modal);
        }
      });

      const colorSel = client.interactions.createSelect({
        user,
        data: { placeholder: '🎨 Escolher cor…', options: PRESET_COLORS.map(c => ({ label: c.label, value: c.value })) },
        funcao: async (si) => {
          const val = si.data.values[0];
          if (val === 'custom') {
            const modal = client.interactions.createModal({
              user, title: 'Cor HEX Personalizada',
              components: [{ type: 1, components: [{ type: 4, custom_id: 'hex', label: 'HEX (ex: FF5733)', style: 1, required: true, max_length: 7, placeholder: 'FF5733' }] }],
              funcao: async (mi, _, fields) => {
                const hex = (fields.hex || '').replace('#', '').trim();
                if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return;
                embed.color = parseInt(hex, 16);
                await client.interactions._callback(mi, { type: 6 });
                return renderBuilder(mi, followUpMsgId);
              }
            });
            return client.interactions.showModal(si, modal);
          }
          embed.color = parseInt(val, 16);
          await deferUpdate(si, client);
          return renderBuilder(si, followUpMsgId);
        }
      });

      const finish = async (i2, embedResult) => {
        await deferUpdate(i2, client);
        await deleteFollowUp(i2, client, followUpMsgId);

        // Marca a interação com o override de destino — qualquer
        // editOriginal subsequente vai editar a msg raiz de verdade.
        i2.__rootOverride = { channelId: rootChannelId, messageId: rootMessageId };

        return onDone(i2, embedResult);
      };

      const btnConfirm = client.interactions.createButton({
        user, data: { label: '✅ Confirmar embed', style: 3 },
        funcao: (i2) => finish(i2, cleanEmbed(embed))
      });

      const btnRemove = client.interactions.createButton({
        user, data: { label: '🗑️ Remover embed', style: 4 },
        funcao: (i2) => finish(i2, null)
      });

      const btnCancel = client.interactions.createButton({
        user, data: { label: '✖️ Cancelar', style: 2 },
        funcao: (i2) => finish(i2, existingEmbed ?? null)
      });

      const builderPayload = {
        content:    `🎨 **${title}** — o preview abaixo é exatamente como a embed vai ficar!`,
        embeds:     [buildLiveEmbed(embed)],
        components: [
          { type: 1, components: [editSel] },
          { type: 1, components: [fieldSel] },
          { type: 1, components: [colorSel] },
          { type: 1, components: [btnConfirm, btnRemove, btnCancel] },
        ],
        flags: 64, // ephemeral — SEM flag CV2, pois embed real não roda junto com Components V2
      };

      return DiscordRequest(
        `/webhooks/${client.clientId}/${i.token}/messages/${followUpMsgId}`,
        { method: 'PATCH', body: builderPayload }
      );
    };

    const initialPayload = {
      content:    `🎨 **${title}** — o preview abaixo é exatamente como a embed vai ficar!`,
      embeds:     [buildLiveEmbed(embed)],
      components: [],
      flags: 64,
    };

    const followUpResponse = await followUp(interaction, client, initialPayload);
    const followUpMsgId = followUpResponse?.id;

    return renderBuilder(interaction, followUpMsgId);
  }
};

module.exports = EmbedBuilderUI;

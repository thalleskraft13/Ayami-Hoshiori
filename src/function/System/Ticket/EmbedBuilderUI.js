'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const { localeCtx }  = require('../../Utils/ctxLocale.js');

const COLOR_GOLD = 0xFFD966;


function t(client, key, ctx) {
  return client.t(`ticket.${key}`, ctx);
}

function presetColors(client, ctx) {
  return [
    { label: t(client, 'eb_color_blue_ayami', ctx), value: '7C8FFF' },
    { label: t(client, 'eb_color_blue_hair', ctx),  value: 'A9D6FF' },
    { label: t(client, 'eb_color_dark_blue', ctx),  value: '243B7A' },
    { label: t(client, 'eb_color_gold', ctx),       value: 'FFD966' },
    { label: t(client, 'eb_color_pink', ctx),       value: 'FFB6C8' },
    { label: t(client, 'eb_color_green', ctx),      value: '57F287' },
    { label: t(client, 'eb_color_red', ctx),        value: 'ED4245' },
    { label: t(client, 'eb_color_yellow', ctx),     value: 'FEE75C' },
    { label: t(client, 'eb_color_orange', ctx),     value: 'E67E22' },
    { label: t(client, 'eb_color_purple', ctx),     value: '9B59B6' },
    { label: t(client, 'eb_color_black', ctx),      value: '000000' },
    { label: t(client, 'eb_color_custom', ctx),     value: 'custom' },
  ];
}

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

function buildLiveEmbed(embed, client, ctx) {
  const e = cleanEmbed(embed);
  if (!e.title && !e.description && !e.fields?.length && !e.image && !e.thumbnail && !e.author) {
    e.description = t(client, 'eb_blank_placeholder', ctx);
  }
  e.color = embed.color ?? COLOR_GOLD;
  return e;
}

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

  async open(interaction, client, opts) {
    const ctx = localeCtx(interaction);
    const { user, existingEmbed = null, title = t(client, 'eb_default_title', ctx), onDone } = opts;

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
          placeholder: t(client, 'eb_field_select_placeholder', ctx),
          options: [
            { label: t(client, 'eb_field_title', ctx),        value: 'title'        },
            { label: t(client, 'eb_field_description', ctx),  value: 'description'  },
            { label: t(client, 'eb_field_url', ctx),          value: 'url'          },
            { label: t(client, 'eb_field_author_name', ctx),  value: 'author_name'  },
            { label: t(client, 'eb_field_author_icon', ctx),  value: 'author_icon'  },
            { label: t(client, 'eb_field_author_url', ctx),   value: 'author_url'   },
            { label: t(client, 'eb_field_footer_text', ctx),  value: 'footer_text'  },
            { label: t(client, 'eb_field_footer_icon', ctx),  value: 'footer_icon'  },
            { label: t(client, 'eb_field_thumbnail', ctx),    value: 'thumbnail'    },
            { label: t(client, 'eb_field_image', ctx),        value: 'image'        },
          ]
        },
        funcao: async (si) => {
          const editPrefix = t(client, 'eb_edit_prefix', ctx);
          const MAP = {
            title:       [`${editPrefix} ${t(client, 'eb_field_title', ctx)}`,          () => embed.title,           v => { embed.title           = v; }, false],
            description: [`${editPrefix} ${t(client, 'eb_field_description', ctx)}`,    () => embed.description,     v => { embed.description     = v; }, true ],
            url:         [`${editPrefix} ${t(client, 'eb_field_url', ctx)}`,            () => embed.url,             v => { embed.url             = v; }, false],
            author_name: [`${editPrefix} ${t(client, 'eb_field_author_name', ctx)}`,    () => embed.author.name,     v => { embed.author.name     = v; }, false],
            author_icon: [`${editPrefix} ${t(client, 'eb_field_author_icon', ctx)}`,    () => embed.author.icon_url, v => { embed.author.icon_url = v; }, false],
            author_url:  [`${editPrefix} ${t(client, 'eb_field_author_url', ctx)}`,     () => embed.author.url,      v => { embed.author.url      = v; }, false],
            footer_text: [`${editPrefix} ${t(client, 'eb_field_footer_text', ctx)}`,    () => embed.footer.text,     v => { embed.footer.text     = v; }, false],
            footer_icon: [`${editPrefix} ${t(client, 'eb_field_footer_icon', ctx)}`,    () => embed.footer.icon_url, v => { embed.footer.icon_url = v; }, false],
            thumbnail:   [`${editPrefix} ${t(client, 'eb_field_thumbnail', ctx)}`,      () => embed.thumbnail.url,   v => { embed.thumbnail.url   = v; }, false],
            image:       [`${editPrefix} ${t(client, 'eb_field_image', ctx)}`,          () => embed.image.url,       v => { embed.image.url       = v; }, false],
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
        data: { placeholder: t(client, 'eb_fields_manage_placeholder', ctx), options: [
          { label: t(client, 'eb_add_field_label', ctx), value: 'add',   description: t(client, 'eb_add_field_desc', { ...ctx, count: embed.fields.length }) },
          { label: t(client, 'eb_remove_field_label', ctx),  value: 'remove' },
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
            user, title: t(client, 'eb_add_field_modal_title', ctx),
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'name',  label: t(client, 'eb_field_name_label', ctx),  style: 1, required: true, max_length: 256 }] },
              { type: 1, components: [{ type: 4, custom_id: 'value', label: t(client, 'eb_field_value_label', ctx), style: 2, required: true, max_length: 1024 }] },
              { type: 1, components: [{ type: 4, custom_id: 'inline', label: t(client, 'eb_field_inline_label', ctx), style: 1, required: false, max_length: 5, placeholder: t(client, 'eb_field_inline_placeholder', ctx) }] },
            ],
            funcao: async (mi, _, fields) => {
              embed.fields.push({ name: fields.name, value: fields.value, inline: ['sim', 's', 'yes', 'y', 'sí', 'si'].includes((fields.inline || '').toLowerCase()) });
              await client.interactions._callback(mi, { type: 6 });
              return renderBuilder(mi, followUpMsgId);
            }
          });
          return client.interactions.showModal(si, modal);
        }
      });

      const colorSel = client.interactions.createSelect({
        user,
        data: { placeholder: t(client, 'eb_color_select_placeholder', ctx), options: presetColors(client, ctx).map(c => ({ label: c.label, value: c.value })) },
        funcao: async (si) => {
          const val = si.data.values[0];
          if (val === 'custom') {
            const modal = client.interactions.createModal({
              user, title: t(client, 'eb_custom_hex_modal_title', ctx),
              components: [{ type: 1, components: [{ type: 4, custom_id: 'hex', label: t(client, 'eb_hex_label', ctx), style: 1, required: true, max_length: 7, placeholder: t(client, 'eb_hex_placeholder', ctx) }] }],
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

        i2.__rootOverride = { channelId: rootChannelId, messageId: rootMessageId };

        return onDone(i2, embedResult);
      };

      const btnConfirm = client.interactions.createButton({
        user, data: { label: t(client, 'eb_confirm_label', ctx), style: 3 },
        funcao: (i2) => finish(i2, cleanEmbed(embed))
      });

      const btnRemove = client.interactions.createButton({
        user, data: { label: t(client, 'eb_remove_label', ctx), style: 4 },
        funcao: (i2) => finish(i2, null)
      });

      const btnCancel = client.interactions.createButton({
        user, data: { label: t(client, 'eb_cancel_label', ctx), style: 2 },
        funcao: (i2) => finish(i2, existingEmbed ?? null)
      });

      const builderPayload = {
        content:    t(client, 'eb_builder_content', { ...ctx, title }),
        embeds:     [buildLiveEmbed(embed, client, ctx)],
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
      content:    t(client, 'eb_builder_content', { ...ctx, title }),
      embeds:     [buildLiveEmbed(embed, client, ctx)],
      components: [],
      flags: 64,
    };

    const followUpResponse = await followUp(interaction, client, initialPayload);
    const followUpMsgId = followUpResponse?.id;

    return renderBuilder(interaction, followUpMsgId);
  }
};

module.exports = EmbedBuilderUI;

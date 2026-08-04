'use strict';

function toDiscordColor(hex) {
  if (typeof hex === 'number') return hex;
  if (!hex) return null;
  return parseInt(String(hex).replace('#', ''), 16);
}

function serializeBlock(block, panel) {
  if (!block || typeof block !== 'object') return null;

  switch (block.kind) {
    case 'text':
      if (!block.content) return null;
      return { type: 10, content: String(block.content).slice(0, 4000) };

    case 'separator':
      return { type: 14, divider: true, spacing: block.spacing === 'large' ? 2 : 1 };

    case 'gallery': {
      const items = (block.items || []).filter(i => i?.url);
      if (!items.length) return null;
      return {
        type: 12,
        items: items.map(i => ({
          media: { url: i.url },
          description: i.description || undefined
        }))
      };
    }

    case 'section': {
      if (!block.text) return null;
      const inner = { type: 9, components: [{ type: 10, content: String(block.text).slice(0, 4000) }] };
      if (block.accessory?.kind === 'thumbnail' && block.accessory.url) {
        inner.accessory = { type: 11, media: { url: block.accessory.url } };
      } else if (block.accessory?.kind === 'button_link' && block.accessory.url) {
        inner.accessory = { type: 2, style: 5, label: block.accessory.label || 'Link', url: block.accessory.url };
      }
      return inner;
    }

    // Botões/Select Menu do painel de abertura — únicas ações permitidas
    // são "abrir ticket" e "abrir categoria específica" (nunca um flow
    // arbitrário), usando os mesmos custom_ids que o InteractionManager
    // já despacha para createFromButton/createFromOptionButton/createFromSelect.
    case 'button_row': {
      const buttons = (block.buttons || []).filter(b =>
        b.action === 'open_ticket' || (b.action === 'open_option' && panel?.selectMenuConfig?.options?.some(o => o.optionId === b.optionId))
      );
      if (!buttons.length) return null;
      return {
        type: 1,
        components: buttons.slice(0, 5).map(b => ({
          type: 2,
          style: [1, 2, 3, 4].includes(Number(b.style)) ? Number(b.style) : 1,
          label: String(b.label || '🎫 Abrir Ticket').slice(0, 80),
          custom_id: b.action === 'open_option'
            ? JSON.stringify({ t: 'create_ticket_option', p: panel.panelId, o: b.optionId })
            : JSON.stringify({ t: 'create_ticket_select', p: panel.panelId })
        }))
      };
    }

    case 'select_menu': {
      const byId = new Map((panel?.selectMenuConfig?.options || []).map(o => [o.optionId, o]));
      const options = (block.options || [])
        .map(o => byId.get(o.optionId))
        .filter(Boolean)
        .map(o => ({
          label: o.label,
          value: o.optionId,
          description: o.description || undefined,
          emoji: o.emoji ? { name: o.emoji } : undefined
        }));
      if (!options.length) return null;
      return {
        type: 1,
        components: [{
          type: 3,
          custom_id: JSON.stringify({ t: 'ticket_select_hub', p: panel.panelId }),
          placeholder: block.placeholder || 'Selecione o tipo de atendimento',
          options
        }]
      };
    }

    case 'container': {
      const children = (block.children || []).map(c => serializeBlock(c, panel)).filter(Boolean);
      if (!children.length) return null;
      const out = { type: 17, components: children };
      const color = toDiscordColor(block.accentColor);
      if (color !== null && !Number.isNaN(color)) out.accent_color = color;
      if (block.spoiler) out.spoiler = true;
      return out;
    }

    default:
      return null;
  }
}

function isTicketTriggerCustomId(customId) {
  if (!customId) return false;
  try {
    const parsed = JSON.parse(customId);
    return ['create_ticket_select', 'create_ticket_option', 'ticket_select_hub'].includes(parsed.t);
  } catch {
    return false;
  }
}

function hasTicketTrigger(components) {
  for (const c of components || []) {
    if (c.type === 17 && hasTicketTrigger(c.components)) return true;
    if (c.type === 9 && isTicketTriggerCustomId(c.accessory?.custom_id)) return true;
    if (c.type === 1 && c.components?.some(inner => isTicketTriggerCustomId(inner.custom_id))) return true;
  }
  return false;
}

function buildPanelBody(panel, actionRows) {
  const rows = Array.isArray(actionRows) ? actionRows : [actionRows].filter(Boolean);

  if (panel.useComponentsV2 && Array.isArray(panel.painelComponentsV2) && panel.painelComponentsV2.length) {
    const children = panel.painelComponentsV2.map(b => serializeBlock(b, panel)).filter(Boolean);
    const finalChildren = hasTicketTrigger(children) ? children : [...children, ...rows];
    const container = {
      type: 17,
      components: finalChildren
    };
    return {
      usedComponentsV2: true,
      body: {
        flags: 1 << 15,
        components: [container]
      }
    };
  }

  return {
    usedComponentsV2: false,
    body: {
      embeds: [panel.painelPrincipal || {
        title: '🎫 Painel de Tickets',
        description: 'Crie seu ticket apertando no botão abaixo.'
      }],
      components: rows
    }
  };
}

module.exports = { serializeBlock, buildPanelBody };

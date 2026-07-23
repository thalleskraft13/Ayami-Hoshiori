'use strict';


function serializeBlock(block) {
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

    case 'container': {
      const children = (block.children || []).map(serializeBlock).filter(Boolean);
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

function toDiscordColor(hex) {
  if (typeof hex === 'number') return hex;
  if (!hex) return null;
  return parseInt(String(hex).replace('#', ''), 16);
}

function buildPanelBody(panel, actionRows) {
  const rows = Array.isArray(actionRows) ? actionRows : [actionRows].filter(Boolean);

  if (panel.useComponentsV2 && Array.isArray(panel.painelComponentsV2) && panel.painelComponentsV2.length) {
    const children = panel.painelComponentsV2.map(serializeBlock).filter(Boolean);
    const container = {
      type: 17,
      components: [...children, ...rows]
    };
    return {
      usedComponentsV2: true,
      body: {
        flags: 1 << 15, // IS_COMPONENTS_V2 — não pode coexistir com `embeds`
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

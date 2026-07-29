'use strict';

const IS_COMPONENTS_V2 = 1 << 15;

const CTYPE = Object.freeze({
  ACTION_ROW   : 1,
  BUTTON       : 2,
  SECTION      : 9,
  TEXT_DISPLAY : 10,
  THUMBNAIL    : 11,
  MEDIA_GALLERY: 12,
  SEPARATOR    : 14,
  CONTAINER    : 17
});

function serializeButton(btn) {
  if (btn.kind === 'flow') {
    const out = { type: CTYPE.BUTTON, style: Number(btn.style) || 1, custom_id: JSON.stringify({ t: 'flow_trigger', f: btn.flowId }) };
    if (btn.label) out.label = btn.label;
    if (btn.emoji) out.emoji = /^\d{17,20}$/.test(btn.emoji.trim()) ? { id: btn.emoji.trim() } : { name: btn.emoji.trim() };
    return out;
  }
  const out = { type: CTYPE.BUTTON, style: 5, url: btn.url };
  if (btn.label)    out.label    = btn.label;
  if (btn.disabled) out.disabled = true;
  if (btn.emoji)    out.emoji    = /^\d{17,20}$/.test(btn.emoji.trim()) ? { id: btn.emoji.trim() } : { name: btn.emoji.trim() };
  return out;
}

function serializeBlock(block) {
  if (!block || typeof block !== 'object') return null;

  switch (block.kind) {
    case 'text':
      return { type: CTYPE.TEXT_DISPLAY, content: block.content || '' };

    case 'gallery': {
      if (!block.items?.length) return null;
      return { type: CTYPE.MEDIA_GALLERY, items: block.items.map(it => {
        const obj = { media: { url: it.url } };
        if (it.description) obj.description = it.description;
        if (it.spoiler)     obj.spoiler      = true;
        return obj;
      }) };
    }

    case 'section': {
      const comp = { type: CTYPE.SECTION, components: [{ type: CTYPE.TEXT_DISPLAY, content: block.text || '' }] };
      if (block.accessory) {
        if (block.accessory.kind === 'thumbnail') {
          comp.accessory = { type: CTYPE.THUMBNAIL, media: { url: block.accessory.url },
            ...(block.accessory.description ? { description: block.accessory.description } : {}),
            ...(block.accessory.spoiler     ? { spoiler: true } : {}) };
        } else if (block.accessory.kind === 'button_link') {
          comp.accessory = { type: CTYPE.BUTTON, style: 5, url: block.accessory.url,
            ...(block.accessory.label    ? { label: block.accessory.label }   : {}),
            ...(block.accessory.disabled ? { disabled: true } : {}) };
        }
      }
      return comp;
    }

    case 'separator':
      return { type: CTYPE.SEPARATOR, divider: block.divider ?? true, spacing: block.spacing === 'large' ? 2 : 1 };

    case 'action_row':
      if (!block.buttons?.length) return null;
      return { type: CTYPE.ACTION_ROW, components: block.buttons.map(serializeButton) };

    case 'select_menu': {
      if (!block.options?.length) return null;
      return { type: 1, components: [{ type: 3,
        custom_id  : JSON.stringify({ t: 'cv2_select', id: block._id }),
        placeholder: block.placeholder || '',
        min_values : 1, max_values: 1, disabled: false,
        options    : block.options.map(o => ({
          label      : o.label,
          value      : JSON.stringify({ t: 'flow_trigger', f: o.flowId }),
          description: o.description || null,
          emoji      : o.emoji ? { name: o.emoji } : null,
          default    : false
        }))
      }] };
    }

    case 'container': {
      const children = (block.children || []).map(serializeBlock).filter(Boolean);
      const comp     = { type: CTYPE.CONTAINER, components: children };
      if (block.accentColor != null) comp.accent_color = block.accentColor;
      if (block.spoiler)             comp.spoiler       = true;
      return comp;
    }

    default:
      return null;
  }
}

function serializeBlocks(blocks) {
  return (blocks || []).map(serializeBlock).filter(Boolean);
}

function buildCV2Payload(blocks, { ephemeral = false } = {}) {
  return {
    flags:      IS_COMPONENTS_V2 | (ephemeral ? 64 : 0),
    components: serializeBlocks(blocks)
  };
}

module.exports = { CTYPE, IS_COMPONENTS_V2, serializeButton, serializeBlock, serializeBlocks, buildCV2Payload };

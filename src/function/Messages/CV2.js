'use strict';

const IS_COMPONENTS_V2 = 1 << 15;
const EPHEMERAL = 64;

const CTYPE = Object.freeze({
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  SECTION: 9,
  TEXT_DISPLAY: 10,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  SEPARATOR: 14,
  CONTAINER: 17
});

function text(content) {
  return { type: CTYPE.TEXT_DISPLAY, content };
}

function separator(divider = true, spacing = 1) {
  return { type: CTYPE.SEPARATOR, divider, spacing };
}

function section(textContent, accessory) {
  const comp = { type: CTYPE.SECTION, components: [text(textContent)] };
  if (accessory) comp.accessory = accessory;
  return comp;
}

function row(...components) {
  return { type: CTYPE.ACTION_ROW, components };
}

function thumbnail(url, opts = {}) {
  const comp = { type: CTYPE.THUMBNAIL, media: { url } };
  if (opts.description) comp.description = opts.description;
  if (opts.spoiler) comp.spoiler = true;
  return comp;
}

function mediaGallery(items = []) {
  return {
    type: CTYPE.MEDIA_GALLERY,
    items: items.map((item) => {
      const entry = { media: { url: item.url } };
      if (item.description) entry.description = item.description;
      if (item.spoiler) entry.spoiler = true;
      return entry;
    }),
  };
}

function container(children, opts = {}) {
  const comp = { type: CTYPE.CONTAINER, components: children };
  if (opts.accentColor != null) comp.accent_color = opts.accentColor;
  if (opts.spoiler) comp.spoiler = true;
  return comp;
}

function payload(containers, opts = {}) {
  return {
    flags: IS_COMPONENTS_V2 | (opts.ephemeral === false ? 0 : EPHEMERAL),
    components: Array.isArray(containers) ? containers : [containers],
    allowed_mentions: { parse: [] }
  };
}

module.exports = { CTYPE, IS_COMPONENTS_V2, EPHEMERAL, text, separator, section, row, container, payload, thumbnail, mediaGallery };

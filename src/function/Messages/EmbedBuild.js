class CustomEmbed {

  static colors = {
    Red: 16711680,
    DarkRed: 9109504,
    Crimson: 14423100,
    FireBrick: 11674146,

    Orange: 16753920,
    DarkOrange: 16747520,
    Gold: 16766720,
    Yellow: 16776960,
    LightYellow: 16777184,

    Green: 65280,
    Lime: 3329330,
    DarkGreen: 25600,
    ForestGreen: 2263842,
    SeaGreen: 3050327,

    Aqua: 65535,
    Turquoise: 4251856,
    Teal: 32896,
    LightSeaGreen: 2142890,

    Blue: 255,
    RoyalBlue: 4286945,
    DodgerBlue: 2003199,
    SkyBlue: 8900331,
    DeepSkyBlue: 49151,
    Navy: 128,

    Indigo: 4915330,
    Purple: 8388736,
    DarkMagenta: 9109643,
    MediumPurple: 9662683,
    Violet: 15631086,
    Plum: 14524637,

    Pink: 16761035,
    HotPink: 16738740,
    DeepPink: 16716947,

    Coral: 16744272,
    Tomato: 16737095,
    Salmon: 16416882,

    Brown: 10824234,
    SaddleBrown: 9127187,
    Chocolate: 13789470,
    Peru: 13468991,

    Beige: 16119260,
    Ivory: 16777200,
    White: 16777215,
    Silver: 12632256,
    Gray: 8421504,
    DarkGray: 11119017,
    Black: 0,

    DiscordBlurple: 5793266
  };

  constructor() {
    this.data = {};
  }

  setTitle(text) {
    this.data.title = text;
    return this;
  }

  setDescription(text) {
    this.data.description = text;
    return this;
  }

  setColor(color) {

    if (typeof color === "number") {
      this.data.color = color;
      return this;
    }

    if (typeof color === "string") {

      if (color.startsWith("#")) {
        this.data.color = parseInt(color.replace("#", ""), 16);
        return this;
      }

      const formatted =
        color.charAt(0).toUpperCase() +
        color.slice(1).toLowerCase();

      const found = CustomEmbed.colors[formatted];

      if (!found)
        throw new Error(`Color "${color}" not found.`);

      this.data.color = found;
      return this;
    }

    throw new Error("Invalid color format.");
  }

  randomColor() {
    const keys = Object.keys(CustomEmbed.colors);
    const randomKey =
      keys[Math.floor(Math.random() * keys.length)];

    this.data.color = CustomEmbed.colors[randomKey];
    return this;
  }

  addField(name, value, inline = false) {
    if (!this.data.fields)
      this.data.fields = [];

    this.data.fields.push({ name, value, inline });
    return this;
  }

  setFooter(text, icon_url = null) {
    this.data.footer = { text };
    if (icon_url)
      this.data.footer.icon_url = icon_url;
    return this;
  }

  setThumbnail(url) {
    this.data.thumbnail = { url };
    return this;
  }

  setImage(url) {
    this.data.image = { url };
    return this;
  }

  setTimestamp() {
    this.data.timestamp = new Date().toISOString();
    return this;
  }

  build() {
    return this.data;
  }
}

module.exports = CustomEmbed;
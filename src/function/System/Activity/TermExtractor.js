'use strict';


const STOPWORDS = new Set([
  'de','a','o','que','e','do','da','em','um','uma','os','as','para','com','nao','não','uma',
  'por','mais','como','mas','ao','ele','das','tem','seu','sua','ou','ser','quando','muito',
  'ha','há','nos','ja','já','esta','está','eu','tambem','também','so','só','pelo','pela','ate','até',
  'isso','ela','entre','depois','sem','mesmo','aos','seus','quem','nas','me','esse','eles',
  'voce','você','vc','vcs','essa','num','nem','suas','meu','minha','numa','pelos','pelas',
  'esses','essas','pra','pro','la','lá','vai','tao','tão','aqui','ali','sim','oq','pq','porque',
  'ta','tá','to','tô','ne','né','entao','então','vou','tava','tinha','vamos','isso','aquilo',
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with','he','as',
  'you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will',
  'my','one','all','would','there','their','what','so','up','out','if','about','who','get','which',
  'go','me','when','make','can','like','time','no','just','him','know','take','people','into','year',
  'your','good','some','could','them','see','other','than','then','now','look','only','come','its',
  'over','think','also','back','after','use','two','how','our','work','first','well','way','even',
  'new','want','because','any','these','give','day','most','us','im','dont','yeah','lol','okay','ok',
  'el','la','de','que','y','a','en','un','ser','se','no','haber','por','con','su','para','como',
  'estar','tener','le','lo','todo','pero','mas','más','hacer','o','poder','decir','este','ir','otro',
  'ese','si','sí','porque','esta','entre','cuando','muy','sin','sobre','tambien','también','me','hasta',
  'donde','quien','desde','todos','durante','uno','les','ni','contra','ese','eso','esa','yo','tu','tú',
]);

const CUSTOM_EMOJI_RE  = /<a?:(\w+):(\d+)>/g;
const UNICODE_EMOJI_RE = /\p{Extended_Pictographic}/gu;
const WORD_RE          = /[\p{L}\p{N}]{3,}/gu; 

function extractTerms(content) {
  if (!content) return { words: [], emojis: [] };

  const emojiSet = new Set();
  for (const m of content.matchAll(CUSTOM_EMOJI_RE)) emojiSet.add(m[1].toLowerCase());
  for (const m of content.matchAll(UNICODE_EMOJI_RE)) emojiSet.add(m[0]);

  const cleaned = content
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(CUSTOM_EMOJI_RE, ' ')
    .replace(/<@!?\d+>|<#\d+>|<@&\d+>/g, ' ');

  const wordSet = new Set();
  for (const m of cleaned.matchAll(WORD_RE)) {
    const w = m[0].toLowerCase();
    if (/^\d+$/.test(w)) continue;       
    if (STOPWORDS.has(w)) continue;
    wordSet.add(w);
  }

  return { words: [...wordSet], emojis: [...emojiSet] };
}

module.exports = { extractTerms, STOPWORDS };

const fs = require('fs');
const path = 'src/function/System/LogicScript/Interpreter.js';
let src = fs.readFileSync(path, 'utf8');

const oldStr = `      customId: interaction.data?.custom_id,
      values:   interaction.data?.values ?? [],
      reply: async (content, opts = {}) => {
        const data = buildMessageBody(content, opts);
        return DiscordRequest(\`/interactions/\${id}/\${token}/callback\`, { method: 'POST', body: { type: 4, data } });
      },`;

const newStr = `      customId: interaction.data?.custom_id,
      values:   interaction.data?.values ?? [],
      userId:   interaction.member?.user?.id ?? interaction.user?.id,
      user:     async () => self._buildUserObj(interaction.member?.user?.id ?? interaction.user?.id),
      reply: async (content, opts = {}) => {
        const data = buildMessageBody(content, opts);
        return DiscordRequest(\`/interactions/\${id}/\${token}/callback\`, { method: 'POST', body: { type: 4, data } });
      },
      update: async (content, opts = {}) => {
        const data = buildMessageBody(content, opts);
        return DiscordRequest(\`/interactions/\${id}/\${token}/callback\`, { method: 'POST', body: { type: 7, data } });
      },`;

if (!src.includes(oldStr)) {
  console.error('❌ Trecho não encontrado — arquivo diferente do esperado. Nada foi alterado.');
  process.exit(1);
}

fs.writeFileSync(path, src.replace(oldStr, newStr), 'utf8');
console.log('✅ Patch aplicado.');

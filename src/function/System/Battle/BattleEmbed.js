'use strict';

const MessageEmbed = require('../../Messages/EmbedBuild.js');
const BattleTeam   = require('./BattleTeam.js');

// Emojis dos elementos
const EMOJI_ELEMENTO = {
    pyro:    '🔥',
    hydro:   '💧',
    electro: '⚡',
    cryo:    '❄️',
    dendro:  '🌿',
    anemo:   '🌬️',
    geo:     '🪨',
};

// Emojis de raridade
const EMOJI_RARIDADE = {
    '5': '⭐⭐⭐⭐⭐',
    '4': '⭐⭐⭐⭐',
};

/**
 * BattleEmbed
 *
 * Constrói todos os embeds visuais da batalha.
 * Centraliza a lógica de formatação, separada da engine e do comando.
 */
class BattleEmbed {

    /**
     * Embed principal da batalha — exibido a cada turno.
     *
     * @param {object} snapshot - Retornado por engine.gerarSnapshot()
     * @param {string[]} logTurno
     * @param {object} [aposta]
     */
    static batalha(snapshot, logTurno = [], aposta = null) {
        const { timeA, timeB, turno, vez } = snapshot;

        const embed = new MessageEmbed()
            .setTitle(`⚔️ Arena — Turno ${turno}`)
            .setColor(0xE74C3C)
            .setFooter(`Vez de: ${vez === 'A' ? timeA.username : timeB.username}`);

        // ─── Time A ───────────────────────────────────────────────────────────
        embed.addField(
            `🔵 ${timeA.username}`,
            BattleEmbed._renderTime(timeA),
            true
        );

        // Separador
        embed.addField('⚔️', '**vs**', true);

        // ─── Time B ───────────────────────────────────────────────────────────
        embed.addField(
            `🔴 ${timeB.username}`,
            BattleEmbed._renderTime(timeB),
            true
        );

        // ─── Log do turno ─────────────────────────────────────────────────────
        if (logTurno.length > 0) {
            const logTexto = logTurno.slice(-10).join('\n'); // Máximo 10 linhas
            embed.addField('📜 Turno', logTexto.slice(0, 1024));
        }

        // ─── Aposta ───────────────────────────────────────────────────────────
        if (aposta) {
            embed.addField('💰 Aposta', BattleEmbed._renderAposta(aposta));
        }

        return embed;
    }

    /**
     * Embed de vitória/derrota.
     */
    static resultado(vencedor, perdedor, estatisticas, aposta = null) {
        const embed = new MessageEmbed()
            .setTitle('🏆 Batalha Encerrada!')
            .setColor(0xF1C40F);

        embed.setDescription(
            `**${vencedor.username}** venceu a batalha!\n` +
            `**${perdedor.username}** foi derrotado.`
        );

        embed.addField('📊 Estatísticas', BattleEmbed._renderEstatisticas(estatisticas));

        if (aposta) {
            embed.addField('💰 Aposta Resolvida', BattleEmbed._renderApostaResultado(aposta, vencedor.username));
        }

        return embed;
    }

    /**
     * Embed de convite de batalha.
     */
    static convite(desafianteNome, adversarioNome, timeDesafiante, aposta = null) {
        const embed = new MessageEmbed()
            .setTitle('⚔️ Desafio de Batalha!')
            .setColor(0x3498DB);

        embed.setDescription(
            `**${desafianteNome}** desafiou **${adversarioNome}** para uma batalha na Arena!\n\n` +
            `${adversarioNome}, você aceita o desafio?`
        );

        embed.addField(
            `🔵 Time de ${desafianteNome}`,
            timeDesafiante.personagens.map(p =>
                `${EMOJI_ELEMENTO[p.elemento] ?? '✦'} **${p.nome}** (C${p.constelacao})`
            ).join('\n') || 'Time vazio'
        );

        if (aposta) {
            embed.addField('💰 Aposta', BattleEmbed._renderAposta(aposta));
        }

        embed.setFooter('O desafio expira em 60 segundos.');
        return embed;
    }

    /**
     * Embed de histórico de batalhas.
     */
    static historico(userId, username, batalhas = []) {
        const embed = new MessageEmbed()
            .setTitle(`📜 Histórico — ${username}`)
            .setColor(0x9B59B6);

        if (batalhas.length === 0) {
            embed.setDescription('Nenhuma batalha registrada ainda.');
            return embed;
        }

        const linhas = batalhas.slice(0, 10).map((b, i) => {
            const resultado = b.vencedor === userId ? '✅ Vitória' : '❌ Derrota';
            const data      = new Date(b.data).toLocaleDateString('pt-BR');
            return `**${i + 1}.** ${resultado} vs ${b.adversario} — ${data}`;
        });

        embed.setDescription(linhas.join('\n'));
        return embed;
    }

    /**
     * Embed de ranking da Arena.
     */
    static ranking(jogadores = []) {
        const embed = new MessageEmbed()
            .setTitle('🏆 Ranking da Arena')
            .setColor(0xF39C12);

        if (jogadores.length === 0) {
            embed.setDescription('Nenhum jogador no ranking ainda.');
            return embed;
        }

        const medalhas = ['🥇', '🥈', '🥉'];
        const linhas   = jogadores.slice(0, 10).map((j, i) => {
            const medal = medalhas[i] ?? `**${i + 1}.**`;
            return `${medal} **${j.username}** — ${j.pontos} pts (${j.vitorias}V/${j.derrotas}D)`;
        });

        embed.setDescription(linhas.join('\n'));
        return embed;
    }

    // ─── Helpers internos ─────────────────────────────────────────────────────

    static _renderTime(timeSnapshot) {
        return timeSnapshot.personagens.map((p, i) => {
            const ativo    = i === timeSnapshot.ativoIndex;
            const status   = !p.vivo ? '💀' : ativo ? '⚔️' : '💤';
            const elemento = EMOJI_ELEMENTO[p.elemento] ?? '✦';
            const barra    = BattleEmbed._barraHP(p.hpAtual, p.hpMax);
            const energia  = `${p.energia}/${p.energiaMax}⚡`;

            let linha = `${status} ${elemento} **${p.nome}**\n`;
            linha    += `${barra} ${p.hpAtual}/${p.hpMax} HP\n`;

            if (ativo && p.vivo) {
                linha += `Energia: ${energia}`;
                if (p.escudoTotal > 0) linha += ` 🛡️${p.escudoTotal}`;
                if (p.buffs.length)    linha += ` ✨${p.buffs.length}buff`;
                if (p.debuffs.length)  linha += ` 🔻${p.debuffs.length}debuff`;
            }

            return linha;
        }).join('\n');
    }

    static _barraHP(atual, max, tamanho = 8) {
        const pct    = atual / max;
        const cheios = Math.round(pct * tamanho);
        const vazios = tamanho - cheios;
        const emoji  = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
        return emoji.repeat(Math.max(0, cheios)) + '⬛'.repeat(Math.max(0, vazios));
    }

    static _renderAposta(aposta) {
        const partes = [];
        if (aposta.primogemas) partes.push(`💎 **${aposta.primogemas}** Primogemas`);
        if (aposta.personagem) partes.push(`👤 **${aposta.personagem}**`);
        return partes.join('\n') || 'Sem aposta';
    }

    static _renderApostaResultado(aposta, vencedorNome) {
        const partes = [`**${vencedorNome}** recebeu:`];
        if (aposta.primogemas) partes.push(`💎 **${aposta.primogemas}** Primogemas`);
        if (aposta.personagem) partes.push(`👤 **${aposta.personagem}** (com nível, constelação e amizade)`);
        return partes.join('\n');
    }

    static _renderEstatisticas(est) {
        if (!est) return 'Sem dados.';
        return [
            `🗡️ Dano Total: **${est.danoTotal?.toLocaleString('pt-BR') ?? 0}**`,
            `💚 Cura Total: **${est.curaTotal?.toLocaleString('pt-BR') ?? 0}**`,
            `💀 Derrotas:   **${est.personagensDerrotados ?? 0}** personagens`,
            `🔁 Turnos:     **${est.turnos ?? 0}**`,
        ].join('\n');
    }
}

module.exports = BattleEmbed;

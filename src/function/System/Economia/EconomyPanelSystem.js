'use strict';

const DiscordRequest = require("../../DiscordRequest.js");
const CV2             = require("../../Messages/CV2.js");
const BankService      = require("../../Banco/BankService.js");
const ShopService       = require("../../Loja/ShopService.js");
const { isPlanAtLeast } = require("../../Utils/PremiumPlans.js");

const ACCENT        = 0x5C6BC0;
const ACCENT_LOCKED = 0x757575;
const ACCENT_ERROR  = 0xE74C3C;

const PLANO_MINIMO = 'LUA_CRESCENTE';

const CATEGORIAS = [
  { value: 'banco',       label: 'Banco',              desc: 'Saldo, lastro, histórico e administradores', emoji: '🏦' },
  { value: 'moeda',        label: 'Moeda',               desc: 'Nome, símbolo, cor, ícone e casas decimais',  emoji: '🪙' },
  { value: 'loja',         label: 'Loja',                desc: 'Categorias, produtos e estoque',              emoji: '🛒' },
  { value: 'recompensas',  label: 'Recompensas',         desc: 'Ganhos por mensagens, voz, comandos e mais',  emoji: '🎁' },
  { value: 'salarios',     label: 'Salários',            desc: 'Pagamentos automáticos por cargo',            emoji: '💼' },
  { value: 'impostos',     label: 'Impostos',            desc: 'Taxas sobre transferências, loja e mercado',  emoji: '📋' },
  { value: 'permissoes',   label: 'Permissões',          desc: 'Administradores e cargos autorizados',        emoji: '🔐' },
  { value: 'estatisticas', label: 'Estatísticas',        desc: 'Movimentação, lastro e uso da economia',      emoji: '📊' },
  { value: 'geral',        label: 'Configurações Gerais', desc: 'Ativação, nome público, logs e limites',      emoji: '⚙️' },
];

const REWARD_TYPES = [
  { value: 'mensagens',   label: 'Mensagens enviadas' },
  { value: 'voz_tempo',   label: 'Tempo em canais de voz' },
  { value: 'voz_entrada', label: 'Entrada em canais de voz' },
  { value: 'comandos',    label: 'Utilização de comandos' },
  { value: 'exploracao',  label: 'Exploração' },
  { value: 'jardim',      label: 'Jardim' },
  { value: 'oficina',     label: 'Oficina' },
  { value: 'mercado',     label: 'Mercado' },
  { value: 'biblioteca',  label: 'Biblioteca' },
  { value: 'missoes',     label: 'Missões' },
  { value: 'eventos',     label: 'Eventos' },
];

class EconomyPanelSystem {

  constructor(client) {
    this.client = client;
  }

  async deferUpdate(interaction) {
    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      { method: "POST", body: { type: 6 } }
    );
  }

  async editOriginal(interaction, containers, opts = {}) {
    return DiscordRequest(
      `/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`,
      { method: "PATCH", body: CV2.payload(containers, { ephemeral: false, ...opts }) }
    );
  }

  _bank(guildId) {
    return new BankService(guildId, { client: this.client, guildId });
  }

  _shop(guildId) {
    return new ShopService(guildId, { client: this.client, guildId });
  }

  errorContainer(mensagem) {
    return CV2.container([
      CV2.text(`⚠️ **Não deu certo**`),
      CV2.text(mensagem)
    ], { accentColor: ACCENT_ERROR });
  }

  backRow(user, destino) {
    return CV2.row(this.client.interactions.createButton({
      user,
      data: { label: 'Voltar', style: 2 },
      funcao: async (i) => {
        await this.deferUpdate(i);
        return destino(i);
      }
    }));
  }

  async open(interaction) {
    try {
      const guildId = interaction.guild_id;
      if (!guildId)
        return this.editOriginal(interaction, [this.errorContainer("Esse painel só funciona dentro de um servidor.")]);

      const bank = this._bank(guildId);
      const plan = await bank.getPlano();

      if (!isPlanAtLeast(plan.key, PLANO_MINIMO)) {
        return this.editOriginal(interaction, [CV2.container([
          CV2.text(`🏦 **Economia do Servidor**`),
          CV2.separator(),
          CV2.text(
            `O módulo de **Economia do Servidor** depende do **Banco do Servidor**, disponível apenas na assinatura 🌙 **Lua Crescente** ou superior.\n\n` +
            `Plano atual do servidor: ${plan.emoji} **${plan.name}**.`
          )
        ], { accentColor: ACCENT_LOCKED })]);
      }

      const banco = await bank.getBanco();
      if (!banco) {
        return this.editOriginal(interaction, [CV2.container([
          CV2.text(`🏦 **Economia do Servidor**`),
          CV2.separator(),
          CV2.text(
            `Esse servidor ainda não tem um **Banco do Servidor**.\n\n` +
            `Use \`/banco criar\` para criar o Banco e depois volte aqui para configurar a economia.`
          )
        ], { accentColor: ACCENT_LOCKED })]);
      }

      return this.mainPanel(interaction, banco);
    } catch (err) {
      console.error('[EconomyPanelSystem.open]', err);
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.")]);
    }
  }

  async mainPanel(interaction, banco) {
    const user = interaction.member.user.id;

    const select = this.client.interactions.createSelect({
      user,
      data: {
        placeholder: 'Selecione uma categoria da economia',
        options: CATEGORIAS.map(c => ({
          label: c.label,
          description: c.desc,
          value: c.value,
          emoji: { name: c.emoji }
        }))
      },
      funcao: async (i) => {
        await this.deferUpdate(i);
        const valor = i.data.values?.[0];
        switch (valor) {
          case 'banco':       return this.painelBanco(i);
          case 'moeda':       return this.painelMoeda(i);
          case 'permissoes':  return this.painelPermissoes(i);
          case 'geral':       return this.painelGeral(i);
          case 'salarios':    return this.painelSalarios(i);
          case 'impostos':    return this.painelImpostos(i);
          case 'loja':        return this.painelLoja(i);
          case 'recompensas': return this.painelRecompensas(i);
          case 'estatisticas': return this.painelEstatisticas(i);
          default:            return this.emConstrucao(i, valor);
        }
      }
    });

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`🏦 **Economia do Servidor**\n${banco.nome}`),
      CV2.separator(),
      CV2.text(
        `Configure a economia local do servidor por aqui — moeda, loja, recompensas, salários, impostos, permissões e estatísticas.\n\n` +
        `Selecione uma categoria abaixo para começar.`
      ),
      CV2.separator(),
      CV2.row(select)
    ], { accentColor: ACCENT })]);
  }

  async emConstrucao(interaction, valor) {
    const categoria = CATEGORIAS.find(c => c.value === valor);
    const user = interaction.member.user.id;

    return this.editOriginal(interaction, [CV2.container([
      CV2.text(`${categoria?.emoji ?? '🏦'} **${categoria?.label ?? 'Categoria'}**`),
      CV2.separator(),
      CV2.text(`Esse painel ainda está em construção e chega em uma próxima atualização.`),
      CV2.separator(),
      this.backRow(user, (i) => this.open(i))
    ], { accentColor: ACCENT })]);
  }

  async painelBanco(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco = await bank.requireBanco();

      const infoBtn  = this.client.interactions.createButton({
        user,
        data: { label: 'Histórico e Auditoria', style: 2 },
        funcao: async (i) => { await this.deferUpdate(i); return this.painelBancoHistorico(i); }
      });

      const adminBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Administradores', style: 2 },
        funcao: async (i) => { await this.deferUpdate(i); return this.painelBancoAdmins(i); }
      });

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`🏦 **${banco.nome}**`),
        CV2.separator(),
        CV2.text(
          `**Descrição:** ${banco.descricao || '—'}\n` +
          `**Lastro (Estrelas):** ${banco.saldoEstrelas}\n` +
          `**Moeda emitida:** ${banco.totalEmitido} ${banco.moeda?.simbolo ?? ''} ${banco.moeda?.nome ?? ''}\n` +
          `**Administradores:** ${banco.administradores?.length ?? 0}`
        ),
        CV2.separator(),
        CV2.row(infoBtn, adminBtn),
        this.backRow(user, (i) => this.open(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar o Banco.")]);
    }
  }

  async painelBancoHistorico(interaction) {
    const user    = interaction.member.user.id;
    const bank    = this._bank(interaction.guild_id);

    try {
      const registros = await bank.historico(10);

      const linhas = registros.length
        ? registros.map(r => {
            const data = new Date(r.criadoEm).toLocaleString('pt-BR');
            const status = r.sucesso === false ? '❌' : '✅';
            return `${status} \`${r.tipo}\` — ${r.operacao} (${data})`;
          }).join('\n')
        : 'Nenhuma movimentação registrada ainda.';

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`🏦 **Histórico e Auditoria**`),
        CV2.separator(),
        CV2.text(linhas),
        CV2.separator(),
        this.backRow(user, (i) => this.painelBanco(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar o histórico.")]);
    }
  }

  async painelBancoAdmins(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco = await bank.requireBanco();
      const admins = banco.administradores ?? [];

      const addSelect = this.client.interactions.createUserSelect({
        user,
        data: { placeholder: 'Adicionar administrador' },
        funcao: async (i) => {
          await this.deferUpdate(i);
          const novoId = i.data.values?.[0];
          if (!novoId) return this.painelBancoAdmins(i);
          const atuais = new Set(admins);
          atuais.add(novoId);
          await bank.configurar(user, { administradores: [...atuais] });
          return this.painelBancoAdmins(i);
        }
      });

      const blocks = [
        CV2.text(`🏦 **Administradores do Banco**`),
        CV2.separator(),
        CV2.text(admins.length ? admins.map(id => `• <@${id}>`).join('\n') : 'Nenhum administrador configurado.'),
        CV2.separator(),
        CV2.row(addSelect)
      ];

      if (admins.length) {
        const removeSelect = this.client.interactions.createSelect({
          user,
          data: {
            placeholder: 'Remover administrador',
            options: admins.slice(0, 25).map(id => ({ label: `ID: ${id}`, value: id }))
          },
          funcao: async (i) => {
            await this.deferUpdate(i);
            const alvoId = i.data.values?.[0];
            const restantes = admins.filter(id => id !== alvoId);
            await bank.configurar(user, { administradores: restantes });
            return this.painelBancoAdmins(i);
          }
        });
        blocks.push(CV2.row(removeSelect));
      }

      blocks.push(this.backRow(user, (i) => this.painelBanco(i)));

      return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar os administradores.")]);
    }
  }

  async painelMoeda(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco = await bank.requireBanco();
      const moeda = banco.moeda ?? {};

      const editarBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Editar Moeda', style: 1 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: 'Editar Moeda',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'nome', label: 'Nome', style: 1, required: true, max_length: 50, value: moeda.nome ?? '' }] },
              { type: 1, components: [{ type: 4, custom_id: 'simbolo', label: 'Símbolo', style: 1, required: true, max_length: 10, value: moeda.simbolo ?? '' }] },
              { type: 1, components: [{ type: 4, custom_id: 'cor', label: 'Cor (hex, ex: #F5C542)', style: 1, required: false, max_length: 7, value: moeda.cor ?? '' }] },
              { type: 1, components: [{ type: 4, custom_id: 'icone', label: 'Ícone (emoji ou URL)', style: 1, required: false, max_length: 200, value: moeda.icone ?? '' }] },
              { type: 1, components: [{ type: 4, custom_id: 'casasDecimais', label: 'Casas decimais (0 a 4)', style: 1, required: false, max_length: 1, value: String(moeda.casasDecimais ?? 0) }] }
            ],
            funcao: async (mi, _client, fields) => {
              const casas = Number.parseInt(fields.casasDecimais, 10);
              await bank.configurar(user, {
                moeda: {
                  nome: fields.nome?.trim() || moeda.nome,
                  simbolo: fields.simbolo?.trim() || moeda.simbolo,
                  cor: fields.cor?.trim() || moeda.cor,
                  icone: fields.icone?.trim() || null,
                  casasDecimais: Number.isInteger(casas) && casas >= 0 && casas <= 4 ? casas : moeda.casasDecimais
                }
              });
              await this.deferUpdate(mi);
              return this.painelMoeda(mi);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`🪙 **Moeda do Servidor**`),
        CV2.separator(),
        CV2.text(
          `**Nome:** ${moeda.nome}\n` +
          `**Símbolo:** ${moeda.simbolo}\n` +
          `**Cor:** ${moeda.cor}\n` +
          `**Ícone:** ${moeda.icone || '—'}\n` +
          `**Casas decimais:** ${moeda.casasDecimais ?? 0}\n\n` +
          `-# Qualquer alteração reflete automaticamente em todos os módulos da economia.`
        ),
        CV2.separator(),
        CV2.row(editarBtn),
        this.backRow(user, (i) => this.open(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar a moeda.")]);
    }
  }

  async painelPermissoes(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco = await bank.requireBanco();
      const admins = banco.administradores ?? [];
      const cargos = banco.permissoes?.cargosAutorizados ?? [];

      const addCargoSelect = this.client.interactions.createRoleSelect({
        user,
        data: { placeholder: 'Adicionar cargo autorizado' },
        funcao: async (i) => {
          await this.deferUpdate(i);
          const novoId = i.data.values?.[0];
          if (!novoId) return this.painelPermissoes(i);
          const atuais = new Set(cargos);
          atuais.add(novoId);
          await bank.configurar(user, { permissoes: { cargosAutorizados: [...atuais] } });
          return this.painelPermissoes(i);
        }
      });

      const blocks = [
        CV2.text(`🔐 **Permissões da Economia**`),
        CV2.separator(),
        CV2.text(
          `**Administradores (usuário):** ${admins.length ? admins.map(id => `<@${id}>`).join(', ') : '—'}\n` +
          `**Cargos autorizados:** ${cargos.length ? cargos.map(id => `<@&${id}>`).join(', ') : '—'}\n\n` +
          `-# Administradores por usuário são gerenciados no painel do Banco. Cargos autorizados abaixo têm as mesmas permissões administrativas na economia.`
        ),
        CV2.separator(),
        CV2.row(addCargoSelect)
      ];

      if (cargos.length) {
        const removeSelect = this.client.interactions.createSelect({
          user,
          data: {
            placeholder: 'Remover cargo autorizado',
            options: cargos.slice(0, 25).map(id => ({ label: `Cargo (ID: ${id})`, value: id }))
          },
          funcao: async (i) => {
            await this.deferUpdate(i);
            const alvoId = i.data.values?.[0];
            const restantes = cargos.filter(id => id !== alvoId);
            await bank.configurar(user, { permissoes: { cargosAutorizados: restantes } });
            return this.painelPermissoes(i);
          }
        });
        blocks.push(CV2.row(removeSelect));
      }

      blocks.push(this.backRow(user, (i) => this.open(i)));

      return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar as permissões.")]);
    }
  }

  async painelGeral(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco = await bank.requireBanco();
      const cfg   = banco.configuracoesGerais ?? {};

      const toggleAtivaBtn = this.client.interactions.createButton({
        user,
        data: { label: cfg.ativa === false ? 'Ativar Economia' : 'Desativar Economia', style: cfg.ativa === false ? 3 : 4 },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurar(user, { configuracoesGerais: { ativa: !(cfg.ativa !== false) } });
          return this.painelGeral(i);
        }
      });

      const toggleLogsBtn = this.client.interactions.createButton({
        user,
        data: { label: cfg.logs ? 'Desativar Logs' : 'Ativar Logs', style: cfg.logs ? 4 : 2 },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurar(user, { configuracoesGerais: { logs: !cfg.logs } });
          return this.painelGeral(i);
        }
      });

      const toggleConfirmacoesBtn = this.client.interactions.createButton({
        user,
        data: { label: cfg.confirmacoes === false ? 'Ativar Confirmações' : 'Desativar Confirmações', style: cfg.confirmacoes === false ? 3 : 2 },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurar(user, { configuracoesGerais: { confirmacoes: !(cfg.confirmacoes !== false) } });
          return this.painelGeral(i);
        }
      });

      const canalLogsSelect = this.client.interactions.createChannelSelect({
        user,
        data: { placeholder: 'Selecionar canal de logs', channel_types: [0, 5] },
        funcao: async (i) => {
          await this.deferUpdate(i);
          const canalId = i.data.values?.[0] ?? null;
          await bank.configurar(user, { configuracoesGerais: { canalLogsId: canalId } });
          return this.painelGeral(i);
        }
      });

      const editarBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Nome Público e Limite', style: 2 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: 'Configurações Gerais',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'nomePublico', label: 'Nome público da economia', style: 1, required: false, max_length: 100, value: cfg.nomePublico ?? '' }] },
              { type: 1, components: [{ type: 4, custom_id: 'limite', label: 'Limite geral de transferência (vazio = sem limite)', style: 1, required: false, max_length: 20, value: cfg.limiteTransferencia != null ? String(cfg.limiteTransferencia) : '' }] }
            ],
            funcao: async (mi, _client, fields) => {
              const limite = fields.limite?.trim() ? Number(fields.limite.trim()) : null;
              await bank.configurar(user, {
                configuracoesGerais: {
                  nomePublico: fields.nomePublico?.trim() || null,
                  limiteTransferencia: Number.isFinite(limite) ? limite : null
                }
              });
              await this.deferUpdate(mi);
              return this.painelGeral(mi);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`⚙️ **Configurações Gerais da Economia**`),
        CV2.separator(),
        CV2.text(
          `**Economia ativa:** ${cfg.ativa === false ? 'Não' : 'Sim'}\n` +
          `**Nome público:** ${cfg.nomePublico || '—'}\n` +
          `**Logs:** ${cfg.logs ? 'Ativados' : 'Desativados'}\n` +
          `**Canal de logs:** ${cfg.canalLogsId ? `<#${cfg.canalLogsId}>` : '—'}\n` +
          `**Confirmações:** ${cfg.confirmacoes === false ? 'Desativadas' : 'Ativadas'}\n` +
          `**Limite geral de transferência:** ${cfg.limiteTransferencia ?? 'Sem limite'}`
        ),
        CV2.separator(),
        CV2.row(toggleAtivaBtn, toggleLogsBtn, toggleConfirmacoesBtn),
        CV2.row(canalLogsSelect),
        CV2.row(editarBtn),
        this.backRow(user, (i) => this.open(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar as configurações gerais.")]);
    }
  }

  async painelSalarios(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco    = await bank.requireBanco();
      const salarios = banco.salarios ?? [];

      const addCargoSelect = this.client.interactions.createRoleSelect({
        user,
        data: { placeholder: 'Configurar salário para um cargo' },
        funcao: async (si) => {
          const cargoId = si.data.values?.[0];
          if (!cargoId) return;

          const modal = this.client.interactions.createModal({
            user,
            title: 'Configurar Salário',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'valor', label: 'Valor por pagamento', style: 1, required: true, max_length: 20 }] },
              { type: 1, components: [{ type: 4, custom_id: 'intervalo', label: 'Intervalo em minutos (ex: 1440 = 1 dia)', style: 1, required: false, max_length: 10 }] },
              { type: 1, components: [{ type: 4, custom_id: 'limite', label: 'Limite de pagamentos (vazio = sem limite)', style: 1, required: false, max_length: 10 }] }
            ],
            funcao: async (mi, _client, fields) => {
              const valor      = Number(fields.valor?.trim());
              const intervalo  = fields.intervalo?.trim() ? Number(fields.intervalo.trim()) : undefined;
              const limite     = fields.limite?.trim() ? Number(fields.limite.trim()) : null;

              await bank.adicionarSalario(user, { cargoId, valor, intervaloMinutos: intervalo, limite });
              await this.deferUpdate(mi);
              return this.painelSalarios(mi);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const linhas = salarios.length
        ? salarios.map(s => `${s.ativo ? '🟢' : '🔴'} <@&${s.cargoId}> — **${s.valor}** a cada **${s.intervaloMinutos}min** ${s.limite ? `(limite: ${s.limite})` : ''}`).join('\n')
        : 'Nenhum salário configurado ainda.';

      const blocks = [
        CV2.text(`💼 **Salários Automáticos**`),
        CV2.separator(),
        CV2.text(linhas),
        CV2.separator(),
        CV2.row(addCargoSelect)
      ];

      if (salarios.length) {
        const toggleSelect = this.client.interactions.createSelect({
          user,
          data: {
            placeholder: 'Ativar/Desativar salário',
            options: salarios.slice(0, 25).map(s => ({ label: `Cargo ${s.cargoId} — ${s.ativo ? 'ativo' : 'inativo'}`, value: s.cargoId }))
          },
          funcao: async (i) => {
            await this.deferUpdate(i);
            await bank.toggleSalario(user, i.data.values?.[0]);
            return this.painelSalarios(i);
          }
        });

        const removeSelect = this.client.interactions.createSelect({
          user,
          data: {
            placeholder: 'Remover salário',
            options: salarios.slice(0, 25).map(s => ({ label: `Cargo ${s.cargoId}`, value: s.cargoId }))
          },
          funcao: async (i) => {
            await this.deferUpdate(i);
            await bank.removerSalario(user, i.data.values?.[0]);
            return this.painelSalarios(i);
          }
        });

        blocks.push(CV2.row(toggleSelect));
        blocks.push(CV2.row(removeSelect));
      }

      blocks.push(this.backRow(user, (i) => this.open(i)));

      return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar os salários.")]);
    }
  }

  async painelImpostos(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco    = await bank.requireBanco();
      const impostos = banco.impostos ?? {};

      const editarBtn1 = this.client.interactions.createButton({
        user,
        data: { label: 'Editar Taxas (1/2)', style: 2 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: 'Impostos (1/2)',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'transferencias', label: 'Transferências locais (%)', style: 1, required: false, max_length: 6, value: String(impostos.transferencias ?? 0) }] },
              { type: 1, components: [{ type: 4, custom_id: 'compras', label: 'Compras (%)', style: 1, required: false, max_length: 6, value: String(impostos.compras ?? 0) }] },
              { type: 1, components: [{ type: 4, custom_id: 'vendas', label: 'Vendas (%)', style: 1, required: false, max_length: 6, value: String(impostos.vendas ?? 0) }] },
              { type: 1, components: [{ type: 4, custom_id: 'mercado', label: 'Mercado (%)', style: 1, required: false, max_length: 6, value: String(impostos.mercado ?? 0) }] },
              { type: 1, components: [{ type: 4, custom_id: 'loja', label: 'Loja (%)', style: 1, required: false, max_length: 6, value: String(impostos.loja ?? 0) }] }
            ],
            funcao: async (mi, _client, fields) => {
              const patch = {};
              for (const chave of ['transferencias', 'compras', 'vendas', 'mercado', 'loja']) {
                const v = Number(fields[chave]?.trim());
                if (Number.isFinite(v) && v >= 0) patch[chave] = v;
              }
              await bank.configurarImpostos(user, patch);
              await this.deferUpdate(mi);
              return this.painelImpostos(mi);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const editarBtn2 = this.client.interactions.createButton({
        user,
        data: { label: 'Editar Taxas (2/2)', style: 2 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: 'Impostos (2/2)',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'leiloes', label: 'Leilões (%)', style: 1, required: false, max_length: 6, value: String(impostos.leiloes ?? 0) }] },
              { type: 1, components: [{ type: 4, custom_id: 'trocas', label: 'Trocas (%)', style: 1, required: false, max_length: 6, value: String(impostos.trocas ?? 0) }] }
            ],
            funcao: async (mi, _client, fields) => {
              const patch = {};
              for (const chave of ['leiloes', 'trocas']) {
                const v = Number(fields[chave]?.trim());
                if (Number.isFinite(v) && v >= 0) patch[chave] = v;
              }
              await bank.configurarImpostos(user, patch);
              await this.deferUpdate(mi);
              return this.painelImpostos(mi);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`📋 **Impostos da Economia**`),
        CV2.separator(),
        CV2.text(
          `**Transferências locais:** ${impostos.transferencias ?? 0}%\n` +
          `**Compras:** ${impostos.compras ?? 0}%\n` +
          `**Vendas:** ${impostos.vendas ?? 0}%\n` +
          `**Mercado:** ${impostos.mercado ?? 0}%\n` +
          `**Loja:** ${impostos.loja ?? 0}%\n` +
          `**Leilões:** ${impostos.leiloes ?? 0}%\n` +
          `**Trocas:** ${impostos.trocas ?? 0}%\n\n` +
          `-# Toda arrecadação é enviada automaticamente ao lastro do Banco do Servidor.`
        ),
        CV2.separator(),
        CV2.row(editarBtn1, editarBtn2),
        this.backRow(user, (i) => this.open(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar os impostos.")]);
    }
  }

  async painelLoja(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const shop    = this._shop(guildId);

    try {
      const categorias = await shop.listarCategorias();

      const novaCategoriaBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Nova Categoria', style: 3 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: 'Nova Categoria',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'nome', label: 'Nome da categoria', style: 1, required: true, max_length: 100 }] }
            ],
            funcao: async (mi, _client, fields) => {
              await shop.criarCategoria(user, fields.nome);
              await this.deferUpdate(mi);
              return this.painelLoja(mi);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const blocks = [
        CV2.text(`🛒 **Loja do Servidor**`),
        CV2.separator(),
        CV2.text(categorias.length ? 'Selecione uma categoria para gerenciar os produtos.' : 'Nenhuma categoria criada ainda.'),
        CV2.separator(),
        CV2.row(novaCategoriaBtn)
      ];

      if (categorias.length) {
        const categoriaSelect = this.client.interactions.createSelect({
          user,
          data: {
            placeholder: 'Gerenciar categoria',
            options: categorias.slice(0, 25).map(c => ({ label: c.nome, value: String(c._id) }))
          },
          funcao: async (i) => {
            await this.deferUpdate(i);
            return this.painelLojaCategoria(i, i.data.values?.[0]);
          }
        });

        const removerSelect = this.client.interactions.createSelect({
          user,
          data: {
            placeholder: 'Remover categoria',
            options: categorias.slice(0, 25).map(c => ({ label: c.nome, value: String(c._id) }))
          },
          funcao: async (i) => {
            await this.deferUpdate(i);
            await shop.removerCategoria(user, i.data.values?.[0]);
            return this.painelLoja(i);
          }
        });

        blocks.push(CV2.row(categoriaSelect));
        blocks.push(CV2.row(removerSelect));
      }

      blocks.push(this.backRow(user, (i) => this.open(i)));

      return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar a loja.")]);
    }
  }

  async painelLojaCategoria(interaction, categoriaId) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const shop    = this._shop(guildId);

    try {
      const produtos = await shop.listarProdutos(categoriaId);

      const novoProdutoBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Novo Produto', style: 3 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: 'Novo Produto',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'nome', label: 'Nome', style: 1, required: true, max_length: 100 }] },
              { type: 1, components: [{ type: 4, custom_id: 'descricao', label: 'Descrição', style: 2, required: false, max_length: 500 }] },
              { type: 1, components: [{ type: 4, custom_id: 'preco', label: 'Preço', style: 1, required: true, max_length: 20 }] },
              { type: 1, components: [{ type: 4, custom_id: 'estoque', label: 'Estoque (vazio = ilimitado)', style: 1, required: false, max_length: 10 }] },
              { type: 1, components: [{ type: 4, custom_id: 'imagem', label: 'URL da imagem', style: 1, required: false, max_length: 300 }] }
            ],
            funcao: async (mi, _client, fields) => {
              const preco   = Number(fields.preco?.trim());
              const estoque = fields.estoque?.trim() ? Number(fields.estoque.trim()) : null;

              await shop.criarProduto(user, categoriaId, {
                nome: fields.nome,
                descricao: fields.descricao,
                preco,
                estoque,
                imagem: fields.imagem?.trim() || null
              });
              await this.deferUpdate(mi);
              return this.painelLojaCategoria(mi, categoriaId);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const linhas = produtos.length
        ? produtos.map(p => `${p.ativo ? '🟢' : '🔴'} **${p.nome}** — ${p.preco} ${p.estoque !== null ? `(estoque: ${p.estoque})` : '(ilimitado)'}`).join('\n')
        : 'Nenhum produto nessa categoria ainda.';

      const blocks = [
        CV2.text(`🛒 **Produtos**`),
        CV2.separator(),
        CV2.text(linhas),
        CV2.separator(),
        CV2.row(novoProdutoBtn)
      ];

      if (produtos.length) {
        const produtoSelect = this.client.interactions.createSelect({
          user,
          data: {
            placeholder: 'Editar produto',
            options: produtos.slice(0, 25).map(p => ({ label: p.nome, value: String(p._id) }))
          },
          funcao: async (i) => {
            await this.deferUpdate(i);
            return this.painelLojaProduto(i, i.data.values?.[0], categoriaId);
          }
        });
        blocks.push(CV2.row(produtoSelect));
      }

      blocks.push(this.backRow(user, (i) => this.painelLoja(i)));

      return this.editOriginal(interaction, [CV2.container(blocks, { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar a categoria.")]);
    }
  }

  async painelLojaProduto(interaction, produtoId, categoriaId) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const shop    = this._shop(guildId);

    try {
      const produto = await shop.getProduto(produtoId);
      if (!produto) return this.painelLojaCategoria(interaction, categoriaId);

      const editarBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Editar Dados', style: 1 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: 'Editar Produto',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'nome', label: 'Nome', style: 1, required: true, max_length: 100, value: produto.nome }] },
              { type: 1, components: [{ type: 4, custom_id: 'descricao', label: 'Descrição', style: 2, required: false, max_length: 500, value: produto.descricao || '' }] },
              { type: 1, components: [{ type: 4, custom_id: 'preco', label: 'Preço', style: 1, required: true, max_length: 20, value: String(produto.preco) }] },
              { type: 1, components: [{ type: 4, custom_id: 'estoque', label: 'Estoque (vazio = ilimitado)', style: 1, required: false, max_length: 10, value: produto.estoque !== null ? String(produto.estoque) : '' }] },
              { type: 1, components: [{ type: 4, custom_id: 'imagem', label: 'URL da imagem', style: 1, required: false, max_length: 300, value: produto.imagem || '' }] }
            ],
            funcao: async (mi, _client, fields) => {
              const preco   = Number(fields.preco?.trim());
              const estoque = fields.estoque?.trim() ? Number(fields.estoque.trim()) : null;

              await shop.editarProduto(user, produtoId, {
                nome: fields.nome,
                descricao: fields.descricao,
                preco: Number.isFinite(preco) ? preco : undefined,
                estoque,
                imagem: fields.imagem?.trim() || null
              });
              await this.deferUpdate(mi);
              return this.painelLojaProduto(mi, produtoId, categoriaId);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const toggleBtn = this.client.interactions.createButton({
        user,
        data: { label: produto.ativo ? 'Desativar' : 'Ativar', style: produto.ativo ? 4 : 3 },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await shop.editarProduto(user, produtoId, { ativo: !produto.ativo });
          return this.painelLojaProduto(i, produtoId, categoriaId);
        }
      });

      const removerBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Remover Produto', style: 4 },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await shop.removerProduto(user, produtoId);
          return this.painelLojaCategoria(i, categoriaId);
        }
      });

      const cargosSelect = this.client.interactions.createRoleSelect({
        user,
        data: { placeholder: 'Definir cargos entregues na compra', max_values: 10 },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await shop.editarProduto(user, produtoId, { cargosEntregues: i.data.values ?? [] });
          return this.painelLojaProduto(i, produtoId, categoriaId);
        }
      });

      const itensBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Definir Itens Entregues', style: 2 },
        funcao: async (si) => {
          const atual = (produto.itensEntregues || []).map(it => `${it.nome}:${it.quantidade}`).join(', ');
          const modal = this.client.interactions.createModal({
            user,
            title: 'Itens Entregues',
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'itens', label: 'Formato: nome:qtd, nome2:qtd2', style: 2, required: false, max_length: 500, value: atual }] }
            ],
            funcao: async (mi, _client, fields) => {
              const itens = (fields.itens || '').split(',').map(s => s.trim()).filter(Boolean).map(par => {
                const [nome, qtd] = par.split(':').map(s => s?.trim());
                return { nome, quantidade: Number.isFinite(Number(qtd)) ? Number(qtd) : 1 };
              }).filter(it => it.nome);

              await shop.editarProduto(user, produtoId, { itensEntregues: itens });
              await this.deferUpdate(mi);
              return this.painelLojaProduto(mi, produtoId, categoriaId);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`🛒 **${produto.nome}**`),
        CV2.separator(),
        CV2.text(
          `**Descrição:** ${produto.descricao || '—'}\n` +
          `**Preço:** ${produto.preco}\n` +
          `**Estoque:** ${produto.estoque !== null ? produto.estoque : 'Ilimitado'}\n` +
          `**Status:** ${produto.ativo ? 'Ativo' : 'Inativo'}\n` +
          `**Cargos entregues:** ${produto.cargosEntregues?.length ? produto.cargosEntregues.map(id => `<@&${id}>`).join(', ') : '—'}\n` +
          `**Itens entregues:** ${produto.itensEntregues?.length ? produto.itensEntregues.map(it => `${it.nome} x${it.quantidade}`).join(', ') : '—'}`
        ),
        CV2.separator(),
        CV2.row(editarBtn, toggleBtn, removerBtn),
        CV2.row(cargosSelect),
        CV2.row(itensBtn),
        this.backRow(user, (i) => this.painelLojaCategoria(i, categoriaId))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar o produto.")]);
    }
  }

  async painelRecompensas(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco = await bank.requireBanco();
      const configuradas = new Map((banco.recompensas ?? []).map(r => [r.tipo, r]));

      const tipoSelect = this.client.interactions.createSelect({
        user,
        data: {
          placeholder: 'Selecione uma recompensa para configurar',
          options: REWARD_TYPES.map(t => {
            const r = configuradas.get(t.value);
            return {
              label: t.label,
              description: r ? `${r.ativo ? 'Ativa' : 'Inativa'} — valor ${r.valor}` : 'Não configurada',
              value: t.value
            };
          })
        },
        funcao: async (i) => {
          await this.deferUpdate(i);
          return this.painelRecompensaDetalhe(i, i.data.values?.[0]);
        }
      });

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`🎁 **Recompensas**`),
        CV2.separator(),
        CV2.text('Configure ganhos de moeda local por atividade no servidor.'),
        CV2.separator(),
        CV2.row(tipoSelect),
        this.backRow(user, (i) => this.open(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar as recompensas.")]);
    }
  }

  async painelRecompensaDetalhe(interaction, tipo) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const banco = await bank.requireBanco();
      const info  = REWARD_TYPES.find(t => t.value === tipo);
      const r     = banco.recompensas.find(x => x.tipo === tipo) ?? {
        valor: 0, cooldownSegundos: 0, limiteDiario: null,
        cargoObrigatorio: null, cargoBloqueado: null, canalPermitido: null, canalBloqueado: null, ativo: true
      };

      const editarBtn = this.client.interactions.createButton({
        user,
        data: { label: 'Editar Valor e Limites', style: 1 },
        funcao: async (si) => {
          const modal = this.client.interactions.createModal({
            user,
            title: `Recompensa: ${info?.label ?? tipo}`,
            components: [
              { type: 1, components: [{ type: 4, custom_id: 'valor', label: 'Valor por ganho', style: 1, required: true, max_length: 20, value: String(r.valor ?? 0) }] },
              { type: 1, components: [{ type: 4, custom_id: 'cooldown', label: 'Cooldown em segundos', style: 1, required: false, max_length: 10, value: String(r.cooldownSegundos ?? 0) }] },
              { type: 1, components: [{ type: 4, custom_id: 'limite', label: 'Limite diário (vazio = sem limite)', style: 1, required: false, max_length: 10, value: r.limiteDiario != null ? String(r.limiteDiario) : '' }] }
            ],
            funcao: async (mi, _client, fields) => {
              const valor    = Number(fields.valor?.trim());
              const cooldown = fields.cooldown?.trim() ? Number(fields.cooldown.trim()) : 0;
              const limite   = fields.limite?.trim() ? Number(fields.limite.trim()) : null;

              await bank.configurarRecompensa(user, tipo, {
                valor: Number.isFinite(valor) ? valor : r.valor,
                cooldownSegundos: Number.isFinite(cooldown) ? cooldown : r.cooldownSegundos,
                limiteDiario: limite
              });
              await this.deferUpdate(mi);
              return this.painelRecompensaDetalhe(mi, tipo);
            }
          });
          return this.client.interactions.showModal(si, modal);
        }
      });

      const toggleBtn = this.client.interactions.createButton({
        user,
        data: { label: r.ativo === false ? 'Ativar' : 'Desativar', style: r.ativo === false ? 3 : 4 },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurarRecompensa(user, tipo, { ativo: !(r.ativo !== false) });
          return this.painelRecompensaDetalhe(i, tipo);
        }
      });

      const cargoObrigatorioSelect = this.client.interactions.createRoleSelect({
        user,
        data: { placeholder: 'Cargo obrigatório (quem pode ganhar)' },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurarRecompensa(user, tipo, { cargoObrigatorio: i.data.values?.[0] ?? null });
          return this.painelRecompensaDetalhe(i, tipo);
        }
      });

      const cargoBloqueadoSelect = this.client.interactions.createRoleSelect({
        user,
        data: { placeholder: 'Cargo bloqueado (quem não pode ganhar)' },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurarRecompensa(user, tipo, { cargoBloqueado: i.data.values?.[0] ?? null });
          return this.painelRecompensaDetalhe(i, tipo);
        }
      });

      const canalPermitidoSelect = this.client.interactions.createChannelSelect({
        user,
        data: { placeholder: 'Canal permitido' },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurarRecompensa(user, tipo, { canalPermitido: i.data.values?.[0] ?? null });
          return this.painelRecompensaDetalhe(i, tipo);
        }
      });

      const canalBloqueadoSelect = this.client.interactions.createChannelSelect({
        user,
        data: { placeholder: 'Canal bloqueado' },
        funcao: async (i) => {
          await this.deferUpdate(i);
          await bank.configurarRecompensa(user, tipo, { canalBloqueado: i.data.values?.[0] ?? null });
          return this.painelRecompensaDetalhe(i, tipo);
        }
      });

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`🎁 **${info?.label ?? tipo}**`),
        CV2.separator(),
        CV2.text(
          `**Status:** ${r.ativo === false ? 'Inativa' : 'Ativa'}\n` +
          `**Valor:** ${r.valor}\n` +
          `**Cooldown:** ${r.cooldownSegundos}s\n` +
          `**Limite diário:** ${r.limiteDiario ?? 'Sem limite'}\n` +
          `**Cargo obrigatório:** ${r.cargoObrigatorio ? `<@&${r.cargoObrigatorio}>` : '—'}\n` +
          `**Cargo bloqueado:** ${r.cargoBloqueado ? `<@&${r.cargoBloqueado}>` : '—'}\n` +
          `**Canal permitido:** ${r.canalPermitido ? `<#${r.canalPermitido}>` : '—'}\n` +
          `**Canal bloqueado:** ${r.canalBloqueado ? `<#${r.canalBloqueado}>` : '—'}`
        ),
        CV2.separator(),
        CV2.row(editarBtn, toggleBtn),
        CV2.row(cargoObrigatorioSelect),
        CV2.row(cargoBloqueadoSelect),
        CV2.row(canalPermitidoSelect),
        CV2.row(canalBloqueadoSelect),
        this.backRow(user, (i) => this.painelRecompensas(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar a recompensa.")]);
    }
  }

  async painelEstatisticas(interaction) {
    const user    = interaction.member.user.id;
    const guildId = interaction.guild_id;
    const bank    = this._bank(guildId);

    try {
      const stats = await bank.estatisticas();

      return this.editOriginal(interaction, [CV2.container([
        CV2.text(`📊 **Estatísticas da Economia**`),
        CV2.separator(),
        CV2.text(
          `**Total movimentado:** ${stats.totalMovimentado}\n` +
          `**Total emitido:** ${stats.totalEmitido}\n` +
          `**Lastro disponível:** ${stats.lastroDisponivel}\n` +
          `**Lastro utilizado:** ${stats.lastroUtilizado}\n` +
          `**Total de usuários:** ${stats.totalUsuarios}\n` +
          `**Total de transações:** ${stats.totalTransacoes}\n` +
          `**Média diária:** ${stats.mediaDiaria} transações\n` +
          `**Média semanal:** ${stats.mediaSemanal} transações/dia\n` +
          `**Média mensal:** ${stats.mediaMensal} transações/dia`
        ),
        CV2.separator(),
        this.backRow(user, (i) => this.open(i))
      ], { accentColor: ACCENT })]);
    } catch (err) {
      return this.editOriginal(interaction, [this.errorContainer(err.message || "Não foi possível carregar as estatísticas.")]);
    }
  }
}

module.exports = EconomyPanelSystem;

'use strict';

const GROUP_MULTIPLIER = {
  diaria:  { meta: 1,  estrelas: 1 },
  semanal: { meta: 6,  estrelas: 7 },
  mensal:  { meta: 25, estrelas: 30 }
};

const DIFFICULTY_MULTIPLIER = {
  facil:   { meta: 0.6, estrelas: 0.7 },
  medio:   { meta: 1,   estrelas: 1 },
  dificil: { meta: 1.6, estrelas: 1.6 },
  epico:   { meta: 2.5, estrelas: 2.6 }
};

const DIFFICULTY_WEIGHTS = [
  { dificuldade: 'facil',   peso: 40 },
  { dificuldade: 'medio',   peso: 35 },
  { dificuldade: 'dificil', peso: 20 },
  { dificuldade: 'epico',   peso: 5 }
];

const TEMPLATES = [

  { id: 'economia_ganhar_estrelas',    categoria: 'economia',   acao: 'ganhar_estrelas',    titulo: 'Acumulando Estrelas',      descricao: 'Ganhe {meta} Estrelas de qualquer fonte.',              metaBase: 150,  estrelasBase: 25 },
  { id: 'economia_gastar_estrelas',    categoria: 'economia',   acao: 'gastar_estrelas',    titulo: 'Investindo Estrelas',      descricao: 'Gaste {meta} Estrelas.',                                 metaBase: 100,  estrelasBase: 20 },
  { id: 'economia_transferir',        categoria: 'economia',   acao: 'transferir_estrelas', titulo: 'Boa Vizinhança',           descricao: 'Transfira {meta} Estrelas para outros usuários.',       metaBase: 80,   estrelasBase: 18 },
  { id: 'economia_comprar',           categoria: 'economia',   acao: 'comprar',            titulo: 'Consumidor de Estrelas',    descricao: 'Compre {meta} item(ns) no Mercado.',                     metaBase: 2,    estrelasBase: 20 },
  { id: 'economia_vender',            categoria: 'economia',   acao: 'vender',             titulo: 'Vendedor Nato',            descricao: 'Anuncie {meta} item(ns) para venda no Mercado.',         metaBase: 2,    estrelasBase: 20 },
  { id: 'economia_fabricar',          categoria: 'economia',   acao: 'fabricar',           titulo: 'Mãos à Obra',              descricao: 'Fabrique {meta} item(ns) na Oficina.',                   metaBase: 2,    estrelasBase: 22 },
  { id: 'economia_trocar',            categoria: 'economia',   acao: 'trocar',             titulo: 'Troca Justa',              descricao: 'Conclua {meta} troca(s) no Mercado.',                    metaBase: 1,    estrelasBase: 25 },

  { id: 'exploracao_explorar',        categoria: 'exploracao', acao: 'explorar_regiao',    titulo: 'Rumo ao Desconhecido',      descricao: 'Inicie {meta} expedição(ões) em regiões.',               metaBase: 2,    estrelasBase: 22 },
  { id: 'exploracao_concluir',        categoria: 'exploracao', acao: 'concluir_expedicao', titulo: 'Missão Cumprida',          descricao: 'Conclua {meta} expedição(ões).',                         metaBase: 2,    estrelasBase: 25 },
  { id: 'exploracao_coletar',         categoria: 'exploracao', acao: 'coletar_recurso',    titulo: 'Catador de Recursos',       descricao: 'Colete {meta} recurso(s) em expedições.',                metaBase: 6,    estrelasBase: 20 },

  { id: 'jardim_plantar',             categoria: 'jardim',     acao: 'plantar',            titulo: 'Mão Verde',                descricao: 'Plante {meta} semente(s) no seu jardim.',                metaBase: 2,    estrelasBase: 18 },
  { id: 'jardim_colher',              categoria: 'jardim',     acao: 'colher',             titulo: 'Hora da Colheita',          descricao: 'Colha {meta} plantação(ões).',                           metaBase: 2,    estrelasBase: 20 },
  { id: 'jardim_construir',           categoria: 'jardim',     acao: 'construir',          titulo: 'Expandindo o Jardim',       descricao: 'Construa {meta} estrutura(s) no jardim.',                metaBase: 1,    estrelasBase: 30 },
  { id: 'jardim_decorar',             categoria: 'jardim',     acao: 'decorar',            titulo: 'Toque Pessoal',            descricao: 'Adicione {meta} decoração(ões) ao seu jardim.',          metaBase: 1,    estrelasBase: 20 },

  { id: 'companheiros_alimentar',     categoria: 'companheiros', acao: 'alimentar',        titulo: 'Cuidando de Quem Ama',      descricao: 'Alimente seus companheiros {meta} vez(es).',            metaBase: 2,    estrelasBase: 15 },
  { id: 'companheiros_evoluir',       categoria: 'companheiros', acao: 'evoluir',          titulo: 'Evolução Constante',        descricao: 'Evolua {meta} companheiro(s).',                          metaBase: 1,    estrelasBase: 35 },
  { id: 'companheiros_expedicao',     categoria: 'companheiros', acao: 'enviar_expedicao', titulo: 'Parceiros de Jornada',      descricao: 'Envie um companheiro em {meta} expedição(ões).',         metaBase: 2,    estrelasBase: 20 },

  { id: 'biblioteca_publicar',        categoria: 'biblioteca',  acao: 'publicar',          titulo: 'Novo Criador',              descricao: 'Publique {meta} projeto(s) na Biblioteca.',              metaBase: 1,    estrelasBase: 30 },
  { id: 'biblioteca_downloads',       categoria: 'biblioteca',  acao: 'receber_downloads', titulo: 'Conteúdo Popular',          descricao: 'Receba {meta} download(s) nas suas publicações.',       metaBase: 3,    estrelasBase: 20 },
  { id: 'biblioteca_avaliacoes',      categoria: 'biblioteca',  acao: 'receber_avaliacoes', titulo: 'Bem Avaliado',             descricao: 'Receba {meta} avaliação(ões) nas suas publicações.',     metaBase: 2,    estrelasBase: 18 },

  { id: 'discord_mensagens',          categoria: 'discord',     acao: 'enviar_mensagens',  titulo: 'Voz Ativa',                 descricao: 'Envie {meta} mensagem(ns) no servidor.',                 metaBase: 20,   estrelasBase: 15 },
  { id: 'discord_voz_tempo',          categoria: 'discord',     acao: 'permanecer_voz',    titulo: 'Sempre Conectado',          descricao: 'Permaneça {meta} minuto(s) em canais de voz.',           metaBase: 20,   estrelasBase: 18 },
  { id: 'discord_voz_entrar',         categoria: 'discord',     acao: 'entrar_voz',        titulo: 'Bora Chamar',              descricao: 'Entre em canais de voz {meta} vez(es).',                 metaBase: 2,    estrelasBase: 12 },
  { id: 'discord_comandos',           categoria: 'discord',     acao: 'usar_comando',      titulo: 'Explorando a Ayami',        descricao: 'Utilize {meta} comando(s) da Ayami.',                    metaBase: 5,    estrelasBase: 15 },
  { id: 'discord_reagir',             categoria: 'discord',     acao: 'reagir_mensagem',   titulo: 'Reação na Certa',           descricao: 'Reaja a {meta} mensagem(ns).',                           metaBase: 10,   estrelasBase: 12 },
  { id: 'discord_topicos',            categoria: 'discord',     acao: 'criar_topico',      titulo: 'Puxando Assunto',           descricao: 'Crie {meta} tópico(s) no servidor.',                     metaBase: 1,    estrelasBase: 18 },
  { id: 'discord_eventos',            categoria: 'discord',     acao: 'participar_evento', titulo: 'Presença Confirmada',       descricao: 'Participe de {meta} evento(s) do servidor.',             metaBase: 1,    estrelasBase: 20 },
  { id: 'discord_ajudar',             categoria: 'discord',     acao: 'ajudar_membro',     titulo: 'Mão Amiga',                descricao: 'Ajude membros do servidor {meta} vez(es).',              metaBase: 1,    estrelasBase: 22 },
  { id: 'discord_atividades',         categoria: 'discord',     acao: 'completar_atividade', titulo: 'Sempre Presente',        descricao: 'Complete {meta} atividade(s) do servidor.',              metaBase: 1,    estrelasBase: 20 }
];

const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));

function sortearDificuldade() {
  const total = DIFFICULTY_WEIGHTS.reduce((acc, d) => acc + d.peso, 0);
  let roll = Math.random() * total;
  for (const { dificuldade, peso } of DIFFICULTY_WEIGHTS) {
    if (roll < peso) return dificuldade;
    roll -= peso;
  }
  return 'facil';
}

function calcularMeta(template, grupo, dificuldade) {
  const base = template.metaBase * GROUP_MULTIPLIER[grupo].meta * DIFFICULTY_MULTIPLIER[dificuldade].meta;
  return Math.max(1, Math.round(base));
}

function calcularRecompensa(template, grupo, dificuldade) {
  const base = template.estrelasBase * GROUP_MULTIPLIER[grupo].estrelas * DIFFICULTY_MULTIPLIER[dificuldade].estrelas;
  return Math.max(5, Math.round(base / 5) * 5);
}

module.exports = {
  TEMPLATES,
  TEMPLATES_BY_ID,
  GROUP_MULTIPLIER,
  DIFFICULTY_MULTIPLIER,
  sortearDificuldade,
  calcularMeta,
  calcularRecompensa
};

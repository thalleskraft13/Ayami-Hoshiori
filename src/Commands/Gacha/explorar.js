'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");

module.exports = {
  data: {
    name: "explorar",
    description: "Comandos relacionados à exploração",
    name_localizations: { 'en-US': 'explore', 'en-GB': 'explore', 'es-ES': 'explorar' },
    description_localizations: {
      'en-US': 'Commands related to exploration',
      'en-GB': 'Commands related to exploration',
      'es-ES': 'Comandos relacionados con la exploración',
    },
    type: 1,
    options: [
      {
        name: "mondstadt",
        description: "Explore a Cidade da Liberdade e descubra o que os ventos de Barbatos insistem em esconder",
        type: 1
      },
      {
        name: "tempo",
        description: "Veja o tempo que falta de cada exploração",
        type: 1
      }
    ]
  },

  async execute(interaction, client) {

    const subcommand = interaction.data.options?.[0];
    const authorId = interaction.member.user.id;
    const emoji = client.emoji;
    if (!subcommand) return;

    let user = await db.findOne({ userId: authorId });
    if (!user) user = await db.create({ userId: authorId }).save();

    const agora = Date.now();

    // ──────────────────────────────────────────
    //  TEMPO
    // ──────────────────────────────────────────
    if (subcommand.name === "tempo") {

      const exploracao = user.exploracao.mondstadt;

      if (!exploracao.tempo || exploracao.tempo <= agora) {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                flags: 64,
                content: `${emoji.pensando} Você não possui nenhuma exploração ativa no momento... Que tal explorar um pouco?`
              }
            }
          }
        );
      }

      const restante = exploracao.tempo - agora;
      const horas = Math.floor(restante / 1000 / 60 / 60);
      const minutos = Math.floor((restante / 1000 / 60) % 60);
      const segundos = Math.floor((restante / 1000) % 60);

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              flags: 64,
              content: `${emoji.sonolenta} Exploração em andamento, aguenta aí!\nTempo restante: **${horas > 0 ? `${horas}h ` : ""}${minutos}m ${segundos}s** ${emoji.animada}`
            }
          }
        }
      );
    }

    // ──────────────────────────────────────────
    //  MONDSTADT
    // ──────────────────────────────────────────
    if (subcommand.name === "mondstadt") {

      const exploracao = user.exploracao.mondstadt;

      // Já tem exploração em andamento
      if (exploracao.tempo > agora) {

        const restante = exploracao.tempo - agora;
        const horas = Math.floor(restante / 1000 / 60 / 60);
        const minutos = Math.floor((restante / 1000 / 60) % 60);

        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                flags: 64,
                content: `${emoji.emburrada} Ei, você ainda tem uma exploração rolando!\nVolta em ${horas > 0 ? `${horas}h ` : ""}${minutos}min, tá? ${emoji.carinho}`
              }
            }
          }
        );
      }

      // Tem recompensa pra coletar
      if (exploracao.tempo <= agora && exploracao.coletar > 0) {

        const quantidade = exploracao.coletar;

        if (!user.primogemas) user.primogemas = { atm: 0, transacoes: [] };

        user.primogemas.atm += quantidade;
        user.primogemas.transacoes.push({ tipo: "exploracao", quantidade, data: agora });

        await client.missionManager.trackEvent(authorId, 'explore', 1, interaction.guild_id);

        user.exploracao.mondstadt.coletar = 0;
        user.exploracao.mondstadt.tempo = 0;
        await user.save();

        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                flags: 64,
                content: `${emoji.festa} Sua exploração terminou! Você coletou **${quantidade} Primogemas**! ${emoji.corao}\n\nBom trabalho, aventureiro~`
              }
            }
          }
        );
      }

      // Painel de exploração
      const buildPanel = (disabled = false) => ([
        {
          type: 10,
          content: `<@${authorId}>`
        },
        {
          type: 17,
          accent_color: 0x11CC8D,
          spoiler: false,
          components: [
            {
              type: 10,
              content: `# ${emoji.animada} Exploração de Mondstadt`
            },
            {
              type: 10,
              content: `${emoji.pensando} Mondstadt está chamando por você! Os ventos de Barbatos raramente carregam só canções...\n\nEscolha por quanto tempo quer explorar e eu aviso quando terminar, pode deixar comigo! ${emoji.carinho}`
            },
            {
              type: 12,
              items: [
                {
                  media: {
                    url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-SdaIFV7rzuOApt4UI4QIFA1yZXJ4SOyzOmSvcIpD6CTIWOmP4TXuPobC&s=10"
                  },
                  description: null,
                  spoiler: false
                }
              ]
            },
            {
              type: 1,
              components: [
                client.interactions.createSelect({
                  user: authorId,
                  data: {
                    placeholder: `${disabled ? "✅ Exploração iniciada!" : "Escolha o tempo de exploração"}`,
                    options: [
                      {
                        label: "Rastros dos Ventos",
                        description: "Explore Mondstadt por 30 minutos • 300 Primogemas",
                        value: "30min"
                      },
                      {
                        label: "Planícies Anemo",
                        description: "Explore Mondstadt por 1 hora • 600 Primogemas",
                        value: "1h"
                      },
                      {
                        label: "Expedição da Liberdade",
                        description: "Explore Mondstadt por 2 horas • 1200 Primogemas",
                        value: "2h"
                      },
                      {
                        label: "Grande Jornada dos Mil Ventos",
                        description: "Explore Mondstadt por 10 horas • 6000 Primogemas",
                        value: "10h"
                      }
                    ]
                  },

                  funcao: async (i) => {

                    const userId = i.member.user.id;
                    const value = i.data.values?.[0];

                    let tempo = 0;
                    let recompensa = 0;
                    let tempoTexto = "";

                    switch (value) {
                      case "30min": tempo = 30 * 60 * 1000;        recompensa = 300;  tempoTexto = "30 minutos"; break;
                      case "1h":    tempo = 1 * 60 * 60 * 1000;    recompensa = 600;  tempoTexto = "1 hora";     break;
                      case "2h":    tempo = 2 * 60 * 60 * 1000;    recompensa = 1200; tempoTexto = "2 horas";    break;
                      case "10h":   tempo = 10 * 60 * 60 * 1000;   recompensa = 6000; tempoTexto = "10 horas";   break;
                      default: return;
                    }

                    const userDoc = await db.findOne({ userId });
                    userDoc.exploracao.mondstadt.tempo = Date.now() + tempo;
                    userDoc.exploracao.mondstadt.coletar = recompensa;
                    await userDoc.save();

                    // Edita a mensagem original desabilitando o select
                    await DiscordRequest(
                      `/interactions/${i.id}/${i.token}/callback`,
                      {
                        method: "POST",
                        body: {
                          type: 7,
                          data: {
                            flags: 32768,
                            components: [
                              {
                                type: 10,
                                content: `<@${userId}>`
                              },
                              {
                                type: 17,
                                accent_color: 0x11CC8D,
                                spoiler: false,
                                components: [
                                  {
                                    type: 10,
                                    content: `# ${emoji.feliz} Exploração Iniciada!`
                                  },
                                  {
                                    type: 10,
                                    content: `${emoji.animada} Boa aventura em Mondstadt! Você vai por **${tempoTexto}** e volta com **${recompensa} Primogemas**!\n\nEu fico aqui te esperando, vai lá! ${emoji.corao}`
                                  },
                                  {
                                    type: 12,
                                    items: [
                                      {
                                        media: {
                                          url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-SdaIFV7rzuOApt4UI4QIFA1yZXJ4SOyzOmSvcIpD6CTIWOmP4TXuPobC&s=10"
                                        },
                                        description: null,
                                        spoiler: false
                                      }
                                    ]
                                  },
                                  {
                                    type: 1,
                                    components: [
                                      client.interactions.createButton({
                                        user: userId,
                                        data: {
                                          label: "⏰ Ativar Lembrete",
                                          style: 2
                                        },
                                        funcao: async (btn) => {

                                          await DiscordRequest(
                                            `/interactions/${btn.id}/${btn.token}/callback`,
                                            {
                                              method: "POST",
                                              body: {
                                                type: 4,
                                                data: {
                                                  flags: 64,
                                                  content: `${emoji.carinho} Lembrete ativado! Eu mesma venho te avisar quando terminar~`
                                                }
                                              }
                                            }
                                          );

                                          await client.TaskManager.create({
                                            tipo: "lembrete",
                                            delay: tempo,
                                            dados: {
                                              userId,
                                              channelId: btn.channel_id,
                                              mensagem: `${emoji.festa} Sua exploração em Mondstadt terminou! Corre lá coletar suas **${recompensa} Primogemas**! ${emoji.animada}`
                                            }
                                          });
                                        }
                                      })
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        }
                      }
                    );
                  }
                })
              ]
            }
          ]
        }
      ]);

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              flags: 32768,
              components: buildPanel()
            }
          }
        }
      );
    }
  }
};
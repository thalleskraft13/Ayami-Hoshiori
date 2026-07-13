"use strict";

module.exports = [
  { id: "banned_title", render: () => "⛔ Você está banido da Ayami" },
  { id: "banned_description", render: () =>
    "Você não pode usar a Ayami em nenhum servidor enquanto estiver na blacklist global." },
  { id: "banned_field_staff", render: () => "Staff responsável" },
  { id: "banned_field_when", render: () => "Quando" },
  { id: "banned_field_reason", render: () => "Motivo" },
  { id: "banned_unknown", render: () => "Desconhecido" },
  { id: "banned_no_reason", render: () => "Não especificado" },
];

'use strict';

class GiveawayExport {

  static async export(doc, format) {

    switch (format) {
      case 'html': return this._toHTML(doc);
      case 'csv':  return this._toCSV(doc);
      case 'xlsx': return this._toXLSX(doc);
      case 'json': return this._toJSON(doc);
      default: throw new Error(`Formato inválido: ${format}`);
    }
  }


  static async _toHTML(doc) {

    const rows = doc.participants.map((p, i) => {

      const statusLabel = {
        participating: '🎟️ Participando',
        winner:        '🏆 Vencedor',
        disqualified:  '❌ Desclassificado',
        would_have_won:'💭 Teria Vencido',
      }[p.status] ?? p.status;

      const joinedDate = new Date(p.joinedAt).toLocaleString('pt-BR');

      return `
      <tr class="row-${p.status}">
        <td>${i + 1}</td>
        <td><code>${p.userId}</code></td>
        <td><code>${p.guildId}</code></td>
        <td>${joinedDate}</td>
        <td>${p.baseEntries}</td>
        <td>${p.bonusEntries}</td>
        <td><strong>${p.totalEntries}</strong></td>
        <td>${statusLabel}</td>
        <td>${p.disqualifyReason ?? '—'}</td>
      </tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sorteio — ${this._esc(doc.prize)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #1a1a2e;
      color: #eee;
      padding: 2rem;
    }
    h1 { color: #FFB7C5; margin-bottom: 0.25rem; font-size: 1.8rem; }
    .meta { color: #aaa; font-size: 0.85rem; margin-bottom: 2rem; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th {
      background: #FFB7C5;
      color: #1a1a2e;
      padding: 0.6rem 0.8rem;
      text-align: left;
      font-weight: 700;
    }
    td { padding: 0.5rem 0.8rem; border-bottom: 1px solid #2a2a4a; }
    tr:hover td { background: #22224a; }
    .row-winner td     { color: #57F287; }
    .row-disqualified td { color: #ED4245; opacity: 0.8; }
    .row-would_have_won td { color: #FEE75C; }
    code { font-family: monospace; font-size: 0.8rem; opacity: 0.85; }
    .summary {
      display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .stat {
      background: #16213e;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      border-left: 3px solid #FFB7C5;
    }
    .stat-label { font-size: 0.75rem; color: #aaa; }
    .stat-value { font-size: 1.4rem; font-weight: 700; color: #FFB7C5; }
  </style>
</head>
<body>
  <h1>🎉 ${this._esc(doc.prize)}</h1>
  <p class="meta">
    ID: ${doc.giveawayId} &nbsp;|&nbsp;
    Servidor: ${doc.guildId} &nbsp;|&nbsp;
    Encerrado: ${doc.endedAt ? new Date(doc.endedAt).toLocaleString('pt-BR') : '—'} &nbsp;|&nbsp;
    Vencedores: ${doc.winners}
  </p>

  <div class="summary">
    <div class="stat">
      <div class="stat-label">Total de Participantes</div>
      <div class="stat-value">${doc.participants.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Vencedores</div>
      <div class="stat-value">${doc.participants.filter(p => p.status === 'winner').length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Desclassificados</div>
      <div class="stat-value">${doc.participants.filter(p => p.status === 'disqualified').length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Entradas Totais</div>
      <div class="stat-value">${doc.participants.reduce((a, p) => a + p.totalEntries, 0)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>User ID</th>
        <th>Servidor</th>
        <th>Entrou em</th>
        <th>Base</th>
        <th>Bônus</th>
        <th>Total</th>
        <th>Status</th>
        <th>Motivo</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <p style="margin-top:1.5rem;color:#666;font-size:0.75rem">
    Exportado por Ayami Hoshiori &hearts;
  </p>
</body>
</html>`;

    return {
      name:        `sorteio-${doc.giveawayId}.html`,
      data:        Buffer.from(html, 'utf8'),
      contentType: 'text/html',
    };
  }


  static async _toCSV(doc) {

    const header = 'Posição,User ID,Servidor,Entrou em,Base,Bônus,Total,Status,Motivo\n';

    const rows = doc.participants.map((p, i) => {
      const cols = [
        i + 1,
        p.userId,
        p.guildId,
        new Date(p.joinedAt).toISOString(),
        p.baseEntries,
        p.bonusEntries,
        p.totalEntries,
        p.status,
        p.disqualifyReason ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);

      return cols.join(',');
    });

    const csv = header + rows.join('\n');

    return {
      name:        `sorteio-${doc.giveawayId}.csv`,
      data:        Buffer.from('\uFEFF' + csv, 'utf8'), // BOM para Excel reconhecer UTF-8
      contentType: 'text/csv',
    };
  }


  static async _toXLSX(doc) {

    const XLSX = require('xlsx');

    const data = [
      ['#', 'User ID', 'Servidor', 'Entrou em', 'Entradas Base', 'Entradas Bônus', 'Total', 'Status', 'Motivo de Desclassificação'],
      ...doc.participants.map((p, i) => [
        i + 1,
        p.userId,
        p.guildId,
        new Date(p.joinedAt).toLocaleString('pt-BR'),
        p.baseEntries,
        p.bonusEntries,
        p.totalEntries,
        p.status,
        p.disqualifyReason ?? '',
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 40 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Participantes');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      name:        `sorteio-${doc.giveawayId}.xlsx`,
      data:        buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }


  static async _toJSON(doc) {

    const payload = {
      giveawayId:   doc.giveawayId,
      guildId:      doc.guildId,
      prize:        doc.prize,
      description:  doc.description,
      winners:      doc.winners,
      status:       doc.status,
      endsAt:       doc.endsAt,
      endedAt:      doc.endedAt,
      participants: doc.participants.map(p => ({
        userId:           p.userId,
        guildId:          p.guildId,
        baseEntries:      p.baseEntries,
        bonusEntries:     p.bonusEntries,
        totalEntries:     p.totalEntries,
        joinedAt:         p.joinedAt,
        status:           p.status,
        disqualifyReason: p.disqualifyReason,
        drawPosition:     p.drawPosition,
      })),
      drawHistory:  doc.drawHistory,
      exportedAt:   new Date().toISOString(),
      exportedBy:   'Ayami Hoshiori',
    };

    return {
      name:        `sorteio-${doc.giveawayId}.json`,
      data:        Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      contentType: 'application/json',
    };
  }


  static _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = GiveawayExport;

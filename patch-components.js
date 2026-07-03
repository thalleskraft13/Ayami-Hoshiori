const fs = require('fs');
const path = 'src/function/System/LogicScript/Interpreter.js';
let src = fs.readFileSync(path, 'utf8');

const oldStr = `  // Componentes
  const comps = resolveComponents(opts.components ?? opts.component);
  if (comps.length) body.components = comps;`;

const newStr = `  // Componentes
  if (opts.components !== undefined || opts.component !== undefined) {
    body.components = resolveComponents(opts.components ?? opts.component);
  }`;

if (!src.includes(oldStr)) {
  console.error('❌ Trecho não encontrado — nada foi alterado.');
  process.exit(1);
}

fs.writeFileSync(path, src.replace(oldStr, newStr), 'utf8');
console.log('✅ Patch aplicado.');

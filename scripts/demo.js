import { simulateClutch } from '../src/clutch.js';
const names = { '111111111111111111': 'Esther', '222222222222222222': 'Levy' };
const duel = simulateClutch({ id: '111111111111111111' }, { id: '222222222222222222' });
console.log(`SIMULAÇÃO · ${duel.map}\n${duel.text.replace(/<@(\d+)>/g, (_,id) => names[id])}`);

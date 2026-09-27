import { optimizeTeams, type Fighter, type BattleOptions } from "../../../lib/calculators/hero-battle";
self.onmessage = (event: MessageEvent<{ pool: Fighter[]; options: BattleOptions }>) => {
  try {
    const result = optimizeTeams(event.data.pool, event.data.options, (done) => self.postMessage({ done }));
    self.postMessage({ result });
  } catch {
    self.postMessage({ error: true });
  }
};

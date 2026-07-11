import { RANK_TIERS } from "../config.js";

export function calcularRango(puntos) {
  let r = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (puntos >= t.min) r = t;
  return r;
}

export function proximoRango(puntos) {
  const actual = calcularRango(puntos);
  const idx = RANK_TIERS.findIndex((t) => t.name === actual.name);
  return RANK_TIERS[idx + 1] || null;
}

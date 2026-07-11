/**
 * Racha semanal de compras: sube el descuento automático mientras el cliente pida
 * al menos una vez por semana (contado desde que el admin aprueba el pedido, no desde
 * que lo envía). Si se salta una semana completa, la racha vuelve a partir de 1.
 */

/** Clave de semana ISO, ej. "2026-W28". */
export function obtenerSemanaISO(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d - inicioAnio) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + "-W" + semana;
}

function esSemanaConsecutiva(semanaAnterior, semanaActual) {
  const [anioA, wA] = semanaAnterior.split("-W").map(Number);
  const [anioB, wB] = semanaActual.split("-W").map(Number);
  if (anioA === anioB && wB === wA + 1) return true;
  if (anioB === anioA + 1 && wA >= 52 && wB === 1) return true; // fin de año
  return false;
}

/**
 * Calcula la nueva racha de un usuario al aprobarle un pedido. Devuelve null si esta
 * semana ya se había contado (no hay nada que actualizar).
 */
export function calcularNuevaRacha(ultimaSemanaCompra, rachaActual, ahora = new Date()) {
  const semanaActual = obtenerSemanaISO(ahora);
  if (ultimaSemanaCompra === semanaActual) return null; // ya se contó esta semana
  const consecutiva = ultimaSemanaCompra && esSemanaConsecutiva(ultimaSemanaCompra, semanaActual);
  return {
    racha: consecutiva ? (rachaActual || 0) + 1 : 1,
    ultimaSemanaCompra: semanaActual,
  };
}

/** % de descuento activo según la racha y la configuración del admin. */
export function calcularDescuentoRacha(racha, settings) {
  if (!racha || racha <= 0) return 0;
  const pct = racha * (settings.streakPercentPerWeek || 0);
  if (settings.streakInfinite) return pct;
  return Math.min(pct, settings.streakMaxPercent || 0);
}

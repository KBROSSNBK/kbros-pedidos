/**
 * Configuración global del prototipo.
 *
 * USE_MOCK = true  -> toda la app corre contra datos locales (localStorage), sin tocar
 *                      el Firebase real. Así se puede navegar, iniciar "sesión", pedir,
 *                      juntar puntos y canjear recompensas sin escribir nada en producción.
 * USE_MOCK = false -> usa js/data/firebaseAdapter.js, que apunta al MISMO proyecto y
 *                      las MISMAS colecciones que la página actual (users, pendingPoints,
 *                      orders, likes, usuarios, settings, codesIndex, transfers), más dos
 *                      colecciones nuevas y aditivas: products/ y settings/rewards.
 *                      Cambiar esta bandera es la ÚNICA acción necesaria para pasar de
 *                      demo a producción real; no hay que tocar ningún otro archivo.
 */
export const USE_MOCK = false;

export const ADMIN_EMAIL = "kbros.contacto@gmail.com";

export const DEFAULT_SETTINGS = {
  pointsPerClp: 100, // $100 CLP = 1 K-POINT
  bonoCumpleanos: 500, // mismo nombre de campo que la Firebase real (settings/bonoCumpleanos)
  heroTitle: "COME",
  heroSlogan: "BKN",
  heroSubtitle: "Completos, churrascos, fajitas y más. Pide online y retira o recibe en tu casa.",
  whatsappNumber: "56956446048",
  deliveryBaseFee: 1700,
  deliveryPerKmFee: 300,
  deliveryFreeKm: 1,
  adminEmails: [], // administradores extra, agregados desde Panel Admin -> Ajustes (sin tocar Firebase)

  // Racha semanal: por cada semana consecutiva con al menos 1 pedido aprobado, sube el
  // descuento automático que se aplica en el siguiente pedido. Todo configurable desde
  // Panel Admin -> Ajustes.
  streakPercentPerWeek: 2, // % que suma cada semana de racha
  streakMaxPercent: 10, // tope del descuento (se ignora si streakInfinite = true)
  streakInfinite: false, // si es true, el % sigue subiendo sin tope semana a semana
};

export const KBROS_LOCATION = { lat: -33.60675364336594, lng: -70.68617400931403 };

export const WHATSAPP_NUMBER = "56956446048";

export const BRAND = {
  name: "KBROS",
  logo: "assets/logo.png", // logo redondo oficial (extraído del arte del letrero acrílico)
};

// Sistema de rangos: progreso individual por puntos acumulados (no es un ranking
// competitivo entre clientes -> eso, junto con misiones y ruleta, se eliminó).
export const RANK_TIERS = [
  { name: "Papita Nueva", icon: "🥔", min: 0 },
  { name: "Completero", icon: "🌭", min: 500 },
  { name: "Plancha ardiente", icon: "🔥", min: 2000 }, // mismo nombre que ya vieron los clientes en la página actual
  { name: "KBROS Legend", icon: "👑", min: 5000 },
];

// Misiones del mes: totalmente configurables desde el panel admin (meta a cumplir,
// tipo de meta y cómo se entrega la recompensa).
export const DEFAULT_MISSIONS = [
  {
    id: "m-frecuente",
    icon: "🛍️",
    name: "Comprador frecuente",
    description: "Realiza 3 compras este mes",
    goalType: "compras", // 'compras' | 'puntos' | 'monto'
    goalTarget: 3,
    rewardType: "puntos", // 'puntos' | 'fisico'
    rewardValue: 200,
  },
  {
    id: "m-puntos",
    icon: "🎯",
    name: "Meta de puntos",
    description: "Junta 500 K-POINTS en el mes",
    goalType: "puntos",
    goalTarget: 500,
    rewardType: "puntos",
    rewardValue: 150,
  },
  {
    id: "m-antojo",
    icon: "🍮",
    name: "Antojo cumplido",
    description: "Gasta $15.000 este mes en KBROS",
    goalType: "monto",
    goalTarget: 15000,
    rewardType: "fisico",
    rewardValue: "Postre de cortesía en tu próxima visita",
  },
];

// Catálogo de recompensas por defecto (reemplaza ranking y ruleta).
export const DEFAULT_REWARDS = [
  { id: "rw-bebida", name: "Bebida lata gratis", cost: 400, icon: "🥤", description: "Canjea una bebida lata en tu próximo pedido." },
  { id: "rw-papas", name: "Papas chicas gratis", cost: 700, icon: "🍟", description: "Papas fritas chicas de cortesía." },
  { id: "rw-empanadas", name: "Empanadas de queso x5", cost: 900, icon: "🥟", description: "Canjea una porción de empanadas de queso." },
  { id: "rw-completo", name: "Completo chico gratis", cost: 1200, icon: "🌭", description: "Un completo chico a elección, gratis." },
  { id: "rw-descuento10", name: "10% de descuento", cost: 1500, icon: "🏷️", description: "10% de descuento en tu próximo pedido." },
  { id: "rw-combo", name: "Combo KBROS gratis", cost: 3000, icon: "🎁", description: "Un combo completo de cortesía." },
];

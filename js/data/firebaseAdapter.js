import { ADMIN_EMAIL, DEFAULT_SETTINGS, DEFAULT_MISSIONS } from "../config.js";
import { getAllProducts, getCategories as getLocalCategories } from "./menuData.js";
import { calcularNuevaRacha } from "../state/streak.js";

function periodKey(date = new Date()) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

/** Las misiones se lanzaron con esta fecha. Los pedidos aprobados ANTES de esto (de
 * cuando la tienda probaba el sistema, antes de que las misiones existieran para los
 * clientes) no cuentan para el progreso — si no, cualquier cuenta con historial previo
 * este mes aparecía con la misión "ya completada" el primer día, lista para reclamar sin
 * haber hecho nada nuevo. */
const MISSIONS_TRACKING_SINCE = new Date("2026-07-11T00:00:00").getTime();

/** La página anterior guardaba las misiones con otros nombres de campo
 * (descripcion/icono/meta/nombre/recompensa/tipo, siempre en puntos). Para no perder
 * ni romper las misiones que ya existen en la Firebase real, se normalizan acá al leerlas
 * en vez de asumir que todo lo que hay en settings/missions ya tiene la forma nueva. */
function normalizeMission(m) {
  if (!m) return m;
  if (m.goalType) return m; // ya tiene la forma nueva
  return {
    id: m.id,
    icon: m.icono || "🎯",
    name: m.nombre || "Misión",
    description: m.descripcion || "",
    goalType: m.tipo === "monto" ? "monto" : m.tipo === "puntos" ? "puntos" : "compras",
    goalTarget: m.meta || 1,
    rewardType: "puntos",
    rewardValue: m.recompensa || 0,
  };
}

function computeProgress(u, period) {
  const hist = Object.values(u.historial || {}).filter(
    (h) => h.tipo === "puntos_aprobados" && h.fecha >= MISSIONS_TRACKING_SINCE && periodKey(new Date(h.fecha)) === period
  );
  return {
    compras: hist.length,
    puntos: hist.reduce((s, h) => s + (h.puntos || 0), 0),
    monto: hist.reduce((s, h) => s + (h.monto || 0), 0),
  };
}

/**
 * Adapter real. Usa EXACTAMENTE el mismo proyecto y las mismas colecciones que la
 * página actual en línea (users, pendingPoints, orders, likes, usuarios, settings,
 * codesIndex, transfers), más dos colecciones nuevas y puramente aditivas:
 *   - products/        (catálogo editable desde el panel admin, con fallback a menuData.js)
 *   - settings/rewards  (catálogo de recompensas, reemplaza settings/missions y settings/ruleta)
 *
 * Este archivo NO se ejecuta mientras config.js tenga USE_MOCK = true: ni siquiera se
 * descarga el SDK de Firebase. Se activa cambiando esa única bandera cuando el equipo
 * de KBROS decida pasar este prototipo a producción.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDR-LnHsJ54kj-5vRzB3NoK-EB-ELD9xQs",
  authDomain: "kbros-web.firebaseapp.com",
  databaseURL: "https://kbros-web-default-rtdb.firebaseio.com",
  projectId: "kbros-web",
  storageBucket: "kbros-web.firebasestorage.app",
  messagingSenderId: "281753184526",
  appId: "1:281753184526:web:c6e824fefd7b261a428f5f",
};

let dbPromise = null;
let ultimoCumpleanosGoogle = null; // ver signInWithGoogle() / getOrCreateUser()

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initFirebase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js");
      // eslint-disable-next-line no-undef
      firebase.initializeApp(firebaseConfig);
      // eslint-disable-next-line no-undef
      const provider = new firebase.auth.GoogleAuthProvider();
      // Pide la fecha de nacimiento del perfil de Google (si el usuario la tiene
      // configurada y compartida) para no depender de que el cliente la escriba a mano.
      // Requiere tener habilitada la People API en el proyecto de Google Cloud detrás
      // de este Firebase.
      provider.addScope("https://www.googleapis.com/auth/user.birthday.read");
      // eslint-disable-next-line no-undef
      return { db: firebase.database(), auth: firebase.auth(), provider };
    })();
  }
  return dbPromise;
}

/** Consulta la fecha de nacimiento del perfil de Google recién autenticado (People API).
 * Devuelve "AAAA-MM-DD" (o "0000-MM-DD" si Google solo comparte día y mes, sin año),
 * o null si la cuenta no tiene esa info o el usuario no la compartió. */
async function obtenerCumpleanosDeGoogle(accessToken) {
  if (!accessToken) return null;
  try {
    const resp = await fetch(
      `https://people.googleapis.com/v1/people/me?personFields=birthdays&access_token=${accessToken}`
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const fecha = (data.birthdays || []).map((b) => b.date).find((d) => d && d.month && d.day);
    if (!fecha) return null;
    const y = fecha.year ? String(fecha.year).padStart(4, "0") : "0000";
    return `${y}-${String(fecha.month).padStart(2, "0")}-${String(fecha.day).padStart(2, "0")}`;
  } catch (e) {
    console.error("No se pudo obtener el cumpleaños desde Google People API:", e);
    return null;
  }
}

/** Reduce una imagen a un dataURL liviano (máx ~640px) para guardarla directo en la base
 * de datos, sin depender de Firebase Storage (que requiere el plan de pago Blaze). */
function fileToCompressedDataUrl(file, maxSize = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function genCode(existingCheck) {
  return new Promise(async (resolve) => {
    let code, exists = true;
    while (exists) {
      code = "KB" + Math.floor(10000 + Math.random() * 90000);
      exists = await existingCheck(code);
    }
    resolve(code);
  });
}

export const firebaseAdapter = {
  async getProducts() {
    const { db } = await initFirebase();
    const snap = await db.ref("products").get();
    if (snap.exists()) return Object.values(snap.val());
    // Primera vez: siembra el nodo con el catálogo local para que quede editable.
    const seed = getAllProducts();
    const obj = {};
    seed.forEach((p) => (obj[p.id] = p));
    await db.ref("products").set(obj);
    return seed;
  },

  async getCategories() {
    const { db } = await initFirebase();
    const snap = await db.ref("categories").get();
    if (snap.exists()) return Object.values(snap.val());
    // Primera vez: siembra el nodo con las categorías locales para que queden editables.
    const seed = getLocalCategories();
    const obj = {};
    seed.forEach((c) => (obj[c.id] = c));
    await db.ref("categories").set(obj);
    return seed;
  },

  /** "Más vendidos" real: se calcula de las ventas efectivas (nodo productStats/, aditivo),
   * con los productos marcados manualmente como bestSeller solo como relleno inicial. */
  async getBestSellers(limit = 8) {
    const { db } = await initFirebase();
    const [statsSnap, products] = await Promise.all([db.ref("productStats").get(), this.getProducts()]);
    const stats = statsSnap.val() || {};
    const withCounts = products.map((p) => ({ ...p, salesCount: stats[p.id] || 0, bestSeller: false }));
    const vendidos = withCounts.filter((p) => p.salesCount > 0).sort((a, b) => b.salesCount - a.salesCount);
    vendidos.forEach((p) => (p.bestSeller = true));
    if (vendidos.length >= limit) return vendidos.slice(0, limit);
    const relleno = withCounts
      .filter((p) => p.salesCount === 0 && products.find((x) => x.id === p.id)?.bestSeller)
      .map((p) => ({ ...p, bestSeller: true }));
    return [...vendidos, ...relleno].slice(0, limit);
  },

  async recordProductSales(items) {
    const { db } = await initFirebase();
    await Promise.all(
      items.filter((i) => i.id).map((i) => db.ref("productStats/" + i.id).transaction((v) => (v || 0) + (i.cantidad || 1)))
    );
  },

  async getSettings() {
    const { db } = await initFirebase();
    const snap = await db.ref("settings").get();
    return snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.val() } : DEFAULT_SETTINGS;
  },

  async getMissions() {
    const { db } = await initFirebase();
    const snap = await db.ref("settings/missions").get();
    if (snap.exists()) return Object.values(snap.val()).map(normalizeMission);
    const obj = {};
    DEFAULT_MISSIONS.forEach((m) => (obj[m.id] = m));
    await db.ref("settings/missions").set(obj);
    return DEFAULT_MISSIONS;
  },

  async getMissionProgress(uid) {
    const { db } = await initFirebase();
    const snap = await db.ref("users/" + uid).get();
    const u = snap.val() || {};
    const period = periodKey();
    return {
      progreso: computeProgress(u, period),
      reclamadas: (u.misionesReclamadas && u.misionesReclamadas[period]) || {},
    };
  },

  async claimMission(uid, missionId) {
    const { db } = await initFirebase();
    const missionsSnap = await db.ref("settings/missions/" + missionId).get();
    const mission = normalizeMission(missionsSnap.val());
    if (!mission) return { ok: false, message: "Misión no encontrada." };
    const period = periodKey();
    const reclamadaSnap = await db.ref(`users/${uid}/misionesReclamadas/${period}/${missionId}`).get();
    if (reclamadaSnap.exists() && reclamadaSnap.val()) return { ok: false, message: "Ya reclamaste esta misión este mes." };
    const userSnap = await db.ref("users/" + uid).get();
    const u = userSnap.val() || {};
    const progreso = computeProgress(u, period);
    if ((progreso[mission.goalType] || 0) < mission.goalTarget) {
      return { ok: false, message: "Todavía no cumples la meta de esta misión." };
    }
    await db.ref(`users/${uid}/misionesReclamadas/${period}`).update({ [missionId]: true });
    if (mission.rewardType === "puntos") {
      const pts = Number(mission.rewardValue || 0);
      await db.ref("users/" + uid + "/puntos").transaction((p) => (p || 0) + pts);
      await db.ref("users/" + uid + "/historial").push({ tipo: "mision_completada", mision: mission.name, puntos: pts, fecha: Date.now() });
      return { ok: true, message: `¡Misión completada! +${pts} K-POINTS` };
    }
    await db.ref("users/" + uid + "/historial").push({ tipo: "mision_completada", mision: mission.name, premio: mission.rewardValue, fecha: Date.now() });
    return { ok: true, message: `¡Misión completada! Muestra esto al staff: "${mission.rewardValue}"` };
  },

  onLikes(cb) {
    initFirebase().then(({ db }) => db.ref("likes").on("value", (s) => cb(s.val() || 0)));
    return () => initFirebase().then(({ db }) => db.ref("likes").off());
  },

  async incrementLike() {
    const { db } = await initFirebase();
    await db.ref("likes").transaction((c) => (c || 0) + 1);
  },

  onActiveUsers(cb) {
    initFirebase().then(({ db }) => {
      const ref = db.ref("usuarios").push(true);
      ref.onDisconnect().remove();
      db.ref("usuarios").on("value", (s) => cb(s.numChildren()));
    });
    return () => initFirebase().then(({ db }) => db.ref("usuarios").off());
  },

  async signInWithGoogle() {
    const { auth, provider } = await initFirebase();
    const cred = await auth.signInWithPopup(provider);
    // El access token de OAuth solo está disponible acá, justo tras el popup — no se
    // puede volver a pedir más adelante. Se guarda en una variable de módulo para que
    // getOrCreateUser() lo use al crear la cuenta (si es la primera vez que entra).
    ultimoCumpleanosGoogle = await obtenerCumpleanosDeGoogle(cred.credential?.accessToken);
    return cred.user;
  },

  async signOutUser() {
    const { auth } = await initFirebase();
    await auth.signOut();
  },

  onAuthChange(cb) {
    initFirebase().then(({ auth }) => auth.onAuthStateChanged(cb));
    return () => {};
  },

  async getOrCreateUser(authUser) {
    const { db } = await initFirebase();
    const ref = db.ref("users/" + authUser.uid);
    const snap = await ref.get();
    if (snap.exists()) return snap.val();
    const code = await genCode(async (c) => (await db.ref("codesIndex/" + c).get()).exists());
    const nuevo = {
      uid: authUser.uid,
      nombre: authUser.displayName || "",
      correo: authUser.email || "",
      foto: authUser.photoURL || "",
      fechaCreacion: Date.now(),
      codigo: code,
      puntos: 0,
      pedidos: 0,
      montoGastado: 0,
      historial: [],
      // Viene de Google (People API), no de un campo que el cliente pueda escribir a su
      // gusto. Si Google no la tiene disponible, queda sin definir y se pide una sola vez
      // manualmente (ver profile.js) — mismo resultado, solo que no se puede forzar.
      ...(ultimoCumpleanosGoogle ? { fechaNacimiento: ultimoCumpleanosGoogle } : {}),
    };
    ultimoCumpleanosGoogle = null;
    await ref.set(nuevo);
    await db.ref("codesIndex/" + code).set(authUser.uid);
    return nuevo;
  },

  onUserData(uid, cb) {
    initFirebase().then(({ db }) => db.ref("users/" + uid).on("value", (s) => cb(s.val())));
    return () => initFirebase().then(({ db }) => db.ref("users/" + uid).off());
  },

  async saveBirthday(uid, dateStr) {
    const { db } = await initFirebase();
    await db.ref("users/" + uid + "/fechaNacimiento").set(dateStr);
  },

  /** Se llama en cada login: si hoy es el cumpleaños del cliente y no se le ha dado el
   * bono este año, se lo acredita automáticamente. */
  async claimBirthdayBonusIfDue(uid) {
    const { db } = await initFirebase();
    const snap = await db.ref("users/" + uid).get();
    const u = snap.val();
    if (!u || !u.fechaNacimiento) return { granted: false };
    const [, mesStr, diaStr] = u.fechaNacimiento.split("-");
    const hoy = new Date();
    const esHoy = hoy.getMonth() + 1 === parseInt(mesStr, 10) && hoy.getDate() === parseInt(diaStr, 10);
    const anioActual = hoy.getFullYear();
    if (!esHoy || u.ultimoBonoCumpleanos === anioActual) return { granted: false };
    const settingsSnap = await db.ref("settings").get();
    const settings = { ...DEFAULT_SETTINGS, ...(settingsSnap.val() || {}) };
    const bono = settings.bonoCumpleanos || 0;
    await db.ref("users/" + uid + "/puntos").transaction((p) => (p || 0) + bono);
    await db.ref("users/" + uid + "/ultimoBonoCumpleanos").set(anioActual);
    await db.ref("users/" + uid + "/historial").push({ tipo: "cumpleanos", puntos: bono, fecha: Date.now() });
    return { granted: true, amount: bono };
  },

  async submitOrder(payload) {
    const { db } = await initFirebase();

    // Los canjes agregados al pedido descuentan K-Points de inmediato (quedan "reservados"
    // mientras el pedido está pendiente); si el admin rechaza el pedido, se devuelven
    // en admin.rejectPending(). Si lo aprueba, quedan descontados definitivamente.
    if (payload.canjes && payload.canjes.length && payload.uid) {
      const totalCanje = payload.canjes.reduce((s, c) => s + c.cost * (c.qty || 1), 0);
      await db.ref("users/" + payload.uid + "/puntos").transaction((p) => Math.max(0, (p || 0) - totalCanje));
      await Promise.all(
        payload.canjes.map((c) =>
          db.ref("users/" + payload.uid + "/historial").push({ tipo: "canje_pendiente", recompensa: c.name, puntos: -(c.cost * (c.qty || 1)), fecha: Date.now() })
        )
      );
    }

    const entry = { ...payload, fecha: Date.now(), estado: "pendiente" };
    await db.ref("pendingPoints").push(entry);
    await db.ref("orders").push(entry);
    return entry;
  },

  async getMyRedemptions(uid) {
    const { db } = await initFirebase();
    const snap = await db.ref("pendingPoints").get();
    const data = snap.val() || {};
    return Object.entries(data)
      .filter(([, p]) => p.uid === uid && p.canjes && p.canjes.length)
      .map(([id, p]) => ({ id, canjes: p.canjes, estado: p.estado, fecha: p.fecha }))
      .sort((a, b) => b.fecha - a.fecha);
  },

  async getMyOrders(uid) {
    const { db } = await initFirebase();
    const snap = await db.ref("pendingPoints").get();
    const data = snap.val() || {};
    return Object.entries(data)
      .filter(([, p]) => p.uid === uid)
      .map(([id, p]) => ({ id, items: p.items || [], canjes: p.canjes || null, modo: p.modo, monto: p.monto, puntos: p.puntos, estado: p.estado, fecha: p.fecha }))
      .sort((a, b) => b.fecha - a.fecha);
  },

  async getRewards() {
    const { db } = await initFirebase();
    const snap = await db.ref("settings/rewards").get();
    if (snap.exists()) return Object.values(snap.val());
    return [];
  },

  async redeemReward(uid, reward) {
    const { db } = await initFirebase();
    const snap = await db.ref("users/" + uid + "/puntos").get();
    const puntos = snap.val() || 0;
    if (puntos < reward.cost) return { ok: false, message: "No tienes suficientes K-POINTS." };
    await db.ref("users/" + uid + "/puntos").transaction((p) => (p || 0) - reward.cost);
    await db.ref("users/" + uid + "/historial").push({ tipo: "canje", recompensa: reward.name, puntos: -reward.cost, fecha: Date.now() });
    return { ok: true, message: `¡Canjeaste "${reward.name}"! Muestra tu código en el local.` };
  },

  async getHistory(uid) {
    const { db } = await initFirebase();
    const snap = await db.ref("users/" + uid + "/historial").get();
    if (!snap.exists()) return [];
    return Object.values(snap.val()).reverse();
  },

  async transferPoints(fromCode, toCode, amount) {
    const { db } = await initFirebase();
    if (fromCode === toCode) return { ok: false, message: "No puedes transferirte a ti mismo." };
    const destSnap = await db.ref("codesIndex/" + toCode).get();
    if (!destSnap.exists()) return { ok: false, message: "Código no encontrado." };
    const destUid = destSnap.val();
    const fromSnap = await db.ref("codesIndex/" + fromCode).get();
    const fromUid = fromSnap.val();
    const fromUserSnap = await db.ref("users/" + fromUid).get();
    const fromUser = fromUserSnap.val();
    if (fromUser && fromUser.correo !== ADMIN_EMAIL) {
      if ((fromUser.puntos || 0) < amount) return { ok: false, message: "No tienes suficientes K-POINTS." };
      await db.ref("users/" + fromUid + "/puntos").transaction((p) => (p || 0) - amount);
      await db.ref("users/" + fromUid + "/historial").push({ tipo: "transferencia_enviada", cantidad: amount, para: toCode, fecha: Date.now() });
    }
    await db.ref("users/" + destUid + "/puntos").transaction((p) => (p || 0) + amount);
    await db.ref("users/" + destUid + "/historial").push({ tipo: "transferencia_recibida", cantidad: amount, de: fromCode, fecha: Date.now() });
    await db.ref("transfers").push({ de: fromCode, para: toCode, cantidad: amount, fecha: Date.now() });
    return { ok: true, message: "Transferencia realizada." };
  },

  admin: {
    async getStats() {
      const { db } = await initFirebase();
      const usersSnap = await db.ref("users").get();
      const users = usersSnap.val() || {};
      const pendSnap = await db.ref("pendingPoints").get();
      const pend = pendSnap.val() || {};
      return {
        totalUsuarios: Object.keys(users).length,
        totalPuntos: Object.values(users).reduce((s, u) => s + (u.puntos || 0), 0),
        pendientesCount: Object.values(pend).filter((p) => p.estado === "pendiente").length,
      };
    },
    async getPending() {
      const { db } = await initFirebase();
      const snap = await db.ref("pendingPoints").get();
      const data = snap.val() || {};
      return Object.entries(data)
        .filter(([, p]) => p.estado === "pendiente")
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => b.fecha - a.fecha);
    },
    /** Historial de pedidos ya resueltos (aprobados y rechazados), para auditoría del admin. */
    async getOrdersHistory() {
      const { db } = await initFirebase();
      const snap = await db.ref("pendingPoints").get();
      const data = snap.val() || {};
      return Object.entries(data)
        .filter(([, p]) => p.estado === "aprobado" || p.estado === "rechazado")
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => b.fecha - a.fecha);
    },
    async approvePending(id) {
      const { db } = await initFirebase();
      const ref = db.ref("pendingPoints/" + id);
      const snap = await ref.get();
      const p = snap.val();
      if (!p) return;
      const uidSnap = await db.ref("codesIndex/" + p.codigo).get();
      if (!uidSnap.exists()) return;
      const uid = uidSnap.val();
      await db.ref("users/" + uid + "/puntos").transaction((v) => (v || 0) + p.puntos);
      await db.ref("users/" + uid + "/pedidos").transaction((v) => (v || 0) + 1);
      await db.ref("users/" + uid + "/montoGastado").transaction((v) => (v || 0) + p.monto);
      await db.ref("users/" + uid + "/historial").push({ tipo: "puntos_aprobados", puntos: p.puntos, monto: p.monto, fecha: Date.now() });
      if (p.canjes && p.canjes.length) {
        await Promise.all(
          p.canjes.map((c) => db.ref("users/" + uid + "/historial").push({ tipo: "canje_aprobado", recompensa: c.name, fecha: Date.now() }))
        );
      }
      // Racha semanal: solo avanza con pedidos aprobados, nunca con el simple envío.
      const userSnap = await db.ref("users/" + uid).get();
      const u = userSnap.val() || {};
      const nueva = calcularNuevaRacha(u.ultimaSemanaCompra, u.racha);
      if (nueva) {
        await db.ref("users/" + uid).update({ racha: nueva.racha, ultimaSemanaCompra: nueva.ultimaSemanaCompra });
      }
      await ref.update({ estado: "aprobado", fechaAprobacion: Date.now() });
    },
    async rejectPending(id) {
      const { db } = await initFirebase();
      const ref = db.ref("pendingPoints/" + id);
      const snap = await ref.get();
      const p = snap.val();
      await ref.update({ estado: "rechazado", fechaRechazo: Date.now() });
      // Los canjes de un pedido rechazado devuelven los K-Points que se habían descontado al pedir.
      if (p && p.canjes && p.canjes.length && p.uid) {
        const totalCanje = p.canjes.reduce((s, c) => s + c.cost * (c.qty || 1), 0);
        await db.ref("users/" + p.uid + "/puntos").transaction((v) => (v || 0) + totalCanje);
        await db.ref("users/" + p.uid + "/historial").push({ tipo: "canje_reembolsado", puntos: totalCanje, motivo: "Pedido rechazado", fecha: Date.now() });
      }
    },
    async searchUsers(query) {
      const { db } = await initFirebase();
      const q = query.trim().toLowerCase();
      const snap = await db.ref("users").get();
      const users = snap.val() || {};
      return Object.values(users).filter(
        (u) =>
          (u.nombre || "").toLowerCase().includes(q) ||
          (u.correo || "").toLowerCase().includes(q) ||
          (u.codigo || "").toLowerCase().includes(q)
      );
    },
    async adjustPoints(codigo, amount, reason) {
      const { db } = await initFirebase();
      const uidSnap = await db.ref("codesIndex/" + codigo).get();
      if (!uidSnap.exists()) return { ok: false, message: "Código no encontrado." };
      const uid = uidSnap.val();
      await db.ref("users/" + uid + "/puntos").transaction((v) => Math.max(0, (v || 0) + amount));
      await db.ref("users/" + uid + "/historial").push({ tipo: amount > 0 ? "bonificacion" : "descuento", cantidad: amount, motivo: reason || "Ajuste manual", fecha: Date.now() });
      return { ok: true, message: "Ajuste aplicado." };
    },
    async getAllProducts() {
      const { db } = await initFirebase();
      const snap = await db.ref("products").get();
      return snap.exists() ? Object.values(snap.val()) : getAllProducts();
    },
    async saveProduct(product) {
      const { db } = await initFirebase();
      await db.ref("products/" + product.id).set(product);
    },
    async deleteProduct(id) {
      const { db } = await initFirebase();
      await db.ref("products/" + id).remove();
    },
    async getCategoriesAdmin() {
      const { db } = await initFirebase();
      const snap = await db.ref("categories").get();
      return snap.exists() ? Object.values(snap.val()) : getLocalCategories();
    },
    async saveCategory(category) {
      const { db } = await initFirebase();
      await db.ref("categories/" + category.id).set(category);
    },
    async deleteCategory(id) {
      const { db } = await initFirebase();
      await db.ref("categories/" + id).remove();
    },
    async getRewardsAdmin() {
      const { db } = await initFirebase();
      const snap = await db.ref("settings/rewards").get();
      return snap.exists() ? Object.values(snap.val()) : [];
    },
    async saveReward(reward) {
      const { db } = await initFirebase();
      await db.ref("settings/rewards/" + reward.id).set(reward);
    },
    async deleteReward(id) {
      const { db } = await initFirebase();
      await db.ref("settings/rewards/" + id).remove();
    },
    async saveSettings(patch) {
      const { db } = await initFirebase();
      await db.ref("settings").update(patch);
      const snap = await db.ref("settings").get();
      return snap.val();
    },
    async getMissionsAdmin() {
      const { db } = await initFirebase();
      const snap = await db.ref("settings/missions").get();
      return snap.exists() ? Object.values(snap.val()).map(normalizeMission) : DEFAULT_MISSIONS;
    },
    async saveMission(mission) {
      const { db } = await initFirebase();
      await db.ref("settings/missions/" + mission.id).set(mission);
    },
    async deleteMission(id) {
      const { db } = await initFirebase();
      await db.ref("settings/missions/" + id).remove();
    },
    async uploadProductImage(productId, file) {
      const dataUrl = await fileToCompressedDataUrl(file);
      const { db } = await initFirebase();
      await db.ref("products/" + productId + "/image").set(dataUrl);
      return dataUrl;
    },
  },
};

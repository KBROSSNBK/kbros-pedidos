import { ADMIN_EMAIL, DEFAULT_SETTINGS, DEFAULT_REWARDS, DEFAULT_MISSIONS } from "../config.js";
import { getAllProducts, getCategories as getLocalCategories } from "./menuData.js";
import { calcularNuevaRacha } from "../state/streak.js";

/**
 * Adapter 100% local (localStorage). Implementa la misma interfaz que firebaseAdapter.js
 * para que el resto de la app no note la diferencia. Se usa mientras USE_MOCK = true en
 * config.js, así se puede probar todo el flujo (login, pedidos, puntos, canjes, admin)
 * sin escribir un solo dato en el Firebase real.
 */

const KEY = {
  users: "kbros_mock_users",
  session: "kbros_mock_session",
  pending: "kbros_mock_pending",
  rewards: "kbros_mock_rewards",
  likes: "kbros_mock_likes",
  settings: "kbros_mock_settings",
  products: "kbros_mock_products",
  categories: "kbros_mock_categories",
  missions: "kbros_mock_missions",
  productStats: "kbros_mock_productStats",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function uid() {
  return "u_" + Math.random().toString(36).slice(2, 10);
}
function genCode(users) {
  let code;
  do {
    code = "KB" + Math.floor(10000 + Math.random() * 90000);
  } while (Object.values(users).some((u) => u.codigo === code));
  return code;
}

function ensureSeed() {
  if (read(KEY.rewards, null) === null) write(KEY.rewards, DEFAULT_REWARDS);
  if (read(KEY.settings, null) === null) write(KEY.settings, DEFAULT_SETTINGS);
  if (read(KEY.products, null) === null) write(KEY.products, getAllProducts());
  if (read(KEY.categories, null) === null) write(KEY.categories, getLocalCategories());
  if (read(KEY.missions, null) === null) write(KEY.missions, DEFAULT_MISSIONS);
  if (read(KEY.users, null) === null) write(KEY.users, {});
  if (read(KEY.pending, null) === null) write(KEY.pending, []);
  if (read(KEY.likes, null) === null) write(KEY.likes, 128);
}
ensureSeed();

/** Clave del período mensual actual, ej. "2026-07". Las misiones se reinician cada mes. */
function periodKey(date = new Date()) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

/** Progreso del usuario en el mes actual, calculado desde su propio historial de compras aprobadas. */
function computeProgress(u, period) {
  const hist = (u.historial || []).filter(
    (h) => h.tipo === "puntos_aprobados" && periodKey(new Date(h.fecha)) === period
  );
  return {
    compras: hist.length,
    puntos: hist.reduce((s, h) => s + (h.puntos || 0), 0),
    monto: hist.reduce((s, h) => s + (h.monto || 0), 0),
  };
}

const authListeners = new Set();
let currentAuthUser = null;

function notifyAuth() {
  authListeners.forEach((cb) => cb(currentAuthUser));
}

// Restaura sesión simulada al cargar
(function restoreSession() {
  const sess = read(KEY.session, null);
  if (sess) currentAuthUser = sess;
})();

/** Reduce una imagen a un dataURL liviano (máx ~640px) para no saturar localStorage. */
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

export const mockAdapter = {
  async getProducts() {
    return read(KEY.products, getAllProducts());
  },

  async getCategories() {
    return read(KEY.categories, getLocalCategories());
  },

  /** "Más vendidos" real: se calcula de las ventas efectivas, con los productos marcados
   * manualmente como bestSeller solo como relleno mientras todavía no hay pedidos suficientes. */
  async getBestSellers(limit = 8) {
    const stats = read(KEY.productStats, {});
    const products = read(KEY.products, getAllProducts());
    const withCounts = products.map((p) => ({ ...p, salesCount: stats[p.id] || 0, bestSeller: false }));
    const vendidos = withCounts.filter((p) => p.salesCount > 0).sort((a, b) => b.salesCount - a.salesCount);
    vendidos.forEach((p) => (p.bestSeller = true));
    if (vendidos.length >= limit) return vendidos.slice(0, limit);
    const relleno = withCounts
      .filter((p) => p.salesCount === 0 && products.find((x) => x.id === p.id)?.bestSeller)
      .map((p) => ({ ...p, bestSeller: true }));
    return [...vendidos, ...relleno].slice(0, limit);
  },

  /** Suma unidades vendidas por producto cada vez que se confirma un pedido (aunque sea invitado). */
  async recordProductSales(items) {
    const stats = read(KEY.productStats, {});
    items.forEach((i) => {
      if (!i.id) return;
      stats[i.id] = (stats[i.id] || 0) + (i.cantidad || 1);
    });
    write(KEY.productStats, stats);
  },

  async getSettings() {
    // Merge con los valores por defecto por si el navegador tiene guardada una versión
    // vieja de settings (de una sesión de prueba anterior) a la que le faltan campos nuevos.
    return { ...DEFAULT_SETTINGS, ...read(KEY.settings, {}) };
  },

  async getMissions() {
    return read(KEY.missions, DEFAULT_MISSIONS);
  },

  async getMissionProgress(userUid) {
    const users = read(KEY.users, {});
    const u = users[userUid];
    const period = periodKey();
    if (!u) return { progreso: { compras: 0, puntos: 0, monto: 0 }, reclamadas: {} };
    return {
      progreso: computeProgress(u, period),
      reclamadas: (u.misionesReclamadas && u.misionesReclamadas[period]) || {},
    };
  },

  async claimMission(userUid, missionId) {
    const users = read(KEY.users, {});
    const u = users[userUid];
    if (!u) return { ok: false, message: "Debes iniciar sesión." };
    const missions = read(KEY.missions, DEFAULT_MISSIONS);
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return { ok: false, message: "Misión no encontrada." };
    const period = periodKey();
    u.misionesReclamadas = u.misionesReclamadas || {};
    u.misionesReclamadas[period] = u.misionesReclamadas[period] || {};
    if (u.misionesReclamadas[period][missionId]) return { ok: false, message: "Ya reclamaste esta misión este mes." };
    const progreso = computeProgress(u, period);
    if ((progreso[mission.goalType] || 0) < mission.goalTarget) {
      return { ok: false, message: "Todavía no cumples la meta de esta misión." };
    }
    u.misionesReclamadas[period][missionId] = true;
    u.historial = u.historial || [];
    if (mission.rewardType === "puntos") {
      const pts = Number(mission.rewardValue || 0);
      u.puntos = (u.puntos || 0) + pts;
      u.historial.unshift({ tipo: "mision_completada", mision: mission.name, puntos: pts, fecha: Date.now() });
      write(KEY.users, users);
      return { ok: true, message: `¡Misión completada! +${pts} K-POINTS` };
    }
    u.historial.unshift({ tipo: "mision_completada", mision: mission.name, premio: mission.rewardValue, fecha: Date.now() });
    write(KEY.users, users);
    return { ok: true, message: `¡Misión completada! Muestra esto al staff: "${mission.rewardValue}"` };
  },

  onLikes(cb) {
    cb(read(KEY.likes, 0));
    const handler = (e) => {
      if (e.key === KEY.likes) cb(read(KEY.likes, 0));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },

  async incrementLike() {
    const n = read(KEY.likes, 0) + 1;
    write(KEY.likes, n);
    return n;
  },

  onActiveUsers(cb) {
    // Simulación liviana solo para dar vida a la UI (no representa tráfico real).
    let n = 3 + Math.floor(Math.random() * 6);
    cb(n);
    const id = setInterval(() => {
      n = Math.max(1, n + (Math.random() > 0.5 ? 1 : -1));
      cb(n);
    }, 8000);
    return () => clearInterval(id);
  },

  async signInWithGoogle({ nombre, correo, fechaNacimiento }) {
    const users = read(KEY.users, {});
    let user = Object.values(users).find((u) => u.correo === correo);
    if (!user) {
      const id = uid();
      user = {
        uid: id,
        nombre,
        correo,
        foto: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nombre)}`,
        fechaCreacion: Date.now(),
        codigo: genCode(users),
        puntos: 0,
        pedidos: 0,
        montoGastado: 0,
        historial: [],
        // En producción esto lo entrega Google (People API) al iniciar sesión, no el
        // cliente escribiéndolo — así no puede "elegir" una fecha para forzar el bono.
        // Si Google no la tiene disponible, queda sin definir y se pide una sola vez
        // manualmente (mismo flujo de siempre).
        ...(fechaNacimiento ? { fechaNacimiento } : {}),
      };
      users[id] = user;
      write(KEY.users, users);
    }
    currentAuthUser = { uid: user.uid, displayName: user.nombre, email: user.correo, photoURL: user.foto };
    write(KEY.session, currentAuthUser);
    notifyAuth();
    return currentAuthUser;
  },

  async signOutUser() {
    currentAuthUser = null;
    localStorage.removeItem(KEY.session);
    notifyAuth();
  },

  onAuthChange(cb) {
    authListeners.add(cb);
    cb(currentAuthUser);
    return () => authListeners.delete(cb);
  },

  async getOrCreateUser(authUser) {
    const users = read(KEY.users, {});
    return users[authUser.uid];
  },

  onUserData(userUid, cb) {
    let last = null;
    const tick = () => {
      const users = read(KEY.users, {});
      const u = users[userUid];
      const serialized = JSON.stringify(u);
      if (serialized !== last) {
        last = serialized;
        cb(u);
      }
    };
    tick();
    const id = setInterval(tick, 700);
    return () => clearInterval(id);
  },

  async saveBirthday(userUid, dateStr) {
    const users = read(KEY.users, {});
    if (!users[userUid]) return;
    users[userUid].fechaNacimiento = dateStr;
    write(KEY.users, users);
  },

  /** Se llama en cada login: si hoy es el cumpleaños del cliente y no se le ha dado el
   * bono este año, se lo acredita automáticamente. */
  async claimBirthdayBonusIfDue(userUid) {
    const users = read(KEY.users, {});
    const u = users[userUid];
    if (!u || !u.fechaNacimiento) return { granted: false };
    const [, mesStr, diaStr] = u.fechaNacimiento.split("-");
    const hoy = new Date();
    const esHoy = hoy.getMonth() + 1 === parseInt(mesStr, 10) && hoy.getDate() === parseInt(diaStr, 10);
    const anioActual = hoy.getFullYear();
    if (!esHoy || u.ultimoBonoCumpleanos === anioActual) return { granted: false };
    const settings = { ...DEFAULT_SETTINGS, ...read(KEY.settings, {}) };
    const bono = settings.bonoCumpleanos || 0;
    u.puntos = (u.puntos || 0) + bono;
    u.ultimoBonoCumpleanos = anioActual;
    u.historial = u.historial || [];
    u.historial.unshift({ tipo: "cumpleanos", puntos: bono, fecha: Date.now() });
    write(KEY.users, users);
    return { granted: true, amount: bono };
  },

  async submitOrder(payload) {
    const users = read(KEY.users, {});
    const pending = read(KEY.pending, []);

    // Los canjes agregados al pedido descuentan K-Points de inmediato (quedan "reservados"
    // mientras el pedido está pendiente); si el admin rechaza el pedido, se devuelven
    // en rejectPending(). Si lo aprueba, quedan descontados definitivamente.
    if (payload.canjes && payload.canjes.length && payload.uid) {
      const u = users[payload.uid];
      if (u) {
        const totalCanje = payload.canjes.reduce((s, c) => s + c.cost * (c.qty || 1), 0);
        u.puntos = Math.max(0, (u.puntos || 0) - totalCanje);
        u.historial = u.historial || [];
        payload.canjes.forEach((c) => {
          u.historial.unshift({ tipo: "canje_pendiente", recompensa: c.name, puntos: -(c.cost * (c.qty || 1)), fecha: Date.now() });
        });
        write(KEY.users, users);
      }
    }

    const entry = {
      id: "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      uid: payload.uid || null,
      codigo: payload.codigo || null,
      nombre: payload.nombre,
      modo: payload.modo,
      monto: payload.monto,
      puntos: payload.puntos || 0,
      items: payload.items || [],
      canjes: payload.canjes || null,
      fecha: Date.now(),
      estado: "pendiente",
    };
    pending.push(entry);
    write(KEY.pending, pending);
    return entry;
  },

  async getMyRedemptions(userUid) {
    const pending = read(KEY.pending, []);
    return pending
      .filter((p) => p.uid === userUid && p.canjes && p.canjes.length)
      .map((p) => ({ id: p.id, canjes: p.canjes, estado: p.estado, fecha: p.fecha }))
      .sort((a, b) => b.fecha - a.fecha);
  },

  async getMyOrders(userUid) {
    const pending = read(KEY.pending, []);
    return pending
      .filter((p) => p.uid === userUid)
      .map((p) => ({ id: p.id, items: p.items || [], canjes: p.canjes || null, modo: p.modo, monto: p.monto, puntos: p.puntos, estado: p.estado, fecha: p.fecha }))
      .sort((a, b) => b.fecha - a.fecha);
  },

  async getRewards() {
    return read(KEY.rewards, DEFAULT_REWARDS);
  },

  async redeemReward(userUid, reward) {
    const users = read(KEY.users, {});
    const u = users[userUid];
    if (!u) return { ok: false, message: "Debes iniciar sesión." };
    if ((u.puntos || 0) < reward.cost) return { ok: false, message: "No tienes suficientes K-POINTS." };
    u.puntos -= reward.cost;
    u.historial = u.historial || [];
    u.historial.unshift({ tipo: "canje", recompensa: reward.name, puntos: -reward.cost, fecha: Date.now() });
    write(KEY.users, users);
    return { ok: true, message: `¡Canjeaste "${reward.name}"! Muestra tu código en el local.` };
  },

  async getHistory(userUid) {
    const users = read(KEY.users, {});
    const u = users[userUid];
    return (u && u.historial) || [];
  },

  async transferPoints(fromCode, toCode, amount) {
    const users = read(KEY.users, {});
    const list = Object.values(users);
    const from = list.find((u) => u.codigo === fromCode);
    const to = list.find((u) => u.codigo === toCode);
    if (!to) return { ok: false, message: "Código no encontrado." };
    if (fromCode === toCode) return { ok: false, message: "No puedes transferirte a ti mismo." };
    if (from && from.correo !== ADMIN_EMAIL) {
      if ((from.puntos || 0) < amount) return { ok: false, message: "No tienes suficientes K-POINTS." };
      from.puntos -= amount;
      from.historial = from.historial || [];
      from.historial.unshift({ tipo: "transferencia_enviada", cantidad: amount, para: toCode, fecha: Date.now() });
    }
    to.puntos = (to.puntos || 0) + amount;
    to.historial = to.historial || [];
    to.historial.unshift({ tipo: "transferencia_recibida", cantidad: amount, de: fromCode, fecha: Date.now() });
    write(KEY.users, users);
    return { ok: true, message: "Transferencia realizada." };
  },

  admin: {
    async getStats() {
      const users = Object.values(read(KEY.users, {}));
      const pending = read(KEY.pending, []);
      return {
        totalUsuarios: users.length,
        totalPuntos: users.reduce((s, u) => s + (u.puntos || 0), 0),
        pendientesCount: pending.filter((p) => p.estado === "pendiente").length,
      };
    },
    async getPending() {
      return read(KEY.pending, []).filter((p) => p.estado === "pendiente").sort((a, b) => b.fecha - a.fecha);
    },
    /** Historial de pedidos ya resueltos (aprobados y rechazados), para auditoría del admin. */
    async getOrdersHistory() {
      return read(KEY.pending, [])
        .filter((p) => p.estado === "aprobado" || p.estado === "rechazado")
        .sort((a, b) => b.fecha - a.fecha);
    },
    async approvePending(id) {
      const pending = read(KEY.pending, []);
      const item = pending.find((p) => p.id === id);
      if (!item) return;
      item.estado = "aprobado";
      write(KEY.pending, pending);
      if (item.uid) {
        const users = read(KEY.users, {});
        const u = users[item.uid];
        if (u) {
          u.puntos = (u.puntos || 0) + item.puntos;
          u.pedidos = (u.pedidos || 0) + 1;
          u.montoGastado = (u.montoGastado || 0) + item.monto;
          u.historial = u.historial || [];
          u.historial.unshift({ tipo: "puntos_aprobados", puntos: item.puntos, monto: item.monto, fecha: Date.now() });
          if (item.canjes && item.canjes.length) {
            item.canjes.forEach((c) => u.historial.unshift({ tipo: "canje_aprobado", recompensa: c.name, fecha: Date.now() }));
          }
          // Racha semanal: solo avanza con pedidos aprobados, nunca con el simple envío.
          const nueva = calcularNuevaRacha(u.ultimaSemanaCompra, u.racha);
          if (nueva) {
            u.racha = nueva.racha;
            u.ultimaSemanaCompra = nueva.ultimaSemanaCompra;
          }
          write(KEY.users, users);
        }
      }
    },
    async rejectPending(id) {
      const pending = read(KEY.pending, []);
      const item = pending.find((p) => p.id === id);
      if (!item) return;
      item.estado = "rechazado";
      write(KEY.pending, pending);
      // Los canjes de un pedido rechazado devuelven los K-Points que se habían descontado al pedir.
      if (item.canjes && item.canjes.length && item.uid) {
        const users = read(KEY.users, {});
        const u = users[item.uid];
        if (u) {
          const totalCanje = item.canjes.reduce((s, c) => s + c.cost * (c.qty || 1), 0);
          u.puntos = (u.puntos || 0) + totalCanje;
          u.historial = u.historial || [];
          u.historial.unshift({ tipo: "canje_reembolsado", puntos: totalCanje, motivo: "Pedido rechazado", fecha: Date.now() });
          write(KEY.users, users);
        }
      }
    },
    async searchUsers(query) {
      const q = query.trim().toLowerCase();
      // Sin mínimo de caracteres: con "" cada nombre/correo/código "incluye" la cadena
      // vacía, así que de entrada ya lista a todos los clientes.
      const users = Object.values(read(KEY.users, {}));
      return users.filter(
        (u) =>
          (u.nombre || "").toLowerCase().includes(q) ||
          (u.correo || "").toLowerCase().includes(q) ||
          (u.codigo || "").toLowerCase().includes(q)
      );
    },
    async adjustPoints(codigo, amount, reason) {
      const users = read(KEY.users, {});
      const u = Object.values(users).find((x) => x.codigo === codigo);
      if (!u) return { ok: false, message: "Código no encontrado." };
      u.puntos = Math.max(0, (u.puntos || 0) + amount);
      u.historial = u.historial || [];
      u.historial.unshift({ tipo: amount > 0 ? "bonificacion" : "descuento", cantidad: amount, motivo: reason || "Ajuste manual", fecha: Date.now() });
      write(KEY.users, users);
      return { ok: true, message: "Ajuste aplicado." };
    },
    async getAllProducts() {
      return read(KEY.products, getAllProducts());
    },
    async saveProduct(product) {
      const products = read(KEY.products, getAllProducts());
      const idx = products.findIndex((x) => x.id === product.id);
      if (idx >= 0) products[idx] = product;
      else products.push(product);
      write(KEY.products, products);
    },
    async deleteProduct(id) {
      const products = read(KEY.products, getAllProducts()).filter((x) => x.id !== id);
      write(KEY.products, products);
    },
    async getCategoriesAdmin() {
      return read(KEY.categories, getLocalCategories());
    },
    async saveCategory(category) {
      const categories = read(KEY.categories, getLocalCategories());
      const idx = categories.findIndex((x) => x.id === category.id);
      if (idx >= 0) categories[idx] = category;
      else categories.push(category);
      write(KEY.categories, categories);
    },
    async deleteCategory(id) {
      const categories = read(KEY.categories, getLocalCategories()).filter((x) => x.id !== id);
      write(KEY.categories, categories);
    },
    async getRewardsAdmin() {
      return read(KEY.rewards, DEFAULT_REWARDS);
    },
    async saveReward(reward) {
      const rewards = read(KEY.rewards, DEFAULT_REWARDS);
      const idx = rewards.findIndex((x) => x.id === reward.id);
      if (idx >= 0) rewards[idx] = reward;
      else rewards.push(reward);
      write(KEY.rewards, rewards);
    },
    async deleteReward(id) {
      const rewards = read(KEY.rewards, DEFAULT_REWARDS).filter((x) => x.id !== id);
      write(KEY.rewards, rewards);
    },
    async getSettings() {
      return read(KEY.settings, DEFAULT_SETTINGS);
    },
    async saveSettings(patch) {
      const settings = { ...DEFAULT_SETTINGS, ...read(KEY.settings, {}) };
      // Imita el update() de Firebase: una clave con "/" es una ruta anidada (p.ej.
      // "adminEmailsMap/correo,com"), no una propiedad literal con esos caracteres.
      Object.entries(patch).forEach(([key, value]) => {
        if (key.includes("/")) {
          const [parent, child] = key.split("/");
          settings[parent] = settings[parent] || {};
          if (value === null) delete settings[parent][child];
          else settings[parent][child] = value;
        } else {
          settings[key] = value;
        }
      });
      write(KEY.settings, settings);
      return settings;
    },
    /** Sube (localmente) la foto de un producto y devuelve el dataURL ya guardado en el producto. */
    async getMissionsAdmin() {
      return read(KEY.missions, DEFAULT_MISSIONS);
    },
    async saveMission(mission) {
      const missions = read(KEY.missions, DEFAULT_MISSIONS);
      const idx = missions.findIndex((x) => x.id === mission.id);
      if (idx >= 0) missions[idx] = mission;
      else missions.push(mission);
      write(KEY.missions, missions);
    },
    async deleteMission(id) {
      const missions = read(KEY.missions, DEFAULT_MISSIONS).filter((x) => x.id !== id);
      write(KEY.missions, missions);
    },
    async uploadProductImage(productId, file) {
      const dataUrl = await fileToCompressedDataUrl(file);
      const products = read(KEY.products, getAllProducts());
      const idx = products.findIndex((x) => x.id === productId);
      if (idx >= 0) {
        products[idx] = { ...products[idx], image: dataUrl };
        write(KEY.products, products);
      }
      return dataUrl;
    },
  },
};

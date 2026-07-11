import { sessionStore, enterAsGuest, loginWithGoogle, logout } from "../state/session.js";
import { getAdapter } from "../data/dataAdapter.js";
import { calcularRango, proximoRango } from "../state/rank.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { openAdminPanel } from "./admin.js";
import { reorderPastOrder } from "./cartUI.js";
import { calcularDescuentoRacha } from "../state/streak.js";
import { USE_MOCK, DEFAULT_SETTINGS } from "../config.js";

const CLP = new Intl.NumberFormat("es-CL");

/** "1998-05-20" -> "20 de mayo" (sin año, para no exponer la edad del cliente). */
function formatearFechaLarga(isoDate) {
  const [, m, d] = isoDate.split("-");
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${parseInt(d, 10)} de ${meses[parseInt(m, 10) - 1]}`;
}

function loginLobbyHTML() {
  return `
    <div class="lobby-card">
      <div class="lobby-title">MI CUENTA</div>
      <div class="lobby-sub">Inicia sesión para juntar K-POINTS, ver tu historial y canjear recompensas.</div>
      <button class="google-btn" id="btnGoogleLogin" type="button">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
        </svg>
        Iniciar sesión con Google
      </button>
      <button class="profile-action-btn" id="btnGuest" type="button" style="justify-content:center;">Entrar sin iniciar sesión</button>
      ${USE_MOCK ? `<p class="demo-note">Prototipo en modo demostración: no se conecta al Google real ni al Firebase en línea. Ingresa cualquier nombre y correo para simular tu cuenta.</p>` : ""}
    </div>`;
}

function askFakeGoogleProfile() {
  return new Promise((resolve) => {
    const { close, sheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">SIMULAR GOOGLE</div>
      <p class="demo-note" style="margin-bottom:0.8rem;">Solo para esta demostración local. En producción esto es el selector real de cuentas de Google.</p>
      <label class="modal-input-label">NOMBRE</label>
      <input class="modal-input" id="fkNombre" placeholder="Tu nombre">
      <label class="modal-input-label">CORREO</label>
      <input class="modal-input" id="fkCorreo" placeholder="tu@correo.com">
      <label class="modal-input-label">FECHA DE NACIMIENTO (opcional)</label>
      <input class="modal-input" id="fkFechaNac" type="date">
      <p class="demo-note" style="text-align:left;margin-top:0.3rem;">Simula lo que Google entregaría automáticamente. Si la dejas vacía, se simula una cuenta sin esa info: verás el formulario manual de respaldo en tu Perfil.</p>
      <button class="modal-btn" id="fkConfirm" type="button">CONTINUAR</button>
    `, { onClose: () => resolve(null) });
    sheet.querySelector("#fkConfirm").addEventListener("click", () => {
      const nombre = sheet.querySelector("#fkNombre").value.trim();
      const correo = sheet.querySelector("#fkCorreo").value.trim();
      const fechaNacimiento = sheet.querySelector("#fkFechaNac").value || null;
      if (!nombre || !correo.includes("@")) return showToast("Completa nombre y correo válido");
      close();
      resolve({ nombre, correo, fechaNacimiento });
    });
  });
}

function profileHTML(userData, isAdmin) {
  const rango = calcularRango(userData.puntos || 0);
  const puntosTxt = isAdmin ? "∞" : CLP.format(userData.puntos || 0);
  const rangoTxt = isAdmin ? "👑 Administrador" : `${rango.icon} ${rango.name}`;
  let progresoHTML = "";
  if (!isAdmin) {
    const siguiente = proximoRango(userData.puntos || 0);
    if (siguiente) {
      const pct = Math.max(0, Math.min(100, Math.round(((userData.puntos - rango.min) / (siguiente.min - rango.min)) * 100)));
      progresoHTML = `
        <div style="margin:0.8rem 0;text-align:left;">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--muted);margin-bottom:4px;">
            <span>${rango.icon} ${rango.name}</span><span>${siguiente.icon} ${siguiente.name}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div style="text-align:center;font-size:0.7rem;color:var(--muted);margin-top:4px;">Te faltan ${CLP.format(Math.max(0, siguiente.min - (userData.puntos || 0)))} K-POINTS para ${siguiente.name}</div>
        </div>`;
    } else {
      progresoHTML = `<div style="text-align:center;font-size:0.78rem;color:var(--accent2);margin:0.8rem 0;">🏆 ¡Rango máximo alcanzado!</div>`;
    }
  }
  const cumpleHTML = userData.fechaNacimiento
    ? `<div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border-radius:12px;padding:0.7rem 0.9rem;margin-top:1rem;">
         <span style="font-size:0.82rem;">🎂 Cumpleaños: ${formatearFechaLarga(userData.fechaNacimiento)}</span>
       </div>
       <p class="demo-note" style="text-align:left;margin-top:0.4rem;">Ya quedó registrada. Si está mal, pide al staff que la corrija en el local.</p>`
    : `<div style="margin-top:1rem;text-align:left;">
         <label class="modal-input-label">FECHA DE NACIMIENTO (regalo de cumpleaños 🎂)</label>
         <input class="modal-input" id="fechaNacInput" type="date">
         <button class="profile-action-btn" id="btnGuardarFechaNac" type="button" style="justify-content:center;margin-top:0.5rem;">GUARDAR</button>
       </div>`;

  return `
    <div class="profile-head">
      <img class="profile-photo" src="${userData.foto}" alt="">
      <div style="font-weight:700;font-size:1.05rem;">${userData.nombre}</div>
      <div style="color:var(--muted);font-size:0.82rem;">${userData.correo}</div>
      <div class="rank-badge">${rangoTxt}</div>
      <div id="streakBadge"></div>
      <div class="points-big">⭐ ${puntosTxt}</div>
      <div style="color:var(--muted);font-size:0.78rem;">K-POINTS disponibles</div>
      ${progresoHTML}
      <div class="code-box">
        <div style="font-size:0.75rem;color:var(--muted);margin-bottom:4px;">TU CÓDIGO KBROS</div>
        <div class="code">${userData.codigo}</div>
        <div style="font-size:0.7rem;color:var(--muted);margin-top:4px;">Muéstralo al staff para sumar o canjear puntos</div>
      </div>
      ${cumpleHTML}
    </div>
    <details class="collapsible" style="margin-top:1.2rem;">
      <summary>🧾 Historial de compras <span class="collapsible-count" id="ordersCount"></span></summary>
      <div id="ordersSection" style="padding:0.6rem 1rem 0;"><div class="empty-state">Cargando…</div></div>
    </details>
    <details class="collapsible" style="margin-top:0.6rem;">
      <summary>🎁 Mis canjes <span class="collapsible-count" id="canjesCount"></span></summary>
      <div id="canjesSection" style="padding:0.6rem 1rem 0;"><div class="empty-state">Cargando…</div></div>
    </details>
    <div class="profile-actions">
      <button class="profile-action-btn" id="btnGoKpoints" type="button">🎁 Ver recompensas y mi historial</button>
      <button class="profile-action-btn" id="btnTransfer" type="button">🔁 Transferir K-Points</button>
      ${isAdmin ? `<button class="profile-action-btn" id="btnAdmin" type="button">👑 Panel administrador</button>` : ""}
      <button class="profile-action-btn danger" id="btnLogout" type="button">🚪 Cerrar sesión</button>
    </div>`;
}

const ESTADO_LABEL = {
  pendiente: `<span style="color:var(--accent2);font-size:0.76rem;font-weight:700;">⏳ Por aprobar</span>`,
  aprobado: `<span style="color:var(--green);font-size:0.76rem;font-weight:700;">✓ Realizado</span>`,
  rechazado: `<span style="color:var(--red);font-size:0.76rem;font-weight:700;">✕ Rechazado (reembolsado)</span>`,
};

async function paintCompras(container, uid) {
  const adapter = await getAdapter();
  const orders = await adapter.getMyOrders(uid);
  const countEl = document.getElementById("ordersCount");
  if (countEl) countEl.textContent = orders.length ? `(${orders.length})` : "";
  if (!orders.length) {
    container.innerHTML = `<div class="empty-state">Aún no tienes pedidos.</div>`;
    return;
  }
  container.innerHTML = orders
    .map((o) => {
      const nombres = (o.items || []).map((i) => (i.cantidad > 1 ? `${i.nombre} x${i.cantidad}` : i.nombre)).join(", ") || "Sin detalle";
      const fechaTxt = new Date(o.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
      return `
        <div class="pending-item" data-order-id="${o.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;">
              <div style="font-size:0.84rem;">${nombres}</div>
              <div class="muted" style="font-size:0.72rem;margin-top:2px;">${fechaTxt} · ${o.modo || ""} · $${CLP.format(o.monto || 0)}</div>
            </div>
            ${ESTADO_LABEL[o.estado] || o.estado}
          </div>
          <button class="reward-redeem-btn" data-reorder="${o.id}" type="button" style="margin-top:8px;width:100%;">VOLVER A PEDIR</button>
        </div>`;
    })
    .join("");
  container.querySelectorAll("[data-reorder]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = orders.find((o) => o.id === btn.dataset.reorder);
      const ok = reorderPastOrder(order);
      if (ok) document.querySelector('.nav-item[data-view="menu"]')?.click();
    });
  });
}

async function paintStreak(container, userData, isAdmin) {
  if (isAdmin || !userData.racha) { container.innerHTML = ""; return; }
  const adapter = await getAdapter();
  let settings = DEFAULT_SETTINGS;
  try { settings = { ...DEFAULT_SETTINGS, ...(await adapter.getSettings()) }; } catch { /* usa los valores por defecto */ }
  const pct = calcularDescuentoRacha(userData.racha, settings);
  container.innerHTML = `
    <div class="streak-badge">
      🔥 Racha de ${userData.racha} semana${userData.racha === 1 ? "" : "s"}
      ${pct > 0 ? `<span class="streak-pct">${pct}% OFF activo</span>` : ""}
    </div>`;
}

async function paintCanjes(container, uid) {
  const adapter = await getAdapter();
  const redemptions = await adapter.getMyRedemptions(uid);
  const countEl = document.getElementById("canjesCount");
  if (countEl) countEl.textContent = redemptions.length ? `(${redemptions.length})` : "";
  if (!redemptions.length) {
    container.innerHTML = `<div class="empty-state">Aún no has canjeado recompensas.</div>`;
    return;
  }
  container.innerHTML = redemptions
    .map((r) => {
      const total = r.canjes.reduce((s, c) => s + c.cost * (c.qty || 1), 0);
      const nombres = r.canjes.map((c) => (c.qty > 1 ? `${c.name} x${c.qty}` : c.name)).join(", ");
      return `<div class="history-row"><span>${nombres} · ${CLP.format(total)} pts</span>${ESTADO_LABEL[r.estado] || r.estado}</div>`;
    })
    .join("");
}

function openTransferModal(userData, isAdmin) {
  const saldo = isAdmin ? "∞ (ilimitados)" : CLP.format(userData.puntos || 0);
  const { close, sheet } = openModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">TRANSFERIR K-POINTS</div>
    <p style="text-align:center;color:var(--muted);font-size:0.82rem;">Tienes <b style="color:var(--accent);">${saldo}</b> K-POINTS disponibles</p>
    <label class="modal-input-label">CÓDIGO KBROS DESTINATARIO</label>
    <input class="modal-input" id="destCodigo" placeholder="KB00000" style="text-transform:uppercase;">
    <label class="modal-input-label">CANTIDAD</label>
    <input class="modal-input" id="destCantidad" type="number" placeholder="Ej: 100">
    <button class="modal-btn" id="btnConfirmTransfer" type="button">TRANSFERIR</button>
  `);
  sheet.querySelector("#btnConfirmTransfer").addEventListener("click", async () => {
    const codigo = sheet.querySelector("#destCodigo").value.trim().toUpperCase();
    const cantidad = parseInt(sheet.querySelector("#destCantidad").value, 10);
    if (!codigo || !cantidad || cantidad <= 0) return showToast("Completa todos los campos");
    const adapter = await getAdapter();
    try {
      const res = await adapter.transferPoints(userData.codigo, codigo, cantidad);
      showToast(res.ok ? "✅ " + res.message : "❌ " + res.message);
      if (res.ok) close();
    } catch (err) {
      showToast("❌ No se pudo transferir: " + (err.message || err));
    }
  });
}

export function initProfileView() {
  const root = document.getElementById("view-perfil");

  function paint() {
    const { authUser, userData, isAdmin, guestMode } = sessionStore.getState();

    if (!authUser) {
      if (guestMode) {
        root.innerHTML = `
          <div class="section">
            <div class="lobby-card">
              <div class="lobby-title">MODO INVITADO</div>
              <div class="lobby-sub">Estás pidiendo sin iniciar sesión, no juntarás K-POINTS.</div>
              ${loginLobbyHTML()}
            </div>
          </div>`;
      } else {
        root.innerHTML = `<div class="section">${loginLobbyHTML()}</div>`;
      }
      wireLogin(root);
      return;
    }

    if (!userData) {
      root.innerHTML = `<div class="section empty-state">Cargando tu perfil…</div>`;
      return;
    }

    root.innerHTML = `<div class="section">${profileHTML(userData, isAdmin)}</div>`;
    paintStreak(root.querySelector("#streakBadge"), userData, isAdmin);
    paintCompras(root.querySelector("#ordersSection"), userData.uid);
    paintCanjes(root.querySelector("#canjesSection"), userData.uid);

    root.querySelector("#btnGoKpoints")?.addEventListener("click", () => {
      document.querySelector('.nav-item[data-view="kpoints"]')?.click();
    });
    root.querySelector("#btnTransfer")?.addEventListener("click", () => openTransferModal(userData, isAdmin));
    root.querySelector("#btnAdmin")?.addEventListener("click", () => openAdminPanel());
    root.querySelector("#btnLogout")?.addEventListener("click", () => logout());
    root.querySelector("#btnGuardarFechaNac")?.addEventListener("click", async () => {
      const val = root.querySelector("#fechaNacInput").value;
      if (!val) return showToast("Selecciona una fecha");
      const adapter = await getAdapter();
      try {
        await adapter.saveBirthday(userData.uid, val);
        showToast("🎂 ¡Fecha guardada!");
      } catch (err) {
        showToast("❌ No se pudo guardar: " + (err.message || err));
      }
    });
  }

  function wireLogin(root) {
    root.querySelector("#btnGoogleLogin")?.addEventListener("click", async () => {
      if (USE_MOCK) {
        // Solo en modo demostración local: simula el selector de cuentas de Google
        // para poder probar la app sin credenciales reales.
        const profile = await askFakeGoogleProfile();
        if (!profile) return;
        await loginWithGoogle(profile);
      } else {
        // En producción: ventana real de Google. El nombre y correo vienen tal cual
        // de la cuenta de Google elegida, el cliente no puede escribirlos a mano.
        await loginWithGoogle();
      }
    });
    root.querySelector("#btnGuest")?.addEventListener("click", () => enterAsGuest());
  }

  sessionStore.subscribe(paint);
}

import { sessionStore } from "../state/session.js";
import { getAdapter } from "../data/dataAdapter.js";
import { calcularRango } from "../state/rank.js";
import { showToast } from "./toast.js";
import { addRedemptionToCart, cartCanjePoints } from "../state/cart.js";

const CLP = new Intl.NumberFormat("es-CL");

function timeAgo(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) + " · " +
    d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

const HIST_LABELS = {
  puntos_aprobados: (h) => `Compra aprobada · +${h.puntos} pts`,
  canje: (h) => `Canje: ${h.recompensa} · ${h.puntos} pts`,
  transferencia_enviada: (h) => `Enviaste ${h.cantidad} pts a ${h.para}`,
  transferencia_recibida: (h) => `Recibiste ${h.cantidad} pts de ${h.de}`,
  bonificacion: (h) => `Bonificación · +${h.cantidad} pts`,
  descuento: (h) => `Ajuste · ${h.cantidad} pts`,
  mision_completada: (h) => `Misión: ${h.mision}${h.puntos ? ` · +${h.puntos} pts` : ""}`,
  canje_pendiente: (h) => `Canje pendiente: ${h.recompensa} · ${h.puntos} pts`,
  canje_aprobado: (h) => `Canje confirmado: ${h.recompensa}`,
  canje_reembolsado: (h) => `Reembolso de canje · +${h.puntos} pts`,
  cumpleanos: (h) => `🎂 Bono de cumpleaños · +${h.puntos} pts`,
};

const GOAL_LABEL = { compras: "compras", puntos: "K-POINTS", monto: "CLP gastados" };

export function initKpointsView() {
  const root = document.getElementById("view-kpoints");
  let activeTab = "recompensas";

  async function paint() {
    const { authUser, userData, isAdmin, guestMode } = sessionStore.getState();
    const adapter = await getAdapter();

    if (!authUser) {
      root.innerHTML = `
        <div class="section">
          <div class="lobby-card">
            <div class="lobby-title">K-POINTS</div>
            <div class="lobby-sub">${guestMode ? "Estás en modo invitado." : "Aún no has iniciado sesión."} Inicia sesión con Google para empezar a juntar K-POINTS con cada compra.</div>
            <button class="btn btn-primary" id="btnGoLogin" type="button" style="width:100%;">IR A INICIAR SESIÓN</button>
          </div>
        </div>`;
      root.querySelector("#btnGoLogin")?.addEventListener("click", () => {
        document.querySelector('.nav-item[data-view="perfil"]')?.click();
      });
      return;
    }

    const puntos = isAdmin ? "∞" : CLP.format(userData?.puntos || 0);
    const rango = calcularRango(userData?.puntos || 0);

    root.innerHTML = `
      <div class="section" style="text-align:center;">
        <div class="points-big">⭐ ${puntos}</div>
        <div class="rank-badge">${isAdmin ? "👑 Administrador" : rango.icon + " " + rango.name}</div>
      </div>
      <div class="admin-tabs" style="padding:0 1rem;margin-bottom:0.9rem;" id="kpointsTabs">
        <button class="kpoints-tab-btn${activeTab === "recompensas" ? " active" : ""}" data-tab="recompensas" type="button">🎁 Recompensas</button>
        <button class="kpoints-tab-btn${activeTab === "misiones" ? " active" : ""}" data-tab="misiones" type="button">🎯 Misiones</button>
        <button class="kpoints-tab-btn${activeTab === "historial" ? " active" : ""}" data-tab="historial" type="button">🧾 Historial</button>
      </div>
      <div class="section" id="kpointsContent" style="padding-top:0;"></div>`;

    root.querySelectorAll("#kpointsTabs .kpoints-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        root.querySelectorAll("#kpointsTabs .kpoints-tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        paintContent();
      });
    });

    await paintContent();

    async function paintContent() {
      const cont = root.querySelector("#kpointsContent");
      if (!cont) return;
      if (activeTab === "recompensas") return paintRecompensas(cont);
      if (activeTab === "misiones") return paintMisiones(cont);
      return paintHistorial(cont);
    }

    async function paintRecompensas(cont) {
      const rewards = await adapter.getRewards();
      cont.innerHTML = `
        <p class="demo-note" style="text-align:left;padding:0 1rem;margin-bottom:0.6rem;">Agrega una recompensa a tu próximo pedido: no suma al total a pagar, pero se descuentan los K-Points al confirmar. Si el pedido se rechaza, los puntos se devuelven.</p>
        <div id="rewardsList" style="padding:0 1rem;"></div>`;
      const rewardsList = cont.querySelector("#rewardsList");
      if (rewards.length === 0) {
        rewardsList.innerHTML = `<div class="empty-state">Todavía no hay recompensas configuradas.</div>`;
        return;
      }
      const disponibles = isAdmin ? Infinity : (userData?.puntos || 0) - cartCanjePoints();
      rewardsList.innerHTML = rewards
        .map(
          (r) => `
        <div class="reward-card">
          <div class="reward-icon">${r.icon || "🎁"}</div>
          <div class="reward-info">
            <div class="reward-name">${r.name}</div>
            <div class="reward-desc">${r.description || ""}</div>
          </div>
          <div style="text-align:right;">
            <div class="reward-cost">${CLP.format(r.cost)} pts</div>
            <button class="reward-redeem-btn" data-id="${r.id}" type="button" ${disponibles < r.cost ? "disabled" : ""}>Agregar</button>
          </div>
        </div>`
        )
        .join("");
      rewardsList.querySelectorAll(".reward-redeem-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const reward = rewards.find((r) => r.id === btn.dataset.id);
          addRedemptionToCart(reward);
          showToast("🎁 " + reward.name + " agregado a tu pedido");
          paintRecompensas(cont);
        });
      });
    }

    async function paintMisiones(cont) {
      cont.innerHTML = `<div id="missionsList" style="padding:0 1rem;"></div>`;
      const list = cont.querySelector("#missionsList");
      const [missions, progressData] = await Promise.all([adapter.getMissions(), adapter.getMissionProgress(authUser.uid)]);
      if (missions.length === 0) {
        list.innerHTML = `<div class="empty-state">No hay misiones activas por ahora.</div>`;
        return;
      }
      const { progreso, reclamadas } = progressData;
      list.innerHTML = missions
        .map((m) => {
          const actual = progreso[m.goalType] || 0;
          const pct = Math.max(0, Math.min(100, Math.round((actual / m.goalTarget) * 100)));
          const completada = actual >= m.goalTarget;
          const reclamada = !!reclamadas[m.id];
          const actualTxt = m.goalType === "monto" ? "$" + CLP.format(actual) : CLP.format(actual);
          const metaTxt = m.goalType === "monto" ? "$" + CLP.format(m.goalTarget) : CLP.format(m.goalTarget);
          const premioTxt = m.rewardType === "puntos" ? `+${CLP.format(m.rewardValue)} pts` : "🎁 " + m.rewardValue;
          return `
          <div class="pending-item">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <div style="font-weight:700;">${m.icon || "🎯"} ${m.name}</div>
              <div style="color:var(--accent2);font-size:0.76rem;font-weight:700;text-align:right;">${premioTxt}</div>
            </div>
            <div style="color:var(--muted);font-size:0.78rem;margin-bottom:6px;">${m.description || ""}</div>
            <div class="progress-track" style="margin-bottom:6px;"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.72rem;color:var(--muted);">${actualTxt}/${metaTxt} ${GOAL_LABEL[m.goalType] || ""}</span>
              ${reclamada
                ? '<span style="font-size:0.76rem;color:var(--green);">✓ Reclamada</span>'
                : completada
                  ? `<button class="reward-redeem-btn" data-mision="${m.id}" type="button">Reclamar 🎉</button>`
                  : '<span style="font-size:0.72rem;color:var(--muted);">En progreso</span>'}
            </div>
          </div>`;
        })
        .join("");
      list.querySelectorAll("[data-mision]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const res = await adapter.claimMission(authUser.uid, btn.dataset.mision);
            showToast((res.ok ? "🎉 " : "❌ ") + res.message);
            if (res.ok) paint();
          } catch (err) {
            showToast("❌ No se pudo reclamar: " + (err.message || err));
          }
        });
      });
    }

    async function paintHistorial(cont) {
      const history = await adapter.getHistory(authUser.uid);
      cont.innerHTML = `<div id="historyList" style="padding:0 1rem;"></div>`;
      const historyList = cont.querySelector("#historyList");
      if (!history || history.length === 0) {
        historyList.innerHTML = `<div class="empty-state">Aún no tienes movimientos.</div>`;
        return;
      }
      historyList.innerHTML = history
        .slice(0, 20)
        .map((h) => {
          const label = HIST_LABELS[h.tipo] ? HIST_LABELS[h.tipo](h) : h.tipo;
          return `<div class="history-row"><span>${label}</span><span class="muted">${timeAgo(h.fecha)}</span></div>`;
        })
        .join("");
    }
  }

  sessionStore.subscribe(paint);
}

import { getAdapter } from "../data/dataAdapter.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { getCategories } from "../data/menuData.js";
import { ADMIN_EMAIL, USE_MOCK, sanitizeEmailKey } from "../config.js";
import { calcularRango } from "../state/rank.js";

const CLP = new Intl.NumberFormat("es-CL");

export async function openAdminPanel() {
  const adapter = await getAdapter();
  const { sheet } = openModal(`
    <div class="modal-handle"></div>
    <div class="modal-title">👑 PANEL ADMIN</div>
    <div id="adminStats" class="admin-stats-grid"></div>
    <div class="admin-tabs">
      <button class="admin-tab-btn active" data-tab="pendientes" type="button">Pendientes</button>
      <button class="admin-tab-btn" data-tab="historial" type="button">Historial</button>
      <button class="admin-tab-btn" data-tab="buscar" type="button">Clientes</button>
      <button class="admin-tab-btn" data-tab="productos" type="button">Productos</button>
      <button class="admin-tab-btn" data-tab="recompensas" type="button">Recompensas</button>
      <button class="admin-tab-btn" data-tab="misiones" type="button">Misiones</button>
      <button class="admin-tab-btn" data-tab="ajustes" type="button">Ajustes</button>
    </div>
    <div id="adminContent"></div>
  `);

  try {
    await paintStats();
    await paintPendientes();
  } catch (err) {
    sheet.querySelector("#adminContent").innerHTML = `<p class="empty-state">❌ No se pudo cargar: ${err.message || err}</p>`;
  }

  sheet.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      sheet.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      const cont = sheet.querySelector("#adminContent");
      cont.innerHTML = `<p class="empty-state">Cargando…</p>`;
      try {
        if (tab === "pendientes") await paintPendientes();
        if (tab === "historial") await paintHistorialPedidos();
        if (tab === "buscar") paintBuscar();
        if (tab === "productos") await paintProductos();
        if (tab === "recompensas") await paintRecompensas();
        if (tab === "misiones") await paintMisiones();
        if (tab === "ajustes") await paintAjustes();
      } catch (err) {
        cont.innerHTML = `<p class="empty-state">❌ No se pudo cargar: ${err.message || err}</p>`;
      }
    });
  });

  async function paintStats() {
    const stats = await adapter.admin.getStats();
    sheet.querySelector("#adminStats").innerHTML = `
      <div class="stat-card"><div class="stat-num">${stats.totalUsuarios}</div><div class="stat-label">Usuarios</div></div>
      <div class="stat-card"><div class="stat-num">${CLP.format(stats.totalPuntos)}</div><div class="stat-label">Puntos entregados</div></div>
      <div class="stat-card"><div class="stat-num">${stats.pendientesCount}</div><div class="stat-label">Pendientes</div></div>`;
  }

  async function paintPendientes() {
    const cont = sheet.querySelector("#adminContent");
    cont.innerHTML = `<p class="empty-state">Cargando…</p>`;
    const items = await adapter.admin.getPending();
    if (items.length === 0) {
      cont.innerHTML = `<p class="empty-state">No hay pedidos pendientes 🎉</p>`;
      return;
    }
    cont.innerHTML = items
      .map(
        (p) => `
      <div class="pending-item" data-id="${p.id}">
        <div><b>${p.nombre || ""}</b> · ${p.codigo || ""}</div>
        <div style="color:var(--muted);font-size:0.76rem;">${p.modo || ""} · ${new Date(p.fecha).toLocaleString("es-CL")}</div>
        <div style="color:var(--accent);font-weight:700;">$${CLP.format(p.monto || 0)} → +${p.puntos} pts</div>
        <div class="admin-actions-row">
          <button class="btn-approve" data-action="approve" type="button">Aprobar ✓</button>
          <button class="btn-reject" data-action="reject" type="button">Rechazar ✕</button>
        </div>
      </div>`
      )
      .join("");
    cont.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest(".pending-item").dataset.id;
        try {
          if (btn.dataset.action === "approve") await adapter.admin.approvePending(id);
          else await adapter.admin.rejectPending(id);
          window.dispatchEvent(new CustomEvent("kbros:pending-changed"));
          await paintStats();
          await paintPendientes();
        } catch (err) {
          showToast("❌ No se pudo procesar: " + (err.message || err));
        }
      });
    });
  }

  const HIST_ESTADO_LABEL = {
    aprobado: `<span style="color:var(--green);font-size:0.76rem;font-weight:700;">✓ Aprobado</span>`,
    rechazado: `<span style="color:var(--red);font-size:0.76rem;font-weight:700;">✕ Rechazado</span>`,
  };

  /** Auditoría: todos los pedidos ya resueltos (aprobados y rechazados), de todos los clientes. */
  async function paintHistorialPedidos() {
    const cont = sheet.querySelector("#adminContent");
    cont.innerHTML = `<p class="empty-state">Cargando…</p>`;
    const items = await adapter.admin.getOrdersHistory();
    if (items.length === 0) {
      cont.innerHTML = `<p class="empty-state">Todavía no hay pedidos resueltos.</p>`;
      return;
    }
    cont.innerHTML = items
      .map(
        (p) => `
      <div class="pending-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div><b>${p.nombre || ""}</b> · ${p.codigo || ""}</div>
            <div style="color:var(--muted);font-size:0.76rem;">${p.modo || ""} · ${new Date(p.fecha).toLocaleString("es-CL")}</div>
            <div style="color:var(--accent);font-weight:700;margin-top:2px;">$${CLP.format(p.monto || 0)} → ${p.puntos} pts${p.canjes && p.canjes.length ? " · con canje" : ""}</div>
          </div>
          ${HIST_ESTADO_LABEL[p.estado] || p.estado}
        </div>
      </div>`
      )
      .join("");
  }

  function paintBuscar() {
    const cont = sheet.querySelector("#adminContent");
    cont.innerHTML = `
      <input class="modal-input" id="buscarInput" placeholder="Nombre, correo o código KBROS (déjalo vacío para ver a todos)" style="margin-bottom:0.6rem;">
      <button class="modal-btn" id="btnBuscar" type="button" style="margin-top:0;">🔍 BUSCAR</button>
      <div id="resultados" style="margin-top:0.8rem;"></div>`;
    const run = async () => {
      const q = cont.querySelector("#buscarInput").value;
      const resEl = cont.querySelector("#resultados");
      // Sin mínimo de caracteres: con el campo vacío, muestra a todos los clientes.
      const results = await adapter.admin.searchUsers(q);
      resEl.innerHTML = results.length
        ? results.map((u) => `
          <div class="pending-item client-row" data-uid="${u.uid}" role="button" tabindex="0">
            <img src="${u.foto}" alt="" style="width:34px;height:34px;border-radius:50%;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <b>${u.nombre}</b><br>
              <span style="color:var(--muted);font-size:0.76rem;">${u.codigo} · ⭐ ${CLP.format(u.puntos || 0)} · 🎂 ${u.fechaNacimiento || "sin registrar"}</span>
            </div>
            <span style="color:var(--muted);">›</span>
          </div>`).join("")
        : `<p class="empty-state">Sin resultados</p>`;
      resEl.querySelectorAll(".client-row").forEach((row) => {
        row.addEventListener("click", () => {
          const u = results.find((x) => x.uid === row.dataset.uid);
          openClientFicha(u, run);
        });
      });
    };
    cont.querySelector("#btnBuscar").addEventListener("click", run);
    cont.querySelector("#buscarInput").addEventListener("input", run);
    cont.querySelector("#buscarInput").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    run(); // lista a todos los clientes de entrada, sin que el admin tenga que escribir nada
  }

  const FICHA_ESTADO_LABEL = {
    pendiente: `<span style="color:var(--accent2);font-size:0.74rem;font-weight:700;white-space:nowrap;">⏳ Por aprobar</span>`,
    aprobado: `<span style="color:var(--green);font-size:0.74rem;font-weight:700;white-space:nowrap;">✓ Realizado</span>`,
    rechazado: `<span style="color:var(--red);font-size:0.74rem;font-weight:700;white-space:nowrap;">✕ Rechazado</span>`,
  };

  /** Ficha del cliente: acá viven las acciones (ajustar puntos, editar cumpleaños) e historiales. */
  function openClientFicha(u, onChange) {
    const rango = calcularRango(u.puntos || 0);
    const { close, sheet: formSheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title" style="font-size:1.6rem;">FICHA DEL CLIENTE</div>
      <div class="ficha-cliente-head" style="text-align:center;">
        <img src="${u.foto}" style="width:104px;height:104px;border-radius:50%;border:4px solid var(--accent);margin-bottom:0.8rem;">
        <div style="font-weight:700;font-size:1.35rem;">${u.nombre}</div>
        <div style="color:var(--muted);font-size:0.92rem;margin-bottom:0.3rem;">${u.correo}</div>
        <div class="rank-badge" style="font-size:0.95rem;padding:0.45rem 1.1rem;">${rango.icon} ${rango.name}</div>
        <div class="points-big" style="font-size:2.6rem;">⭐ ${CLP.format(u.puntos || 0)}</div>
        <div class="code-box">
          <div style="font-size:0.8rem;color:var(--muted);margin-bottom:4px;">CÓDIGO KBROS</div>
          <div class="code" style="font-size:1.8rem;">${u.codigo}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border-radius:12px;padding:0.8rem 1rem;margin-bottom:1.2rem;">
          <span style="font-size:0.9rem;">🎂 ${u.fechaNacimiento || "Sin registrar"}</span>
          <button class="btn-add" id="btnEditarCumple" type="button" aria-label="Editar cumpleaños">✎</button>
        </div>
      </div>
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:0.6rem;text-align:left;font-weight:700;">AJUSTAR K-POINTS</div>
      <div class="admin-quick-btns">
        <button class="plus" data-cant="50" type="button">+50</button>
        <button class="plus" data-cant="100" type="button">+100</button>
        <button class="plus" data-cant="500" type="button">+500</button>
        <button class="minus" data-cant="-50" type="button">-50</button>
        <button class="minus" data-cant="-100" type="button">-100</button>
        <button class="minus" data-cant="-500" type="button">-500</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:0.8rem;">
        <input class="modal-input" id="fichaCustomPts" type="number" placeholder="Cantidad personalizada (± )" style="flex:1;">
        <button class="modal-btn outline" id="fichaCustomBtn" type="button" style="width:auto;margin:0;padding:0 1.1rem;white-space:nowrap;">Aplicar</button>
      </div>
      <div class="section-title" style="padding:0;margin-top:1.4rem;"><h2 style="font-size:1.05rem;">🧾 Historial de compras</h2></div>
      <div id="fichaOrders" style="margin-top:0.6rem;"><p class="empty-state">Cargando…</p></div>
      <div class="section-title" style="padding:0;margin-top:1.2rem;"><h2 style="font-size:1.05rem;">🎁 Historial de canjes</h2></div>
      <div id="fichaCanjes" style="margin-top:0.6rem;"><p class="empty-state">Cargando…</p></div>
    `);
    formSheet.style.maxWidth = "560px";

    formSheet.querySelectorAll("[data-cant]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const res = await adapter.admin.adjustPoints(u.codigo, parseInt(btn.dataset.cant, 10), "Ajuste manual admin");
          showToast(res.message || "Ajuste aplicado");
          close();
          onChange();
        } catch (err) {
          showToast("❌ No se pudo ajustar: " + (err.message || err));
        }
      });
    });
    formSheet.querySelector("#fichaCustomBtn").addEventListener("click", async () => {
      const cantidad = parseInt(formSheet.querySelector("#fichaCustomPts").value, 10);
      if (!cantidad) return showToast("Ingresa una cantidad distinta de cero");
      try {
        const res = await adapter.admin.adjustPoints(u.codigo, cantidad, "Ajuste manual admin (monto personalizado)");
        showToast(res.message || "Ajuste aplicado");
        close();
        onChange();
      } catch (err) {
        showToast("❌ No se pudo ajustar: " + (err.message || err));
      }
    });
    formSheet.querySelector("#btnEditarCumple").addEventListener("click", () => {
      openBirthdayForm(u, () => { close(); onChange(); });
    });

    adapter.getMyOrders(u.uid).then((orders) => {
      const cont = formSheet.querySelector("#fichaOrders");
      if (!orders.length) { cont.innerHTML = `<p class="empty-state">Sin pedidos aún.</p>`; return; }
      cont.innerHTML = orders.map((o) => {
        const nombres = (o.items || []).map((i) => (i.cantidad > 1 ? `${i.nombre} x${i.cantidad}` : i.nombre)).join(", ") || "Sin detalle";
        const fechaTxt = new Date(o.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
        return `<div class="pending-item">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;"><div style="font-size:0.84rem;">${nombres}</div>
            <div class="muted" style="font-size:0.72rem;margin-top:2px;">${fechaTxt} · ${o.modo || ""} · $${CLP.format(o.monto || 0)}</div></div>
            ${FICHA_ESTADO_LABEL[o.estado] || o.estado}
          </div></div>`;
      }).join("");
    });

    adapter.getMyRedemptions(u.uid).then((redemptions) => {
      const cont = formSheet.querySelector("#fichaCanjes");
      if (!redemptions.length) { cont.innerHTML = `<p class="empty-state">Sin canjes aún.</p>`; return; }
      cont.innerHTML = redemptions.map((r) => {
        const total = r.canjes.reduce((s, c) => s + c.cost * (c.qty || 1), 0);
        const nombres = r.canjes.map((c) => (c.qty > 1 ? `${c.name} x${c.qty}` : c.name)).join(", ");
        return `<div class="history-row"><span>${nombres} · ${CLP.format(total)} pts</span>${FICHA_ESTADO_LABEL[r.estado] || r.estado}</div>`;
      }).join("");
    });
  }

  function openBirthdayForm(u, onSaved) {
    const { close, sheet: formSheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">🎂 CUMPLEAÑOS DE ${u.nombre?.split(" ")[0]?.toUpperCase() || "CLIENTE"}</div>
      <p class="demo-note" style="margin-bottom:0.6rem;">El cliente solo puede ingresarla una vez; desde acá el admin siempre puede corregirla.</p>
      <label class="modal-input-label">FECHA DE NACIMIENTO</label>
      <input class="modal-input" id="bDate" type="date" value="${u.fechaNacimiento || ""}">
      <button class="modal-btn" id="bSave" type="button">GUARDAR</button>
    `);
    formSheet.querySelector("#bSave").addEventListener("click", async () => {
      const val = formSheet.querySelector("#bDate").value;
      if (!val) return showToast("Selecciona una fecha");
      try {
        await adapter.saveBirthday(u.uid, val);
        showToast("🎂 Fecha actualizada");
        close();
        onSaved();
      } catch (err) {
        showToast("❌ No se pudo guardar: " + (err.message || err));
      }
    });
  }

  async function paintProductos() {
    const cont = sheet.querySelector("#adminContent");
    const products = await adapter.admin.getAllProducts();
    const categories = getCategories();
    cont.innerHTML = `
      <p class="demo-note" style="margin-bottom:0.6rem;">${USE_MOCK ? "Catálogo listo para editarse desde acá y guardarse en Firebase (nodo <code>products/</code>). Cambios aquí no afectan la página en línea mientras el prototipo esté en modo demostración." : "Los cambios acá se guardan de inmediato en Firebase y se reflejan en la página en línea."}</p>
      <button class="modal-btn outline" id="btnNuevoProducto" type="button">+ NUEVO PRODUCTO</button>
      <div id="productList" style="margin-top:0.6rem;"></div>`;
    const list = cont.querySelector("#productList");
    list.innerHTML = products
      .map((p) => `
        <div class="admin-product-row" data-id="${p.id}">
          <div class="name">${p.name}</div>
          <div class="price">$${CLP.format(p.price)}</div>
          <button class="btn-add" data-action="edit" type="button" aria-label="Editar">✎</button>
          <button class="btn-add" data-action="del" type="button" aria-label="Eliminar">✕</button>
        </div>`)
      .join("");
    list.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest(".admin-product-row").dataset.id;
        openProductForm(products.find((p) => p.id === id), categories, async () => { await paintProductos(); });
      });
    });
    list.querySelectorAll("[data-action='del']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest(".admin-product-row").dataset.id;
        try {
          await adapter.admin.deleteProduct(id);
          await paintProductos();
        } catch (err) {
          showToast("❌ No se pudo eliminar: " + (err.message || err));
        }
      });
    });
    cont.querySelector("#btnNuevoProducto").addEventListener("click", () => {
      openProductForm(null, categories, async () => { await paintProductos(); });
    });
  }

  function openProductForm(product, categories, onSaved) {
    const isNew = !product;
    const p = product || { id: "prod-" + Date.now(), category: categories[0].id, name: "", price: 0, description: "", image: "" };
    let currentImage = p.image || "";
    const { close, sheet: formSheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">${isNew ? "NUEVO PRODUCTO" : "EDITAR PRODUCTO"}</div>
      <label class="modal-input-label">FOTO DEL PRODUCTO</label>
      <div class="product-photo-uploader">
        <div class="product-photo-preview" id="fImgPreview">${currentImage ? `<img src="${currentImage}" alt="">` : "🍽️"}</div>
        <div style="flex:1;">
          <input type="file" accept="image/*" id="fImgFile" class="sr-only" />
          <button type="button" class="modal-btn outline" id="fImgPick" style="margin-top:0;">📷 Subir foto</button>
          <p class="demo-note" style="text-align:left;margin-top:0.4rem;">JPG o PNG. Se optimiza automáticamente.</p>
        </div>
      </div>
      <label class="modal-input-label">NOMBRE</label>
      <input class="modal-input" id="fName" value="${p.name}">
      <label class="modal-input-label">CATEGORÍA</label>
      <select class="modal-input" id="fCat">${categories.map((c) => `<option value="${c.id}" ${c.id === p.category ? "selected" : ""}>${c.label}</option>`).join("")}</select>
      <label class="modal-input-label">PRECIO (CLP)</label>
      <input class="modal-input" id="fPrice" type="number" value="${p.price}">
      <label class="modal-input-label">DESCRIPCIÓN</label>
      <input class="modal-input" id="fDesc" value="${p.description || ""}">
      <button class="modal-btn" id="fSave" type="button">GUARDAR</button>
    `);

    formSheet.querySelector("#fImgPick").addEventListener("click", () => formSheet.querySelector("#fImgFile").click());
    formSheet.querySelector("#fImgFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const preview = formSheet.querySelector("#fImgPreview");
      preview.innerHTML = "⏳";
      try {
        currentImage = await adapter.admin.uploadProductImage(p.id, file);
        preview.innerHTML = `<img src="${currentImage}" alt="">`;
      } catch (err) {
        showToast("❌ No se pudo subir la foto: " + err.message);
        preview.innerHTML = currentImage ? `<img src="${currentImage}" alt="">` : "🍽️";
      }
    });

    formSheet.querySelector("#fSave").addEventListener("click", async () => {
      const name = formSheet.querySelector("#fName").value.trim();
      const price = parseInt(formSheet.querySelector("#fPrice").value, 10);
      if (!name || !price) return showToast("Completa nombre y precio");
      const updated = {
        ...p,
        name, price,
        category: formSheet.querySelector("#fCat").value,
        description: formSheet.querySelector("#fDesc").value.trim(),
        image: currentImage || null,
      };
      try {
        await adapter.admin.saveProduct(updated);
        close();
        onSaved();
      } catch (err) {
        showToast("❌ No se pudo guardar el producto: " + (err.message || err));
      }
    });
  }

  async function paintRecompensas() {
    const cont = sheet.querySelector("#adminContent");
    const rewards = await adapter.admin.getRewardsAdmin();
    cont.innerHTML = `
      <button class="modal-btn outline" id="btnNuevaRecompensa" type="button">+ NUEVA RECOMPENSA</button>
      <div id="rewardAdminList" style="margin-top:0.6rem;"></div>`;
    const list = cont.querySelector("#rewardAdminList");
    list.innerHTML = rewards
      .map((r) => `
        <div class="admin-product-row" data-id="${r.id}">
          <div class="name">${r.icon || "🎁"} ${r.name}</div>
          <div class="price">${CLP.format(r.cost)} pts</div>
          <button class="btn-add" data-action="edit" type="button" aria-label="Editar">✎</button>
          <button class="btn-add" data-action="del" type="button" aria-label="Eliminar">✕</button>
        </div>`)
      .join("");
    list.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest(".admin-product-row").dataset.id;
        openRewardForm(rewards.find((r) => r.id === id), async () => { await paintRecompensas(); });
      });
    });
    list.querySelectorAll("[data-action='del']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest(".admin-product-row").dataset.id;
        try {
          await adapter.admin.deleteReward(id);
          await paintRecompensas();
        } catch (err) {
          showToast("❌ No se pudo eliminar: " + (err.message || err));
        }
      });
    });
    cont.querySelector("#btnNuevaRecompensa").addEventListener("click", () => {
      openRewardForm(null, async () => { await paintRecompensas(); });
    });
  }

  function openRewardForm(reward, onSaved) {
    const isNew = !reward;
    const r = reward || { id: "rw-" + Date.now(), name: "", cost: 100, icon: "🎁", description: "" };
    const { close, sheet: formSheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">${isNew ? "NUEVA RECOMPENSA" : "EDITAR RECOMPENSA"}</div>
      <label class="modal-input-label">ÍCONO (emoji)</label>
      <input class="modal-input" id="rIcon" value="${r.icon}">
      <label class="modal-input-label">NOMBRE</label>
      <input class="modal-input" id="rName" value="${r.name}">
      <label class="modal-input-label">DESCRIPCIÓN</label>
      <input class="modal-input" id="rDesc" value="${r.description || ""}">
      <label class="modal-input-label">COSTO (K-POINTS)</label>
      <input class="modal-input" id="rCost" type="number" value="${r.cost}">
      <button class="modal-btn" id="rSave" type="button">GUARDAR</button>
    `);
    formSheet.querySelector("#rSave").addEventListener("click", async () => {
      const name = formSheet.querySelector("#rName").value.trim();
      const cost = parseInt(formSheet.querySelector("#rCost").value, 10);
      if (!name || !cost) return showToast("Completa nombre y costo");
      const updated = { ...r, name, cost, icon: formSheet.querySelector("#rIcon").value.trim() || "🎁", description: formSheet.querySelector("#rDesc").value.trim() };
      try {
        await adapter.admin.saveReward(updated);
        close();
        onSaved();
      } catch (err) {
        showToast("❌ No se pudo guardar: " + (err.message || err));
      }
    });
  }

  const GOAL_TYPE_LABEL = { compras: "N° de compras del mes", puntos: "K-POINTS ganados en el mes", monto: "CLP gastados en el mes" };

  async function paintMisiones() {
    const cont = sheet.querySelector("#adminContent");
    const missions = await adapter.admin.getMissionsAdmin();
    cont.innerHTML = `
      <p class="demo-note" style="margin-bottom:0.6rem;">Todo es configurable: la meta a cumplir, cómo se mide y cómo se entrega la recompensa (K-POINTS automáticos o un premio físico que el cliente reclama en el local).</p>
      <button class="modal-btn outline" id="btnNuevaMision" type="button">+ NUEVA MISIÓN</button>
      <div id="missionAdminList" style="margin-top:0.6rem;"></div>`;
    const list = cont.querySelector("#missionAdminList");
    list.innerHTML = missions
      .map((m) => `
        <div class="admin-product-row" data-id="${m.id}" style="align-items:flex-start;">
          <div class="name">
            <div>${m.icon || "🎯"} ${m.name}</div>
            <div style="color:var(--muted);font-size:0.72rem;margin-top:2px;">
              Meta: ${m.goalTarget} ${GOAL_TYPE_LABEL[m.goalType] || m.goalType} · Premio: ${m.rewardType === "puntos" ? `+${m.rewardValue} pts` : m.rewardValue}
            </div>
          </div>
          <button class="btn-add" data-action="edit" type="button" aria-label="Editar">✎</button>
          <button class="btn-add" data-action="del" type="button" aria-label="Eliminar">✕</button>
        </div>`)
      .join("") || `<p class="empty-state">No hay misiones configuradas.</p>`;
    list.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest(".admin-product-row").dataset.id;
        openMissionForm(missions.find((m) => m.id === id), async () => { await paintMisiones(); });
      });
    });
    list.querySelectorAll("[data-action='del']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest(".admin-product-row").dataset.id;
        try {
          await adapter.admin.deleteMission(id);
          await paintMisiones();
        } catch (err) {
          showToast("❌ No se pudo eliminar: " + (err.message || err));
        }
      });
    });
    cont.querySelector("#btnNuevaMision").addEventListener("click", () => {
      openMissionForm(null, async () => { await paintMisiones(); });
    });
  }

  function openMissionForm(mission, onSaved) {
    const isNew = !mission;
    const m = mission || { id: "m-" + Date.now(), icon: "🎯", name: "", description: "", goalType: "compras", goalTarget: 1, rewardType: "puntos", rewardValue: 100 };
    const { close, sheet: formSheet } = openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">${isNew ? "NUEVA MISIÓN" : "EDITAR MISIÓN"}</div>
      <div style="display:flex;gap:8px;">
        <div style="width:70px;">
          <label class="modal-input-label">ÍCONO</label>
          <input class="modal-input" id="mIcon" value="${m.icon}" style="text-align:center;">
        </div>
        <div style="flex:1;">
          <label class="modal-input-label">NOMBRE DE LA MISIÓN</label>
          <input class="modal-input" id="mName" value="${m.name}">
        </div>
      </div>
      <label class="modal-input-label">DESCRIPCIÓN (lo que ve el cliente)</label>
      <input class="modal-input" id="mDesc" value="${m.description || ""}">
      <label class="modal-input-label">¿QUÉ SE MIDE?</label>
      <select class="modal-input" id="mGoalType">
        <option value="compras" ${m.goalType === "compras" ? "selected" : ""}>N° de compras del mes</option>
        <option value="puntos" ${m.goalType === "puntos" ? "selected" : ""}>K-POINTS ganados en el mes</option>
        <option value="monto" ${m.goalType === "monto" ? "selected" : ""}>CLP gastados en el mes</option>
      </select>
      <label class="modal-input-label">META A CUMPLIR</label>
      <input class="modal-input" id="mGoalTarget" type="number" value="${m.goalTarget}">
      <label class="modal-input-label">¿CÓMO SE ENTREGA LA RECOMPENSA?</label>
      <select class="modal-input" id="mRewardType">
        <option value="puntos" ${m.rewardType === "puntos" ? "selected" : ""}>K-POINTS automáticos</option>
        <option value="fisico" ${m.rewardType === "fisico" ? "selected" : ""}>Premio físico (se reclama en el local)</option>
      </select>
      <label class="modal-input-label" id="mRewardLabel">${m.rewardType === "puntos" ? "CANTIDAD DE K-POINTS" : "DESCRIPCIÓN DEL PREMIO"}</label>
      <input class="modal-input" id="mRewardValue" value="${m.rewardValue}" ${m.rewardType === "puntos" ? 'type="number"' : ""}>
      <button class="modal-btn" id="mSave" type="button">GUARDAR</button>
    `);

    formSheet.querySelector("#mRewardType").addEventListener("change", (e) => {
      const isPuntos = e.target.value === "puntos";
      formSheet.querySelector("#mRewardLabel").textContent = isPuntos ? "CANTIDAD DE K-POINTS" : "DESCRIPCIÓN DEL PREMIO";
      const input = formSheet.querySelector("#mRewardValue");
      input.type = isPuntos ? "number" : "text";
      if (isPuntos && isNaN(parseInt(input.value, 10))) input.value = "100";
    });

    formSheet.querySelector("#mSave").addEventListener("click", async () => {
      const name = formSheet.querySelector("#mName").value.trim();
      const goalTarget = parseFloat(formSheet.querySelector("#mGoalTarget").value);
      const rewardType = formSheet.querySelector("#mRewardType").value;
      const rewardValueRaw = formSheet.querySelector("#mRewardValue").value.trim();
      if (!name || !goalTarget) return showToast("Completa el nombre y la meta");
      if (rewardType === "puntos" && !parseInt(rewardValueRaw, 10)) return showToast("Ingresa la cantidad de K-POINTS del premio");
      if (rewardType === "fisico" && !rewardValueRaw) return showToast("Describe el premio físico");
      const updated = {
        ...m,
        name,
        icon: formSheet.querySelector("#mIcon").value.trim() || "🎯",
        description: formSheet.querySelector("#mDesc").value.trim(),
        goalType: formSheet.querySelector("#mGoalType").value,
        goalTarget,
        rewardType,
        rewardValue: rewardType === "puntos" ? parseInt(rewardValueRaw, 10) : rewardValueRaw,
      };
      try {
        await adapter.admin.saveMission(updated);
        close();
        onSaved();
      } catch (err) {
        showToast("❌ No se pudo guardar: " + (err.message || err));
      }
    });
  }

  async function paintAjustes() {
    const cont = sheet.querySelector("#adminContent");
    const s = await adapter.getSettings();
    cont.innerHTML = `
      <p class="demo-note" style="margin-bottom:0.6rem;">Estos ajustes controlan el texto del inicio, WhatsApp, delivery y K-Points en toda la app.</p>
      <label class="modal-input-label">TÍTULO DEL INICIO</label>
      <input class="modal-input" id="sHeroTitle" value="${s.heroTitle}">
      <label class="modal-input-label">SLOGAN DESTACADO (naranja)</label>
      <input class="modal-input" id="sHeroSlogan" value="${s.heroSlogan}">
      <label class="modal-input-label">SUBTÍTULO</label>
      <input class="modal-input" id="sHeroSubtitle" value="${s.heroSubtitle}">
      <label class="modal-input-label">WHATSAPP (con código de país, sin +)</label>
      <input class="modal-input" id="sWhatsapp" value="${s.whatsappNumber}">
      <label class="modal-input-label">DELIVERY: TARIFA BASE (CLP)</label>
      <input class="modal-input" id="sDeliveryBase" type="number" value="${s.deliveryBaseFee}">
      <label class="modal-input-label">DELIVERY: KM INCLUIDOS EN TARIFA BASE</label>
      <input class="modal-input" id="sDeliveryFreeKm" type="number" value="${s.deliveryFreeKm}">
      <label class="modal-input-label">DELIVERY: RECARGO POR KM EXTRA (CLP)</label>
      <input class="modal-input" id="sDeliveryPerKm" type="number" value="${s.deliveryPerKmFee}">
      <label class="modal-input-label">CONVERSIÓN: $CLP POR 1 K-POINT</label>
      <input class="modal-input" id="sPointsConv" type="number" value="${s.pointsPerClp}">
      <label class="modal-input-label">BONO DE CUMPLEAÑOS (K-POINTS)</label>
      <input class="modal-input" id="sBirthday" type="number" value="${s.bonoCumpleanos}">
      <div style="font-size:0.8rem;color:var(--muted);margin:1.4rem 0 0.5rem;">🔥 RACHA SEMANAL</div>
      <p class="demo-note" style="text-align:left;margin-bottom:0.5rem;">Cada semana consecutiva con al menos 1 pedido aprobado sube el descuento automático del cliente en su próxima compra.</p>
      <label class="modal-input-label">% QUE SUMA CADA SEMANA DE RACHA</label>
      <input class="modal-input" id="sStreakPerWeek" type="number" value="${s.streakPercentPerWeek}">
      <label class="modal-input-label">TOPE MÁXIMO DE DESCUENTO (%)</label>
      <input class="modal-input" id="sStreakMax" type="number" value="${s.streakMaxPercent}" ${s.streakInfinite ? "disabled" : ""}>
      <label class="modal-option" style="margin-top:0.6rem;${s.streakInfinite ? "" : "opacity:0.85;"}" id="streakInfiniteRow">
        <span class="modal-opt-icon">♾️</span>
        <div class="modal-opt-text">
          <div class="modal-opt-title">Rachas infinitas</div>
          <div class="modal-opt-sub">El % sigue subiendo sin tope semana a semana, sin límite.</div>
        </div>
        <input type="checkbox" id="sStreakInfinite" ${s.streakInfinite ? "checked" : ""} style="width:20px;height:20px;margin-left:auto;">
      </label>
      <button class="modal-btn" id="btnGuardarAjustes" type="button">GUARDAR CAMBIOS</button>
      <div style="font-size:0.8rem;color:var(--muted);margin:1.4rem 0 0.5rem;">ADMINISTRADORES</div>
      <p class="demo-note" style="text-align:left;margin-bottom:0.5rem;">${ADMIN_EMAIL} siempre es admin y no se puede quitar desde acá. Cuando una cuenta agregada acá inicie sesión con Google, el sitio la reconoce como admin automáticamente — no requiere tocar Firebase.</p>
      <div id="adminEmailChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:0.6rem;"></div>
      <div style="display:flex;gap:6px;">
        <input class="modal-input" id="sNewAdminEmail" placeholder="nuevo-admin@correo.com" style="flex:1;">
        <button class="modal-btn outline" id="btnAddAdminEmail" type="button" style="width:auto;margin:0;padding:0 1rem;white-space:nowrap;">Añadir</button>
      </div>`;

    function renderAdminChips(map) {
      const keys = Object.keys(map || {});
      const box = cont.querySelector("#adminEmailChips");
      box.innerHTML = keys.length
        ? keys.map((key) => `
            <span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border2);border-radius:999px;padding:0.3rem 0.5rem 0.3rem 0.8rem;font-size:0.78rem;">
              ${key.replace(/,/g, ".")}
              <button type="button" data-remove="${key}" style="background:none;border:none;color:var(--red);font-size:0.85rem;padding:2px;">✕</button>
            </span>`).join("")
        : `<span class="demo-note">Todavía no hay administradores adicionales.</span>`;
      box.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            const saved = await adapter.admin.saveSettings({ [`adminEmailsMap/${btn.dataset.remove}`]: null });
            s.adminEmailsMap = saved.adminEmailsMap || {};
            renderAdminChips(s.adminEmailsMap);
            showToast("Administrador quitado");
          } catch (err) {
            showToast("❌ No se pudo quitar: " + (err.message || err));
          }
        });
      });
    }
    renderAdminChips(s.adminEmailsMap || {});

    cont.querySelector("#btnAddAdminEmail").addEventListener("click", async () => {
      const input = cont.querySelector("#sNewAdminEmail");
      const email = input.value.trim().toLowerCase();
      if (!email || !email.includes("@")) return showToast("Ingresa un correo válido");
      if (email === ADMIN_EMAIL.toLowerCase()) return showToast("Ese correo ya es administrador principal");
      const key = sanitizeEmailKey(email);
      if ((s.adminEmailsMap || {})[key]) return showToast("Ese correo ya es administrador");
      try {
        const saved = await adapter.admin.saveSettings({ [`adminEmailsMap/${key}`]: true });
        s.adminEmailsMap = saved.adminEmailsMap || {};
        renderAdminChips(s.adminEmailsMap);
        input.value = "";
        showToast("✅ Administrador agregado");
      } catch (err) {
        showToast("❌ No se pudo agregar: " + (err.message || err));
      }
    });

    cont.querySelector("#sStreakInfinite").addEventListener("change", (e) => {
      cont.querySelector("#sStreakMax").disabled = e.target.checked;
    });

    cont.querySelector("#btnGuardarAjustes").addEventListener("click", async () => {
      const patch = {
        heroTitle: cont.querySelector("#sHeroTitle").value.trim() || s.heroTitle,
        heroSlogan: cont.querySelector("#sHeroSlogan").value.trim() || s.heroSlogan,
        heroSubtitle: cont.querySelector("#sHeroSubtitle").value.trim() || s.heroSubtitle,
        whatsappNumber: cont.querySelector("#sWhatsapp").value.trim() || s.whatsappNumber,
        deliveryBaseFee: parseInt(cont.querySelector("#sDeliveryBase").value, 10) || 0,
        deliveryFreeKm: parseInt(cont.querySelector("#sDeliveryFreeKm").value, 10) || 0,
        deliveryPerKmFee: parseInt(cont.querySelector("#sDeliveryPerKm").value, 10) || 0,
        pointsPerClp: parseInt(cont.querySelector("#sPointsConv").value, 10) || s.pointsPerClp,
        bonoCumpleanos: parseInt(cont.querySelector("#sBirthday").value, 10) || 0,
        streakPercentPerWeek: parseFloat(cont.querySelector("#sStreakPerWeek").value) || 0,
        streakMaxPercent: parseFloat(cont.querySelector("#sStreakMax").value) || 0,
        streakInfinite: cont.querySelector("#sStreakInfinite").checked,
      };
      try {
        const saved = await adapter.admin.saveSettings(patch);
        window.dispatchEvent(new CustomEvent("kbros:settings-updated", { detail: saved || patch }));
        showToast("✅ Ajustes guardados");
      } catch (err) {
        showToast("❌ No se pudo guardar: " + (err.message || err));
      }
    });
  }
}

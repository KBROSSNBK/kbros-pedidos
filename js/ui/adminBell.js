import { sessionStore } from "../state/session.js";
import { getAdapter } from "../data/dataAdapter.js";
import { openAdminPanel } from "./admin.js";

const POLL_MS = 15000;

export function initAdminBell() {
  const btn = document.getElementById("adminBellBtn");
  const dot = document.getElementById("adminBellDot");
  if (!btn) return;

  let pollId = null;

  async function refreshCount() {
    try {
      const adapter = await getAdapter();
      const stats = await adapter.admin.getStats();
      const n = stats.pendientesCount || 0;
      dot.hidden = n === 0;
      dot.textContent = n > 99 ? "99+" : n;
    } catch { /* silencioso: no bloquea la UI si falla un refresco puntual */ }
  }

  sessionStore.subscribe(({ isAdmin }) => {
    btn.hidden = !isAdmin;
    if (isAdmin) {
      refreshCount();
      if (!pollId) pollId = setInterval(refreshCount, POLL_MS);
    } else if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
  });

  window.addEventListener("kbros:pending-changed", refreshCount);
  btn.addEventListener("click", () => openAdminPanel());
}

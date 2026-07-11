const views = ["inicio", "menu", "kpoints", "perfil"];
const listeners = new Set();
let current = "inicio";

export function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });
}

export function goToView(id) {
  if (!views.includes(id)) return;
  const changed = id !== current;
  current = id;
  views.forEach((v) => {
    const section = document.getElementById("view-" + v);
    if (section) section.hidden = v !== id;
  });
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === id);
    btn.setAttribute("aria-current", btn.dataset.view === id ? "page" : "false");
  });
  window.scrollTo({ top: 0, behavior: "auto" });

  // Pequeña animación de entrada al cambiar de pestaña, como el swap de tabs en una app nativa.
  if (changed) {
    const active = document.getElementById("view-" + id);
    if (active) {
      active.classList.remove("view-fade-enter");
      void active.offsetWidth;
      active.classList.add("view-fade-enter");
    }
  }
  listeners.forEach((l) => l(id));
}

export function onViewChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getCurrentView() {
  return current;
}

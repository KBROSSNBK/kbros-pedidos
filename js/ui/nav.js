const views = ["inicio", "menu", "kpoints", "perfil"];
// El catálogo (antes una pestaña "Menú" aparte) ahora vive dentro de la sección Inicio,
// más abajo del scroll — así lo ve también quien solo baja con el dedo sin tocar nada.
// "Menú" en la barra inferior sigue existiendo como atajo: en vez de cambiar de sección,
// hace scroll suave hasta el catálogo.
const SECTION_OF = { inicio: "inicio", menu: "inicio", kpoints: "kpoints", perfil: "perfil" };
const listeners = new Set();
let current = "inicio";
let currentSection = "inicio"; // separado de `current`: inicio y menu comparten sección

export function initNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });
}

export function goToView(id) {
  if (!views.includes(id)) return;
  current = id;
  const targetSection = SECTION_OF[id];
  const sectionChanged = targetSection !== currentSection;
  currentSection = targetSection;
  [...new Set(Object.values(SECTION_OF))].forEach((sectionId) => {
    const section = document.getElementById("view-" + sectionId);
    if (section) section.hidden = sectionId !== targetSection;
  });
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === id);
    btn.setAttribute("aria-current", btn.dataset.view === id ? "page" : "false");
  });

  if (id === "menu") {
    document.getElementById("catalogSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  // Pequeña animación de entrada al cambiar de sección, como el swap de tabs en una app
  // nativa — solo cuando la sección de verdad cambia (inicio <-> menu no cuenta, es la misma).
  if (sectionChanged) {
    const active = document.getElementById("view-" + targetSection);
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

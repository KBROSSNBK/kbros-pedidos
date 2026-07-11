const DISMISS_KEY = "kbros_install_dismissed";

/** Registra el service worker (app shell offline + carga instantánea en visitas repetidas). */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.error("SW error:", e));
  });
}

/** Muestra el banner "Instalar KBROS" cuando Chrome/Android ofrece el prompt nativo. */
export function initInstallBanner() {
  const banner = document.getElementById("installBanner");
  const installBtn = document.getElementById("installBtn");
  const closeBtn = document.getElementById("installBannerClose");
  if (!banner) return;

  // Ya instalada (standalone) o el usuario ya cerró el banner antes: no molestar de nuevo.
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (isStandalone || localStorage.getItem(DISMISS_KEY)) return;

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.hidden = true;
  });

  closeBtn.addEventListener("click", () => {
    banner.hidden = true;
    localStorage.setItem(DISMISS_KEY, "1");
  });

  window.addEventListener("appinstalled", () => {
    banner.hidden = true;
  });
}

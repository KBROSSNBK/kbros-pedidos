import { createStore } from "./store.js";
import { getAdapter } from "../data/dataAdapter.js";
import { ADMIN_EMAIL } from "../config.js";

const CONTACT_KEY = "kbros_contact_v1";

export const sessionStore = createStore({
  ready: false, // ya se resolvió el estado de auth al menos una vez
  authUser: null,
  userData: null,
  isAdmin: false,
  guestMode: false,
});

let unsubUserData = null;

export async function initSession() {
  const adapter = await getAdapter();
  adapter.onAuthChange(async (authUser) => {
    if (unsubUserData) {
      unsubUserData();
      unsubUserData = null;
    }
    if (authUser) {
      const userData = await adapter.getOrCreateUser(authUser);
      // El correo en config.js es el super-admin fijo (siempre admin, no se puede quitar desde
      // la app). El admin principal puede sumar otros correos desde Panel Admin -> Ajustes,
      // sin tocar Firebase directamente: quedan guardados en settings.adminEmails.
      let adminEmails = [];
      try {
        const settings = await adapter.getSettings();
        adminEmails = settings.adminEmails || [];
      } catch { /* si falla, igual queda el super-admin como respaldo */ }
      const email = (authUser.email || "").toLowerCase();
      const isAdmin = email === ADMIN_EMAIL.toLowerCase() || adminEmails.map((e) => e.toLowerCase()).includes(email);
      sessionStore.setState({ ready: true, authUser, userData, isAdmin, guestMode: false });
      unsubUserData = adapter.onUserData(authUser.uid, (fresh) => {
        if (fresh) sessionStore.setState({ userData: fresh });
      });
      // Bono de cumpleaños: se revisa en cada login, no solo al crear la cuenta.
      try {
        const bono = await adapter.claimBirthdayBonusIfDue(authUser.uid);
        if (bono.granted) window.dispatchEvent(new CustomEvent("kbros:birthday-bonus", { detail: bono }));
      } catch (e) { console.error("Error al revisar el bono de cumpleaños:", e); }
    } else {
      sessionStore.setState({ ready: true, authUser: null, userData: null, isAdmin: false });
    }
  });
}

export function enterAsGuest() {
  sessionStore.setState({ guestMode: true });
}

export async function loginWithGoogle(fakeProfile) {
  const adapter = await getAdapter();
  await adapter.signInWithGoogle(fakeProfile);
}

export async function logout() {
  const adapter = await getAdapter();
  await adapter.signOutUser();
  sessionStore.setState({ guestMode: false });
}

export function getRememberedContact() {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveRememberedContact(nombre, telefono) {
  localStorage.setItem(CONTACT_KEY, JSON.stringify({ nombre, telefono }));
}

import { USE_MOCK } from "../config.js";

/**
 * Punto único de acceso a datos. El resto de la app (state/, ui/) nunca importa
 * mockAdapter.js ni firebaseAdapter.js directamente — siempre pide el adapter aquí.
 * Esto es lo que permite "separar lógica, interfaz y datos": si mañana cambia el
 * backend (Firebase -> otra cosa), solo se escribe un adapter nuevo con la misma forma.
 *
 * Interfaz que debe cumplir cualquier adapter:
 *   getProducts(): Promise<Product[]>
 *   getCategories(): Promise<Category[]>  // secciones del menú, editables desde el panel admin
 *   getBestSellers(limit): Promise<Product[]>  // calculado de ventas reales, con relleno manual
 *   recordProductSales(items): Promise<void>   // items: [{id, cantidad}], se llama al confirmar un pedido
 *   getSettings(): Promise<Settings>
 *   onLikes(cb): unsubscribe()
 *   incrementLike(): Promise<void>
 *   onActiveUsers(cb): unsubscribe()
 *   signInWithGoogle(): Promise<AuthUser>
 *   signOutUser(): Promise<void>
 *   onAuthChange(cb): unsubscribe()
 *   getOrCreateUser(authUser): Promise<UserData>
 *   onUserData(uid, cb): unsubscribe()
 *   saveBirthday(uid, dateStr): Promise<void>
 *   claimBirthdayBonusIfDue(uid): Promise<{granted:boolean, amount?:number}>  // se llama en cada login
 *   submitOrder(orderPayload): Promise<void>  // orderPayload.items?: [{id,nombre,precio,cantidad,categoria,imagen}], .canjes?: [{rewardId,name,cost,qty}]
 *   getMyRedemptions(uid): Promise<{id,canjes,estado,fecha}[]>  // canjes pendientes y resueltos del cliente
 *   getMyOrders(uid): Promise<{id,items,canjes,modo,monto,puntos,estado,fecha}[]>  // historial de compras del cliente
 *   getRewards(): Promise<Reward[]>
 *   redeemReward(uid, reward): Promise<{ok:boolean, message:string}>
 *   getMissions(): Promise<Mission[]>
 *   getMissionProgress(uid): Promise<{progreso:{compras,puntos,monto}, reclamadas:object}>
 *   claimMission(uid, missionId): Promise<{ok:boolean, message:string}>
 *   getHistory(uid): Promise<HistoryItem[]>
 *   transferPoints(fromCode, toCode, amount): Promise<{ok:boolean, message:string}>
 *   admin: {
 *     getStats(): Promise<Stats>
 *     getPending(): Promise<PendingItem[]>
 *     getOrdersHistory(): Promise<PendingItem[]>  // resueltos: aprobados + rechazados, para auditoría
 *     approvePending(id): Promise<void>
 *     rejectPending(id): Promise<void>
 *     searchUsers(query): Promise<UserData[]>
 *     adjustPoints(code, amount, reason): Promise<void>
 *     saveProduct(product): Promise<void>
 *     deleteProduct(id): Promise<void>
 *     getCategoriesAdmin(): Promise<Category[]>
 *     saveCategory(category): Promise<void>
 *     deleteCategory(id): Promise<void>
 *     saveReward(reward): Promise<void>
 *     deleteReward(id): Promise<void>
 *     getMissionsAdmin(): Promise<Mission[]>
 *     saveMission(mission): Promise<void>
 *     deleteMission(id): Promise<void>
 *     saveSettings(patch): Promise<Settings>
 *     uploadProductImage(productId, file): Promise<string>  // devuelve la URL/dataURL final
 *   }
 */
let adapterPromise = null;

export function getAdapter() {
  if (!adapterPromise) {
    adapterPromise = USE_MOCK
      ? import("./mockAdapter.js").then((m) => m.mockAdapter)
      : import("./firebaseAdapter.js").then((m) => m.firebaseAdapter);
  }
  return adapterPromise;
}

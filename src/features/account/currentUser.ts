/*
 * Le compte connecté, lisible hors de React : les rooms l'annoncent en
 * rejoignant une table, pour que chacun voie les cosmétiques des autres.
 * Tenu à jour par AuthProvider.
 */
let current: string | null = null;

export const getCurrentUserId = () => current;
export const setCurrentUserId = (id: string | null) => {
  current = id;
};

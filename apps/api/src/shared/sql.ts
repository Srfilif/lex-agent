// Escapa comodines de LIKE/ILIKE en input de usuario (H7).
// Sin esto, % y _ del usuario alteran la búsqueda (no es SQLi: va parametrizado).
export function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

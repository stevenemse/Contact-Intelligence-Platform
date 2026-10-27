/**
 * Limites d'import CSV — source unique partagée par le wizard (client) et la
 * route API.
 *
 * Un import ne peut pas partir en une seule requête : Vercel rejette tout corps
 * au-delà d'environ 4,5 Mo (413 avant même d'atteindre notre code), alors qu'un
 * fichier de 18 000 lignes pèse plusieurs Mo en JSON. Le wizard découpe donc
 * l'envoi en lots rattachés à un même identifiant d'import.
 */

/** Plafond de lignes d'un import (contrainte applicative). */
export const MAX_IMPORT_ROWS = 20_000

/** Lignes par requête : quelques centaines de Ko de JSON, très loin du 413. */
export const IMPORT_CHUNK_ROWS = 1_000

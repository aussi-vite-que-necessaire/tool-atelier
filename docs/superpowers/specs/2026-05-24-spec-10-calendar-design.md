# Spec 10 — Calendrier éditorial — Design

**Objectif** : une page `/calendar` montrant en grille mensuelle les publications planifiées et publiées, chaque entrée renvoyant au post.

## Périmètre

- Vue **grille mois** (lundi → dimanche), navigation mois précédent/suivant.
- Affiche les publications **planifiées** (`scheduled`/`queued`/`publishing`, datées par `scheduledFor`) et **publiées** (`published`, datées par `publishedAt`).
- **Lecture seule** : chaque entrée est un lien vers `/posts/{postId}`. Pas d'annulation ni de reprogrammation depuis le calendrier (ça reste sur la page post, Spec 9).
- Entrée de navigation « Calendrier » dans le header.

Hors périmètre : gestion fine des fuseaux horaires, drag-and-drop, vue semaine/jour, export iCal.

## Architecture

Page server-rendered sans état client. Une fonction pure construit le modèle de grille à partir des publications ; le rendu mappe ce modèle. La navigation entre mois se fait par lien (`?month=YYYY-MM`), pas de JS.

*Alternative écartée : calendrier client avec lib externe (date-fns / react-day-picker). Surdimensionné — le projet n'a aucune lib de date et le besoin est en lecture seule.*

## Données

Aucune migration. On charge les publications du user via `listPublications(userId)` (volume faible en usage solo) et on filtre/groupe en mémoire. Pas de requête SQL par plage de dates.

La **date calendaire** d'une publication :
- `scheduledFor` si statut `scheduled`, `queued` ou `publishing` ;
- `publishedAt` si statut `published` ;
- `null` (non affichée) pour `failed` ou toute publication sans date pertinente.

## Logique pure — `src/lib/calendar/month-grid.ts`

- `calendarDate(pub): Date | null` — applique la règle ci-dessus.
- `type CalendarItem = { publicationId: string; postId: string; title: string; status: string }` — `title` = première ligne du `contentSnapshot`, tronquée.
- `type CalendarDay = { date: Date; inMonth: boolean; items: CalendarItem[] }`.
- `buildMonthGrid(year: number, month: number, pubs: Publication[]): CalendarDay[][]` — renvoie des semaines (tableaux de 7 jours) couvrant du lundi ≤ 1er au dimanche ≥ dernier jour du mois. `inMonth` distingue les jours du mois courant des jours de débordement. Items placés au jour de leur `calendarDate`, triés par heure.
- `prevMonth(year, month)` / `nextMonth(year, month)` → `{ year, month }` (gèrent le passage d'année). `month` est 1-12.
- `monthParam(year, month): string` → `'YYYY-MM'` ; `parseMonthParam(s): { year, month }` avec fallback au mois courant si invalide.

## Page — `src/app/(app)/calendar/page.tsx`

Server component :
1. lit `searchParams.month` (`YYYY-MM`), défaut = mois courant ;
2. `listPublications(userId)` → `buildMonthGrid(...)` ;
3. rend l'en-tête (`Mai 2026` + liens ‹ › vers `?month=` précédent/suivant) et la grille 7 colonnes.

Chaque cellule jour :
- numéro du jour (atténué si `!inMonth`) ;
- jusqu'à 3 **chips** (titre tronqué, style selon statut : planifié vs publié), chacune `<Link href="/posts/{postId}">` ;
- « +N » si plus de 3 items ce jour-là.

Navigation ajoutée dans `src/components/layout/app-header.tsx` : `{ href: '/calendar', label: 'Calendrier', icon: CalendarDays }`.

## Fuseau horaire

Groupage par la date du timestamp tel quel (simplification assumée, suffisant pour un usage perso). Pas de conversion tz par utilisateur.

## Tests

- **Unit** (`test/unit/month-grid.test.ts`) :
  - `buildMonthGrid` : nombre de semaines correct, lundi en tête, `inMonth` exact aux bornes, item planifié placé au jour de `scheduledFor`, item publié au jour de `publishedAt`, plusieurs items le même jour.
  - `calendarDate` : `failed` → null ; `scheduled` → `scheduledFor` ; `published` → `publishedAt`.
  - `prevMonth`/`nextMonth` : passage décembre→janvier et janvier→décembre.
  - `parseMonthParam` : valide / invalide (fallback).
- **E2E** (`test/e2e/calendar.spec.ts`, stub LinkedIn) : connecter LinkedIn (stub) → créer un post → le planifier à une date du mois courant → aller sur `/calendar` → la chip apparaît → clic → atterrit sur `/posts/{id}`.

---
name: lab-adr
description: Capturer une décision structurante de l'atelier en ADR (Architecture Decision Record). À utiliser quand Manu prend une décision qui contraint plusieurs features ou qui n'est attachée à aucune feature précise (choix de stack, convention transverse, abandon d'une approche). Pas pour les décisions internes à une feature — celles-là restent dans la spec.
---

# /lab-adr — capturer une décision structurante

Une ADR est une note courte qui fige une décision **transverse** (qui contraint
plusieurs features) ou **autonome** (qui n'est attachée à aucune feature). Les
décisions internes à une feature restent dans la spec de cette feature — pas
besoin d'ADR.

## Contrat

- Format strict : numéroté `NNNN-<sujet-kebab>.md`, gabarit imposé.
- L'identité d'une ADR est son **numéro**, pas sa date.
- Une ADR peut en *superseder* une autre (la nouvelle remplace l'ancienne ; la
  vieille passe en statut `Superseded by ADR-NNNN`).
- L'index `docs/decisions/README.md` est maintenu par cette skill.

## Déroulé

1. **Choisir le numéro.** Scanner `docs/decisions/` pour le plus grand numéro
   existant. Le prochain = `printf '%04d' $((max + 1))`. Si dossier vide → `0001`.

2. **Poser 4 questions** (une à la fois, `AskUserQuestion` quand possible) :
   - **Contexte.** Quel problème, quelles contraintes, ce qui force une décision.
   - **Décision.** Ce qu'on fait, dans les termes les plus secs.
   - **Conséquences.** Ce qui devient interdit/requis, facile/difficile, les
     engagements futurs.
   - **Alternatives écartées.** 1-3 options qui ont été considérées et pourquoi
     elles sont rejetées.

3. **Demander si supersedes.** « Cette décision en remplace-t-elle une
   précédente ? Si oui, ADR-NNNN ? » (Optionnel.)

4. **Écrire le fichier** `docs/decisions/NNNN-<sujet-kebab>.md` avec ce gabarit
   exact :

   ```md
   # ADR-NNNN : <titre court>

   **Statut.** Accepted
   **Date.** AAAA-MM-JJ
   **Supersedes.** ADR-MMMM  <!-- ligne à retirer si non applicable -->

   ## Contexte
   <2-4 phrases>

   ## Décision
   <1-2 phrases>

   ## Conséquences
   - <puce>
   - <puce>

   ## Alternatives écartées
   - **<option>** — <raison>.
   ```

5. **Si supersedes** : éditer l'ADR remplacée pour changer son statut en
   `Superseded by ADR-NNNN`, et mettre à jour sa ligne dans l'index.

6. **Mettre à jour l'index** `docs/decisions/README.md` : ajouter une ligne dans
   la section « Décisions » :
   ```
   - [ADR-NNNN](NNNN-<sujet>.md) — Accepted — <titre court>.
   ```
   Si une autre ADR est supersédée, mettre à jour son statut dans l'index aussi.

7. **Commit** avec message `📜 ADR-NNNN : <titre>`.

## Principes

- ADR = pourquoi durable. Ne pas y mettre du « comment » qui appartient au code
  ou à une spec.
- Concis. Pas de digression historique, pas de récit. Une ADR tient sur un écran.
- Pas de placeholder. Si une section est vide, c'est que l'ADR n'est pas mûre :
  reposer la question, ou ne pas la créer.

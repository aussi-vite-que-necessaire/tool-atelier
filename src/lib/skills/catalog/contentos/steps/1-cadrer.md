# 1. Cadrer — format + voix

But : poser le **cadre** du post. Cette étape ne rédige rien — elle propose, l'humain choisit.

1. Récupère les formats : `list_publication_formats`. Récupère les voix : `list_voices`.
2. Présente un **menu** clair à l'humain :
   - les **formats** disponibles (nom + à quoi ils servent),
   - les **voix** disponibles (nom).
3. Demande à l'humain de choisir **un format** et **une voix**. Attends sa réponse.

Si la liste est vide (aucun format ou aucune voix), dis-le et invite à en créer dans l'espace
Compte de la suite — ne pas inventer de format ni de voix.

Garde en mémoire l'`id` du format et de la voix choisis : les étapes suivantes lisent leur
contenu (`structure`, `writingRules`, `visualIntent` du format ; `content` de la voix).

→ Étape suivante : [2-plan.md](2-plan.md)

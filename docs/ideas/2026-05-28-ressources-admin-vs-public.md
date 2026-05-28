# Ressources : séparer l'admin et le front-end public

**Date.** 2026-05-28
**Statut.** À explorer

## Contexte

Le projet `ressources` (plateforme de lead magnets, `ressources.avqn.ch` puis bientôt
`ressources.contentos.ch`) sert aujourd'hui à la fois l'admin (création/gestion des lead magnets)
et le front-end utilisateur (téléchargement public). On vient de migrer cast vers le SSO
centralisé `auth.contentos.ch` (PR #53) ; la migration de ressources pose la question : doit-on
exposer l'admin et le front-end public via le même service, avec le SSO appliqué partout, ou les
séparer ?

## L'idée

Restreindre `ressources` à l'admin (gestion des lead magnets, derrière SSO `auth.contentos.ch`).
Extraire le front-end utilisateur (téléchargement public d'un lead magnet par un visiteur) dans
un nouveau projet dédié — sans auth, ou avec un flow distinct (capture email léger, pas de SSO
suite). Cela permet :
- de séparer la cible (équipe interne vs visiteurs externes) ;
- de garder l'admin propre derrière le SSO contentos sans cookies cross-domain inutiles sur le
  front-end public ;
- de pouvoir scaler/cacher le front-end indépendamment.

## Tradeoffs

- **Gain** : séparation propre des préoccupations, sécurité de l'admin renforcée, front-end
  public plus simple à optimiser et à styliser.
- **Coût** : un projet de plus à maintenir (Dockerfile, deploy, CLAUDE.md), duplication
  potentielle des modèles de données ou besoin d'une API cross-projet.
- **Inconnue** : où vit la base ? Le nouveau front-end public lit-il la base de l'admin via
  `/v1`, ou réplique-t-on les données ? Probablement un endpoint `/v1` admin → public.
- **Risque** : si trop de logique métier se duplique, ça devient lourd. Mitigation : keep le
  front-end public dumb (consommateur HTTP-only).

## Quand y revenir

Quand on voudra **ouvrir un front-end public à des visiteurs externes** (pas seulement
l'équipe), ou quand on rajoutera des features admin qui n'ont rien à voir avec le téléchargement
public.

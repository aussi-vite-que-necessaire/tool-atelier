# SSO de la suite contentos — design

`auth.contentos.ch` est l'**unique** lieu de connexion de la suite (media, cast, ressources, www,
skills, …). Une connexion là-bas ouvre la session pour tous les sous-domaines `*.contentos.ch`.
Les services clients ne stockent ni n'authentifient les users : ils lisent la session via un
appel HTTP au provider.

## Modèle

- **Provider** : `auth` (ce projet). Détient la base BetterAuth (user, session, account,
  verification, plus le store OTP). Émet le cookie de session.
- **Clients** : `media`, `cast`, `ressources`, `www`, `skills`, … Aucune table user locale.
  Lisent la session par appel HTTP à `auth`.

## Cookie partagé

BetterAuth sert le cookie de session via `advanced.crossSubDomainCookies`. Le domain dépend de
l'host de `APP_URL` :

| `APP_URL`                                 | Cookie `Domain=` | Lu par                                  |
|-------------------------------------------|------------------|-----------------------------------------|
| `https://auth.contentos.ch`               | `.contentos.ch`  | `*.contentos.ch` (prod de la suite)     |
| `https://auth-<br>.preview.contentos.ch`  | `.preview.contentos.ch` | `*.preview.contentos.ch` (toutes previews) |
| `http://localhost:3000`                   | (par host)       | Local seulement                         |

Conséquence preview : les previews de la suite partagent un cookie unique. C'est un compromis
assumé — les previews sont éphémères, leurs bases sont seedées + droppées, et tester le SSO
nécessite ce partage. Pour une vraie isolation par preview, il faudrait un cookie par origine
(et le SSO ne serait pas testable en preview).

`trustedOrigins` autorise `https://contentos.ch`, `https://*.contentos.ch`,
`https://*.preview.contentos.ch`, et `APP_URL` lui-même (pour le local).

## Lecture de session côté client

Le client appelle `GET ${AUTH_URL}/api/auth/get-session` en **forwardant le cookie du browser**.
BetterAuth résout la session contre la DB d'`auth` et renvoie `{ user, session }` ou 401.

```ts
// dans le service client
export async function getSession(headers: Headers) {
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  const res = await fetch(`${process.env.AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user ? data : null;
}
```

Pas de secret partagé entre projets, pas d'accès DB croisé.

## Redirection vers le login

Si pas de session, le client redirige vers `${AUTH_URL}/sign-in?redirect=${currentUrl}`. La page
`sign-in` d'auth, après OTP validé, redirige vers `redirect` (whitelistée par `trustedOrigins`).

## Variables côté clients

Chaque service client a une variable `AUTH_URL` :

- Prod : `https://auth.contentos.ch`
- Preview : `https://auth-<branche-de-auth>.preview.contentos.ch` ou un alias stable (à arbitrer
  une fois le premier client branché). Le simple est de pointer toutes les previews vers la prod
  d'`auth` — le cookie `.contentos.ch` ne sera pas lu sur `.preview.contentos.ch` (domaines
  disjoints), donc la session preview ne sera pas partagée avec prod, mais le login fonctionnera.
  Trancher au premier branchement.

## Hors scope (V1)

- **OIDC provider** : pas exposé. Si une app tierce (hors suite) doit s'authentifier, on ajoutera
  le plugin `oidc-provider` de BetterAuth plus tard.
- **Gestion fine des permissions / orgs** : pas de plugin `organization` pour l'instant. La
  notion d'ownership par user dans les apps clientes (ex. isolation des médias dans `media`) se
  fait par chaque client lui-même, à partir du `user.id` retourné par `get-session`.
- **MCP de gestion** : pas de serveur MCP côté auth pour l'instant — les serveurs MCP des
  services clients valident leurs sessions via le même endpoint HTTP.
- **Révocation de session par admin** : repose sur les outils natifs BetterAuth, pas d'UI dédiée.

## Sortie en prod

1. Déployer `auth.contentos.ch` (ce projet).
2. Brancher un premier client (`media`) qui appelle `get-session` et utilise `user.id` pour
   isoler ses ressources — c'est ce qui a déclenché le besoin initial.
3. Étendre aux autres services.

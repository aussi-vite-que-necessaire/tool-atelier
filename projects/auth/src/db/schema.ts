import { user, session, account, verification } from "./schemas/auth";
import { oauthApplication, oauthAccessToken, oauthConsent } from "./schemas/oidc";

export { user, session, account, verification, oauthApplication, oauthAccessToken, oauthConsent };

export const schema = {
  user, session, account, verification,
  oauthApplication, oauthAccessToken, oauthConsent,
};

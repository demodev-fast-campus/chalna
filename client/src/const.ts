export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const isLoginConfigured = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  if (!oauthPortalUrl || !appId) return false;

  try {
    new URL(oauthPortalUrl);
    return true;
  } catch {
    return false;
  }
};

// Generate login URL at runtime so redirect URI reflects the current origin.
// In local development, OAuth envs may be absent. Return a safe fallback instead
// of throwing during render so the app can still boot and show a clear message.
export const getLoginUrl = () => {
  if (!isLoginConfigured()) return "#login-unavailable";

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL("app-auth", `${oauthPortalUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

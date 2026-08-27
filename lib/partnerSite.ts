export const PARTNER_SITE_NAME = "SwitchAuto AI";
export const PARTNER_SITE_URL = "https://switchautoai.com";

const PARTNER_HOSTS = new Set(["switchautoai.com", "www.switchautoai.com"]);

export function normalizeHostname(host: string): string {
  return host.toLowerCase().split(":")[0].replace(/\.$/, "");
}

export function isPartnerHostname(host: string): boolean {
  return PARTNER_HOSTS.has(normalizeHostname(host));
}


// Official sponsor logos in public/logos/. Paths are relative to public/ (use with staticFile).
export type SponsorId = "nessie" | "auth0" | "tiger" | "eyes" | "godaddy";

export const LOGO: Record<SponsorId, string | null> = {
  nessie: "logos/capitalone.svg",
  auth0: "logos/auth0.svg",
  tiger: "logos/tigerdata.svg",
  eyes: "logos/eyes-lockup.svg",
  godaddy: "logos/godaddy-registry.svg",
};

// White or light versions for a dark purple background. null: the main logo already works on dark.
export const LOGO_ON_DARK: Record<SponsorId, string | null> = {
  nessie: "logos/capitalone-white.svg",
  auth0: "logos/auth0-white.svg",
  tiger: "logos/tigerdata-white.svg",
  eyes: "logos/eyes-lockup-white.svg",
  godaddy: "logos/godaddy-registry-white.svg",
};

// Nessie API mascot from nessieisreal.com (192 px PNG, light background only).
export const NESSIE_MARK = "logos/nessie-mark.png";

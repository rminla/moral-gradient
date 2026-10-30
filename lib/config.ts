// Single source of truth for branding + runtime flags. The site name is ONE config value.
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Moral Gradient";
export const SITE_TAGLINE = "Do AI models do what they say is right?";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const OWNER_NAME = "Raphael";

export const paymentsMode = (): "stripe" | "mock" => (process.env.STRIPE_SECRET_KEY ? "stripe" : "mock");
export const emailMode = (): "resend" | "dev" => (process.env.RESEND_API_KEY ? "resend" : "dev");
// Safety latches for previews: without these flags a deployment with no Stripe / email keys refuses fake payments and
// on-screen sign-in links (which would otherwise let anyone sign in as any email).
export const mockPaymentsAllowed = () => process.env.ALLOW_MOCK_PAYMENTS === "1";
export const devLoginAllowed = () => process.env.ALLOW_DEV_LOGIN === "1";
export const autoLaunch = () => process.env.AUTO_LAUNCH !== "0";
export const jobMode = (): "dryrun" | "command" | "webhook" =>
  (["command", "webhook"].includes(process.env.JOB_RUNNER_MODE || "") ? process.env.JOB_RUNNER_MODE : "dryrun") as any;

export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 1_000_000;

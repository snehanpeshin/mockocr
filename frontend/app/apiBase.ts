const PRODUCTION_API_BASE =
  "https://mo-9f59128d1e0048feab5efaaaa71df90c.ecs.us-east-1.on.aws";
const LOCAL_API_BASE = ["http:", "//localhost:8000"].join("");

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function isUnsafePublicApiBase(value: string) {
  const lower = value.toLowerCase();
  return (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("0.0.0.0") ||
    lower.includes("replace-with")
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

  if (typeof window !== "undefined" && !isLocalHost(window.location.hostname)) {
    if (!configured || isUnsafePublicApiBase(configured)) {
      return PRODUCTION_API_BASE;
    }
  }

  if (configured) {
    return trimTrailingSlash(configured);
  }

  return typeof window !== "undefined" && isLocalHost(window.location.hostname)
    ? LOCAL_API_BASE
    : PRODUCTION_API_BASE;
}

const normalizeBaseUrl = (value?: string) => {
  if (!value) return "";
  return value.trim().replace(/\/+$/, "");
};

const backendBaseUrl = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL);

export const getBackendApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (backendBaseUrl) {
    return `${backendBaseUrl}${normalizedPath}`;
  }

  return normalizedPath;
};

export const getLoginUrl = () => {
  if (typeof window === "undefined") {
    return "/login";
  }

  return new URL("/login", window.location.origin).toString();
};

const resumeAppBaseUrl = normalizeBaseUrl(import.meta.env.VITE_RESUME_APP_URL);

export const getResumeAppUrl = () => {
  if (resumeAppBaseUrl) {
    return resumeAppBaseUrl;
  }

  return "http://localhost:5174";
};

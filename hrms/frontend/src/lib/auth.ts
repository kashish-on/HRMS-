import { getBackendApiUrl } from "./backend";

export const createUserViaBackend = async (email: string, password: string) => {
  const response = await fetch(getBackendApiUrl("/api/create-user"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to create user");
  }

  return result;
};

import { getBackendApiUrl } from "./backend";

export const uploadFileToBackend = async (
  file: File,
  options?: {
    bucket?: string;
    path?: string;
    employeeId?: string;
  }
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.bucket) formData.append("bucket", options.bucket);
  if (options?.path) formData.append("path", options.path);
  if (options?.employeeId) formData.append("employeeId", options.employeeId);

  const response = await fetch(getBackendApiUrl("/api/upload"), {
    method: "POST",
    body: formData,
  });

  const text = await response.text();

  if (!text) {
    throw new Error(`Upload failed with status ${response.status} and empty response body.`);
  }

  let result: any;
  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error(`Upload failed with status ${response.status}: ${text}`);
  }

  if (!response.ok) {
    throw new Error(result.error || result.message || `Upload failed with status ${response.status}`);
  }

  return result as { publicUrl: string; bucket: string; path: string; status: string };
};

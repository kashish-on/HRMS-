import { uploadFileToBackend } from "@/lib/backendUpload";

export const validateProfilePhoto = (file: File) => {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    return "Only JPG or PNG files are allowed.";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "File size should be less than 5MB.";
  }

  return null;
};

export const uploadProfilePhoto = async (userId: string, file: File) => {
  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `profile-photos/${userId}/${Date.now()}.${fileExt}`;

  const { publicUrl } = await uploadFileToBackend(file, {
    bucket: "documents",
    path: filePath,
    employeeId: userId,
  });

  return publicUrl;
};

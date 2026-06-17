import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Monitor, UploadCloud, Eye, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadFileToBackend } from "@/lib/backendUpload";
import { useNavigate } from "react-router-dom";
import CandidateWrapper from "@/components/CandidateWrapper";

const steps = [
  "OFFER RELEASED",
  "OFFER ACCEPTED",
  "DOCUMENTS SUBMITTED",
  "HR VERIFICATION",
  "IT ASSET ASSIGNED",
  "INDUCTION COMPLETED",
  "PROBATION STARTED",
];

const saveOnboardingTaskProgress = async (
  employeeId: string,
  values: Record<string, boolean>
) => {
  const { data: existingTask, error: fetchError } = await supabase
    .from("onboarding_tasks")
    .select("id")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existingTask?.id) {
    const { error } = await supabase
      .from("onboarding_tasks")
      .update(values)
      .eq("employee_id", employeeId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("onboarding_tasks")
    .insert({
      employee_id: employeeId,
      offer_accepted: true,
      ...values,
    });

  if (error) throw error;
};

const upsertITAssetDetails = async (payload: {
  employee_id: string;
  device_name: string;
  serial_number: string;
  device_photo_url: string;
}) => {
  const { data: existingRow, error: fetchError } = await supabase
    .from("it_asset_details")
    .select("id")
    .eq("employee_id", payload.employee_id)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const detailsPayload = {
    ...payload,
    submitted_at: new Date().toISOString(),
  };

  if (existingRow?.id) {
    const { error } = await supabase
      .from("it_asset_details")
      .update(detailsPayload)
      .eq("employee_id", payload.employee_id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("it_asset_details")
    .insert(detailsPayload);

  if (error) throw error;
};

export default function ITAssetPage() {
  const currentStep = 5;
  const navigate = useNavigate();
  const [deviceName, setDeviceName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [devicePhoto, setDevicePhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const canSaveAndContinue =
    !!deviceName.trim() &&
    !!serialNumber.trim() &&
    !!devicePhoto;

  const previewUrl = useMemo(
    () => (devicePhoto ? URL.createObjectURL(devicePhoto) : ""),
    [devicePhoto]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isValidType = ["image/jpeg", "image/png"].includes(file.type);
    const isValidSize = file.size <= 2 * 1024 * 1024;

    if (!isValidType) {
      alert("Please upload a JPG or PNG file.");
      event.target.value = "";
      return;
    }

    if (!isValidSize) {
      alert("Please upload an image up to 2MB.");
      event.target.value = "";
      return;
    }

    setDevicePhoto(file);
    event.target.value = "";
  };

  const handleSaveAndContinue = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("User not authenticated");
      return;
    }

    if (!canSaveAndContinue) {
      alert("Please complete all IT asset details before continuing.");
      return;
    }

    try {
      setSaving(true);

      const filePath = `it-assets/${user.id}/${Date.now()}-${devicePhoto.name}`;
      const { publicUrl } = await uploadFileToBackend(devicePhoto, {
        bucket: "documents",
        path: filePath,
        employeeId: user.id,
      });

      await upsertITAssetDetails({
        employee_id: user.id,
        device_name: deviceName.trim(),
        serial_number: serialNumber.trim(),
        device_photo_url: publicUrl,
      });

      await saveOnboardingTaskProgress(user.id, {
        asset_assigned: true,
      });
    } catch (error: any) {
      alert(error.message || "Unable to save IT asset status.");
      return;
    } finally {
      setSaving(false);
    }

    navigate("/induction");
  };

  return (
    <CandidateWrapper>
      <div className="flex w-full">
        <div className="flex-1 p-6 space-y-6">
          <h1 className="text-2xl font-bold"></h1>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Onboarding Progress</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex items-center justify-between px-4">
                {steps.map((label, i) => {
                  const stepIndex = i + 1;

                  return (
                    <div key={i} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        {stepIndex < currentStep ? (
                          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle2 className="text-white h-5 w-5" />
                          </div>
                        ) : stepIndex === currentStep ? (
                          <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                            {stepIndex}
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold">
                            {stepIndex}
                          </div>
                        )}

                        <p className={`text-[10px] mt-2 text-center font-semibold whitespace-pre-line ${
                          stepIndex < currentStep ? "text-green-500" : "text-muted-foreground"
                        }`}>
                          {label}
                        </p>
                      </div>

                      {i !== steps.length - 1 && (
                        <div
                          className={`flex-1 h-[2px] mx-2 ${
                            stepIndex < currentStep ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Monitor className="h-4 w-4 text-primary" />
                IT Asset Details
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Device Name
                </label>
                <Input
                  placeholder="Dell"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Serial Number
                </label>
                <Input
                  placeholder="ABCDE1234"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Device Photo Upload
                </label>

                {devicePhoto ? (
                  <div className="rounded-xl border bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {devicePhoto.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(devicePhoto.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground">
                        {previewUrl ? (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded p-1 hover:bg-accent"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                        ) : null}

                        <label className="cursor-pointer rounded p-1 hover:bg-accent">
                          <Pencil className="h-4 w-4" />
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            className="hidden"
                            onChange={handlePhotoSelect}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/20">
                    <UploadCloud className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag or drop Device Photo here, or{" "}
                      <span className="font-semibold text-primary">browse files</span>
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      JPG or PNG, max 2MB
                    </p>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  disabled={saving || !canSaveAndContinue}
                  onClick={handleSaveAndContinue}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  Save & Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CandidateWrapper>
  );
}

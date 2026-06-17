import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadFileToBackend } from "@/lib/backendUpload";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadCloud, CheckCircle, Eye, Pencil } from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

import CandidateWrapper from "@/components/CandidateWrapper";

const REQUIRED_DOCUMENT_TYPES = [
  "aadhar",
  "pan",
  "bank_details",
  "education_certificate",
  "experience_letter",
  "offer_letter",
];

const REQUIRED_UPLOAD_FIELDS = [
  "document_submitted",
  "bg_verification",
  "asset_assigned",
  "education_uploaded",
  "experience_uploaded",
  "offer_uploaded",
];

const mapDocumentTypeToField = (documentType: string | null) => {
  switch (documentType) {
    case "aadhar":
      return "document_submitted";
    case "pan":
      return "bg_verification";
    case "bank_details":
      return "asset_assigned";
    case "education_certificate":
      return "education_uploaded";
    case "experience_letter":
      return "experience_uploaded";
    case "offer_letter":
      return "offer_uploaded";
    default:
      return null;
  }
};

const mapFieldToDocumentType = (fieldName: string) => {
  switch (fieldName) {
    case "document_submitted":
      return "aadhar";
    case "bg_verification":
      return "pan";
    case "asset_assigned":
      return "bank_details";
    case "education_uploaded":
      return "education_certificate";
    case "experience_uploaded":
      return "experience_letter";
    case "offer_uploaded":
      return "offer_letter";
    default:
      return fieldName;
  }
};

const normalizeEmployeeType = (value?: string | null) => {
  if (!value) return "--";

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "full" || normalizedValue === "full-time" || normalizedValue === "full time") {
    return "Full Time";
  }

  if (normalizedValue === "intern") {
    return "Intern";
  }

  return value;
};

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
    const { data, error } = await supabase
      .from("onboarding_tasks")
      .update(values)
      .eq("employee_id", employeeId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert({
      employee_id: employeeId,
      offer_accepted: true,
      ...values,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

const CandidateDashboard = () => {
  const [candidate, setCandidate] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [itAssetDetails, setItAssetDetails] = useState<any>(null);
  const [inductionDetails, setInductionDetails] = useState<any>(null);
  const [probationDetails, setProbationDetails] = useState<any>(null);
  const [bgVerification, setBgVerification] = useState({
    company_name: "",
    reference_person_name: "",
    reference_person_email: "",
    reference_person_phone: "",
  });
  const [aadharNumber, setAadharNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [documentsByType, setDocumentsByType] = useState<Record<string, any>>({});
  const [approvedDocumentTypes, setApprovedDocumentTypes] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [probationApproved, setProbationApproved] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const editDocumentType = new URLSearchParams(location.search).get("edit");
  const editField = mapDocumentTypeToField(editDocumentType);

  useEffect(() => {
    const getUserData = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const { data: candidateData } = await supabase
        .from("candidates")
        .select(`
          *,
          departments (
            name
          )
        `)
        .eq("id", user.id)
        .maybeSingle();

      const { data: taskData } = await supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("employee_id", user.id)
        .maybeSingle();

      const { data: bgData } = await supabase
        .from("bg_verification")
        .select("*")
        .eq("employee_id", user.id)
        .maybeSingle();

      const { data: allDocs } = await supabase
        .from("documents")
        .select("*")
        .eq("employee_id", user.id);

      const { data: probationData } = await supabase
        .from("probation_details")
        .select("*")
        .eq("employee_id", user.id)
        .maybeSingle();

      const { data: itAssetData } = await supabase
        .from("it_asset_details")
        .select("*")
        .eq("employee_id", user.id)
        .maybeSingle();

      const { data: inductionData } = await supabase
        .from("induction_details")
        .select("*")
        .eq("employee_id", user.id)
        .maybeSingle();

      setCandidate(candidateData);
      if (candidateData) {
        setAadharNumber(candidateData.aadhar_number || "");
        setPanNumber(candidateData.pan_number || "");
        setBankName(candidateData.bank_name || "");
        setBankBranch(candidateData.bank_branch || "");
        setBankAccountNumber(candidateData.bank_account_number || "");
        setIfscCode(candidateData.bank_ifsc || "");
      }
      const hasAllDocuments = REQUIRED_DOCUMENT_TYPES.every((doc) =>
        (allDocs || []).some((item: any) => item.document_type === doc)
      );

      if (taskData?.document_submitted !== hasAllDocuments) {
        const { data: syncedTasks } = await supabase
          .from("onboarding_tasks")
          .update({
            document_submitted: hasAllDocuments,
            updated_at: new Date().toISOString(),
          })
          .eq("employee_id", user.id)
          .select("*")
          .single();

        setTasks(syncedTasks || { ...taskData, document_submitted: hasAllDocuments });
      } else {
        setTasks(taskData);
      }

      const documentsMap = (allDocs || []).reduce((acc: Record<string, any>, doc: any) => {
        acc[doc.document_type] = doc;
        return acc;
      }, {});

      setDocumentsByType(documentsMap);
      setApprovedDocumentTypes(
        (allDocs || [])
          .filter((d: any) => d.status === "approved")
          .map((d: any) => d.document_type)
      );
      setProbationApproved(
        ["approved", "completed"].includes(probationData?.status?.toLowerCase?.() || "")
      );
      setProbationDetails(probationData);
      setItAssetDetails(itAssetData);
      setInductionDetails(inductionData);

      if (bgData) {
        setBgVerification({
          company_name: bgData.company_name || "",
          reference_person_name: bgData.reference_person_name || "",
          reference_person_email: bgData.reference_person_email || "",
          reference_person_phone: bgData.reference_person_phone || "",
        });
      }
    };

    getUserData();
  }, []);

  const localOrSavedDocsUploaded = REQUIRED_UPLOAD_FIELDS.every((field) => {
    const documentType = mapFieldToDocumentType(field);
    return !!selectedFiles[field] || !!documentsByType[documentType];
  });

  const allBgFieldsFilled =
    !!bgVerification.company_name &&
    !!bgVerification.reference_person_name &&
    !!bgVerification.reference_person_email &&
    !!bgVerification.reference_person_phone;

  const hasSubmittedForHrVerification =
    REQUIRED_DOCUMENT_TYPES.every((doc) => !!documentsByType[doc]) && allBgFieldsFilled;
  const documentsSubmitted =
    tasks?.document_submitted === true || hasSubmittedForHrVerification;

  const allDocumentsApproved = REQUIRED_DOCUMENT_TYPES.every((doc) =>
    approvedDocumentTypes.includes(doc)
  );
  const candidateName = candidate?.name?.trim() || "";
  const candidateInitials = candidateName
    ? candidateName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() || "")
        .join("")
    : "--";
  const candidateDepartment =
    candidate?.departments?.name ||
    candidate?.department_name ||
    candidate?.department ||
    "--";
  const candidateJoiningDate =
    candidate?.joining_date ||
    candidate?.join_date ||
    "--";
  const candidateType = normalizeEmployeeType(
    candidate?.type || candidate?.employment_type || ""
  );
  const hasHrVerificationCompleted = tasks?.hr_verification === true || allDocumentsApproved;
  const hasItAssetStepCompleted =
    tasks?.asset_assigned === true ||
    !!itAssetDetails?.id;
  const hasInductionStepCompleted =
    !!inductionDetails &&
    [
      inductionDetails.hr_orientation,
      inductionDetails.team_introduction,
      inductionDetails.system_setup,
      inductionDetails.policy_training,
      inductionDetails.security_briefing,
      inductionDetails.manager_connect,
    ].some(Boolean);
  const hasProbationStepStarted =
    !!probationDetails?.id ||
    ["active", "approved", "completed"].includes(
      probationDetails?.status?.toLowerCase?.() || ""
    );

  useEffect(() => {
    if (!tasks) return;

    if (hasProbationStepStarted) {
      navigate("/probation");
      return;
    }

    if (hasInductionStepCompleted) {
      navigate("/probation");
      return;
    }

    if (hasItAssetStepCompleted) {
      navigate("/induction");
      return;
    }

    if (hasHrVerificationCompleted) {
      navigate("/it-asset");
      return;
    }

    if (documentsSubmitted) {
      navigate("/hr-verification");
      return;
    }
  }, [
    documentsSubmitted,
    hasHrVerificationCompleted,
    hasInductionStepCompleted,
    hasItAssetStepCompleted,
    hasProbationStepStarted,
    navigate,
    tasks,
  ]);

  const handleBgVerificationChange = (field: string, value: string) => {
    setBgVerification((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitToHrVerification = async () => {
    if (!localOrSavedDocsUploaded || !allBgFieldsFilled || savingProgress) return;

    try {
      setSavingProgress(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        alert("User not authenticated");
        return;
      }

      const employeeId = user.id;
      const updatedDocumentsMap = { ...documentsByType };

      for (const field of REQUIRED_UPLOAD_FIELDS) {
        const file = selectedFiles[field];
        if (!file) continue;

        const filePath = `${employeeId}/${Date.now()}-${file.name}`;
        const { publicUrl } = await uploadFileToBackend(file, {
          bucket: "documents",
          path: filePath,
          employeeId,
        });

        const fileUrl = publicUrl;
        const documentType = mapFieldToDocumentType(field);
        const existingDocument = documentsByType[documentType];

        const now = new Date().toISOString();
        const documentPayload = {
          employee_id: employeeId,
          document_type: documentType,
          file_url: fileUrl,
          uploaded_at: now,
          updated_at: now,
          status: "pending",
          reason: null,
          verified_by: null,
        };

        if (existingDocument?.id) {
          const { error: updateDocumentError } = await supabase
            .from("documents")
            .update(documentPayload)
            .eq("id", existingDocument.id);

          if (updateDocumentError) throw updateDocumentError;
        } else {
          const { error: insertDocumentError } = await supabase
            .from("documents")
            .insert([documentPayload]);

          if (insertDocumentError) throw insertDocumentError;
        }

        updatedDocumentsMap[documentType] = {
          ...(existingDocument || {}),
          ...documentPayload,
        };
      }

      const { data: existingBgVerification, error: bgFetchError } = await supabase
        .from("bg_verification")
        .select("id")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (bgFetchError) throw bgFetchError;

      const candidatePayload: Record<string, any> = {
        aadhar_number: aadharNumber || null,
        pan_number: panNumber || null,
        bank_name: bankName || null,
        bank_branch: bankBranch || null,
        bank_account_number: bankAccountNumber || null,
        bank_ifsc: ifscCode || null,
      };

      const { error: candidateUpdateError } = await supabase
        .from("candidates")
        .update(candidatePayload)
        .eq("id", employeeId);

      if (candidateUpdateError) throw candidateUpdateError;
      setCandidate((prev: any) => ({
        ...prev,
        ...candidatePayload,
      }));

      if (existingBgVerification?.id) {
        const { error: bgUpdateError } = await supabase
          .from("bg_verification")
          .update(bgVerification)
          .eq("employee_id", employeeId);

        if (bgUpdateError) throw bgUpdateError;
      } else {
        const { error: bgInsertError } = await supabase.from("bg_verification").insert({
          employee_id: employeeId,
          ...bgVerification,
        });

        if (bgInsertError) throw bgInsertError;
      }

      setDocumentsByType(updatedDocumentsMap);
      setApprovedDocumentTypes(
        Object.values(updatedDocumentsMap)
          .filter((doc: any) => doc?.status === "approved")
          .map((doc: any) => doc.document_type)
      );
      const updatedTasks = await saveOnboardingTaskProgress(employeeId, {
        document_submitted: true,
      });
      setTasks((prev: any) => ({
        ...prev,
        ...updatedTasks,
      }));
      setSelectedFiles({});
      navigate("/hr-verification");
    } catch (error: any) {
      console.error("Error saving onboarding details:", error);
      alert(error.message || "Failed to save details.");
    } finally {
      setSavingProgress(false);
    }
  };

  const steps = [
    { label: "Offer Released", done: true },
    { label: "Offer Accepted", done: true },
    { label: "Documents Submitted", done: documentsSubmitted || (localOrSavedDocsUploaded && allBgFieldsFilled) },
    { label: "HR Verification", done: allDocumentsApproved },
    { label: "IT Asset Assigned", done: tasks?.asset_assigned || false },
    { label: "Induction Completed", done: tasks?.induction || false },
    { label: "Probation Started", done: probationApproved },
  ];

  const currentStep = steps.findIndex((s) => !s.done);

  if (!candidate || !tasks) return <div className="p-6">Loading...</div>;

  return (
    <CandidateWrapper>
      <div className="flex w-full">
        <div className="flex-1 p-6 space-y-6">
          <h1 className="text-2xl font-bold">Candidate Detail</h1>

          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarImage
                    src={
                      candidate?.photo_url?.startsWith("http")
                        ? candidate.photo_url
                        : undefined
                    }
                  />
                  <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">
                    {candidateInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">
                      {candidate?.name || "Candidate"}
                    </h2>
                    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      {allDocumentsApproved ? "Verified" : "In Progress"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[candidate?.designation, candidate?.emp_id].filter(Boolean).join(" - ") || "--"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Dept: <span className="font-medium text-foreground">{candidateDepartment}</span>
                    <span className="mx-2">Joined:</span>
                    <span className="font-medium text-foreground">{candidateJoiningDate}</span>
                    <span className="mx-2">Type:</span>
                    <span className="font-medium text-foreground">{candidateType}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Onboarding Progress</CardTitle>
            </CardHeader>

            <CardContent className="flex items-center justify-between">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center w-full">
                  <div className="flex flex-col items-center text-center w-24">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        step.done
                          ? "bg-green-500 text-white"
                          : i === currentStep
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {step.done ? <CheckCircle size={16} /> : i + 1}
                    </div>

                    <p className={`mt-2 text-[10px] ${step.done ? "text-green-500" : "text-muted-foreground"}`}>
                      {step.label}
                    </p>
                  </div>

                  {i !== steps.length - 1 && (
                    <div className={`flex-1 h-[2px] ${step.done ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Identity Verification</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Aadhar Card Number</p>
                <Input
                  placeholder="1234-5678-9012"
                  value={aadharNumber}
                  onChange={(e) => setAadharNumber(e.target.value)}
                />
              </div>

              <UploadArea
                label="Aadhar Card Upload"
                field="document_submitted"
                documentsByType={documentsByType}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                isHighlighted={editField === "document_submitted"}
              />

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">PAN Card Number</p>
                <Input
                  placeholder="ABCDE1234SF"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                />
              </div>

              <UploadArea
                label="PAN Card Upload"
                field="bg_verification"
                documentsByType={documentsByType}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                isHighlighted={editField === "bg_verification"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Banking Details</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Bank Name</p>
                <Input
                  placeholder="State Bank of India"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Branch</p>
                <Input
                  placeholder="New Delhi"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Account Number</p>
                <Input
                  placeholder="1234-5678-9012"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">IFSC Code</p>
                <Input
                  placeholder="ABCDE12345F"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                />
              </div>

              <UploadArea
                label="Cancelled Cheque Upload"
                field="asset_assigned"
                documentsByType={documentsByType}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                isHighlighted={editField === "asset_assigned"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Professional Documents</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <UploadArea
                label="Education Certificate"
                field="education_uploaded"
                documentsByType={documentsByType}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                isHighlighted={editField === "education_uploaded"}
              />
              <UploadArea
                label="Experience Letter"
                field="experience_uploaded"
                documentsByType={documentsByType}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                isHighlighted={editField === "experience_uploaded"}
              />
              <UploadArea
                label="Signed Offer Letter"
                field="offer_uploaded"
                documentsByType={documentsByType}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                isHighlighted={editField === "offer_uploaded"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Background Verification</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <p className="text-sm mb-1">Last Company Name</p>
                <Input
                  placeholder="Enter last company name"
                  value={bgVerification.company_name}
                  onChange={(e) => handleBgVerificationChange("company_name", e.target.value)}
                />
              </div>

              <div>
                <p className="text-sm mb-1">Employee Name (Reference)</p>
                <Input
                  placeholder="Enter employee name"
                  value={bgVerification.reference_person_name}
                  onChange={(e) => handleBgVerificationChange("reference_person_name", e.target.value)}
                />
              </div>

              <div>
                <p className="text-sm mb-1">Email</p>
                <Input
                  placeholder="Enter email"
                  type="email"
                  value={bgVerification.reference_person_email}
                  onChange={(e) => handleBgVerificationChange("reference_person_email", e.target.value)}
                />
              </div>

              <div>
                <p className="text-sm mb-1">Phone Number</p>
                <Input
                  placeholder="Enter phone number"
                  value={bgVerification.reference_person_phone}
                  onChange={(e) => handleBgVerificationChange("reference_person_phone", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button
              disabled={!localOrSavedDocsUploaded || !allBgFieldsFilled || savingProgress}
              onClick={handleSubmitToHrVerification}
              className="bg-purple-600 text-white"
            >
              {savingProgress ? "Saving..." : "Submit & Continue to HR Verification"}
            </Button>
          </div>
        </div>
      </div>
    </CandidateWrapper>
  );
};

export default CandidateDashboard;

const UploadArea = ({
  field,
  documentsByType,
  selectedFiles,
  setSelectedFiles,
  label,
  isHighlighted = false,
}: any) => {
  const documentType = mapFieldToDocumentType(field);
  const existingDocument = documentsByType?.[documentType];
  const selectedFile = selectedFiles?.[field];
  const fileUrl = existingDocument?.file_url || "";
  const fileName = selectedFile?.name || (fileUrl ? decodeURIComponent(fileUrl.split("/").pop()) : "");
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : fileUrl),
    [fileUrl, selectedFile]
  );

  useEffect(() => {
    return () => {
      if (selectedFile && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  const saveSelectedFile = (file: File) => {
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      alert("Only PDF files are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File must be less than 5MB.");
      return;
    }

    setSelectedFiles((prev: any) => ({
      ...prev,
      [field]: file,
    }));
  };

  const handleUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    saveSelectedFile(file);
  };

  return (
    <div
      className={`space-y-3 rounded-xl transition-colors ${
        isHighlighted ? "border border-red-200 bg-red-50/60 px-4 py-4" : "px-4 py-4"
      }`}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) {
          saveSelectedFile(file);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
    >
      <p className="text-sm font-medium">{label}</p>
      {isHighlighted && (
        <p className="text-xs font-medium text-red-600">
          This document was rejected by HR. Please re-upload the corrected file.
        </p>
      )}

      {fileName ? (
        <div className="flex items-center justify-between border rounded-lg p-3 bg-white">
          <p className="text-sm">{fileName}</p>

          <div className="flex gap-3">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Eye size={16} />
            </a>

            <button type="button" className="relative cursor-pointer text-purple-600">
              <Pencil size={16} />
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleUpload}
              />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative border border-dashed rounded-lg p-6 text-center bg-white">
          <UploadCloud className="mx-auto h-6 w-6 mb-2 text-muted-foreground" />

          <p className="text-sm text-muted-foreground">
            Drag or drop {label.replace(" Upload", "")} here, or <span className="font-medium text-primary">browse files</span>
          </p>

          <p className="text-[10px] text-muted-foreground mt-1">PDF only, max 5MB</p>

          <input
            type="file"
            accept="application/pdf,.pdf"
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            onChange={handleUpload}
          />
        </div>
      )}
    </div>
  );
};

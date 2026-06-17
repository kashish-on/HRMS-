import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CandidateWrapper from "@/components/CandidateWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Eye,
  Pencil,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadFileToBackend } from "@/lib/backendUpload";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const HR_VERIFIER_NAME = "HR";
const REQUIRED_DOCUMENT_TYPES = [
  "aadhar",
  "pan",
  "bank_details",
  "education_certificate",
  "experience_letter",
  "offer_letter",
];

const mapDocumentTypeToLabel = (documentType: string) => {
  switch (documentType) {
    case "aadhar":
      return "Aadhar Card";
    case "pan":
      return "PAN Card";
    case "bank_details":
      return "Bank Details";
    case "education_certificate":
      return "Education Certificate";
    case "experience_letter":
      return "Experience Letter";
    case "offer_letter":
      return "Offer Letter Signed";
    default:
      return documentType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Approved":
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
          Approved
        </span>
      );
    case "Pending":
      return (
        <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
          Pending
        </span>
      );
    case "Rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
          Rejected <AlertTriangle className="h-3 w-3" />
        </span>
      );
    default:
      return null;
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

const HrVerification = () => {
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [documentsState, setDocumentsState] = useState<any[]>([]);
  const [probationApproved, setProbationApproved] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let mounted = true;
    let employeeId: string | null = null;

    const fetchData = async () => {
      setIsLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (mounted) {
          setCandidate(null);
          setTasks(null);
          setDocumentsState([]);
          setIsLoading(false);
        }
        return;
      }
      employeeId = user.id;

      const { data: candidateData } = await supabase
        .from("candidates")
        .select(`
          *,
          departments (
            name
          )
        `)
        .eq("id", user.id)
        .single();

      const { data: tasksData } = await supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("employee_id", user.id)
        .single();

      const { data: docsData } = await supabase
        .from("documents")
        .select("*")
        .eq("employee_id", user.id);

      const { data: probationData } = await supabase
        .from("probation_details")
        .select("status")
        .eq("employee_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setCandidate(candidateData);
      setTasks(tasksData);
      setDocumentsState(docsData || []);
      setProbationApproved(
        ["approved", "completed"].includes(probationData?.status?.toLowerCase?.() || "")
      );
      setIsLoading(false);
    };

    fetchData();

    const channel = supabase.auth.onAuthStateChange((_event, session) => {
      employeeId = session?.user?.id || null;
    });

    const documentsChannel = supabase
      .channel("candidate-hr-verification-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        (payload) => {
          const rowEmployeeId =
            (payload.new as any)?.employee_id || (payload.old as any)?.employee_id;
          if (employeeId && rowEmployeeId === employeeId) {
            fetchData();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_tasks" },
        (payload) => {
          const rowEmployeeId =
            (payload.new as any)?.employee_id || (payload.old as any)?.employee_id;
          if (employeeId && rowEmployeeId === employeeId) {
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      channel.data.subscription.unsubscribe();
      supabase.removeChannel(documentsChannel);
    };
  }, [navigate]);

  const approvedCount = documentsState.filter((d) => d.status === "approved").length;
  const submittedDocumentTypes = documentsState.map((d) => d.document_type);
  const allDocumentsSubmitted = REQUIRED_DOCUMENT_TYPES.every((doc) =>
    submittedDocumentTypes.includes(doc)
  );
  const allDocumentsApproved =
    documentsState.length > 0 && approvedCount === documentsState.length;

  // Check if current date is joining date or joining date + 1 day
  const isValidJoiningDate = (() => {
    if (!candidate?.joining_date && !candidate?.join_date) return false;

    const joiningDateStr = candidate.joining_date || candidate.join_date;
    if (!joiningDateStr) return false;

    try {
      const joiningDate = new Date(joiningDateStr);
      const today = new Date();

      // Reset time to compare dates only
      const joiningDateOnly = new Date(joiningDate.getFullYear(), joiningDate.getMonth(), joiningDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const nextDayAfterJoining = new Date(joiningDateOnly);
      nextDayAfterJoining.setDate(nextDayAfterJoining.getDate() + 1);

      return todayOnly.getTime() === joiningDateOnly.getTime() || todayOnly.getTime() === nextDayAfterJoining.getTime();
    } catch (error) {
      console.error("Error parsing joining date:", error);
      return false;
    }
  })();

  const canContinueToITAsset = allDocumentsApproved && isValidJoiningDate;
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

  const handleContinueToITAsset = async () => {
    if (!candidate?.id || !canContinueToITAsset) return;

    try {
      const updatedTasks = await saveOnboardingTaskProgress(candidate.id, {
        hr_verification: true,
      });
      setTasks(updatedTasks);
      navigate("/it-asset");
    } catch (_error) {
      alert("Unable to continue to IT Asset.");
    }
  };

  const handleRejectedDocumentUpload = async (doc: any, event: any) => {
    const file = event.target.files?.[0];
    if (!file || !doc?.id) return;

    const employeeId = doc.employee_id || candidate?.id;
    if (!employeeId) {
      alert("Unable to identify the candidate for this upload.");
      return;
    }

    setUploadingDocId(doc.id);

    try {
        const filePath = `${employeeId}/${Date.now()}-${file.name}`;

      const { publicUrl } = await uploadFileToBackend(file, {
        bucket: "documents",
        path: filePath,
        employeeId,
      });

      const fileUrl = publicUrl;
      const uploadedAt = new Date().toISOString();

      console.log("Document upload successful:", { filePath, fileUrl });

      const { error: documentUpdateError } = await supabase
        .from("documents")
        .update({
          file_url: fileUrl,
          uploaded_at: uploadedAt,
          updated_at: new Date().toISOString(),
          status: "pending",
          reason: null,
          verified_by: null,
        })
        .eq("id", doc.id);

      if (documentUpdateError) {
        throw documentUpdateError;
      }

      setDocumentsState((prev) =>
        prev.map((item) =>
          item.id === doc.id
            ? {
                ...item,
                file_url: fileUrl,
                uploaded_at: uploadedAt,
                status: "pending",
                reason: null,
                verified_by: null,
              }
            : item
        )
      );
    } catch (error: any) {
      console.error("Error re-uploading document:", error);
      alert(error.message || "Failed to re-upload document.");
    } finally {
      setUploadingDocId(null);
      event.target.value = "";
    }
  };

  const onboardingSteps = [
    { label: "OFFER\nRELEASED", done: true, step: 1 },
    { label: "OFFER\nACCEPTED", done: true, step: 2 },
    { label: "DOCUMENTS\nSUBMITTED", done: allDocumentsSubmitted, step: 3 },
    { label: "HR\nVERIFICATION", done: allDocumentsApproved, step: 4 },
    { label: "IT ASSET\nASSIGNED", done: !!tasks?.asset_assigned, step: 5 },
    { label: "INDUCTION\nCOMPLETED", done: !!tasks?.induction, step: 6 },
    { label: "PROBATION\nSTARTED", done: probationApproved, step: 7 },
  ];

  const currentStep = onboardingSteps.findIndex((step) => !step.done);

  return (
    <CandidateWrapper>
     <div className="flex w-full">

    
    <div className="flex-1 p-6 space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-foreground">Candidate Detail</h1>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading verification details...
          </CardContent>
        </Card>
      ) : (
        <>
      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage
                src={
                  candidate?.photo_url?.startsWith("http")
                    ? candidate.photo_url
                    : undefined
                }
              />
              <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">{candidateInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-foreground">{candidate?.name || "Candidate"}</h2>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                  {allDocumentsApproved ? "Verified" : "In Progress"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {[candidate?.designation, candidate?.emp_id].filter(Boolean).join(" - ") || "--"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Dept: <span className="text-foreground font-medium">{candidateDepartment}</span>
                <span className="mx-2">Joined:</span>
                <span className="text-foreground font-medium">{candidateJoiningDate}</span>
                <span className="mx-2">Type:</span>
                <span className="text-foreground font-medium">{candidateType}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Progress */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="flex items-center justify-between px-4">
            {onboardingSteps.map((step, index) => (
              <div key={index} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  {step.done ? (
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-white" />
                    </div>
                  ) : index === currentStep ? (
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-sm">{step.step}</span>
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground font-bold text-sm">{step.step}</span>
                    </div>
                  )}
                  <span className={`text-[10px] font-semibold uppercase text-center mt-2 leading-tight tracking-wider whitespace-pre-line ${
                    step.done ? "text-green-500" : "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < onboardingSteps.length - 1 && (
                  <div className="flex-1 mx-2">
                    <div
                      className={`h-0.5 w-full ${
                        step.done ? "bg-green-500" : "bg-muted"
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents Verification */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Documents Verification</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">
              {approvedCount} of {documentsState.length} Verified
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Document Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Verified By</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Uploaded Date</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentsState.map((doc, index) => {
                const statusLabel =
                  doc.status === "approved"
                    ? "Approved"
                    : doc.status === "rejected"
                    ? "Rejected"
                    : "Pending";

                return (
                  <TableRow key={index}>
                    <TableCell className="text-sm font-medium text-center">{mapDocumentTypeToLabel(doc.document_type || "")}</TableCell>
                    <TableCell className="text-center">
                      {doc.status === "rejected" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex cursor-help">
                                {getStatusBadge(statusLabel)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="relative max-w-sm rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-lg"
                            >
                              <p className="text-base leading-snug">
                                <span className="font-medium text-red-500">Document Rejected: </span>
                                <span className="font-semibold text-neutral-900">
                                  "{doc.reason || "The document was rejected by HR."}"
                                </span>
                              </p>
                              <span className="absolute left-1/2 top-full h-4 w-4 -translate-x-1/2 -translate-y-2 rotate-45 border-b border-r border-neutral-200 bg-white" />
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        getStatusBadge(statusLabel)
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">{doc.status === "pending" ? "" : HR_VERIFIER_NAME}</TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ""}</TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <div className="flex items-center justify-center gap-4">

                          {/* VIEW */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!doc.file_url) return;

                                  const newWindow = window.open("about:blank", "_blank");
                                  if (!newWindow) {
                                    alert("Unable to open document. Please allow popups for this site.");
                                    return;
                                  }

                                  try {
                                    const response = await fetch(doc.file_url);
                                    if (!response.ok) {
                                      throw new Error(`Unable to fetch document: ${response.status}`);
                                    }
                                    const blob = await response.blob();
                                    const pdfUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
                                    newWindow.location.href = pdfUrl;
                                  } catch (error) {
                                    console.error("Error opening document:", error);
                                    newWindow.close();
                                    alert("Unable to open document. Please try again.");
                                  }
                                }}
                                disabled={!doc.file_url}
                                className={`rounded p-1 transition-colors ${
                                  doc.file_url
                                    ? "text-neutral-900 hover:bg-neutral-100"
                                    : "cursor-not-allowed text-neutral-400"
                                }`}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{doc.file_url ? "View" : "Document not available"}</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => doc.status === "rejected" && fileInputRefs.current[doc.id]?.click()}
                                disabled={doc.status !== "rejected" || uploadingDocId === doc.id}
                                className={`rounded p-1 transition-colors ${
                                  doc.status === "rejected"
                                    ? "text-neutral-900 hover:bg-neutral-100"
                                    : "cursor-not-allowed text-neutral-400"
                                }`}

        >
          <Pencil className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {doc.status === "rejected"
            ? uploadingDocId === doc.id
              ? "Edit"
              : "Edit"
            : "Available only for rejected documents"}
        </p>
      </TooltipContent>
    </Tooltip>

    <input
      ref={(element) => {
        fileInputRefs.current[doc.id] = element;
      }}
      type="file"
      className="hidden"
      onChange={(event) => handleRejectedDocumentUpload(doc, event)}
    />

  </div>
</TooltipProvider>

                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                disabled={!canContinueToITAsset}
                onClick={handleContinueToITAsset}
                className="bg-purple-600 text-white disabled:bg-gray-300 disabled:text-gray-500"
              >
                Continue to IT Asset
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {!allDocumentsApproved
                  ? "All documents must be approved before continuing"
                  : !isValidJoiningDate
                  ? "This action is only available on the joining date or the day after"
                  : "Continue to IT Asset assignment"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
        </>
      )}
    </div>
     </div>
     </CandidateWrapper>
  );
};

export default HrVerification;

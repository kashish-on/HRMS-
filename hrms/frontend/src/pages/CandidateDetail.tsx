import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Building2,
  ShieldCheck,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Monitor,
  ClipboardList,
  CalendarDays,
  Clock3,
  CircleDotDashed,
  UserRoundCheck,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { supabase } from "@/lib/supabase";

const HR_VERIFIER_NAME = "HR";

type DocumentType = {
  id: string;
  documentType: string;
  name: string;
  status: "Approved" | "Pending" | "Rejected";
  verifiedBy: string;
  date: string;
  reason?: string;
  fileUrl?: string;
};

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

const getStatusBadge = (status: "Approved" | "Pending" | "Rejected") => {
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

const CandidateDetail = () => {

  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<any>(null);
  const [documentsState, setDocumentsState] = useState<DocumentType[]>([]);
  const [bgVerificationData, setBgVerificationData] = useState<any>(null);
  const [itAssetDetails, setItAssetDetails] = useState<any>(null);
  const [inductionDetails, setInductionDetails] = useState<any>(null);
  const [probationDetails, setProbationDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [rejectModal, setRejectModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bgVerificationStatus, setBgVerificationStatus] = useState<"pending" | "complete">("pending");

  const saveBgVerificationStatus = async (nextStatus: "pending" | "complete") => {
    if (!id) return;

    const previousStatus = bgVerificationStatus;
    setBgVerificationStatus(nextStatus);

    const { data: existingTask, error: fetchError } = await supabase
      .from("onboarding_tasks")
      .select("id")
      .eq("employee_id", id)
      .maybeSingle();

    if (fetchError) {
      setBgVerificationStatus(previousStatus);
      alert("Unable to load onboarding status: " + fetchError.message);
      return;
    }

    const payload = {
      bg_verification: nextStatus === "complete",
    };

    if (existingTask?.id) {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update(payload)
        .eq("employee_id", id);

      if (error) {
        setBgVerificationStatus(previousStatus);
        alert("Unable to save background verification status: " + error.message);
      }

      return;
    }

    const { error } = await supabase
      .from("onboarding_tasks")
      .insert({
        employee_id: id,
        offer_accepted: true,
        ...payload,
      });

    if (error) {
      setBgVerificationStatus(previousStatus);
      alert("Unable to save background verification status: " + error.message);
    }
  };

  /* ✅ FETCH DATA FROM SUPABASE */
  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      /* EMPLOYEE */
      const { data: empData, error: empError } = await supabase
        .from("candidates")
        .select(`
          *,
          departments (
            name
          )
        `)
        .eq("id", id)
        .single();

      if (!empError) setEmployee(empData);

      /* DOCUMENTS */
      const { data: docs, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("employee_id", id);

      if (!docError) {
        const formattedDocs: DocumentType[] = (docs || []).map((d: any) => ({
          id: d.id,
          documentType: d.document_type || "",
          name: mapDocumentTypeToLabel(d.document_type || ""),
          status:
            d.status === "approved"
              ? "Approved"
              : d.status === "rejected"
              ? "Rejected"
              : "Pending",
          verifiedBy: d.status === "pending" ? "" : HR_VERIFIER_NAME,
          date: d.uploaded_at
            ? new Date(d.uploaded_at).toLocaleDateString()
            : "",
          reason: d.reason || "",
          fileUrl: d.file_url || "",
        }));

        setDocumentsState(formattedDocs);
      }

      /* BACKGROUND VERIFICATION */
      const { data: bgData } = await supabase
        .from("bg_verification")
        .select("*")
        .eq("employee_id", id)
        .maybeSingle();

      if (bgData) {
        setBgVerificationData(bgData);
      }

      const { data: onboardingTaskData } = await supabase
        .from("onboarding_tasks")
        .select("bg_verification")
        .eq("employee_id", id)
        .maybeSingle();

      setBgVerificationStatus(onboardingTaskData?.bg_verification ? "complete" : "pending");

      const { data: itAssetData } = await supabase
        .from("it_asset_details")
        .select("*")
        .eq("employee_id", id)
        .maybeSingle();

      if (itAssetData) {
        setItAssetDetails(itAssetData);
      }

      const { data: inductionData } = await supabase
        .from("induction_details")
        .select("*")
        .eq("employee_id", id)
        .maybeSingle();

      if (inductionData) {
        setInductionDetails(inductionData);
      }

      const { data: probationData } = await supabase
        .from("probation_details")
        .select("*")
        .eq("employee_id", id)
        .maybeSingle();

      if (probationData) {
        setProbationDetails(probationData);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [id]);

  const saveDocumentStatus = async (
    index: number,
    status: "Approved" | "Pending" | "Rejected",
    reason = ""
  ) => {
    const targetDoc = documentsState[index];
    if (!targetDoc?.id) return;

    const previousDocs = [...documentsState];
    const nextStatus = status;

    const updatedDocs = documentsState.map((doc, docIndex) =>
      docIndex === index
        ? {
            ...doc,
            status: nextStatus,
            reason: nextStatus === "Rejected" ? reason : "",
            verifiedBy: HR_VERIFIER_NAME,
          }
        : doc
    );

    setDocumentsState(updatedDocs);

    const { error } = await supabase
      .from("documents")
      .update({
        status: nextStatus.toLowerCase(),
        reason: nextStatus === "Rejected" ? reason : null,
        verified_by: HR_VERIFIER_NAME,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetDoc.id);

    if (error) {
      console.error("Error updating document status:", error);
      setDocumentsState(previousDocs);
      alert("Unable to save document status: " + error.message);
    }
  };

  const handleStatusChange = async (
    index: number,
    status: "Approved" | "Pending" | "Rejected"
  ) => {
    const currentStatus = documentsState[index]?.status;
    const nextStatus = currentStatus === status ? "Pending" : status;
    await saveDocumentStatus(index, nextStatus);
  };

  // const approvedCount = documents.filter((d) => d.status === "Approved").length;
  const approvedCount = documentsState.filter(
  (d) => d.status === "Approved"
).length;

const handleRejectSubmit = async () => {
  if (selectedIndex === null) return;
  if (!rejectReason.trim()) {
    alert("Please provide a rejection reason.");
    return;
  }

  await saveDocumentStatus(selectedIndex, "Rejected", rejectReason.trim());

  // reset modal
  setRejectModal(false);
  setRejectReason("");
  setSelectedIndex(null);
};

const handleMarkAsCompleted = async () => {
  if (!canMarkAsCompleted) {
    alert("This can be marked complete only after the candidate has finished all onboarding steps.");
    return;
  }

  try {
      const { error } = await supabase
        .from("probation_details")
        .update({ status: "Approved" })
        .eq("employee_id", id);

    if (error) {
      alert("Unable to update probation approval status: " + error.message);
      return;
    }

    setProbationDetails((prev: any) =>
      prev
        ? {
            ...prev,
            status: "Approved",
          }
        : prev
    );

    alert("Candidate onboarding has been marked complete.");
    navigate("/dashboard");
  } catch (err) {
    console.error("Error:", err);
    alert("Failed to update completion status");
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

const employeeName = employee?.name?.trim() || "";
const employeeInitials = employeeName
  ? employeeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() || "")
      .join("")
  : "--";
const employeeDepartment =
  employee?.departments?.name ||
  employee?.department_name ||
  employee?.department ||
  "--";
const employeeJoiningDate =
  employee?.joining_date ||
  employee?.join_date ||
  "--";
const employeeType = normalizeEmployeeType(
  employee?.type || employee?.employment_type || ""
);
const backgroundCompanyName = bgVerificationData?.company_name?.trim() || "--";
const backgroundReferenceName = bgVerificationData?.reference_person_name?.trim() || "--";
const backgroundReferenceEmail = bgVerificationData?.reference_person_email?.trim() || "--";
const backgroundReferencePhone = bgVerificationData?.reference_person_phone?.trim() || "--";
const hasItAssetDetails = !!itAssetDetails;
const hasInductionDetails =
  !!inductionDetails &&
  [
    inductionDetails.hr_orientation,
    inductionDetails.team_introduction,
    inductionDetails.system_setup,
    inductionDetails.policy_training,
    inductionDetails.security_briefing,
    inductionDetails.manager_connect,
  ].some(Boolean);
const hasProbationDetails = !!probationDetails;
const hrStepCompleted = documentsState.length > 0 && documentsState.every((doc) => doc.status === "Approved");
const probationApproved = ["approved", "completed"].includes(
  probationDetails?.status?.toLowerCase?.() || ""
);
const canMarkAsCompleted =
  hrStepCompleted &&
  hasItAssetDetails &&
  hasInductionDetails &&
  hasProbationDetails &&
  !probationApproved;
const detailOnboardingSteps = [
  { label: "OFFER\nRELEASED", step: 1, completed: true },
  { label: "OFFER\nACCEPTED", step: 2, completed: true },
  { label: "DOCUMENTS\nSUBMITTED", step: 3, completed: documentsState.length > 0 },
  { label: "HR\nVERIFICATION", step: 4, completed: hrStepCompleted },
  { label: "IT ASSET\nASSIGNED", step: 5, completed: hasItAssetDetails },
  { label: "INDUCTION\nCOMPLETED", step: 6, completed: hasInductionDetails },
  { label: "PROBATION\nSTARTED", step: 7, completed: probationApproved || hasProbationDetails },
];
const currentOnboardingStep =
  detailOnboardingSteps.findIndex((step) => !step.completed) === -1
    ? detailOnboardingSteps.length - 1
    : detailOnboardingSteps.findIndex((step) => !step.completed);
const inductionItems = hasInductionDetails
  ? [
      { label: "HR Orientation", value: inductionDetails.hr_orientation ? "Yes" : "No" },
      { label: "Team Introduction", value: inductionDetails.team_introduction ? "Yes" : "No" },
      { label: "System Setup", value: inductionDetails.system_setup ? "Yes" : "No" },
      { label: "Policy Training", value: inductionDetails.policy_training ? "Yes" : "No" },
      { label: "Security Briefing", value: inductionDetails.security_briefing ? "Yes" : "No" },
      { label: "Manager Connect", value: inductionDetails.manager_connect ? "Yes" : "No" },
    ]
  : [];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-foreground">Employee Detail</h1>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading candidate details...
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
                  employee?.photo_url?.startsWith("http")
                    ? employee.photo_url
                    : undefined
                }
              />
              <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">{employeeInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-foreground">
                  {employee?.name || "Candidate"}
                </h2>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                  In Progress
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {[employee?.designation, employee?.emp_id].filter(Boolean).join(" - ") || "--"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Dept: <span className="text-foreground font-medium">{employeeDepartment}</span>
                <span className="mx-2">Joined:</span>
                <span className="text-foreground font-medium">{employeeJoiningDate}</span>
                <span className="mx-2">Type:</span>
                <span className="text-foreground font-medium">{employeeType}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => navigate(`/dashboard/employee/${id}/edit`)}
              >
                Edit Profile
              </Button>
              <Button size="sm" className="text-xs bg-primary text-primary-foreground">
                Send Reminder
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Candidate Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
              <p className="text-sm font-medium text-foreground">{employee?.phone || "--"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Address</p>
              <p className="text-sm font-medium text-foreground">{employee?.address || "--"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Date of Birth</p>
              <p className="text-sm font-medium text-foreground">{employee?.date_of_birth || employee?.dob || "--"}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Aadhar Number</p>
              <p className="text-sm font-medium text-foreground">{employee?.aadhar_number || "--"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">PAN Number</p>
              <p className="text-sm font-medium text-foreground">{employee?.pan_number || "--"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Bank Details</p>
              <p className="text-sm font-medium text-foreground">
                {employee?.bank_name ? `${employee.bank_name}${employee.bank_branch ? `, ${employee.bank_branch}` : ""}` : "--"}
              </p>
              <p className="text-sm text-muted-foreground">
                {employee?.bank_account_number ? `A/c: ${employee.bank_account_number}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {employee?.bank_ifsc ? `IFSC: ${employee.bank_ifsc}` : ""}
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
            {detailOnboardingSteps.map((step, index) => (
              <div key={index} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  {step.completed ? (
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-white" />
                    </div>
                  ) : index === currentOnboardingStep ? (
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-sm">{step.step}</span>
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground font-bold text-sm">{step.step}</span>
                    </div>
                  )}
                  <span className={`text-[10px] font-semibold uppercase text-center mt-2 leading-tight tracking-wider whitespace-pre-line ${
                    step.completed ? "text-green-500" : "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < detailOnboardingSteps.length - 1 && (
                  <div className="flex-1 mx-2">
                    <div
                      className={`h-0.5 w-full ${
                        step.completed ? "bg-green-500" : "bg-muted"
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
              {/* {documents.map((doc, index) => ( */}
              {documentsState.map((doc, index) => (
                <TableRow key={index}>
                  <TableCell className="text-sm font-medium text-center">{doc.name}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(doc.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground text-center">{doc.verifiedBy}</TableCell>
                  <TableCell className="text-sm text-muted-foreground text-center">{doc.date}</TableCell>
                  <TableCell className="text-center">

<TooltipProvider>
  <div className="flex items-center justify-center gap-2">

    {/* VIEW */}
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={async () => {
            if (!doc.fileUrl) return;

            const newWindow = window.open("about:blank", "_blank");
            if (!newWindow) {
              alert("Unable to open document. Please allow popups for this site.");
              return;
            }

            try {
              const response = await fetch(doc.fileUrl);
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
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          disabled={!doc.fileUrl}
        >
          <Eye className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>View</p>
      </TooltipContent>
    </Tooltip>

    {/* APPROVE */}
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => handleStatusChange(index, "Approved")}
          className={`p-1 rounded ${
            doc.status === "Approved"
              ? "bg-green-500 text-white"
              : "hover:bg-green-100 text-green-600"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Approve</p>
      </TooltipContent>
    </Tooltip>

    {/* REJECT */}
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          // onClick={() => handleStatusChange(index, "Rejected")}
          onClick={() => {
  setSelectedIndex(index);
  setRejectModal(true);
}}
          className={`p-1 rounded ${
            doc.status === "Rejected"
              ? "bg-red-500 text-white"
              : "hover:bg-red-100 text-red-600"
          }`}
        >
          ✕
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Reject</p>
      </TooltipContent>
    </Tooltip>

  </div>
</TooltipProvider>

                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Background Verification */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Background Verification</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Company Name */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</p>
              <p className="text-sm font-medium text-foreground">{backgroundCompanyName}</p>
            </div>
          </div>

          {/* Verification Status */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verification Status</p>
              <button
                onClick={() =>
                  saveBgVerificationStatus(
                    bgVerificationStatus === "pending" ? "complete" : "pending"
                  )
                }
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border mt-1 cursor-pointer transition-colors ${
                  bgVerificationStatus === "complete"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-orange-50 text-orange-700 border-orange-200"
                }`}
              >
                {bgVerificationStatus === "complete" ? "Complete" : "Pending"}
              </button>
            </div>
          </div>

          {/* Reference Name */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Name</p>
              <p className="text-sm font-medium text-foreground mt-1">{backgroundReferenceName}</p>
            </div>
          </div>

          {/* Reference Persons Email */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Person Email</p>
              <p className="text-sm font-medium text-foreground">{backgroundReferenceEmail}</p>
            </div>
          </div>

          {/* Reference Person Phone */}
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
              <Phone className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Person Phone</p>
              <p className="text-sm font-medium text-foreground">{backgroundReferencePhone}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasItAssetDetails && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">IT Asset Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <Monitor className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device Name</p>
                <p className="text-sm font-medium text-foreground">{itAssetDetails?.device_name || "--"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Serial Number</p>
                <p className="text-sm font-medium text-foreground">{itAssetDetails?.serial_number || "--"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <Eye className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device Photo Upload</p>
                {itAssetDetails?.device_photo_url ? (
                  <a
                    href={itAssetDetails.device_photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View Uploaded File
                  </a>
                ) : (
                  <p className="text-sm font-medium text-foreground">--</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasInductionDetails && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Induction Checklist</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {inductionItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                  <ClipboardList className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasProbationDetails && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserRoundCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Probation Period</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <CircleDotDashed className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Probation Period Status</p>
                <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {probationDetails?.status || "Active"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium text-foreground">{probationDetails?.start_date || "--"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</p>
                <p className="text-sm font-medium text-foreground">{probationDetails?.end_date || "--"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <Clock3 className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</p>
                <p className="text-sm font-medium text-foreground">{probationDetails?.duration_days ? `${probationDetails.duration_days} Days` : "--"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center mt-6">
        <Button
          onClick={handleMarkAsCompleted}
          disabled={!canMarkAsCompleted}
          className="bg-purple-600 text-white"
        >
          Mark as Completed
        </Button>
      </div>
      </>
      )}

      {rejectModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl w-[500px] p-6 shadow-lg">
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-red-500 font-semibold">
        ⚠️ Document Rejected
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3">
        Please provide the reason for rejecting this document.
      </p>

      {/* Textarea */}
      <textarea
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
        maxLength={250}
        className="w-full border rounded-md p-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
        placeholder="Enter reason..."
      />

      <p className="text-xs text-muted-foreground mt-1">
        {250 - rejectReason.length} characters remaining
      </p>

      {/* Buttons */}
      <div className="flex justify-end gap-3 mt-5">
        <button
          onClick={() => setRejectModal(false)}
          className="px-4 py-2 rounded-md border text-sm"
        >
          Cancel
        </button>

        <button
          onClick={handleRejectSubmit}
          className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm"
        >
          Submit
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default CandidateDetail;

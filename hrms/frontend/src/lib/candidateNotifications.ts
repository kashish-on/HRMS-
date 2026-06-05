export type CandidateNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
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
      return "Signed Offer Letter";
    default:
      return documentType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
};

const getIsoString = (value?: string | null) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString();
};

const createNotification = (
  id: string,
  title: string,
  message: string,
  createdAt?: string | null
): CandidateNotification | null => {
  const normalizedCreatedAt = getIsoString(createdAt);

  if (!normalizedCreatedAt) return null;

  return {
    id,
    title,
    message,
    createdAt: normalizedCreatedAt,
  };
};

const isReverifiedDocument = (document: any) => {
  const createdAt = document?.created_at ? new Date(document.created_at).getTime() : 0;
  const updatedAt = document?.updated_at ? new Date(document.updated_at).getTime() : 0;

  return createdAt > 0 && updatedAt > createdAt + 1000;
};

export const deriveCandidateNotifications = ({
  documents,
  onboardingTask,
  itAssetDetails,
  inductionDetails,
  probationDetails,
}: {
  documents: any[];
  onboardingTask: any | null;
  itAssetDetails: any | null;
  inductionDetails: any | null;
  probationDetails: any | null;
}) => {
  const notifications: CandidateNotification[] = [];
  const notificationsById = new Map<string, CandidateNotification>();

  const addNotification = (notification: CandidateNotification | null) => {
    if (!notification || notificationsById.has(notification.id)) return;
    notificationsById.set(notification.id, notification);
    notifications.push(notification);
  };

  (documents || []).forEach((document: any) => {
    const documentLabel = mapDocumentTypeToLabel(document?.document_type || "document");

    if (document?.status === "approved") {
      addNotification(
        createNotification(
          `document-approved-${document.id}`,
          isReverifiedDocument(document) ? "Document Re-verified" : "Document Verified",
          isReverifiedDocument(document)
            ? `HR verified your re-uploaded ${documentLabel}.`
            : `HR verified your ${documentLabel}.`,
          document.updated_at || document.uploaded_at || document.created_at
        )
      );
      return;
    }

    if (document?.status === "rejected") {
      addNotification(
        createNotification(
          `document-rejected-${document.id}`,
          "Document Rejected",
          document?.reason
            ? `HR rejected your ${documentLabel}: ${document.reason}`
            : `HR rejected your ${documentLabel}.`,
          document.updated_at || document.uploaded_at || document.created_at
        )
      );
    }
  });

  if (onboardingTask?.hr_verification) {
    addNotification(
      createNotification(
        `hr-verification-${onboardingTask.id || "complete"}`,
        "HR Verification Complete",
        "HR completed your document verification.",
        onboardingTask.updated_at || onboardingTask.created_at
      )
    );
  }

  if (onboardingTask?.asset_assigned || itAssetDetails?.id) {
    addNotification(
      createNotification(
        `it-asset-approved-${itAssetDetails?.id || onboardingTask?.id || "complete"}`,
        "IT Asset Approved",
        "Your IT asset details have been approved.",
        itAssetDetails?.updated_at ||
          itAssetDetails?.submitted_at ||
          onboardingTask?.updated_at ||
          onboardingTask?.created_at
      )
    );
  }

  const inductionCompleted = !!(
    inductionDetails &&
    [
      inductionDetails.hr_orientation,
      inductionDetails.team_introduction,
      inductionDetails.system_setup,
      inductionDetails.policy_training,
      inductionDetails.security_briefing,
      inductionDetails.manager_connect,
    ].some(Boolean)
  );

  if (inductionCompleted) {
    addNotification(
      createNotification(
        `induction-approved-${inductionDetails.id}`,
        "Induction Approved",
        "Your induction step has been completed.",
        inductionDetails.updated_at || inductionDetails.submitted_at || inductionDetails.created_at
      )
    );
  }

  const normalizedProbationStatus = probationDetails?.status?.toLowerCase?.() || "";
  if (["approved", "completed", "active"].includes(normalizedProbationStatus)) {
    addNotification(
      createNotification(
        `probation-approved-${probationDetails.id}`,
        "Onboarding Approved",
        "Your onboarding has been approved and probation has been started.",
        probationDetails.updated_at || probationDetails.submitted_at || probationDetails.created_at
      )
    );
  }

  return notifications.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
};

export const formatCandidateNotificationTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  const now = Date.now();
  const differenceInMinutes = Math.max(1, Math.floor((now - timestamp) / (1000 * 60)));

  if (differenceInMinutes < 60) {
    return `${differenceInMinutes}m ago`;
  }

  const differenceInHours = Math.floor(differenceInMinutes / 60);
  if (differenceInHours < 24) {
    return `${differenceInHours}h ago`;
  }

  const differenceInDays = Math.floor(differenceInHours / 24);
  if (differenceInDays < 7) {
    return `${differenceInDays}d ago`;
  }

  return new Date(value).toLocaleDateString();
};

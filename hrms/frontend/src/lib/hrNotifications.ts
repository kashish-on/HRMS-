const REQUIRED_DOCUMENT_TYPES = [
  "aadhar",
  "pan",
  "bank_details",
  "education_certificate",
  "experience_letter",
  "offer_letter",
];

export type HrNotification = {
  id: string;
  employeeId: string;
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

const isReuploadedDocument = (document: any) => {
  const createdAt = document?.created_at ? new Date(document.created_at).getTime() : 0;
  const updatedAt = document?.updated_at ? new Date(document.updated_at).getTime() : 0;

  return createdAt > 0 && updatedAt > createdAt + 1000;
};

const createNotification = (
  id: string,
  employeeId: string,
  title: string,
  message: string,
  createdAt?: string | null
): HrNotification | null => {
  const normalizedCreatedAt = getIsoString(createdAt);

  if (!employeeId || !normalizedCreatedAt) {
    return null;
  }

  return {
    id,
    employeeId,
    title,
    message,
    createdAt: normalizedCreatedAt,
  };
};

const getDocumentNotificationId = (
  prefix: string,
  document: any,
  timestamp?: string | null
) => {
  const normalizedTimestamp = getIsoString(
    timestamp || document.updated_at || document.uploaded_at || document.created_at
  );
  return `${prefix}-${document.id}-${normalizedTimestamp}`;
};

export const deriveHrNotifications = ({
  candidates,
  documents,
  onboardingTasks,
  bgVerificationRows,
  itAssetRows,
  inductionRows,
  probationRows,
}: {
  candidates: any[];
  documents: any[];
  onboardingTasks: any[];
  bgVerificationRows: any[];
  itAssetRows: any[];
  inductionRows: any[];
  probationRows: any[];
}) => {
  const candidateNameById = (candidates || []).reduce(
    (acc: Record<string, string>, candidate: any) => {
      if (!candidate?.id) return acc;
      acc[candidate.id] = candidate.name || "Candidate";
      return acc;
    },
    {}
  );

  const notifications: HrNotification[] = [];
  const notificationsById = new Map<string, HrNotification>();

  const addNotification = (notification: HrNotification | null) => {
    if (!notification || notificationsById.has(notification.id)) return;
    notificationsById.set(notification.id, notification);
    notifications.push(notification);
  };

  (candidates || []).forEach((candidate: any) => {
    addNotification(
      createNotification(
        `candidate-created-${candidate.id}`,
        candidate.id,
        "New Candidate Added",
        `${candidate.name || "Candidate"} was added to onboarding.`,
        candidate.created_at
      )
    );
  });

  (documents || []).forEach((document: any) => {
    const employeeId = document?.employee_id;
    const candidateName = candidateNameById[employeeId] || "Candidate";
    const documentLabel = mapDocumentTypeToLabel(document?.document_type || "document");

    if (!employeeId) return;

    if (document.status === "rejected") {
      addNotification(
        createNotification(
          getDocumentNotificationId("document-rejected", document, document.updated_at || document.uploaded_at),
          employeeId,
          "Document Rejected",
          `${candidateName}'s ${documentLabel} was rejected by HR.`,
          document.updated_at || document.uploaded_at
        )
      );
      return;
    }

    if (document.status === "pending") {
      const wasReuploaded = isReuploadedDocument(document);
      const notificationPrefix = wasReuploaded ? "document-reuploaded" : "document-submitted";
      const notificationTimestamp = wasReuploaded
        ? document.updated_at || document.uploaded_at
        : document.uploaded_at || document.updated_at || document.created_at;

      addNotification(
        createNotification(
          getDocumentNotificationId(notificationPrefix, document, notificationTimestamp),
          employeeId,
          wasReuploaded ? "Document Re-uploaded" : "Document Submitted",
          wasReuploaded
            ? `${candidateName} re-uploaded ${documentLabel} for review.`
            : `${candidateName} submitted ${documentLabel}.`,
          notificationTimestamp
        )
      );
    }
  });

  (onboardingTasks || []).forEach((task: any) => {
    const employeeId = task?.employee_id;
    const candidateName = candidateNameById[employeeId] || "Candidate";

    if (!employeeId) return;

    if (task.document_submitted === true && task.hr_verification !== true) {
      addNotification(
        createNotification(
          `hr-approval-pending-${employeeId}`,
          employeeId,
          "HR Approval Pending",
          `${candidateName} is waiting for HR verification.`,
          task.updated_at || task.created_at
        )
      );
    }
  });

  (bgVerificationRows || []).forEach((row: any) => {
    const employeeId = row?.employee_id;
    const candidateName = candidateNameById[employeeId] || "Candidate";

    addNotification(
      createNotification(
        `bg-verification-${row.id}`,
        employeeId,
        "Background Verification Submitted",
        `${candidateName} submitted background verification details.`,
        row.submitted_at || row.updated_at || row.created_at
      )
    );
  });

  (itAssetRows || []).forEach((row: any) => {
    const employeeId = row?.employee_id;
    const candidateName = candidateNameById[employeeId] || "Candidate";

    addNotification(
      createNotification(
        `it-asset-${row.id}`,
        employeeId,
        "IT Asset Details Submitted",
        `${candidateName} submitted IT asset details.`,
        row.submitted_at || row.updated_at || row.created_at
      )
    );
  });

  (inductionRows || []).forEach((row: any) => {
    const employeeId = row?.employee_id;
    const candidateName = candidateNameById[employeeId] || "Candidate";

    const completedSteps = [
      row?.hr_orientation,
      row?.team_introduction,
      row?.system_setup,
      row?.policy_training,
      row?.security_briefing,
      row?.manager_connect,
    ].some(Boolean);

    if (!completedSteps) return;

    addNotification(
      createNotification(
        `induction-${row.id}`,
        employeeId,
        "Induction Completed",
        `${candidateName} completed the induction checklist.`,
        row.submitted_at || row.updated_at || row.created_at
      )
    );
  });

  (probationRows || []).forEach((row: any) => {
    const employeeId = row?.employee_id;
    const candidateName = candidateNameById[employeeId] || "Candidate";

    addNotification(
      createNotification(
        `probation-${row.id}`,
        employeeId,
        "Probation Details Submitted",
        `${candidateName} submitted probation details.`,
        row.submitted_at || row.updated_at || row.created_at
      )
    );
  });

  return notifications
    .filter((notification) => !!notification.createdAt)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, 12);
};

export const formatNotificationTime = (value: string) => {
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

export const getRequiredDocumentTypesCount = () => REQUIRED_DOCUMENT_TYPES.length;

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Candidate,
  ParseRecord,
  ScoreWeights,
  ATSScreen,
  Stage,
  InterviewForm,
  OfferForm,
  ParseRunForm,
} from '../types';
import { DEFAULT_WEIGHTS } from '../data/mockData';
import {
  bulkSaveCandidateStage,
  createCandidateNote,
  createInterview,
  createOffer,
  deleteCandidate as deleteCandidateRequest,
  fetchCandidateDetail,
  fetchCandidatesForJob,
  fetchRecords,
  rejectCandidate,
  runParseFlow,
  saveCandidateStage,
} from '../lib/api';

function calcScore(c: Candidate, weights: ScoreWeights): number {
  return Math.round(
    (c.skill * weights.skill +
      c.experience * weights.experience +
      c.titleR * weights.title +
      c.location_score * weights.location) /
      100
  );
}

interface ATSContextValue {
  screen: ATSScreen;
  navigate: (screen: ATSScreen) => void;
  records: ParseRecord[];
  recordsLoading: boolean;
  refreshRecords: () => Promise<ParseRecord[]>;
  updateRecordLocally: (id: string, patch: Partial<ParseRecord>) => void;
  currentRecord: ParseRecord | null;
  setCurrentRecord: (record: ParseRecord | null) => void;
  candidates: Candidate[];
  candidatesLoading: boolean;
  setCandidates: (candidates: Candidate[]) => void;
  currentCandidate: Candidate | null;
  setCurrentCandidate: (candidate: Candidate | null) => void;
  updateCandidateStage: (id: string, stage: Stage) => Promise<void>;
  addNote: (id: string, text: string) => Promise<void>;
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  bulkAction: (action: 'shortlist' | 'interview' | 'reject') => Promise<void>;
  prevCandidate: () => void;
  nextCandidate: () => void;
  weights: ScoreWeights;
  setWeights: (weights: ScoreWeights) => void;
  getScore: (candidate: Candidate) => number;
  showWeightModal: boolean;
  setShowWeightModal: (value: boolean) => void;
  showParseModal: boolean;
  setShowParseModal: (value: boolean) => void;
  parseProgress: number;
  isParsing: boolean;
  showInterviewModal: boolean;
  setShowInterviewModal: (value: boolean) => void;
  interviewForm: InterviewForm;
  setInterviewForm: (form: Partial<InterviewForm>) => void;
  confirmInterview: () => Promise<void>;
  offerForm: OfferForm;
  setOfferForm: (form: Partial<OfferForm>) => void;
  submitOffer: (offerFile?: File | null) => Promise<void>;
  rejectCurrentCandidate: () => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  startParsing: (form: ParseRunForm) => Promise<void>;
  currentUserName?: string;
  errorMessage: string | null;
  clearError: () => void;
}

const ATSContext = createContext<ATSContextValue | null>(null);

const DEFAULT_INTERVIEW_FORM: InterviewForm = {
  type: 'video',
  round: '1',
  interviewers: [],
  date: null,
  slot: null,
  duration: '30',
  notifyVia: 'email',
  message: '',
};

const DEFAULT_OFFER_FORM: OfferForm = {
  designation: '',
  ctc: '',
  joiningDate: '',
  reportingTo: '',
  additionalNote: '',
};

const STAGE_BY_ACTION: Record<'shortlist' | 'interview' | 'reject', Stage> = {
  shortlist: 'Shortlisted',
  interview: 'Interview Scheduled',
  reject: 'Rejected',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function normalizeRecordKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatFailedUploadsMessage(
  failedUploads: Array<{ fileName: string; message: string }>,
  parsedCount: number,
  totalFiles: number
) {
  if (!failedUploads.length) {
    return null;
  }

  const firstFailure = failedUploads[0];
  const baseReason = firstFailure?.message || 'Resume parsing failed.';

  if (parsedCount === 0) {
    return `${firstFailure.fileName}: ${baseReason}`;
  }

  return `Parsed ${parsedCount} of ${totalFiles} resumes. ${failedUploads
    .map((upload) => `${upload.fileName}: ${upload.message}`)
    .join(' | ')}`;
}

export function ATSProvider({ children, currentUserName }: { children: ReactNode; currentUserName?: string }) {
  const [screen, setScreen] = useState<ATSScreen>('dashboard');
  const [records, setRecords] = useState<ParseRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [currentRecord, setCurrentRecordState] = useState<ParseRecord | null>(null);
  const [candidateMap, setCandidateMap] = useState<Record<string, Candidate[]>>({});
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [currentCandidate, setCurrentCandidateState] = useState<Candidate | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showParseModal, setShowParseModal] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewForm, setInterviewFormState] = useState<InterviewForm>(DEFAULT_INTERVIEW_FORM);
  const [offerForm, setOfferFormState] = useState<OfferForm>(DEFAULT_OFFER_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const normalizedUserName = currentUserName?.trim() || 'HR Team';

  useEffect(() => {
    if (normalizedUserName && interviewForm.interviewers.length === 0) {
      setInterviewFormState((prev) => ({ ...prev, interviewers: [normalizedUserName] }));
    }
  }, [normalizedUserName, interviewForm.interviewers.length]);

  const candidates = useMemo(
    () => (currentRecord ? candidateMap[currentRecord.id] ?? [] : []),
    [candidateMap, currentRecord]
  );

  const getScore = useCallback(
    (candidate: Candidate) =>
      typeof candidate.score === 'number' ? candidate.score : calcScore(candidate, weights),
    [weights]
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  const replaceCandidateList = useCallback((recordId: string, nextCandidates: Candidate[]) => {
    setCandidateMap((prev) => ({
      ...prev,
      [recordId]: nextCandidates,
    }));
  }, []);

  const syncCandidateInCurrentRecord = useCallback((candidate: Candidate) => {
    setCurrentCandidateState(candidate);

    setCandidateMap((prev) => {
      if (!currentRecord) {
        return prev;
      }

      const list = prev[currentRecord.id] ?? [];
      const exists = list.some((item) => item.id === candidate.id);

      return {
        ...prev,
        [currentRecord.id]: exists
          ? list.map((item) => (item.id === candidate.id ? { ...item, ...candidate } : item))
          : [candidate, ...list],
      };
    });
  }, [currentRecord]);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);

    try {
      const nextRecords = await fetchRecords();
      setRecords(nextRecords);
      return nextRecords;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      return [];
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const loadCandidates = useCallback(async (recordId: string) => {
    setCandidatesLoading(true);

    try {
      const nextCandidates = await fetchCandidatesForJob(recordId);
      replaceCandidateList(recordId, nextCandidates);
      setCurrentCandidateState((prev) =>
        prev ? nextCandidates.find((candidate) => candidate.id === prev.id) ?? prev : prev
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCandidatesLoading(false);
    }
  }, [replaceCandidateList]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!currentRecord) {
      return;
    }

    void loadCandidates(currentRecord.id);
  }, [currentRecord, loadCandidates]);

  useEffect(() => {
    if (!currentCandidate?.id) {
      return;
    }

    let ignore = false;

    const loadDetail = async () => {
      try {
        const detail = await fetchCandidateDetail(currentCandidate.id);
        if (!ignore) {
          syncCandidateInCurrentRecord(detail);
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(getErrorMessage(error));
        }
      }
    };

    void loadDetail();

    return () => {
      ignore = true;
    };
  }, [currentCandidate?.id, syncCandidateInCurrentRecord]);

  const navigate = useCallback((nextScreen: ATSScreen) => {
    setScreen(nextScreen);
    if (nextScreen !== 'results') {
      setSelectedIds([]);
    }
  }, []);

  const updateRecordLocally = useCallback((id: string, patch: Partial<ParseRecord>) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setCurrentRecordState((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const setCurrentRecord = useCallback((record: ParseRecord | null) => {
    setCurrentRecordState(record);
    setCurrentCandidateState(null);
    setSelectedIds([]);
  }, []);

  const setCandidates = useCallback((nextCandidates: Candidate[]) => {
    if (!currentRecord) {
      return;
    }

    replaceCandidateList(currentRecord.id, nextCandidates);
  }, [currentRecord, replaceCandidateList]);

  const setCurrentCandidate = useCallback((candidate: Candidate | null) => {
    setCurrentCandidateState(candidate);
  }, []);

  const updateCandidateStage = useCallback(async (id: string, stage: Stage) => {
    try {
      await saveCandidateStage(id, stage);

      if (currentRecord) {
        const nextCandidates = candidates.map((candidate) =>
          candidate.id === id ? { ...candidate, stage } : candidate
        );
        replaceCandidateList(currentRecord.id, nextCandidates);
      }

      setCurrentCandidateState((prev) => (prev?.id === id ? { ...prev, stage } : prev));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [candidates, currentRecord, replaceCandidateList]);

  const addNote = useCallback(async (id: string, text: string) => {
    try {
      const response = await createCandidateNote(id, text, normalizedUserName);

      setCurrentCandidateState((prev) =>
        prev?.id === id ? { ...prev, notes: [response.note, ...(prev.notes ?? [])] } : prev
      );

      if (currentRecord) {
        const nextCandidates = candidates.map((candidate) =>
          candidate.id === id
            ? { ...candidate, notes: [response.note, ...(candidate.notes ?? [])] }
            : candidate
        );
        replaceCandidateList(currentRecord.id, nextCandidates);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [candidates, currentRecord, replaceCandidateList]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.length === candidates.length ? [] : candidates.map((candidate) => candidate.id)
    );
  }, [candidates]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const bulkAction = useCallback(async (action: 'shortlist' | 'interview' | 'reject') => {
    if (!selectedIds.length || !currentRecord) {
      return;
    }

    const stage = STAGE_BY_ACTION[action];

    try {
      await bulkSaveCandidateStage(selectedIds, stage);

      const nextCandidates = candidates.map((candidate) =>
        selectedIds.includes(candidate.id) ? { ...candidate, stage } : candidate
      );

      replaceCandidateList(currentRecord.id, nextCandidates);
      setCurrentCandidateState((prev) =>
        prev && selectedIds.includes(prev.id) ? { ...prev, stage } : prev
      );
      setSelectedIds([]);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [candidates, currentRecord, replaceCandidateList, selectedIds]);

  const prevCandidate = useCallback(() => {
    if (!currentCandidate) {
      return;
    }

    const currentIndex = candidates.findIndex((candidate) => candidate.id === currentCandidate.id);
    if (currentIndex > 0) {
      setCurrentCandidateState(candidates[currentIndex - 1]);
    }
  }, [candidates, currentCandidate]);

  const nextCandidate = useCallback(() => {
    if (!currentCandidate) {
      return;
    }

    const currentIndex = candidates.findIndex((candidate) => candidate.id === currentCandidate.id);
    if (currentIndex >= 0 && currentIndex < candidates.length - 1) {
      setCurrentCandidateState(candidates[currentIndex + 1]);
    }
  }, [candidates, currentCandidate]);

  const setInterviewForm = useCallback((form: Partial<InterviewForm>) => {
    setInterviewFormState((prev) => ({ ...prev, ...form }));
  }, []);

  const setOfferForm = useCallback((form: Partial<OfferForm>) => {
    setOfferFormState((prev) => ({ ...prev, ...form }));
  }, []);

  const confirmInterview = useCallback(async () => {
    if (!currentCandidate || !currentRecord) {
      return;
    }

    try {
      await createInterview(currentCandidate.id, currentRecord.id, interviewForm);
      await updateCandidateStage(currentCandidate.id, 'Interview Scheduled');
      setShowInterviewModal(false);
      setInterviewFormState(DEFAULT_INTERVIEW_FORM);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [currentCandidate, currentRecord, interviewForm, updateCandidateStage]);

  const submitOffer = useCallback(async (offerFile?: File | null) => {
    if (!currentCandidate || !currentRecord) {
      return;
    }

    try {
      await createOffer(
        currentCandidate.id,
        currentRecord.id,
        {
          ...offerForm,
          designation: offerForm.designation || currentRecord.role,
        },
        offerFile
      );
      await updateCandidateStage(currentCandidate.id, 'Offer Extended');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [currentCandidate, currentRecord, offerForm, updateCandidateStage]);

  const rejectCurrentCandidate = useCallback(async () => {
    if (!currentCandidate || !currentRecord) {
      return;
    }

    try {
      await rejectCandidate(currentCandidate.id, currentRecord.id, offerForm.additionalNote);
      const stage: Stage = 'Rejected';

      if (currentRecord) {
        const nextCandidates = candidates.map((candidate) =>
          candidate.id === currentCandidate.id ? { ...candidate, stage } : candidate
        );
        replaceCandidateList(currentRecord.id, nextCandidates);
      }

      setCurrentCandidateState((prev) => (prev?.id === currentCandidate.id ? { ...prev, stage } : prev));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [candidates, currentCandidate, currentRecord, offerForm.additionalNote, replaceCandidateList]);

  const deleteCandidate = useCallback(async (id: string) => {
    if (!currentRecord) {
      return;
    }

    try {
      await deleteCandidateRequest(id);

      const nextCandidates = candidates.filter((candidate) => candidate.id !== id);
      replaceCandidateList(currentRecord.id, nextCandidates);
      setSelectedIds((prev) => prev.filter((candidateId) => candidateId !== id));
      setCurrentCandidateState((prev) => (prev?.id === id ? nextCandidates[0] ?? null : prev));
      await loadRecords();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [candidates, currentRecord, loadRecords, replaceCandidateList]);

  const startParsing = useCallback(async (form: ParseRunForm) => {
    if (!form.role.trim()) {
      setErrorMessage('Please enter a job role before starting parsing.');
      return;
    }

    if (!form.files.length) {
      setErrorMessage('Please add at least one resume file.');
      return;
    }

    setShowParseModal(true);
    setParseProgress(8);
    setIsParsing(true);

    const progressTimer = window.setInterval(() => {
      setParseProgress((prev) => {
        if (prev >= 92) {
          return prev;
        }

        const bump = Math.random() * 11 + 4;
        return Math.min(92, prev + bump);
      });
    }, 450);

    try {
      const response = await runParseFlow(form);
      window.clearInterval(progressTimer);
      setParseProgress(100);

      const refreshedRecords = await loadRecords();
      const normalizedRole = normalizeRecordKey(response.record.role);
      const resolvedRecord =
        refreshedRecords.find((record) => normalizeRecordKey(record.role) === normalizedRole) ||
        refreshedRecords.find((record) => record.id === response.record.id) ||
        response.record;
      const refreshedCandidates = await fetchCandidatesForJob(resolvedRecord.id);
      const failureMessage = formatFailedUploadsMessage(
        response.failedUploads,
        response.summary.parsedCount,
        response.summary.totalFiles
      );

      replaceCandidateList(resolvedRecord.id, refreshedCandidates);
      setCurrentRecordState(resolvedRecord);

      if (response.summary.parsedCount > 0) {
        setCurrentCandidateState(refreshedCandidates[0] ?? null);
        setScreen('results');
      }

      if (failureMessage) {
        setErrorMessage(failureMessage);
      } else {
        setCurrentCandidateState(refreshedCandidates[0] ?? null);
        setErrorMessage(null);
      }

      window.setTimeout(() => {
        setShowParseModal(false);
        setParseProgress(0);
      }, 400);
    } catch (error) {
      window.clearInterval(progressTimer);
      setShowParseModal(false);
      setParseProgress(0);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsParsing(false);
    }
  }, [loadRecords, replaceCandidateList]);

  return (
    <ATSContext.Provider
      value={{
        screen,
        navigate,
        records,
        recordsLoading,
        refreshRecords: loadRecords,
        updateRecordLocally,
        currentRecord,
        setCurrentRecord,
        candidates,
        candidatesLoading,
        setCandidates,
        currentCandidate,
        setCurrentCandidate,
        updateCandidateStage,
        addNote,
        selectedIds,
        toggleSelect,
        toggleSelectAll,
        clearSelection,
        bulkAction,
        prevCandidate,
        nextCandidate,
        weights,
        setWeights,
        getScore,
        showWeightModal,
        setShowWeightModal,
        showParseModal,
        setShowParseModal,
        parseProgress,
        isParsing,
        showInterviewModal,
        setShowInterviewModal,
        interviewForm,
        setInterviewForm,
        confirmInterview,
        offerForm,
        setOfferForm,
        submitOffer,
        rejectCurrentCandidate,
        deleteCandidate,
        startParsing,
        errorMessage,
        clearError,
      }}
    >
      {children}
    </ATSContext.Provider>
  );
}

export function useATS() {
  const context = useContext(ATSContext);
  if (!context) {
    throw new Error('useATS must be used within ATSProvider');
  }
  return context;
}

// import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
// import type { ReactNode } from 'react';
// import type {
//   Candidate,
//   ParseRecord,
//   ScoreWeights,
//   ATSScreen,
//   Stage,
//   InterviewForm,
//   OfferForm,
//   ParseRunForm,
// } from '../types';
// import { DEFAULT_WEIGHTS } from '../data/mockData';
// import {
//   bulkSaveCandidateStage,
//   createCandidateNote,
//   createInterview,
//   createOffer,
//   deleteCandidate as deleteCandidateRequest,
//   fetchCandidateDetail,
//   fetchCandidatesForJob,
//   fetchRecords,
//   rejectCandidate,
//   runParseFlow,
//   saveCandidateStage,
// } from '../lib/api';

// function calcScore(c: Candidate, weights: ScoreWeights): number {
//   return Math.round(
//     (c.skill * weights.skill +
//       c.experience * weights.experience +
//       c.titleR * weights.title +
//       c.location_score * weights.location) /
//       100
//   );
// }

// interface ATSContextValue {
//   screen: ATSScreen;
//   navigate: (screen: ATSScreen) => void;
//   records: ParseRecord[];
//   recordsLoading: boolean;
//   currentRecord: ParseRecord | null;
//   setCurrentRecord: (record: ParseRecord | null) => void;
//   candidates: Candidate[];
//   candidatesLoading: boolean;
//   setCandidates: (candidates: Candidate[]) => void;
//   currentCandidate: Candidate | null;
//   setCurrentCandidate: (candidate: Candidate | null) => void;
//   updateCandidateStage: (id: string, stage: Stage) => Promise<void>;
//   addNote: (id: string, text: string) => Promise<void>;
//   selectedIds: string[];
//   toggleSelect: (id: string) => void;
//   toggleSelectAll: () => void;
//   clearSelection: () => void;
//   bulkAction: (action: 'shortlist' | 'interview' | 'reject') => Promise<void>;
//   prevCandidate: () => void;
//   nextCandidate: () => void;
//   weights: ScoreWeights;
//   setWeights: (weights: ScoreWeights) => void;
//   getScore: (candidate: Candidate) => number;
//   showWeightModal: boolean;
//   setShowWeightModal: (value: boolean) => void;
//   showParseModal: boolean;
//   setShowParseModal: (value: boolean) => void;
//   parseProgress: number;
//   isParsing: boolean;
//   showInterviewModal: boolean;
//   setShowInterviewModal: (value: boolean) => void;
//   interviewForm: InterviewForm;
//   setInterviewForm: (form: Partial<InterviewForm>) => void;
//   confirmInterview: () => Promise<void>;
//   offerForm: OfferForm;
//   setOfferForm: (form: Partial<OfferForm>) => void;
//   submitOffer: () => Promise<void>;
//   rejectCurrentCandidate: () => Promise<void>;
//   deleteCandidate: (id: string) => Promise<void>;
//   startParsing: (form: ParseRunForm) => Promise<void>;
//   errorMessage: string | null;
//   clearError: () => void;
// }

// const ATSContext = createContext<ATSContextValue | null>(null);

// const DEFAULT_INTERVIEW_FORM: InterviewForm = {
//   type: 'video',
//   round: '1',
//   interviewers: ['Anchal'],
//   date: null,
//   slot: null,
//   duration: '30',
//   notifyVia: 'email',
//   message: '',
// };

// const DEFAULT_OFFER_FORM: OfferForm = {
//   designation: '',
//   ctc: '',
//   joiningDate: '',
//   reportingTo: '',
//   additionalNote: '',
// };

// const STAGE_BY_ACTION: Record<'shortlist' | 'interview' | 'reject', Stage> = {
//   shortlist: 'Shortlisted',
//   interview: 'Interview Scheduled',
//   reject: 'Rejected',
// };

// function getErrorMessage(error: unknown): string {
//   return error instanceof Error ? error.message : 'Something went wrong.';
// }

// function normalizeRecordKey(value: string) {
//   return value.trim().toLowerCase().replace(/\s+/g, ' ');
// }

// function formatFailedUploadsMessage(
//   failedUploads: Array<{ fileName: string; message: string }>,
//   parsedCount: number,
//   totalFiles: number
// ) {
//   if (!failedUploads.length) {
//     return null;
//   }

//   const firstFailure = failedUploads[0];
//   const baseReason = firstFailure?.message || 'Resume parsing failed.';

//   if (parsedCount === 0) {
//     return `${firstFailure.fileName}: ${baseReason}`;
//   }

//   return `Parsed ${parsedCount} of ${totalFiles} resumes. ${failedUploads
//     .map((upload) => `${upload.fileName}: ${upload.message}`)
//     .join(' | ')}`;
// }

// export function ATSProvider({ children }: { children: ReactNode }) {
//   const [screen, setScreen] = useState<ATSScreen>('dashboard');
//   const [records, setRecords] = useState<ParseRecord[]>([]);
//   const [recordsLoading, setRecordsLoading] = useState(true);
//   const [currentRecord, setCurrentRecordState] = useState<ParseRecord | null>(null);
//   const [candidateMap, setCandidateMap] = useState<Record<string, Candidate[]>>({});
//   const [candidatesLoading, setCandidatesLoading] = useState(false);
//   const [currentCandidate, setCurrentCandidateState] = useState<Candidate | null>(null);
//   const [selectedIds, setSelectedIds] = useState<string[]>([]);
//   const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
//   const [showWeightModal, setShowWeightModal] = useState(false);
//   const [showParseModal, setShowParseModal] = useState(false);
//   const [parseProgress, setParseProgress] = useState(0);
//   const [isParsing, setIsParsing] = useState(false);
//   const [showInterviewModal, setShowInterviewModal] = useState(false);
//   const [interviewForm, setInterviewFormState] = useState<InterviewForm>(DEFAULT_INTERVIEW_FORM);
//   const [offerForm, setOfferFormState] = useState<OfferForm>(DEFAULT_OFFER_FORM);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);

//   const candidates = useMemo(
//     () => (currentRecord ? candidateMap[currentRecord.id] ?? [] : []),
//     [candidateMap, currentRecord]
//   );

//   const getScore = useCallback(
//     (candidate: Candidate) =>
//       typeof candidate.score === 'number' ? candidate.score : calcScore(candidate, weights),
//     [weights]
//   );

//   const clearError = useCallback(() => setErrorMessage(null), []);

//   const replaceCandidateList = useCallback((recordId: string, nextCandidates: Candidate[]) => {
//     setCandidateMap((prev) => ({
//       ...prev,
//       [recordId]: nextCandidates,
//     }));
//   }, []);

//   const syncCandidateInCurrentRecord = useCallback((candidate: Candidate) => {
//     setCurrentCandidateState(candidate);

//     setCandidateMap((prev) => {
//       if (!currentRecord) {
//         return prev;
//       }

//       const list = prev[currentRecord.id] ?? [];
//       const exists = list.some((item) => item.id === candidate.id);

//       return {
//         ...prev,
//         [currentRecord.id]: exists
//           ? list.map((item) => (item.id === candidate.id ? { ...item, ...candidate } : item))
//           : [candidate, ...list],
//       };
//     });
//   }, [currentRecord]);

//   const loadRecords = useCallback(async () => {
//     setRecordsLoading(true);

//     try {
//       const nextRecords = await fetchRecords();
//       setRecords(nextRecords);
//       return nextRecords;
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//       return [];
//     } finally {
//       setRecordsLoading(false);
//     }
//   }, []);

//   const loadCandidates = useCallback(async (recordId: string) => {
//     setCandidatesLoading(true);

//     try {
//       const nextCandidates = await fetchCandidatesForJob(recordId);
//       replaceCandidateList(recordId, nextCandidates);
//       setCurrentCandidateState((prev) =>
//         prev ? nextCandidates.find((candidate) => candidate.id === prev.id) ?? prev : prev
//       );
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     } finally {
//       setCandidatesLoading(false);
//     }
//   }, [replaceCandidateList]);

//   useEffect(() => {
//     void loadRecords();
//   }, [loadRecords]);

//   useEffect(() => {
//     if (!currentRecord) {
//       return;
//     }

//     void loadCandidates(currentRecord.id);
//   }, [currentRecord, loadCandidates]);

//   useEffect(() => {
//     if (!currentCandidate?.id) {
//       return;
//     }

//     let ignore = false;

//     const loadDetail = async () => {
//       try {
//         const detail = await fetchCandidateDetail(currentCandidate.id);
//         if (!ignore) {
//           syncCandidateInCurrentRecord(detail);
//         }
//       } catch (error) {
//         if (!ignore) {
//           setErrorMessage(getErrorMessage(error));
//         }
//       }
//     };

//     void loadDetail();

//     return () => {
//       ignore = true;
//     };
//   }, [currentCandidate?.id, syncCandidateInCurrentRecord]);

//   const navigate = useCallback((nextScreen: ATSScreen) => {
//     setScreen(nextScreen);
//     if (nextScreen !== 'results') {
//       setSelectedIds([]);
//     }
//   }, []);

//   const setCurrentRecord = useCallback((record: ParseRecord | null) => {
//     setCurrentRecordState(record);
//     setCurrentCandidateState(null);
//     setSelectedIds([]);
//   }, []);

//   const setCandidates = useCallback((nextCandidates: Candidate[]) => {
//     if (!currentRecord) {
//       return;
//     }

//     replaceCandidateList(currentRecord.id, nextCandidates);
//   }, [currentRecord, replaceCandidateList]);

//   const setCurrentCandidate = useCallback((candidate: Candidate | null) => {
//     setCurrentCandidateState(candidate);
//   }, []);

//   const updateCandidateStage = useCallback(async (id: string, stage: Stage) => {
//     try {
//       await saveCandidateStage(id, stage);

//       if (currentRecord) {
//         const nextCandidates = candidates.map((candidate) =>
//           candidate.id === id ? { ...candidate, stage } : candidate
//         );
//         replaceCandidateList(currentRecord.id, nextCandidates);
//       }

//       setCurrentCandidateState((prev) => (prev?.id === id ? { ...prev, stage } : prev));
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     }
//   }, [candidates, currentRecord, replaceCandidateList]);

//   const addNote = useCallback(async (id: string, text: string) => {
//     try {
//       const response = await createCandidateNote(id, text);

//       setCurrentCandidateState((prev) =>
//         prev?.id === id ? { ...prev, notes: [response.note, ...(prev.notes ?? [])] } : prev
//       );

//       if (currentRecord) {
//         const nextCandidates = candidates.map((candidate) =>
//           candidate.id === id
//             ? { ...candidate, notes: [response.note, ...(candidate.notes ?? [])] }
//             : candidate
//         );
//         replaceCandidateList(currentRecord.id, nextCandidates);
//       }
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     }
//   }, [candidates, currentRecord, replaceCandidateList]);

//   const toggleSelect = useCallback((id: string) => {
//     setSelectedIds((prev) =>
//       prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
//     );
//   }, []);

//   const toggleSelectAll = useCallback(() => {
//     setSelectedIds((prev) =>
//       prev.length === candidates.length ? [] : candidates.map((candidate) => candidate.id)
//     );
//   }, [candidates]);

//   const clearSelection = useCallback(() => setSelectedIds([]), []);

//   const bulkAction = useCallback(async (action: 'shortlist' | 'interview' | 'reject') => {
//     if (!selectedIds.length || !currentRecord) {
//       return;
//     }

//     const stage = STAGE_BY_ACTION[action];

//     try {
//       await bulkSaveCandidateStage(selectedIds, stage);

//       const nextCandidates = candidates.map((candidate) =>
//         selectedIds.includes(candidate.id) ? { ...candidate, stage } : candidate
//       );

//       replaceCandidateList(currentRecord.id, nextCandidates);
//       setCurrentCandidateState((prev) =>
//         prev && selectedIds.includes(prev.id) ? { ...prev, stage } : prev
//       );
//       setSelectedIds([]);
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     }
//   }, [candidates, currentRecord, replaceCandidateList, selectedIds]);

//   const prevCandidate = useCallback(() => {
//     if (!currentCandidate) {
//       return;
//     }

//     const currentIndex = candidates.findIndex((candidate) => candidate.id === currentCandidate.id);
//     if (currentIndex > 0) {
//       setCurrentCandidateState(candidates[currentIndex - 1]);
//     }
//   }, [candidates, currentCandidate]);

//   const nextCandidate = useCallback(() => {
//     if (!currentCandidate) {
//       return;
//     }

//     const currentIndex = candidates.findIndex((candidate) => candidate.id === currentCandidate.id);
//     if (currentIndex >= 0 && currentIndex < candidates.length - 1) {
//       setCurrentCandidateState(candidates[currentIndex + 1]);
//     }
//   }, [candidates, currentCandidate]);

//   const setInterviewForm = useCallback((form: Partial<InterviewForm>) => {
//     setInterviewFormState((prev) => ({ ...prev, ...form }));
//   }, []);

//   const setOfferForm = useCallback((form: Partial<OfferForm>) => {
//     setOfferFormState((prev) => ({ ...prev, ...form }));
//   }, []);

//   const confirmInterview = useCallback(async () => {
//     if (!currentCandidate || !currentRecord) {
//       return;
//     }

//     try {
//       await createInterview(currentCandidate.id, currentRecord.id, interviewForm);
//       await updateCandidateStage(currentCandidate.id, 'Interview Scheduled');
//       setShowInterviewModal(false);
//       setInterviewFormState(DEFAULT_INTERVIEW_FORM);
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     }
//   }, [currentCandidate, currentRecord, interviewForm, updateCandidateStage]);

//   const submitOffer = useCallback(async () => {
//     if (!currentCandidate || !currentRecord) {
//       return;
//     }

//     try {
//       await createOffer(currentCandidate.id, currentRecord.id, {
//         ...offerForm,
//         designation: offerForm.designation || currentRecord.role,
//       });
//       await updateCandidateStage(currentCandidate.id, 'Offer Extended');
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     }
//   }, [currentCandidate, currentRecord, offerForm, updateCandidateStage]);

//   const rejectCurrentCandidate = useCallback(async () => {
//     if (!currentCandidate || !currentRecord) {
//       return;
//     }

//     try {
//       await rejectCandidate(currentCandidate.id, currentRecord.id, offerForm.additionalNote);
//       const stage: Stage = 'Rejected';

//       if (currentRecord) {
//         const nextCandidates = candidates.map((candidate) =>
//           candidate.id === currentCandidate.id ? { ...candidate, stage } : candidate
//         );
//         replaceCandidateList(currentRecord.id, nextCandidates);
//       }

//       setCurrentCandidateState((prev) => (prev?.id === currentCandidate.id ? { ...prev, stage } : prev));
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     }
//   }, [candidates, currentCandidate, currentRecord, offerForm.additionalNote, replaceCandidateList]);

//   const deleteCandidate = useCallback(async (id: string) => {
//     if (!currentRecord) {
//       return;
//     }

//     try {
//       await deleteCandidateRequest(id);

//       const nextCandidates = candidates.filter((candidate) => candidate.id !== id);
//       replaceCandidateList(currentRecord.id, nextCandidates);
//       setSelectedIds((prev) => prev.filter((candidateId) => candidateId !== id));
//       setCurrentCandidateState((prev) => (prev?.id === id ? nextCandidates[0] ?? null : prev));
//       await loadRecords();
//     } catch (error) {
//       setErrorMessage(getErrorMessage(error));
//     }
//   }, [candidates, currentRecord, loadRecords, replaceCandidateList]);

//   const startParsing = useCallback(async (form: ParseRunForm) => {
//     if (!form.role.trim()) {
//       setErrorMessage('Please enter a job role before starting parsing.');
//       return;
//     }

//     if (!form.files.length) {
//       setErrorMessage('Please add at least one resume file.');
//       return;
//     }

//     setShowParseModal(true);
//     setParseProgress(8);
//     setIsParsing(true);

//     const progressTimer = window.setInterval(() => {
//       setParseProgress((prev) => {
//         if (prev >= 92) {
//           return prev;
//         }

//         const bump = Math.random() * 11 + 4;
//         return Math.min(92, prev + bump);
//       });
//     }, 450);

//     try {
//       const response = await runParseFlow(form);
//       window.clearInterval(progressTimer);
//       setParseProgress(100);

//       const refreshedRecords = await loadRecords();
//       const normalizedRole = normalizeRecordKey(response.record.role);
//       const resolvedRecord =
//         refreshedRecords.find((record) => normalizeRecordKey(record.role) === normalizedRole) ||
//         refreshedRecords.find((record) => record.id === response.record.id) ||
//         response.record;
//       const refreshedCandidates = await fetchCandidatesForJob(resolvedRecord.id);
//       const failureMessage = formatFailedUploadsMessage(
//         response.failedUploads,
//         response.summary.parsedCount,
//         response.summary.totalFiles
//       );

//       replaceCandidateList(resolvedRecord.id, refreshedCandidates);
//       setCurrentRecordState(resolvedRecord);

//       if (response.summary.parsedCount > 0) {
//         setCurrentCandidateState(refreshedCandidates[0] ?? null);
//         setScreen('results');
//       }

//       if (failureMessage) {
//         setErrorMessage(failureMessage);
//       } else {
//         setCurrentCandidateState(refreshedCandidates[0] ?? null);
//         setErrorMessage(null);
//       }

//       window.setTimeout(() => {
//         setShowParseModal(false);
//         setParseProgress(0);
//       }, 400);
//     } catch (error) {
//       window.clearInterval(progressTimer);
//       setShowParseModal(false);
//       setParseProgress(0);
//       setErrorMessage(getErrorMessage(error));
//     } finally {
//       setIsParsing(false);
//     }
//   }, [loadRecords, replaceCandidateList]);

//   return (
//     <ATSContext.Provider
//       value={{
//         screen,
//         navigate,
//         records,
//         recordsLoading,
//         currentRecord,
//         setCurrentRecord,
//         candidates,
//         candidatesLoading,
//         setCandidates,
//         currentCandidate,
//         setCurrentCandidate,
//         updateCandidateStage,
//         addNote,
//         selectedIds,
//         toggleSelect,
//         toggleSelectAll,
//         clearSelection,
//         bulkAction,
//         prevCandidate,
//         nextCandidate,
//         weights,
//         setWeights,
//         getScore,
//         showWeightModal,
//         setShowWeightModal,
//         showParseModal,
//         setShowParseModal,
//         parseProgress,
//         isParsing,
//         showInterviewModal,
//         setShowInterviewModal,
//         interviewForm,
//         setInterviewForm,
//         confirmInterview,
//         offerForm,
//         setOfferForm,
//         submitOffer,
//         rejectCurrentCandidate,
//         deleteCandidate,
//         startParsing,
//         errorMessage,
//         clearError,
//       }}
//     >
//       {children}
//     </ATSContext.Provider>
//   );
// }

// export function useATS() {
//   const context = useContext(ATSContext);
//   if (!context) {
//     throw new Error('useATS must be used within ATSProvider');
//   }
//   return context;
// }

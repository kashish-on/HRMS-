export type Stage =
  | 'Applied'
  | 'Shortlisted'
  | 'Interview Scheduled'
  | 'Interviewed'
  | 'Offer Extended'
  | 'Rejected';

export interface Note {
  id?: string;
  by: string;
  date: string;
  text: string;
}

export interface Candidate {
  id: string;
  name: string;
  title: string;
  exp: number;
  location: string;
  skill: number;
  experience: number;
  titleR: number;
  location_score: number;
  notes: Note[];
  stage: Stage;
  skills_match: string[];
  skills_miss: string[];
  score?: number;
  currentCompany?: string | null;
  highestEducation?: string | null;
  resumeUrl?: string | null;
  resumeText?: string | null;
  scoreExplanation?: string | null;
}

export interface ParseRecord {
  id: string;
  uploadDate: string;
  role: string;
  totalResumes: number;
  highMatch: number;
  avgScore: number;
  status: 'Completed' | 'Processing' | 'Failed';
}

export interface ScoreWeights {
  skill: number;
  experience: number;
  title: number;
  location: number;
}

export interface InterviewForm {
  type: 'video' | 'phone' | 'f2f';
  round: '1' | '2' | 'hr';
  interviewers: string[];
  date: string | null;
  slot: string | null;
  duration: '30' | '45' | '60';
  notifyVia: 'email' | 'whatsapp' | 'both';
  message: string;
}

export interface OfferForm {
  designation: string;
  ctc: string;
  joiningDate: string;
  reportingTo: string;
  additionalNote: string;
}

export type ATSScreen = 'dashboard' | 'results' | 'candidate' | 'offer';

export interface ParseRunForm {
  role: string;
  exp: string;
  location: string;
  skills: string;
  files: File[];
}

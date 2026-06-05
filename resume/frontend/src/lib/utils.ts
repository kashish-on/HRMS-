import type { Candidate } from '../types';

export function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-800';
  if (score >= 50) return 'text-amber-800';
  return 'text-red-800';
}

export function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-green-100 text-green-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function getScoreBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getStageColor(stage: string): string {
  switch (stage) {
    case 'Shortlisted': return 'bg-purple-100 text-purple-800';
    case 'Interview Scheduled': return 'bg-blue-100 text-blue-800';
    case 'Interviewed': return 'bg-indigo-100 text-indigo-800';
    case 'Offer Extended': return 'bg-green-100 text-green-800';
    case 'Rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-stone-100 text-stone-600';
  }
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function isTop10(candidate: Candidate, allCandidates: Candidate[], getScore: (c: Candidate) => number): boolean {
  const sorted = [...allCandidates].sort((a, b) => getScore(b) - getScore(a));
  const top10 = sorted.slice(0, 10);
  return top10.some(c => c.id === candidate.id);
}

export function getScoreFill(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

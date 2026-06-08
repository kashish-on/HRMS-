import { useEffect, useState } from 'react';
import { ATSProvider, useATS } from './context/ATSContext';
import DashboardScreen from './components/dashboard/DashboardScreen';
import ResultsScreen from './components/results/ResultsScreen';
import CandidateScreen from './components/candidate/CandidateScreen';
import OfferScreen from './components/offer/OfferScreen';
import InterviewModal from './components/modals/interview/InterviewModal';
import WeightSettingsModal from './components/modals/WeightSettingsModal';
import ParseProgressModal from './components/modals/ParseProgressModal';
import { supabase } from './lib/supabase';

interface UserInfo {
  name: string;
  role: string;
  initials: string;
  firstInitial: string;
  photoUrl: string;
}

function useCurrentUser(): UserInfo {
  const [user, setUser] = useState<UserInfo>({
    name: '...',
    role: 'HR Manager',
    initials: '...',
    firstInitial: '.',
    photoUrl: '',
  });

  useEffect(() => {
    const syncSessionFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        return;
      }

      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      params.delete('access_token');
      params.delete('refresh_token');
      const nextSearch = params.toString();
      const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);
    };

    const fetchUser = async () => {
      await syncSessionFromUrl();

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, role, full_name')
        .eq('id', authUser.id)
        .maybeSingle();

      const email = profile?.email || authUser.email || '';
      const profileRole = profile?.role;

      // Use full_name if available, else derive from email
      const name = profile?.full_name?.trim() ||
        email.split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
          .trim() || 'HR';

      const role = profileRole === 'hr' ? 'HR Manager' : profileRole === 'candidate' ? 'Candidate' : 'HR Manager';

      const parts = name.split(/\s+/).filter(Boolean);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();

      const firstInitial = name[0]?.toUpperCase() || 'H';

      setUser({ name, role, initials, firstInitial, photoUrl: '' });
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return user;
}

function ATSContent() {
  const { screen, navigate, errorMessage, clearError } = useATS();
  const currentUser = useCurrentUser();

  return (
    <div className="flex min-h-screen bg-[#f8f6fb] text-[#1d132f]">
      <aside className="fixed left-0 top-0 z-[100] flex h-screen w-[210px] flex-col border-r border-[#ece5f7] bg-[#f1ebf8]">
        <div className="border-b border-[#e7def3] bg-white px-6 py-5 text-[18px] font-semibold text-[#17111f]">
          ObserveNow People
        </div>

        <div className="px-3.5 pt-6">
          <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c90af]">
            General
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-3 rounded-lg px-3.5 py-3 text-[14px] font-medium text-[#3d334b]">
              <span className="flex h-5 w-5 items-center justify-center text-[#7d6f93]">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0" />
                </svg>
              </span>
              Onboarding
            </div>

            <button
              onClick={() => navigate('dashboard')}
              className="flex items-center gap-3 rounded-lg bg-[#e7def3] px-3.5 py-3 text-left text-[14px] font-semibold text-[#2f124f] shadow-[inset_0_0_0_1px_rgba(118,79,168,0.08)]"
            >
              <span className="flex h-5 w-5 items-center justify-center text-[#4f2886]">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="12" height="10" rx="1.5" />
                  <path d="M5 7h6M5 10h4" />
                </svg>
              </span>
              Recruitment
            </button>
          </div>
        </div>

        {/* ── Real logged-in user ── */}
        <div className="mt-auto border-t border-[#e7def3] bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.name}
                className="h-11 w-11 rounded-full border border-[#e7def3] object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#efe2ff] text-[14px] font-semibold text-[#6e33b4]">
                {currentUser.initials}
              </div>
            )}
            <div>
              <div className="text-[14px] font-semibold text-[#231736]">{currentUser.name}</div>
              <div className="text-[12px] text-[#9b90aa]">{currentUser.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-[210px] min-h-screen flex-1">
        <div className="sticky top-0 z-[70] flex h-[52px] items-center justify-between border-b border-[#ebe5f4] bg-white px-8">
          <div className="text-[15px] font-medium text-[#36244f]">Hello, {currentUser.name}!</div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-[180px] items-center gap-2 rounded-md border border-[#ebe4f2] bg-[#fcfbfe] px-3 text-[12px] text-[#a396b5]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              Search
            </div>
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.name}
                className="h-9 w-9 rounded-full border border-[#ebe4f2] object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1e7ff] text-[12px] font-semibold text-[#6e33b4]">
                {currentUser.firstInitial}
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              <span className="font-medium">Parsing issue:</span>
              <span className="flex-1">{errorMessage}</span>
              <button
                onClick={clearError}
                className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {screen === 'dashboard' && <DashboardScreen />}
        {screen === 'results' && <ResultsScreen />}
        {screen === 'candidate' && <CandidateScreen />}
        {screen === 'offer' && <OfferScreen />}
      </main>

      <InterviewModal />
      <WeightSettingsModal />
      <ParseProgressModal />
    </div>
  );
}

export default function App() {
  return (
    <ATSProvider>
      <ATSContent />
    </ATSProvider>
  );
}

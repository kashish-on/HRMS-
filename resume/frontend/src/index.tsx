import { ATSProvider, useATS } from './context/ATSContext';
import DashboardScreen from './components/dashboard/DashboardScreen';
import ResultsScreen from './components/results/ResultsScreen';
import CandidateScreen from './components/candidate/CandidateScreen';
import OfferScreen from './components/offer/OfferScreen';
import InterviewModal from './components/modals/interview/InterviewModal';
import WeightSettingsModal from './components/modals/WeightSettingsModal';
import ParseProgressModal from './components/modals/ParseProgressModal';

function ATSContent() {
  const { screen, navigate } = useATS();

  return (
    <div className="flex min-h-screen bg-[#F8F7F4]">
      {/* Sidebar */}
      <aside className="w-[200px] bg-white border-r border-stone-200 flex flex-col flex-shrink-0 fixed top-0 left-0 h-screen z-[100]">
        <div className="px-4 py-5 border-b border-stone-200 text-[14px] font-semibold text-stone-900">
          Observe<span className="text-[#534AB7]">Now</span> People
        </div>

        <div className="px-3 py-3 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">General</div>

        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-md mx-2 my-0.5 text-[13px] text-stone-500 cursor-pointer hover:bg-stone-50 hover:text-stone-700 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0" />
          </svg>
          Onboarding
        </div>

        <div
          onClick={() => navigate('dashboard')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md mx-2 my-0.5 text-[13px] cursor-pointer transition-colors bg-purple-50 text-[#534AB7] font-medium"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M5 7h6M5 10h4" />
          </svg>
          Recruitment
        </div>

        {/* User at bottom */}
        <div className="mt-auto px-4 py-3.5 border-t border-stone-200 flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-full bg-purple-100 flex items-center justify-center text-[11px] font-semibold text-purple-700 flex-shrink-0">
            AN
          </div>
          <div>
            <div className="text-[12px] font-medium text-stone-800">Anchal</div>
            <div className="text-[11px] text-stone-400">HR Manager</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[200px] flex-1 min-h-screen">
        {screen === 'dashboard' && <DashboardScreen />}
        {screen === 'results' && <ResultsScreen />}
        {screen === 'candidate' && <CandidateScreen />}
        {screen === 'offer' && <OfferScreen />}
      </main>

      {/* Global Modals */}
      <InterviewModal />
      <WeightSettingsModal />
      <ParseProgressModal />
    </div>
  );
}

export default function ATSPage() {
  return (
    <ATSProvider>
      <ATSContent />
    </ATSProvider>
  );
}

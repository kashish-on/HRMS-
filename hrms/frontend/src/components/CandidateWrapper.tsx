import { CandidateHeader } from "@/components/CandidateHeader";
import { NavLink } from "@/components/NavLink";
import observeNowPeopleLogo from "@/assets/observenow_people.png";
import { UserPlus } from "lucide-react";
import { useLocation } from "react-router-dom";

const CandidateWrapper = ({ children }: any) => {
  const location = useLocation();
  const isCandidateSectionActive = location.pathname.startsWith("/candidate");

  return (
    <div className="min-h-screen flex bg-muted/30">
      <div className="w-64 bg-white border-r border-border p-4">
        <div className="pb-2">
          <img
            src={observeNowPeopleLogo}
            alt="ObserveNow People"
            className="h-16 w-auto object-contain"
          />
        </div>

        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            General
          </p>
        </div>

        <NavLink
          to="/candidate"
          end
          className={`mt-3 flex items-center gap-2 rounded-md px-4 py-3 transition-colors ${
            isCandidateSectionActive
              ? "text-foreground hover:bg-accent"
              : "bg-primary text-primary-foreground"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Onboarding
        </NavLink>
      </div>

      <div className="flex-1 flex flex-col">
        <CandidateHeader />

        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  );
};

export default CandidateWrapper;

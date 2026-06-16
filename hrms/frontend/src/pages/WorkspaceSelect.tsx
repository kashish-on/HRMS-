import { Button } from "@/components/ui/button";
import observeNowPeopleLogo from "@/assets/observenow_people.png";
import jobApplicantsImage from "@/assets/job.png";
import { ArrowRight, BriefcaseBusiness, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getResumeAppUrl } from "@/lib/backend";
import { supabase } from "@/lib/supabase";

const WorkspaceSelect = () => {
  const navigate = useNavigate();

  const openResumeModule = async () => {
    const resumeUrl = new URL(getResumeAppUrl());
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token && session?.refresh_token) {
      resumeUrl.searchParams.set("access_token", session.access_token);
      resumeUrl.searchParams.set("refresh_token", session.refresh_token);
    }

    window.location.assign(resumeUrl.toString());
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#faf7ff_0%,#f5f0fb_100%)] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex items-center justify-between rounded-[28px] border border-white/70 bg-white/90 px-8 py-6 shadow-[0_18px_50px_rgba(91,55,145,0.08)] backdrop-blur">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <img
                src={observeNowPeopleLogo}
                alt="ObserveNow People"
                className="h-14 w-auto object-contain"
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#8d7ca8]">
                  HR Workspace
                </p>
                <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#211633]">
                  Choose where you want to work today
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#6f6384]">
              Start from onboarding operations or jump into job applicant screening. This step is only a launcher and does not change any existing module behavior.
            </p>
          </div>

          <Button
            variant="outline"
            className="h-11 rounded-full border-[#d9cfee] px-5 text-[#4e2b84] hover:bg-[#f6f1ff]"
            onClick={() => navigate("/dashboard")}
          >
            Skip to onboarding
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="group rounded-[30px] border border-[#e8def6] bg-white p-7 shadow-[0_20px_50px_rgba(92,59,140,0.08)] transition-transform duration-200 hover:-translate-y-1">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#efe5ff] text-[#6f2dbd]">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a89b8]">
                    Module 01
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#23163a]">
                    Onboarding People
                  </h2>
                </div>
              </div>

              <span className="rounded-full bg-[#f4effd] px-3 py-1 text-xs font-medium text-[#6f2dbd]">
                HRMS
              </span>
            </div>

            <p className="mt-5 text-sm leading-6 text-[#6f6384]">
              Manage new joiners, document verification, IT assets, induction, probation, and HR onboarding progress from the existing onboarding dashboard.
            </p>

            <div className="mt-6 overflow-hidden rounded-[22px] border border-[#efe6fb] bg-[linear-gradient(135deg,#faf7ff_0%,#f4ecff_100%)] p-4">
              <img
                src={observeNowPeopleLogo}
                alt="Onboarding module preview"
                className="h-28 w-full rounded-2xl object-contain bg-white px-4 py-4"
              />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.18em] text-[#a292bc]">
                Continue with current onboarding flow
              </div>
              <Button
                className="h-11 rounded-full bg-[#5e22a4] px-5 text-white hover:bg-[#4f1b8c]"
                onClick={() => navigate("/dashboard")}
              >
                Open onboarding
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>

          <section className="group rounded-[30px] border border-[#e8def6] bg-white p-7 shadow-[0_20px_50px_rgba(92,59,140,0.08)] transition-transform duration-200 hover:-translate-y-1">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#efe5ff] text-[#6f2dbd]">
                  <BriefcaseBusiness className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a89b8]">
                    Module 02
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#23163a]">
                    Job Applicants
                  </h2>
                </div>
              </div>

              <span className="rounded-full bg-[#f4effd] px-3 py-1 text-xs font-medium text-[#6f2dbd]">
                Resume ATS
              </span>
            </div>

            <p className="mt-5 text-sm leading-6 text-[#6f6384]">
              Review parsed resumes, shortlist candidates, move applicants through interview stages, and manage ATS actions inside the recruitment module.
            </p>

            <div className="mt-6 overflow-hidden rounded-[22px] border border-[#efe6fb] bg-[linear-gradient(135deg,#faf7ff_0%,#f4ecff_100%)] p-6 flex h-28 items-center justify-center">
              <BriefcaseBusiness className="h-16 w-16 text-[#6f2dbd]" />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.18em] text-[#a292bc]">
                Opens the resume shortlisting module
              </div>
              <Button
                className="h-11 rounded-full bg-[#5e22a4] px-5 text-white hover:bg-[#4f1b8c]"
                onClick={openResumeModule}
              >
                Open job applicants
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSelect;

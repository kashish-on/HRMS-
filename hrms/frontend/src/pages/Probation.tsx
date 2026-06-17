import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, CalendarDays, Clock3, CircleDotDashed, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import CandidateWrapper from "@/components/CandidateWrapper";

const steps = [
  "OFFER RELEASED",
  "OFFER ACCEPTED",
  "DOCUMENTS SUBMITTED",
  "HR VERIFICATION",
  "IT ASSET ASSIGNED",
  "INDUCTION COMPLETED",
  "PROBATION STARTED",
];

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const upsertProbationDetails = async (payload: {
  employee_id: string;
  status: string;
  start_date: string;
  end_date: string;
  duration_days: number;
}) => {
  const { data: existingRow, error: fetchError } = await supabase
    .from("probation_details")
    .select("id")
    .eq("employee_id", payload.employee_id)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const detailsPayload = {
    ...payload,
    submitted_at: new Date().toISOString(),
  };

  if (existingRow?.id) {
    const { error } = await supabase
      .from("probation_details")
      .update(detailsPayload)
      .eq("employee_id", payload.employee_id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("probation_details")
    .insert(detailsPayload);

  if (error) throw error;
};

export default function ProbationPage() {
  const [confirmedAt, setConfirmedAt] = useState<Date | null>(null);
  const [probationStarted, setProbationStarted] = useState(false);
  const [probationApproved, setProbationApproved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchProbationDetails = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("probation_details")
        .select("status, start_date")
        .eq("employee_id", user.id)
        .maybeSingle();

      if (!mounted || !data) return;

      if (data.start_date) {
        setConfirmedAt(new Date(data.start_date));
      }

      const normalizedStatus = data.status?.toLowerCase() || "";

      if (normalizedStatus === "active" || normalizedStatus === "approved" || normalizedStatus === "completed") {
        setProbationStarted(true);
      }

      if (normalizedStatus === "approved" || normalizedStatus === "completed") {
        setProbationApproved(true);
      }
    };

    fetchProbationDetails();

    return () => {
      mounted = false;
    };
  }, []);

  const startDate = useMemo(() => confirmedAt || new Date(), [confirmedAt]);
  const endDate = useMemo(() => {
    const next = new Date(startDate);
    next.setDate(next.getDate() + 30);
    return next;
  }, [startDate]);

  const handleConfirmProbation = async () => {
    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User not authenticated");
        return;
      }

      const now = new Date();
      const finalEndDate = new Date(now);
      finalEndDate.setDate(finalEndDate.getDate() + 30);

      await upsertProbationDetails({
        employee_id: user.id,
        status: "Active",
        start_date: now.toISOString().split("T")[0],
        end_date: finalEndDate.toISOString().split("T")[0],
        duration_days: 30,
      });

      setConfirmedAt(now);
      setProbationStarted(true);
    } catch (error: any) {
      alert(error.message || "Unable to start probation.");
    } finally {
      setSaving(false);
    }
  };

  const probationDetails = [
    {
      label: "PROBATION PERIOD STATUS",
      value: "Active",
      icon: CircleDotDashed,
      valueClassName:
        "inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700",
    },
    {
      label: "START DATE",
      value: formatDisplayDate(startDate),
      icon: CalendarDays,
      valueClassName: "text-sm font-medium text-foreground",
    },
    {
      label: "END DATE",
      value: formatDisplayDate(endDate),
      icon: CalendarDays,
      valueClassName: "text-sm font-medium text-foreground",
    },
    {
      label: "DURATION",
      value: "30 Days",
      icon: Clock3,
      valueClassName: "text-sm font-medium text-foreground",
    },
  ];
  const currentStep = probationApproved ? 8 : 7;

  return (
    <CandidateWrapper>
      <div className="flex w-full">
        <div className="flex-1 p-6 space-y-6">
          <h1 className="text-2xl font-bold">Candidate Detail</h1>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Onboarding Progress</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex items-center justify-between px-4">
                {steps.map((label, i) => {
                  const stepIndex = i + 1;

                  return (
                    <div key={i} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        {probationApproved || stepIndex < currentStep ? (
                          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle2 className="text-white h-5 w-5" />
                          </div>
                        ) : stepIndex === currentStep ? (
                          <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                            {stepIndex}
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold">
                            {stepIndex}
                          </div>
                        )}

                        <p className={`text-[10px] mt-2 text-center font-semibold whitespace-pre-line ${
                          probationApproved || stepIndex < currentStep ? "text-green-500" : "text-muted-foreground"
                        }`}>
                          {label}
                        </p>
                      </div>

                      {i !== steps.length - 1 && (
                        <div
                          className={`flex-1 h-[2px] mx-2 ${
                            probationApproved || stepIndex < currentStep ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {probationStarted ? (
            <div className="rounded-xl border border-green-200 bg-green-100/70 px-5 py-4">
              <div className="flex items-center gap-3 text-green-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">
                  {probationApproved
                    ? "Your probation has been approved successfully."
                    : "Your probation has been successfully confirmed and is currently awaiting final HR approval."}
                </p>
              </div>
            </div>
          ) : (
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <UserRoundCheck className="h-4 w-4 text-primary" />
                  Probation Period
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-5">
                  {probationDetails.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-purple-50 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </p>
                          <div className={item.valueClassName}>{item.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center pt-4">
                  <Button
                    disabled={saving}
                    onClick={handleConfirmProbation}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Confirm & Start Probation
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </CandidateWrapper>
  );
}

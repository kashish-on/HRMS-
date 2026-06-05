import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const checklistItems = [
  { key: "hr_orientation", label: "HR Orientation" },
  { key: "team_introduction", label: "Team Introduction" },
  { key: "system_setup", label: "System Setup" },
  { key: "policy_training", label: "Policy Training" },
  { key: "security_briefing", label: "Security Briefing" },
  { key: "manager_connect", label: "Manager Connect" },
] as const;

const upsertInductionDetails = async (
  employeeId: string,
  values: Record<string, boolean>
) => {
  const { data: existingRow, error: fetchError } = await supabase
    .from("induction_details")
    .select("id")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const payload = {
    employee_id: employeeId,
    ...values,
    submitted_at: new Date().toISOString(),
  };

  if (existingRow?.id) {
    const { error } = await supabase
      .from("induction_details")
      .update(payload)
      .eq("employee_id", employeeId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("induction_details")
    .insert(payload);

  if (error) throw error;
};

export default function InductionPage() {
  const currentStep = 6;
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({
    hr_orientation: false,
    team_introduction: false,
    system_setup: false,
    policy_training: false,
    security_briefing: false,
    manager_connect: false,
  });

  useEffect(() => {
    let mounted = true;

    const fetchInductionDetails = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("induction_details")
        .select("*")
        .eq("employee_id", user.id)
        .maybeSingle();

      if (!mounted || !data) return;

      setChecklistState({
        hr_orientation: data.hr_orientation === true,
        team_introduction: data.team_introduction === true,
        system_setup: data.system_setup === true,
        policy_training: data.policy_training === true,
        security_briefing: data.security_briefing === true,
        manager_connect: data.manager_connect === true,
      });
    };

    fetchInductionDetails();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveAndContinue = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("User not authenticated");
      return;
    }

    try {
      setSaving(true);
      await upsertInductionDetails(user.id, checklistState);
      navigate("/probation");
    } catch (error: any) {
      alert(error.message || "Unable to save induction details.");
    } finally {
      setSaving(false);
    }
  };

  const allChecklistCompleted = Object.values(checklistState).every(Boolean);

  return (
    <CandidateWrapper>
      <div className="flex w-full">
        <div className="flex-1 p-6 space-y-6">
          <h1 className="text-2xl font-bold">Employee Detail</h1>

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
                        {stepIndex < currentStep ? (
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
                          stepIndex < currentStep ? "text-green-500" : "text-muted-foreground"
                        }`}>
                          {label}
                        </p>
                      </div>

                      {i !== steps.length - 1 && (
                        <div
                          className={`flex-1 h-[2px] mx-2 ${
                            stepIndex < currentStep ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Induction Checklist</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {checklistItems.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={checklistState[item.key]}
                    onCheckedChange={(checked) =>
                      setChecklistState((prev) => ({
                        ...prev,
                        [item.key]: checked === true,
                      }))
                    }
                  />
                  <span className="text-sm">{item.label}</span>
                </div>
              ))}

              <div className="flex flex-col items-center gap-2 mt-4">
                <Button
                  className="bg-purple-600 text-white"
                  disabled={saving || !allChecklistCompleted}
                  onClick={handleSaveAndContinue}
                >
                  Save & Continue
                </Button>
                {!allChecklistCompleted && (
                  <p className="text-xs text-muted-foreground">
                    Complete all induction checklist items before continuing.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CandidateWrapper>
  );
}

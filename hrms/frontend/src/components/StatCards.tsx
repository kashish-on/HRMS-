import { useEffect, useState } from "react";
import {
  UserPlus,
  FileCheck,
  CalendarCheck,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type StatCardsProps = {
  activeCard: string;
  onFilterChange: (card: string) => void;
};

const buildTaskMap = (taskRows: any[]) =>
  (taskRows || []).reduce((acc: Record<string, any>, task: any) => {
    if (!task?.employee_id) return acc;

    const existing = acc[task.employee_id] || {};

    acc[task.employee_id] = {
      ...existing,
      employee_id: task.employee_id,
      document_submitted:
        existing.document_submitted === true || task.document_submitted === true,
      offer_accepted:
        existing.offer_accepted === true || task.offer_accepted === true,
      hr_verification:
        existing.hr_verification === true || task.hr_verification === true,
      asset_assigned:
        existing.asset_assigned === true || task.asset_assigned === true,
    };

    return acc;
  }, {});

export function StatCards({ activeCard, onFilterChange }: StatCardsProps) {
  const [statsData, setStatsData] = useState({
    totalNewJoiners: 0,
    offerAccepted: 0,
    joiningToday: 0,
    docsPending: 0,
    bgPending: 0,
    completed: 0,
  });

// useEffect(() => {
//   const fetchStats = async () => {
//     const today = new Date().toISOString().split("T")[0];

//     try {
//       /* ✅ FETCH DATA */
//       const { data: candidates } = await supabase
//         .from("candidates")
//         .select("*");

//       const { data: tasks } = await supabase
//         .from("onboarding_tasks")
//         .select("*");

//       if (!candidates || !tasks) return;

//       /* ✅ TOTAL NEW JOINERS */
//       const totalNewJoiners = candidates.length;

//       /* ✅ OFFER ACCEPTED (FIXED COLUMN) */
//       const offerAccepted = candidates.filter(
//         (c) => c.onboarding_status === "accepted"
//       ).length;

//       /* ✅ JOINING TODAY */
//       const joiningToday = candidates.filter(
//         (c) => c.joining_date === today
//       ).length;

//       /* ✅ DOCS PENDING */
//       const docsPending = tasks.filter(
//         (t) => !t.document_submitted
//       ).length;

//       /* ✅ BG PENDING */
//       const bgPending = tasks.filter(
//         (t) => !t.bg_verification
//       ).length;

//       /* ✅ ONBOARDING COMPLETED (FIXED COLUMN) */
//       const completed = candidates.filter(
//         (c) => c.onboarding_status === "completed"
//       ).length;

//       setStatsData({
//         totalNewJoiners,
//         offerAccepted,
//         joiningToday,
//         docsPending,
//         bgPending,
//         completed,
//       });
//     } catch (err) {
//       console.error("Error fetching stats:", err);
//     }
//   };

//   fetchStats();
// }, []);

useEffect(() => {
  const fetchStats = async () => {
    const today = new Date().toISOString().split("T")[0];

    try {
      /* ✅ FETCH WITH JOIN */
      const { data: candidates } = await supabase
        .from("candidates")
        .select("*");

      const { data: taskRows } = await supabase
        .from("onboarding_tasks")
        .select(`
          employee_id,
          document_submitted,
          offer_accepted,
          hr_verification,
          asset_assigned
        `);

      const { data: probationRows } = await supabase
        .from("probation_details")
        .select(`
          employee_id,
          status
        `);

      if (!candidates || !taskRows) return;

      const tasksByEmployeeId = buildTaskMap(taskRows);
      const probationApprovedIds = new Set(
        (probationRows || [])
          .filter((row: any) =>
            ["approved", "completed"].includes(row?.status?.toLowerCase?.() || "")
          )
          .map((row: any) => row.employee_id)
      );

      /* ✅ TOTAL */
      const totalNewJoiners = candidates.length;

      /* ✅ OFFER ACCEPTED */
      const offerAccepted = candidates.filter(
        (c) => tasksByEmployeeId[c.id]?.offer_accepted === true
      ).length;

      /* ✅ JOINING TODAY */
      const joiningToday = candidates.filter(
        (c) => c.joining_date === today
      ).length;

      /* 🔥 DOCS PENDING (FIXED) */
      const docsPending = candidates.filter((c) => {
        const task = tasksByEmployeeId[c.id];
        return !task?.document_submitted;
      }).length;

      /* 🔥 BG PENDING (FIXED) */
      const bgPending = candidates.filter((c) => {
        const task = tasksByEmployeeId[c.id];
        return !task?.hr_verification;
      }).length;

      /* ✅ COMPLETED */
      const completed = candidates.filter((c) =>
        probationApprovedIds.has(c.id)
      ).length;

      setStatsData({
        totalNewJoiners,
        offerAccepted,
        joiningToday,
        docsPending,
        bgPending,
        completed,
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  fetchStats();

  const handleWindowFocus = () => {
    fetchStats();
  };

  window.addEventListener("focus", handleWindowFocus);

  const channel = supabase
    .channel("dashboard-stat-cards")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "onboarding_tasks" },
      () => {
        fetchStats();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "candidates" },
      () => {
        fetchStats();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "probation_details" },
      () => {
        fetchStats();
      }
    )
    .subscribe();

  return () => {
    window.removeEventListener("focus", handleWindowFocus);
    supabase.removeChannel(channel);
  };
}, []);

  /* 🔥 ORIGINAL UI STRUCTURE (PRESERVED) */
  const stats = [
    {
      key: "all",
      label: "TOTAL NEW JOINERS",
      value: statsData.totalNewJoiners,
      icon: UserPlus,
      iconColor: "text-primary bg-primary/10",
      borderColor: "border-l-primary",
    },
    {
      key: "offer",
      label: "OFFER ACCEPTED",
      value: statsData.offerAccepted,
      icon: FileCheck,
      iconColor: "text-orange-500 bg-orange-100",
      borderColor: "border-l-orange-500",
    },
    {
      key: "today",
      label: "JOINING TODAY",
      value: statsData.joiningToday,
      icon: CalendarCheck,
      iconColor: "text-green-600 bg-green-100",
      borderColor: "border-l-green-500",
    },
    {
      key: "docs",
      label: "DOCS PENDING",
      value: statsData.docsPending,
      icon: FileText,
      iconColor: "text-yellow-600 bg-yellow-100",
      borderColor: "border-l-yellow-500",
    },
    {
      key: "bg",
      label: "BG VERIFICATION PENDING",
      value: statsData.bgPending,
      icon: ShieldCheck,
      iconColor: "text-red-500 bg-red-100",
      borderColor: "border-l-red-500",
    },
    {
      key: "completed",
      label: "ONBOARDING COMPLETED",
      value: statsData.completed,
      icon: CheckCircle2,
      iconColor: "text-green-600 bg-green-100",
      borderColor: "border-l-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {stats.map((stat) => {
        const isActive = activeCard === stat.key;

        return (
          <div
            key={stat.key}
            onClick={() => onFilterChange(stat.key)}
            className={`cursor-pointer rounded-lg border border-border border-l-4 p-4 space-y-2 transition
              ${
                isActive
                  ? "border-primary bg-primary/5 shadow"
                  : `bg-card ${stat.borderColor} hover:border-primary/40`
              }
            `}
          >
            {/* Icon */}
            <div className="flex items-center justify-between">
              <div
                className={`p-2 rounded-md ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : stat.iconColor
                }`}
              >
                <stat.icon className="h-4 w-4" />
              </div>
            </div>

            {/* Label */}
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>

            {/* Value */}
            <span className="text-2xl font-bold">
              {stat.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

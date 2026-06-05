// import { useState } from "react";
// import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
// import { Button } from "@/components/ui/button";

// import { useNavigate } from "react-router-dom";


// const alerts = [
//   {
//     title: "Joining tomorrow – Docs pending",
//     employee: "John Doe",
//     id: "EMP-0942",
//     color: "border-l-red-500 bg-red-50",
//   },
//   {
//     title: "Joining tomorrow – IT Asset not assigned",
//     employee: "John Doe",
//     id: "EMP-0942",
//     color: "border-l-red-500 bg-red-50",
//   },
//   {
//     title: "Joining tomorrow – Background check delayed",
//     employee: "John Doe",
//     id: "EMP-0942",
//     color: "border-l-yellow-500 bg-yellow-50",
//   },
//   {
//     title: "Joining tomorrow – Offer accepted today",
//     employee: "John Doe",
//     id: "EMP-0942",
//     color: "border-l-green-500 bg-green-50",
//   },
// ];

// export function ActionRequired() {
//   const navigate = useNavigate();
  
//   const [isOpen, setIsOpen] = useState(false);

//   return (
//     <div className="mb-6 bg-card border border-border rounded-lg p-5">

//       {/* Header */}
//       <div className="flex items-center justify-between mb-4">
//         <div className="flex items-center gap-2">
//           <AlertTriangle className="h-5 w-5 text-yellow-500" />
//           <span className="font-semibold text-foreground">Action Required</span>

//           <span className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
//             {alerts.length} Alerts
//           </span>
//         </div>

//         <button
//           onClick={() => setIsOpen(!isOpen)}
//           className="flex items-center gap-1 text-sm text-primary hover:underline font-medium"
//         >
//           View All Notifications
//           {isOpen ? (
//             <ChevronUp className="h-4 w-4" />
//           ) : (
//             <ChevronDown className="h-4 w-4" />
//           )}
//         </button>
//       </div>

//       {/* Dropdown Content */}
//       {isOpen && (
//         <div className="space-y-3">
//           {alerts.map((alert, i) => (
//             <div
//               key={i}
//               className={`flex items-center justify-between border-l-4 ${alert.color} rounded-r-md px-4 py-3`}
//             >
//               <div>
//                 <p className="text-sm font-medium text-foreground">
//                   {alert.title}
//                 </p>

//                 <p className="text-xs text-muted-foreground">
//                   Employee: {alert.employee}{" "}
//                   <span className="text-muted-foreground/70">
//                     ID: {alert.id}
//                   </span>
//                 </p>
//               </div>

//               <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => navigate(`/dashboard/employee/EMP-0942`)}>
//                 View Profile
//               </Button>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

import { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

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

export function ActionRequired() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        /* ✅ FETCH DATA */
        const { data: candidates, error: cError } = await supabase
          .from("candidates")
          .select("*");

        const { data: tasks, error: tError } = await supabase
          .from("onboarding_tasks")
          .select("*");

        const { data: documents, error: dError } = await supabase
          .from("documents")
          .select("employee_id, document_type");

        if (cError || tError || dError) {
          console.error(cError || tError || dError);
          return;
        }

        if (!candidates || !tasks || !documents) return;

        const tasksByEmployeeId = buildTaskMap(tasks);
        const generatedAlerts: any[] = [];

        candidates.forEach((c: any) => {
          const task = tasksByEmployeeId[c.id];
          const candidateDocuments = documents.filter((d: any) => d.employee_id === c.id);
          const hasSubmittedDocuments = candidateDocuments.length > 0;

          if (!task) return;

          /* 🔴 DOCS PENDING */
          if (!hasSubmittedDocuments) {
            generatedAlerts.push({
              title: "Docs pending",
              employee: c.name,
              id: c.employee_id,
              fullId: c.id,
              color: "border-l-red-500 bg-red-50",
            });
          }

          /* 🔴 IT ASSET NOT ASSIGNED */
          if (!task.asset_assigned) {
            generatedAlerts.push({
              title: "IT Asset not assigned",
              employee: c.name,
              id: c.employee_id,
              fullId: c.id,
              color: "border-l-red-500 bg-red-50",
            });
          }

          /* 🟡 BACKGROUND CHECK */
          if (!task.hr_verification) {
            generatedAlerts.push({
              title: "HR verification pending",
              employee: c.name,
              id: c.employee_id,
              fullId: c.id,
              color: "border-l-yellow-500 bg-yellow-50",
            });
          }

          /* 🟢 OFFER ACCEPTED */
          if (c.status === "accepted") {
            generatedAlerts.push({
              title: "Offer accepted",
              employee: c.name,
              id: c.employee_id,
              fullId: c.id,
              color: "border-l-green-500 bg-green-50",
            });
          }
        });

        setAlerts(generatedAlerts);
      } catch (err) {
        console.error("Error fetching alerts:", err);
      }
    };

    fetchAlerts();
  }, []);

  return (
    <div className="mb-6 bg-card border border-border rounded-lg p-5">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />

          <span className="font-semibold text-foreground">
            Action Required
          </span>

          <span className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {alerts.length} Alerts
          </span>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm text-primary hover:underline font-medium"
        >
          View All Notifications
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ALERT LIST */}
      {isOpen && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No alerts 🎉
            </p>
          ) : (
            alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center justify-between border-l-4 ${alert.color} rounded-r-md px-4 py-3`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {alert.title}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Employee: {alert.employee}{" "}
                    <span className="text-muted-foreground/70">
                      ID: {alert.id}
                    </span>
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                    className="text-xs h-8"
                    onClick={() =>
                    navigate(`/dashboard/employee/${alert.fullId}`)
                    }
                  >
                  View Profile
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

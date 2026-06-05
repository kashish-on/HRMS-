import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatCards } from "@/components/StatCards";
import { ActionRequired } from "@/components/ActionRequired";
import { NewJoinersTable } from "@/components/NewJoinersTable";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Routes, Route } from "react-router-dom";
import CandidateDetail from "@/pages/CandidateDetail";
import CandidateOnboarding from "@/pages/CandidateOnboarding";
import UserProfile from "@/pages/UserProfile";
import EditProfile from "@/pages/EditProfile";

import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Dashboard = () => {
    const navigate = useNavigate();
    const [activeCard, setActiveCard] = useState("all")
    const [dateRange, setDateRange] = useState("all")
    const [department, setDepartment] = useState("all")
    const [status, setStatus] = useState("all")
    const [searchTerm, setSearchTerm] = useState("")
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          <main className="flex-1 p-6 overflow-auto">
             <Routes>

    <Route
      index
      element={
        <>
            {/* Title + Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h1 className="text-2xl font-bold text-foreground">Onboarding Dashboard</h1>
              <div className="flex items-center gap-2">
                <Button
                onClick={() => navigate("/dashboard/employee/add")}
    className="h-9 px-4 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
  >
    <Plus className="h-3.5 w-3.5" />
    Add Candidate
  </Button>
              </div>
            </div>

            <StatCards
        activeCard={activeCard}
        onFilterChange={(card) => setActiveCard(card)}
      />
            {/* <ActionRequired /> */}
            {activeCard === "all" && <ActionRequired />}
            <NewJoinersTable
              activeCard={activeCard}
              setActiveCard={setActiveCard}
              dateRange={dateRange}
              department={department}
              status={status}
              searchTerm={searchTerm}
              setDateRange={setDateRange}
              setDepartment={setDepartment}
              setStatus={setStatus}
            />
            </>
      }
    />
    {/* <Route path="employee" element={<NewJoinersTable activeCard={activeCard} setActiveCard={setActiveCard} />} /> */}
    <Route path="employee/:id" element={<CandidateDetail />} />
    <Route path="employee/:id/edit" element={<EditProfile />} />

    <Route path="employee/add" element={<CandidateOnboarding />} />

    <Route path="profile" element={<UserProfile />} />

    <Route path="profile/edit" element={<EditProfile />} />

  </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;

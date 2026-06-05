import { useState, useEffect } from "react"
import {
  Pencil,
  Eye,
  FileText,
  ShieldCheck,
  Laptop,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type StatusType = "completed" | "pending" | "overdue"

type StatusChecklistType = {
  document: StatusType
  bg: StatusType
  it: StatusType
}

type NewJoinersTableProps = {
  activeCard: string
  setActiveCard: (card: string) => void
  dateRange: string
  department: string
  status: string
  searchTerm: string
  setDateRange: (value: string) => void
  setDepartment: (value: string) => void
  setStatus: (value: string) => void
}

const checklistConfig = {
  document: {
    icon: FileText,
    label: "Document Status",
  },
  bg: {
    icon: ShieldCheck,
    label: "BG Check Status",
  },
  it: {
    icon: Laptop,
    label: "IT Asset Status",
  },
}

const statusColors: Record<StatusType, string> = {
  completed: "text-green-500",
  pending: "text-yellow-500",
  overdue: "text-red-500",
}

const buildTaskMap = (taskRows: any[]) =>
  (taskRows || []).reduce((acc: Record<string, any>, task: any) => {
    if (!task?.employee_id) return acc

    const existing = acc[task.employee_id] || {}

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
    }

    return acc
  }, {})

export function NewJoinersTable({
  activeCard,
  setActiveCard,
  dateRange,
  department,
  status,
  searchTerm,
  setDateRange,
  setDepartment,
  setStatus,
}: NewJoinersTableProps) {

  const [joiners, setJoiners] = useState<any[]>([])
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  const navigate = useNavigate()
  const ITEMS_PER_PAGE = 5

  // 🔥 FETCH DATA FROM SUPABASE
  useEffect(() => {
    fetchJoiners()

    const handleWindowFocus = () => {
      fetchJoiners()
    }

    window.addEventListener("focus", handleWindowFocus)

    const channel = supabase
      .channel("dashboard-new-joiners")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_tasks" },
        () => {
          fetchJoiners()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidates" },
        () => {
          fetchJoiners()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "probation_details" },
        () => {
          fetchJoiners()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchJoiners = async () => {
 
  const { data: candidates, error } = await supabase
  .from("candidates")
  .select(`
    *,
    departments ( name )
  `)

  const { data: taskRows, error: tasksError } = await supabase
    .from("onboarding_tasks")
    .select(`
      employee_id,
      document_submitted,
      offer_accepted,
      hr_verification,
      asset_assigned
    `)

  const { data: probationRows, error: probationError } = await supabase
    .from("probation_details")
    .select(`
      employee_id,
      status
    `)

    if (error || tasksError || probationError) {
      console.error("Error fetching candidates:", error || tasksError || probationError)
      return
    }

    const tasksByEmployeeId = buildTaskMap(taskRows || [])
    const probationApprovedIds = new Set(
      (probationRows || [])
        .filter((row: any) =>
          ["approved", "completed"].includes(row?.status?.toLowerCase?.() || "")
        )
        .map((row: any) => row.employee_id)
    )

const formatted = candidates.map((c: any) => {
  const task = tasksByEmployeeId[c.id] || {}
  const hasSubmittedDocuments = task.document_submitted === true
  const isHrVerificationCompleted = task.hr_verification === true
  const isOnboardingCompleted = probationApprovedIds.has(c.id)

  return {
    name: c.name,
    empId: c.id?.slice(0, 6), // for UI display
    fullId: c.id, // 🔥 ADD THIS (IMPORTANT)

    offerAccepted: task.offer_accepted === true,
    designation: c.designation || "-",
    dept: c.departments?.name || "-",
    manager: c.reporting_manager || "-",
    date: c.joining_date || "-",
    obStatus: isOnboardingCompleted
      ? 100
      : task.asset_assigned
      ? 85
      : isHrVerificationCompleted
      ? 65
      : hasSubmittedDocuments
      ? 45
      : task.offer_accepted
      ? 25
      : 10,

    onboardingStatus: isOnboardingCompleted
      ? "completed"
      : task.offer_accepted
      ? "accepted"
      : c.onboarding_status,

    statusChecklist: {
      document: hasSubmittedDocuments ? "completed" : "pending",
      bg: isHrVerificationCompleted ? "completed" : "pending",
      it: task.asset_assigned ? "completed" : "pending",
    },
  };
}
);

    setJoiners(formatted)
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(joiners.map((_, i) => i))
    } else {
      setSelectedRows([])
    }
  }

  const toggleRow = (index: number, checked: boolean) => {
    if (checked) {
      setSelectedRows((prev) => [...prev, index])
    } else {
      setSelectedRows((prev) => prev.filter((i) => i !== index))
    }
  }

  const filteredJoiners = joiners.filter((j) => {
    const today = new Date()
    const normalizedSearchTerm = searchTerm.trim().toLowerCase()
    const matchesDepartment =
      department === "all" ||
      j.dept.toLowerCase().includes(department)

    const matchesStatus =
      status === "all" ||
      (status === "pending" && j.onboardingStatus !== "completed") ||
      (status === "completed" && j.onboardingStatus === "completed")

    const matchesDateRange = (() => {
      if (dateRange === "all") return true
      const joinDate = new Date(j.date)
      const diffTime = today.getTime() - joinDate.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (dateRange === "7d") return diffDays <= 7
      if (dateRange === "30d") return diffDays <= 30
      if (dateRange === "90d") return diffDays <= 90
      return true
    })()

    const matchesCard =
      activeCard === "all" ||
      (activeCard === "docs" && j.statusChecklist.document === "pending") ||
      (activeCard === "bg" && j.statusChecklist.bg === "pending") ||
      (activeCard === "offer" && j.offerAccepted === true) ||
      (activeCard === "today" && j.date === today.toISOString().split("T")[0]) ||
      (activeCard === "completed" && j.onboardingStatus === "completed")

    const searchableText = [
      j.name,
      j.empId,
      j.fullId,
      j.designation,
      j.dept,
      j.manager,
      j.date,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const matchesSearch =
      normalizedSearchTerm === "" || searchableText.includes(normalizedSearchTerm)

    return matchesDepartment && matchesStatus && matchesDateRange && matchesCard && matchesSearch
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [activeCard, dateRange, department, status, searchTerm, joiners.length])

  const totalPages = Math.max(1, Math.ceil(filteredJoiners.length / ITEMS_PER_PAGE))
  const paginatedJoiners = filteredJoiners.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const exportCSV = () => {
    const csv = [
      ["Name", "Emp ID", "Designation", "Department"],
      ...filteredJoiners.map((j) => [
        j.name,
        j.empId,
        j.designation,
        j.dept,
      ]),
    ]

    const csvContent =
      "data:text/csv;charset=utf-8," +
      csv.map((e) => e.join(",")).join("\n")

    const link = document.createElement("a")
    link.href = encodeURI(csvContent)
    link.download = "employees.csv"
    link.click()
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5">

      {/* HEADER */}
      <div className="mb-4 rounded-xl border border-border bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-base font-semibold">
              {activeCard === "docs"
                ? "New Joiners - Docs Pending"
                : activeCard === "bg"
                ? "New Joiners - BG Verification Pending"
                : activeCard === "offer"
                ? "New Joiners - Offer Accepted"
                : activeCard === "today"
                ? "New Joiners - Joining Today"
                : activeCard === "completed"
                ? "New Joiners - Onboarding Completed"
                : "New Joiners"}
            </h2>
          </div>

          {activeCard === "all" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-8 w-[126px] border-border bg-white text-[11px]">
                  <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select Range</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-8 w-[128px] border-border bg-white text-[11px]">
                  <SelectValue placeholder="All Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Department</SelectItem>
                  <SelectItem value="tech">TECH</SelectItem>
                  <SelectItem value="sales">SALES</SelectItem>
                  <SelectItem value="ops">OPS</SelectItem>
                  <SelectItem value="mark">MARK</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-[116px] border-border bg-white text-[11px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                className="h-8 bg-primary px-4 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                onClick={exportCSV}
              >
                Export CSV
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setActiveCard("all")}
              className="text-sm font-medium text-primary hover:underline"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedRows.length === joiners.length}
                  onCheckedChange={(checked) =>
                    toggleSelectAll(checked === true)
                  }
                />
              </TableHead>
              <TableHead>EMP. NAME</TableHead>
              <TableHead>EMP. ID</TableHead>
              <TableHead>DESIGNATION</TableHead>
              <TableHead>DEPT</TableHead>
              <TableHead>REPORTING MANAGER</TableHead>
              <TableHead>JOINING DATE</TableHead>
              <TableHead>OB STATUS</TableHead>
              <TableHead>STATUS CHECKLIST</TableHead>
              <TableHead>ACTIONS</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedJoiners.map((j, i) => (
              <TableRow key={`${j.fullId}-${i}`}>

                <TableCell>
                  <Checkbox
                    checked={selectedRows.includes(i)}
                    onCheckedChange={(checked) =>
                      toggleRow(i, checked === true)
                    }
                  />
                </TableCell>

                <TableCell>{j.name}</TableCell>
                <TableCell>{j.empId}</TableCell>
                <TableCell>{j.designation}</TableCell>
                <TableCell>{j.dept}</TableCell>
                <TableCell>{j.manager}</TableCell>
                <TableCell>{j.date}</TableCell>

                <TableCell>
                  <Progress value={j.obStatus} className="h-2 w-24" />
                </TableCell>

                <TableCell>
                  <TooltipProvider>
                    <div className="flex gap-3">
                      {(Object.keys(j.statusChecklist) as (keyof StatusChecklistType)[]).map((key) => {

                        // const status = j.statusChecklist[key]
                        const status = j.statusChecklist[key] as StatusType
                        const Icon = checklistConfig[key].icon

                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <Icon
                                className={`h-4 w-4 ${statusColors[status]}`}
                              />
                            </TooltipTrigger>

                            <TooltipContent>
                              <p>
                                {checklistConfig[key].label}:{" "}
                                <span className="capitalize">{status}</span>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </TooltipProvider>
                </TableCell>

                <TableCell className="flex gap-2">
                  <Eye
                    className="h-4 w-4 cursor-pointer"
                    onClick={() => navigate(`/dashboard/employee/${j.fullId}`)}
                  />
                  <Pencil className="h-4 w-4 cursor-pointer" />
                </TableCell>

              </TableRow>
            ))}
          </TableBody>

        </Table>

      </div>

      <div className="flex justify-between mt-4 text-xs text-muted-foreground">
        <p>
          Showing{" "}
          {filteredJoiners.length === 0
            ? 0
            : (currentPage - 1) * ITEMS_PER_PAGE + 1}{" "}
          to {Math.min(currentPage * ITEMS_PER_PAGE, filteredJoiners.length)} of{" "}
          {filteredJoiners.length} employees
        </p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={`flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[11px] ${
                currentPage === page
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

    </div>
  )
}

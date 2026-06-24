import { useState, useEffect } from "react";
import { createUserViaBackend } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, UploadCloud, Loader2, CheckCircle2 } from "lucide-react";

import personalIcon from "@/assets/personal.png";
import jobIcon from "@/assets/job.png";
import offerIcon from "@/assets/offer.png";
import { getLoginUrl } from "@/lib/backend";
import { uploadProfilePhoto, validateProfilePhoto } from "@/lib/profilePhoto";
import { uploadFileToBackend } from "@/lib/backendUpload";

const normalizeEmployeeType = (value?: string | null) => {
  if (!value) return "";
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "full" || normalizedValue === "full-time" || normalizedValue === "full time") {
    return "Full Time";
  }
  if (normalizedValue === "intern") {
    return "Intern";
  }
  return value;
};

const uploadOfferLetter = async (candidateId: string, file: File) => {
  const fileExt = file.name.split(".").pop() || "pdf";
  const filePath = `offer-letters/${candidateId}/${Date.now()}.${fileExt}`;
  const { publicUrl } = await uploadFileToBackend(file, {
    bucket: "documents",
    path: filePath,
    employeeId: candidateId,
  });
  return publicUrl;
};

// ── Loading overlay shown while candidate is being created ───────────────────

type CreatingStep = "user" | "photo" | "candidate" | "profile" | "tasks" | "done";

const STEP_LABELS: Record<CreatingStep, string> = {
  user:      "Creating account…",
  photo:     "Uploading photo & documents…",
  candidate: "Saving candidate details…",
  profile:   "Setting up profile…",
  tasks:     "Creating onboarding tasks…",
  done:      "Almost done…",
};

function CreatingOverlay({ step }: { step: CreatingStep }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[340px] rounded-2xl bg-white px-8 py-8 shadow-2xl text-center space-y-5">
        {/* Spinner */}
        <div className="flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[15px] font-semibold text-foreground">Creating Candidate</p>
          <p className="text-[13px] text-muted-foreground">{STEP_LABELS[step]}</p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2">
          {(["user", "photo", "candidate", "profile", "tasks"] as CreatingStep[]).map((s) => {
            const steps: CreatingStep[] = ["user", "photo", "candidate", "profile", "tasks", "done"];
            const currentIdx = steps.indexOf(step);
            const thisIdx = steps.indexOf(s);
            const isDone = thisIdx < currentIdx;
            const isActive = thisIdx === currentIdx;
            return (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isDone
                    ? "w-2 bg-primary"
                    : isActive
                    ? "w-5 bg-primary"
                    : "w-2 bg-muted"
                }`}
              />
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Please wait, do not close or refresh this page.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const CandidateOnboarding = () => {
  const navigate = useNavigate();
  const loginUrl = getLoginUrl();

  /* FORM STATE */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");

  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [manager, setManager] = useState("");
  const [employeeType, setEmployeeType] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [salary, setSalary] = useState("");

  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [offerFile, setOfferFile] = useState<File | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);

  /* POPUP STATE */
  const [showPopup, setShowPopup] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  /* ✅ LOADING STATE */
  const [isCreating, setIsCreating] = useState(false);
  const [creatingStep, setCreatingStep] = useState<CreatingStep>("user");

  /* PASSWORD GENERATOR */
  const generatePassword = () => Math.random().toString(36).slice(-8);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  /* FETCH DEPARTMENTS */
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase.from("departments").select("*");
      if (!error && data && data.length > 0) {
        setDepartments(data);
      } else {
        const defaultDepartments = [
          { id: "hr", name: "Human Resources" },
          { id: "it", name: "Information Technology" },
          { id: "finance", name: "Finance" },
          { id: "marketing", name: "Marketing" },
          { id: "sales", name: "Sales" },
          { id: "operations", name: "Operations" },
        ];
        const { data: insertedData, error: insertError } = await supabase
          .from("departments")
          .insert(defaultDepartments)
          .select();
        if (!insertError && insertedData) {
          setDepartments(insertedData);
        } else {
          setDepartments(defaultDepartments);
        }
      }
    };
    fetchDepartments();
  }, []);

  /* PHOTO HANDLER */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validationError = validateProfilePhoto(file);
      if (validationError) { alert(validationError); return; }
      setPhotoFile(file);
      setPhoto(URL.createObjectURL(file));
    }
  };

  /* OFFER FILE HANDLER */
  const handleOfferFile = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) { alert("Only PDF files are allowed for the unsigned offer letter."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("File must be less than 5MB"); return; }
    setOfferFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleOfferFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); };

  /* SAVE DRAFT */
  const handleSaveDraft = async () => {
    if (savingDraft) return;
    if (!name.trim() || !email.trim()) {
      alert("Please enter at least Full Name and Email to save a draft.");
      return;
    }
    try {
      setSavingDraft(true);
      const draftId = crypto.randomUUID();
      let uploadedPhotoUrl: string | null = null;
      let uploadedOfferLetterUrl: string | null = null;
      if (photoFile) uploadedPhotoUrl = await uploadProfilePhoto(draftId, photoFile);
      if (offerFile) uploadedOfferLetterUrl = await uploadOfferLetter(draftId, offerFile);
      const { error } = await supabase.from("candidates").insert([{
        id: draftId, name, email,
        phone: phone || null,
        address: address || null,
        date_of_birth: dob || null,
        designation: designation || null,
        reporting_manager: manager || null,
        department_id: department || null,
        type: employeeType ? normalizeEmployeeType(employeeType) : null,
        photo_url: uploadedPhotoUrl,
        offer_letter_url: uploadedOfferLetterUrl,
        joining_date: joiningDate || null,
        salary: salary ? Number(salary) : null,
        status: "draft",
        onboarding_status: "draft",
      }]);
      if (error) throw error;
      alert("Draft saved successfully.");
      navigate("/dashboard");
    } catch (error: any) {
      alert(error.message || "Unable to save draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  /* SUBMIT */
  const handleSubmit = async () => {
    if (isCreating) return; // prevent double click

    if (!name.trim() || !email.trim()) {
      alert("Please enter at least Full Name and Email.");
      return;
    }

    try {
      setIsCreating(true);

      /* STEP 1: CREATE AUTH USER */
      setCreatingStep("user");
      const password = generatePassword();
      const createUserResult = await createUserViaBackend(email, password);

      if (!createUserResult.userId) {
        alert("User creation failed");
        return;
      }

      const userId = createUserResult.userId;

      /* STEP 2: UPLOAD FILES */
      setCreatingStep("photo");
      let uploadedPhotoUrl: string | null = null;
      let uploadedOfferLetterUrl: string | null = null;
      if (photoFile) uploadedPhotoUrl = await uploadProfilePhoto(userId, photoFile);
      if (offerFile) uploadedOfferLetterUrl = await uploadOfferLetter(userId, offerFile);

      /* STEP 3: INSERT CANDIDATE */
      setCreatingStep("candidate");
      const { error: candidateError } = await supabase.from("candidates").insert([{
        id: userId,
        name, email, phone, address,
        date_of_birth: dob,
        designation,
        reporting_manager: manager,
        department_id: department,
        type: normalizeEmployeeType(employeeType),
        photo_url: uploadedPhotoUrl,
        offer_letter_url: uploadedOfferLetterUrl,
        joining_date: joiningDate,
        salary: salary ? Number(salary) : null,
        status: "onboarding",
        onboarding_status: "pending",
      }]);

      if (candidateError) {
        alert(candidateError.message);
        return;
      }

      /* STEP 4: INSERT PROFILE */
      setCreatingStep("profile");
      const { error: profileError } = await supabase.from("profiles").upsert([{
        id: userId,
        email,
        role: "candidate",
      }]);

      if (profileError) {
        alert(profileError.message);
        return;
      }

      /* STEP 5: INSERT TASKS */
      setCreatingStep("tasks");
      const { error: taskError } = await supabase.from("onboarding_tasks").insert([{
        employee_id: userId,
        document_submitted: false,
        hr_verification: false,
        asset_assigned: false,
        offer_accepted: true,
      }]);

      if (taskError) {
        alert(taskError.message);
        return;
      }

      /* STEP 6: SHOW POPUP */
      setCreatingStep("done");
      setGeneratedPassword(password);
      setIsCreating(false);
      setShowPopup(true);

    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ✅ Loading overlay — shown while creating */}
      {isCreating && <CreatingOverlay step={creatingStep} />}

      <h1 className="text-2xl font-bold">Candidate Onboarding</h1>

      {/* PERSONAL INFO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <img src={personalIcon} className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 relative cursor-pointer text-center">
            <input
              type="file"
              accept="image/png, image/jpeg"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0"
            />
            {photo ? (
              <img src={photo} className="h-20 w-20 rounded-full object-cover border border-border" />
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border">
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Add Photo</p>
                <p className="mt-1 text-[10px] text-muted-foreground">JPG or PNG, max 5MB</p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Full Name</p>
            <Input placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Email</p>
            <Input placeholder="john.doe@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Phone Number</p>
            <Input placeholder="+91 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Address</p>
            <Input placeholder="123, Business Ave, Suite 100..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Date of Birth</p>
            <div className="relative">
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              />
              <CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* JOB DETAILS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <img src={jobIcon} className="h-4 w-4" />
            Job Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Department</p>
            <Select value={department} onValueChange={(value) => setDepartment(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Designation</p>
            <Input placeholder="Conference Producer" value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Reporting Manager</p>
            <Input placeholder="Enter Manager Name" value={manager} onChange={(e) => setManager(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Employee Type</p>
            <Select onValueChange={(value) => setEmployeeType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Full-time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Full Time">Full Time</SelectItem>
                <SelectItem value="Intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Joining Date</p>
            <div className="relative">
              <Input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              />
              <CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-primary" />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Salary (Annual)</p>
            <Input placeholder="1200000" value={salary} onChange={(e) => setSalary(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* OFFER DETAILS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <img src={offerIcon} className="h-4 w-4" />
            Offer Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Unsigned Offer Letter</p>
          </div>

          <div
            className="border border-dashed rounded-lg p-6 text-center relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="absolute inset-0 opacity-0"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleOfferFile(file); }}
            />
            {offerFile ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{offerFile.name}</p>
                <p className="text-[10px] text-muted-foreground">File ready to upload</p>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Drag or drop unsigned offer letter here, or{" "}
                  <span className="font-medium text-primary">browse files</span>
                </p>
                <p className="text-[10px] text-muted-foreground">PDF only, max 5MB</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Offer Status</p>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Draft" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">CTC Breakdown</p>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"Basic Salary: 500000\nHRA: 5000\nTA: 10000"}
            />
          </div>
        </CardContent>
      </Card>

      {/* ACTION BUTTONS */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft || isCreating}>
          {savingDraft ? "Saving Draft..." : "Save Draft"}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isCreating}
          className="bg-primary text-white min-w-[180px]"
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating…
            </span>
          ) : (
            "Send & Start Onboarding"
          )}
        </Button>
      </div>

      {/* CREDENTIALS POPUP */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] space-y-4 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <h2 className="text-lg font-semibold">Candidate Created!</h2>
            </div>
            <p className="text-[13px] text-muted-foreground">Share these login credentials with the candidate.</p>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Login URL</p>
              <div className="flex justify-between items-center bg-muted p-2 rounded">
                <span className="text-sm truncate">{loginUrl}</span>
                <button className="text-xs text-primary ml-2 shrink-0" onClick={() => copyToClipboard(loginUrl)}>Copy</button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Email</p>
              <div className="flex justify-between items-center bg-muted p-2 rounded">
                <span className="text-sm">{email}</span>
                <button className="text-xs text-primary ml-2 shrink-0" onClick={() => copyToClipboard(email)}>Copy</button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Password</p>
              <div className="flex justify-between items-center bg-muted p-2 rounded">
                <span className="text-sm font-mono">{generatedPassword}</span>
                <button className="text-xs text-primary ml-2 shrink-0" onClick={() => copyToClipboard(generatedPassword)}>Copy</button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => { setShowPopup(false); navigate("/dashboard"); }}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateOnboarding;
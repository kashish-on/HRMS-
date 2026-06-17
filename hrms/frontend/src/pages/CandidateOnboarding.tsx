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
import { CalendarDays, UploadCloud } from "lucide-react";

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

const CandidateOnboarding = () => {
  const navigate = useNavigate();
  const loginUrl = getLoginUrl();

  /* 🔥 FORM STATE */
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

  /* ✅ NEW STATES (POPUP) */
  const [showPopup, setShowPopup] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  /* PASSWORD GENERATOR */
  const generatePassword = () => {
    return Math.random().toString(36).slice(-8);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  /* FETCH DEPARTMENTS */
  useEffect(() => {
    const fetchDepartments = async () => {
      console.log("Fetching departments...");
      const { data, error } = await supabase.from("departments").select("*");

      console.log("Departments data:", data);
      console.log("Departments error:", error);

      if (!error && data && data.length > 0) {
        setDepartments(data);
      } else {
        // If no departments exist, seed some default ones
        console.log("No departments found, seeding default departments...");
        const defaultDepartments = [
          { id: "hr", name: "Human Resources" },
          { id: "it", name: "Information Technology" },
          { id: "finance", name: "Finance" },
          { id: "marketing", name: "Marketing" },
          { id: "sales", name: "Sales" },
          { id: "operations", name: "Operations" },
        ];

        // Try to insert default departments
        const { data: insertedData, error: insertError } = await supabase
          .from("departments")
          .insert(defaultDepartments)
          .select();

        if (!insertError && insertedData) {
          console.log("Default departments inserted:", insertedData);
          setDepartments(insertedData);
        } else {
          console.error("Error inserting default departments:", insertError);
          // Fallback to hardcoded departments for now
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
      if (validationError) {
        alert(validationError);
        return;
      }

      setPhotoFile(file);
      setPhoto(URL.createObjectURL(file));
    }
  };

  /* OFFER FILE HANDLER */
  const handleOfferFile = (file: File) => {
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      alert("Only PDF files are allowed for the unsigned offer letter.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File must be less than 5MB");
      return;
    }

    setOfferFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleOfferFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

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

      if (photoFile) {
        uploadedPhotoUrl = await uploadProfilePhoto(draftId, photoFile);
      }

      if (offerFile) {
        uploadedOfferLetterUrl = await uploadOfferLetter(draftId, offerFile);
      }

      const { error } = await supabase.from("candidates").insert([
        {
          id: draftId,
          name,
          email,
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
        },
      ]);

      if (error) {
        throw error;
      }

      alert("Draft saved successfully.");
      navigate("/dashboard");
    } catch (error: any) {
      alert(error.message || "Unable to save draft.");
    } finally {
      setSavingDraft(false);
    }
  };

const handleSubmit = async () => {
  try {
    /* STEP 1: GENERATE PASSWORD */
    const password = generatePassword();
    console.log("Generated password:", password);

    // Check current session before user creation
    const { data: sessionBefore } = await supabase.auth.getSession();
    console.log("Session before user creation:", sessionBefore?.session?.user?.email);

    /* STEP 2: CREATE AUTH USER VIA BACKEND */
    const createUserResult = await createUserViaBackend(email, password);

    if (!createUserResult.userId) {
      console.error("User creation failed:", createUserResult);
      alert("User creation failed");
      return;
    }

    const userId = createUserResult.userId;
    console.log("Created user ID:", userId);

    // Check session after user creation
    const { data: sessionAfter } = await supabase.auth.getSession();
    console.log("Session after user creation:", sessionAfter?.session?.user?.email);

    let uploadedPhotoUrl: string | null = null;
    let uploadedOfferLetterUrl: string | null = null;
    if (photoFile) {
      console.log("Uploading photo...");
      uploadedPhotoUrl = await uploadProfilePhoto(userId, photoFile);
      console.log("Photo uploaded:", uploadedPhotoUrl);
    }
    if (offerFile) {
      console.log("Uploading unsigned offer letter...");
      uploadedOfferLetterUrl = await uploadOfferLetter(userId, offerFile);
      console.log("Unsigned offer letter uploaded:", uploadedOfferLetterUrl);
    }

    /* ✅ STEP 3: INSERT INTO CANDIDATES FIRST */
    console.log("Inserting candidate data...");
    const { error: candidateError } = await supabase
      .from("candidates")
      .insert([
        {
          id: userId, // 🔥 SAME ID
          name,
          email,
          phone,
            address,
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
        },
      ]);

    if (candidateError) {
      console.error("Candidate insert error:", candidateError);
      alert(candidateError.message);
      return;
    }

    /* ✅ STEP 4: INSERT INTO PROFILES */
    console.log("Inserting profile data...");
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert([
        {
          id: userId,
          email,
          role: "candidate",
        },
      ]);

    if (profileError) {
      console.error("Profile insert error:", profileError);
      alert(profileError.message);
      return;
    }

    /* ✅ STEP 5: INSERT INTO TASKS (NOW SAFE) */
    console.log("Inserting onboarding tasks...");
    const { error: taskError } = await supabase
      .from("onboarding_tasks")
      .insert([
        {
          employee_id: userId, // 🔥 NOW EXISTS
          document_submitted: false,
          hr_verification: false,
          asset_assigned: false,
          offer_accepted: true,
        },
      ]);

    if (taskError) {
      console.error("Task insert error:", taskError);
      alert(taskError.message);
      return;
    }

    console.log("All steps completed successfully!");
    /* STEP 6: POPUP */
    console.log("Setting popup state...");
    setGeneratedPassword(password);
    setShowPopup(true);
    console.log("Popup should now be visible - showPopup:", showPopup, "generatedPassword:", generatedPassword);

    // Add a small delay to ensure state updates
    setTimeout(() => {
      console.log("Timeout check - showPopup:", showPopup, "generatedPassword:", generatedPassword);
    }, 100);

  } catch (err: any) {
    console.error("Unexpected error in handleSubmit:", err);
    alert(err.message);
  }
};

  return (
    <div className="space-y-6">
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
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Add Photo
                </p>
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
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleOfferFile(file);
              }}
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

      {/* ACTION */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft}>
          {savingDraft ? "Saving Draft..." : "Save Draft"}
        </Button>
        <Button onClick={handleSubmit} className="bg-primary text-white">
          Send & Start Onboarding
        </Button>
      </div>

      {/* 🔥 POPUP */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] space-y-4 shadow-lg">

            <h2 className="text-lg font-semibold">Login Credentials</h2>

            <div>
              <p className="text-xs text-muted-foreground">Login URL</p>
              <div className="flex justify-between bg-muted p-2 rounded">
                <span>{loginUrl}</span>
                <button onClick={() => copyToClipboard(loginUrl)}>Copy</button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <div className="flex justify-between bg-muted p-2 rounded">
                <span>{email}</span>
                <button onClick={() => copyToClipboard(email)}>Copy</button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Password</p>
              <div className="flex justify-between bg-muted p-2 rounded">
                <span>{generatedPassword}</span>
                <button onClick={() => copyToClipboard(generatedPassword)}>Copy</button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                setShowPopup(false);
                navigate("/dashboard");
              }}
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


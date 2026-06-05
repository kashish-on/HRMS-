import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays, UploadCloud } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import personalIcon from "@/assets/personal.png";
import jobIcon from "@/assets/job.png";
import CandidateWrapper from "@/components/CandidateWrapper";
import { supabase } from "@/lib/supabase";
import { uploadProfilePhoto, validateProfilePhoto } from "@/lib/profilePhoto";

const formatDateForInput = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().split("T")[0];
};

const getDepartmentName = async (departmentId?: string | null) => {
  if (!departmentId) return "";

  const { data } = await supabase
    .from("departments")
    .select("name")
    .eq("id", departmentId)
    .maybeSingle();

  return data?.name || "";
};

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

export default function EditProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isCandidateRoute = location.pathname.startsWith("/candidate");
  const isHrCandidateEditRoute = location.pathname.startsWith("/dashboard/employee/") && !!id;

  const [recordId, setRecordId] = useState<string | null>(null);
  const [tableName, setTableName] = useState<"employees" | "candidates">(
    isCandidateRoute || isHrCandidateEditRoute ? "candidates" : "employees"
  );
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState("");
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    dob: "",
    designation: "",
    reporting_manager: "",
    employment_type: "",
    joining_date: "",
    salary: "",
    password: "",
    photo_url: "",
  });

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      if (isHrCandidateEditRoute && id) {
        const { data: candidateProfile } = await supabase
          .from("candidates")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        const resolvedDepartmentName =
          candidateProfile?.department ||
          candidateProfile?.department_name ||
          (await getDepartmentName(candidateProfile?.department_id));

        if (!mounted) return;

        setTableName("candidates");
        setRecordId(candidateProfile?.id || id);
        setDepartmentId(candidateProfile?.department_id || "");
        setDepartmentName(resolvedDepartmentName || "");

        const existingPhoto = candidateProfile?.photo_url || "";
        setPhoto(existingPhoto);
        setForm({
          name: candidateProfile?.name || "",
          email: candidateProfile?.email || "",
          phone: candidateProfile?.phone || candidateProfile?.phone_number || "",
          address: candidateProfile?.address || "",
          dob: formatDateForInput(candidateProfile?.date_of_birth || candidateProfile?.dob),
          designation: candidateProfile?.designation || "",
          reporting_manager: candidateProfile?.reporting_manager || "",
          employment_type: normalizeEmployeeType(
            candidateProfile?.type || candidateProfile?.employment_type || ""
          ),
          joining_date: formatDateForInput(candidateProfile?.joining_date || candidateProfile?.join_date),
          salary:
            candidateProfile?.salary?.toString?.() ||
            candidateProfile?.annual_salary?.toString?.() ||
            "",
          password: "",
          photo_url: existingPhoto,
        });
        setLoading(false);
        return;
      }

      let resolvedTable: "employees" | "candidates" = isCandidateRoute
        ? "candidates"
        : "employees";
      let userProfile: any = null;

      const { data: profileById } = await supabase
        .from(resolvedTable)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      userProfile = profileById;

      if (!userProfile && user.email) {
        const { data: profileByEmail } = await supabase
          .from(resolvedTable)
          .select("*")
          .eq("email", user.email)
          .maybeSingle();

        userProfile = profileByEmail;
      }

      if (!userProfile && !isCandidateRoute && user.email) {
        const { data: candidateFallback } = await supabase
          .from("candidates")
          .select("*")
          .eq("email", user.email)
          .maybeSingle();

        if (candidateFallback) {
          userProfile = candidateFallback;
          resolvedTable = "candidates";
        }
      }

      const resolvedDepartmentName =
        userProfile?.department ||
        userProfile?.department_name ||
        (await getDepartmentName(userProfile?.department_id));

      if (!mounted) return;

      setTableName(resolvedTable);
      setRecordId(userProfile?.id || user.id);
      setDepartmentId(userProfile?.department_id || "");
      setDepartmentName(resolvedDepartmentName || "");

      const existingPhoto = userProfile?.photo_url || "";
      setPhoto(existingPhoto);
      setForm({
        name:
          userProfile?.name ||
          userProfile?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "",
        email: userProfile?.email || user.email || "",
        phone: userProfile?.phone || userProfile?.phone_number || "",
        address: userProfile?.address || "",
        dob: formatDateForInput(userProfile?.date_of_birth || userProfile?.dob),
        designation: userProfile?.designation || "",
        reporting_manager: userProfile?.reporting_manager || "",
        employment_type: normalizeEmployeeType(
          userProfile?.type || userProfile?.employment_type || ""
        ),
        joining_date: formatDateForInput(userProfile?.joining_date || userProfile?.join_date),
        salary:
          userProfile?.salary?.toString?.() ||
          userProfile?.annual_salary?.toString?.() ||
          "",
        password: "",
        photo_url: existingPhoto,
      });
      setLoading(false);
    };

    const fetchDepartments = async () => {
      const { data } = await supabase.from("departments").select("id, name");
      if (!mounted) return;
      setDepartments(data || []);
    };

    fetchDepartments();
    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [id, isCandidateRoute, isHrCandidateEditRoute]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateProfilePhoto(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    setSelectedPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhoto(previewUrl);
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!recordId) return;

    try {
      setSaving(true);

      let uploadedPhotoUrl = form.photo_url || "";
      if (selectedPhotoFile) {
        uploadedPhotoUrl = await uploadProfilePhoto(recordId, selectedPhotoFile);
      }

      const updatePayload = isHrCandidateEditRoute
        ? {
            name: form.name,
            email: form.email,
            phone: form.phone,
            address: form.address,
            date_of_birth: form.dob || null,
            designation: form.designation,
            reporting_manager: form.reporting_manager,
            type: normalizeEmployeeType(form.employment_type),
            department_id: departmentId || null,
            joining_date: form.joining_date || null,
            salary: form.salary ? Number(form.salary) : null,
            photo_url: uploadedPhotoUrl || null,
          }
        : {
            name: form.name,
            phone: form.phone,
            address: form.address,
            photo_url: uploadedPhotoUrl || null,
          };

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq("id", recordId);

      if (updateError) throw updateError;

      if (!isHrCandidateEditRoute) {
        const authUpdates: Record<string, any> = {
          data: {
            name: form.name,
          },
        };

        if (form.password.trim()) {
          authUpdates.password = form.password.trim();
        }

        const { error: authError } = await supabase.auth.updateUser(authUpdates);

        if (authError) throw authError;
      }

        alert("Profile updated successfully.");
      navigate(
        isHrCandidateEditRoute && recordId
          ? `/dashboard/employee/${recordId}`
          : isCandidateRoute
          ? "/candidate/profile"
          : "/dashboard/profile"
      );
    } catch (error: any) {
      alert(error.message || "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const editContent = loading ? (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        Loading profile...
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <img src={personalIcon} className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex justify-center relative">
            <div className="relative">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-border bg-muted">
                {photo ? (
                  <img
                    src={photo}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                    {form.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() || "")
                      .join("") || "NA"}
                  </div>
                )}
              </div>

              <input
                type="file"
                onChange={handleImageChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />

              <div className="absolute bottom-0 right-0 bg-purple-600 text-white rounded-full p-1">
                <UploadCloud className="h-3 w-3" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Full Name</p>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <Input
              value={form.email}
              readOnly={!isHrCandidateEditRoute}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
            <Input
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Password</p>
            {isHrCandidateEditRoute ? (
              <Input value="Not editable from HR view" readOnly />
            ) : (
              <Input
                type="password"
                placeholder="Enter new password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
              />
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Address</p>
            <Input
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Date of Birth</p>
            <div className="relative">
              <Input
                type={isHrCandidateEditRoute ? "date" : "text"}
                value={form.dob}
                readOnly={!isHrCandidateEditRoute}
                onChange={(e) => handleChange("dob", e.target.value)}
              />
              <CalendarDays className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <img src={jobIcon} className="h-4 w-4" />
            Job Details
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Department</p>
            {isHrCandidateEditRoute ? (
              <Select
                value={departmentId}
                onValueChange={(value) => {
                  setDepartmentId(value);
                  const selectedDepartment = departments.find((dept) => dept.id === value);
                  setDepartmentName(selectedDepartment?.name || "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={departmentName} readOnly />
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Designation</p>
            <Input
              value={form.designation}
              readOnly={!isHrCandidateEditRoute}
              onChange={(e) => handleChange("designation", e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Reporting Manager</p>
            <Input
              value={form.reporting_manager}
              readOnly={!isHrCandidateEditRoute}
              onChange={(e) => handleChange("reporting_manager", e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Employee Type</p>
            <Input
              value={form.employment_type}
              readOnly={!isHrCandidateEditRoute}
              onChange={(e) => handleChange("employment_type", e.target.value)}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Joining Date</p>
            <div className="relative">
              <Input
                type={isHrCandidateEditRoute ? "date" : "text"}
                value={form.joining_date}
                readOnly={!isHrCandidateEditRoute}
                onChange={(e) => handleChange("joining_date", e.target.value)}
              />
              <CalendarDays className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Salary (Annual)</p>
            <Input
              type={isHrCandidateEditRoute ? "number" : "text"}
              value={form.salary}
              readOnly={!isHrCandidateEditRoute}
              onChange={(e) => handleChange("salary", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white px-6"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  if (isCandidateRoute) {
    return <CandidateWrapper>{editContent}</CandidateWrapper>;
  }

  return editContent;
}

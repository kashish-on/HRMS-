import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import personalIcon from "@/assets/personal.png";
import jobIcon from "@/assets/job.png";
import CandidateWrapper from "@/components/CandidateWrapper";
import { supabase } from "@/lib/supabase";

const formatDate = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN");
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

const UserProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCandidateRoute = location.pathname.startsWith("/candidate");

  const [profile, setProfile] = useState<any>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) {
          setProfile(null);
          setDepartmentName("");
          setLoading(false);
        }
        return;
      }

      const tableName = isCandidateRoute ? "candidates" : "employees";
      let userProfile: any = null;

      const { data: profileById } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      userProfile = profileById;

      if (!userProfile && user.email) {
        const { data: profileByEmail } = await supabase
          .from(tableName)
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

        userProfile = candidateFallback;
      }

      const resolvedDepartmentName =
        userProfile?.department ||
        userProfile?.department_name ||
        (await getDepartmentName(userProfile?.department_id));

      const mergedProfile = {
        ...userProfile,
        email: userProfile?.email || user.email || "",
        name:
          userProfile?.name ||
          userProfile?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "",
      };

      if (mounted) {
        setProfile(mergedProfile);
        setDepartmentName(resolvedDepartmentName || "");
        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [isCandidateRoute]);

  const editProfilePath = isCandidateRoute
    ? "/candidate/profile/edit"
    : "/dashboard/profile/edit";

  const profileContent = loading ? (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        Loading profile...
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Profile</h1>
        {!isCandidateRoute && (
          <Button
            onClick={() => navigate(editProfilePath)}
            className="bg-primary text-white"
          >
            Edit Profile
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <img src={personalIcon} className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Avatar className="h-20 w-20 border border-border">
              <AvatarImage
                src={
                  profile?.photo_url?.startsWith("http")
                    ? profile.photo_url
                    : undefined
                }
              />
              <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                {profile?.name
                  ?.split(" ")
                  ?.filter(Boolean)
                  ?.slice(0, 2)
                  ?.map((part: string) => part[0]?.toUpperCase() || "")
                  ?.join("") || "NA"}
              </AvatarFallback>
            </Avatar>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Full Name</p>
            <Input value={profile?.name || ""} readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <Input value={profile?.email || ""} readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
            <Input value={profile?.phone || profile?.phone_number || ""} readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Password</p>
            <Input value="********" readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Address</p>
            <Input value={profile?.address || profile?.candidate_address || ""} readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Date of Birth</p>
            <div className="relative">
              <Input
                value={formatDate(profile?.date_of_birth || profile?.dob || profile?.birth_date)}
                readOnly
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
            <Input value={departmentName} readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Designation</p>
            <Input value={profile?.designation || ""} readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Reporting Manager</p>
            <Input value={profile?.reporting_manager || ""} readOnly />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Employee Type</p>
            <Input
              value={normalizeEmployeeType(profile?.type || profile?.employment_type || "")}
              readOnly
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Joining Date</p>
            <div className="relative">
              <Input
                value={formatDate(profile?.joining_date || profile?.join_date)}
                readOnly
              />
              <CalendarDays className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Salary (Annual)</p>
            <Input
              value={
                profile?.salary?.toString?.() ||
                profile?.annual_salary?.toString?.() ||
                ""
              }
              readOnly
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isCandidateRoute) {
    return <CandidateWrapper>{profileContent}</CandidateWrapper>;
  }

  return profileContent;
};

export default UserProfile;

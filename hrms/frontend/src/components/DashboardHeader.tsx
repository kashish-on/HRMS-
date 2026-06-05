import { useEffect, useRef, useState } from "react";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { deriveHrNotifications, formatNotificationTime, type HrNotification } from "@/lib/hrNotifications";

const getInitials = (name?: string | null, email?: string | null) => {
  const safeName = name?.trim();

  if (safeName) {
    return safeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "HR";
};

type DashboardHeaderProps = {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
};

export function DashboardHeader({ searchTerm, setSearchTerm }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [initials, setInitials] = useState("HR");
  const [photoUrl, setPhotoUrl] = useState("");
  const [notifications, setNotifications] = useState<HrNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [isNotificationBellAnimated, setIsNotificationBellAnimated] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const previousNotificationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchHeaderProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) {
          setInitials("HR");
          setPhotoUrl("");
        }
        return;
      }

      let displayName =
        user.user_metadata?.name || user.user_metadata?.full_name || "";
      let resolvedPhotoUrl = "";

      const { data: employeeById } = await supabase
        .from("employees")
        .select("name, photo_url")
        .eq("id", user.id)
        .maybeSingle();

      displayName =
        employeeById?.name ||
        displayName;
      resolvedPhotoUrl = employeeById?.photo_url || resolvedPhotoUrl;

      if (!displayName && user.email) {
        const { data: employeeByEmail } = await supabase
          .from("employees")
          .select("name, photo_url")
          .eq("email", user.email)
          .maybeSingle();

        displayName =
          employeeByEmail?.name ||
          displayName;
        resolvedPhotoUrl = employeeByEmail?.photo_url || resolvedPhotoUrl;
      }

      if (mounted) {
        setInitials(getInitials(displayName, user.email));
        setPhotoUrl(
          resolvedPhotoUrl?.startsWith("http") ? resolvedPhotoUrl : ""
        );
      }
    };

    fetchHeaderProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchNotifications = async () => {
      if (mounted) {
        setLoadingNotifications(true);
      }

      const responses = await Promise.all([
        supabase.from("candidates").select("*"),
        supabase.from("documents").select("*"),
        supabase.from("onboarding_tasks").select("*"),
        supabase.from("bg_verification").select("*"),
        supabase.from("it_asset_details").select("*"),
        supabase.from("induction_details").select("*"),
        supabase.from("probation_details").select("*"),
      ]);

      const [
        candidatesResponse,
        documentsResponse,
        onboardingTasksResponse,
        bgVerificationResponse,
        itAssetResponse,
        inductionResponse,
        probationResponse,
      ] = responses;

      responses.forEach((response, index) => {
        if (response.error) {
          const tableNames = [
            "candidates",
            "documents",
            "onboarding_tasks",
            "bg_verification",
            "it_asset_details",
            "induction_details",
            "probation_details",
          ];
          console.error(`Unable to fetch ${tableNames[index]} for HR notifications:`, response.error);
        }
      });

      const nextNotifications = deriveHrNotifications({
        candidates: candidatesResponse.data || [],
        documents: documentsResponse.data || [],
        onboardingTasks: onboardingTasksResponse.data || [],
        bgVerificationRows: bgVerificationResponse.data || [],
        itAssetRows: itAssetResponse.data || [],
        inductionRows: inductionResponse.data || [],
        probationRows: probationResponse.data || [],
      });

      const previousNotificationIds = previousNotificationIdsRef.current;
      const hasNewNotification =
        previousNotificationIds.length > 0 &&
        nextNotifications.some(
          (notification) => !previousNotificationIds.includes(notification.id)
        );

      if (mounted) {
        setNotifications(nextNotifications);
        setLoadingNotifications(false);

        if (hasNewNotification && !isNotificationsOpen) {
          setIsNotificationBellAnimated(true);

          window.setTimeout(() => {
            if (mounted) {
              setIsNotificationBellAnimated(false);
            }
          }, 2500);
        }
      }

      previousNotificationIdsRef.current = nextNotifications.map(
        (notification) => notification.id
      );
    };

    fetchNotifications();

    const notificationChannel = supabase
      .channel("hr-dashboard-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidates" },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_tasks" },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bg_verification" },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "it_asset_details" },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "induction_details" },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "probation_details" },
        fetchNotifications
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(notificationChannel);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (isNotificationsOpen) {
      setIsNotificationBellAnimated(false);
    }
  }, [isNotificationsOpen]);

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-muted-foreground" />
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 w-[200px] text-sm bg-muted/50 border-none"
          />
        </div>
        <Popover open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
          <PopoverTrigger asChild>
            <button
              className={`relative overflow-visible rounded-md p-2 text-muted-foreground transition-all hover:bg-accent ${
                isNotificationBellAnimated ? "scale-110 bg-accent/70" : ""
              }`}
            >
              {isNotificationBellAnimated && (
                <span className="pointer-events-none absolute inset-0 rounded-full border border-primary/60 bg-primary/10 opacity-70 animate-ping" />
              )}
              <Bell
                className={`relative h-5 w-5 ${
                  isNotificationBellAnimated ? "animate-bounce text-primary" : ""
                }`}
              />
              {notifications.length > 0 && (
                <span
                  className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ${
                    isNotificationBellAnimated ? "animate-ping" : ""
                  }`}
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[360px] p-0">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                <span className="text-xs text-muted-foreground">
                  {notifications.length} recent
                </span>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {loadingNotifications ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No onboarding notifications yet.
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => navigate(`/dashboard/employee/${notification.employeeId}`)}
                    className="flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {notification.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {notification.message}
                    </p>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <div
          onClick={() => navigate("/dashboard/profile")}
          className="cursor-pointer"
        >
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={photoUrl} />
            <AvatarFallback className="bg-purple-600 text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  deriveCandidateNotifications,
  formatCandidateNotificationTime,
  type CandidateNotification,
} from "@/lib/candidateNotifications";

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

  return "CA";
};

export function CandidateHeader() {
  const navigate = useNavigate();
  const [initials, setInitials] = useState("CA");
  const [photoUrl, setPhotoUrl] = useState("");
  const [notifications, setNotifications] = useState<CandidateNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [isNotificationBellAnimated, setIsNotificationBellAnimated] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const previousNotificationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchCandidateProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) {
          setInitials("CA");
          setPhotoUrl("");
        }
        return;
      }

      let displayName =
        user.user_metadata?.name || user.user_metadata?.full_name || "";
      let resolvedPhotoUrl = "";

      const { data: candidateById } = await supabase
        .from("candidates")
        .select("name, photo_url")
        .eq("id", user.id)
        .maybeSingle();

      displayName =
        candidateById?.name ||
        displayName;
      resolvedPhotoUrl = candidateById?.photo_url || resolvedPhotoUrl;

      if (!displayName && user.email) {
        const { data: candidateByEmail } = await supabase
          .from("candidates")
          .select("name, photo_url")
          .eq("email", user.email)
          .maybeSingle();

        displayName =
          candidateByEmail?.name ||
          displayName;
        resolvedPhotoUrl = candidateByEmail?.photo_url || resolvedPhotoUrl;
      }

      if (mounted) {
        setInitials(getInitials(displayName, user.email));
        setPhotoUrl(
          resolvedPhotoUrl?.startsWith("http") ? resolvedPhotoUrl : ""
        );
      }
    };

    fetchCandidateProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let animationTimeoutId: number | undefined;

    const fetchCandidateNotifications = async () => {
      if (mounted) {
        setLoadingNotifications(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (mounted) {
          setNotifications([]);
          setLoadingNotifications(false);
        }
        return;
      }

      const employeeId = user.id;

      const responses = await Promise.all([
        supabase.from("documents").select("*").eq("employee_id", employeeId),
        supabase.from("onboarding_tasks").select("*").eq("employee_id", employeeId).maybeSingle(),
        supabase.from("it_asset_details").select("*").eq("employee_id", employeeId).maybeSingle(),
        supabase.from("induction_details").select("*").eq("employee_id", employeeId).maybeSingle(),
        supabase.from("probation_details").select("*").eq("employee_id", employeeId).maybeSingle(),
      ]);

      const [
        documentsResponse,
        onboardingTaskResponse,
        itAssetResponse,
        inductionResponse,
        probationResponse,
      ] = responses;

      responses.forEach((response, index) => {
        if (response.error) {
          const tableNames = [
            "documents",
            "onboarding_tasks",
            "it_asset_details",
            "induction_details",
            "probation_details",
          ];
          console.error(
            `Unable to fetch ${tableNames[index]} for candidate notifications:`,
            response.error
          );
        }
      });

      const nextNotifications = deriveCandidateNotifications({
        documents: documentsResponse.data || [],
        onboardingTask: onboardingTaskResponse.data || null,
        itAssetDetails: itAssetResponse.data || null,
        inductionDetails: inductionResponse.data || null,
        probationDetails: probationResponse.data || null,
      }).slice(0, 12);

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
          animationTimeoutId = window.setTimeout(() => {
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

    fetchCandidateNotifications();

    const candidateNotificationChannel = supabase
      .channel("candidate-dashboard-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        fetchCandidateNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_tasks" },
        fetchCandidateNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "it_asset_details" },
        fetchCandidateNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "induction_details" },
        fetchCandidateNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "probation_details" },
        fetchCandidateNotifications
      )
      .subscribe();

    return () => {
      mounted = false;
      if (animationTimeoutId) {
        window.clearTimeout(animationTimeoutId);
      }
      supabase.removeChannel(candidateNotificationChannel);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (isNotificationsOpen) {
      setIsNotificationBellAnimated(false);
    }
  }, [isNotificationsOpen]);

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background">
      <div className="flex items-center gap-2" />
      <div className="flex items-center gap-4">
        <Popover open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
          <PopoverTrigger asChild>
            <button
              className={`relative overflow-visible rounded-md p-2 text-muted-foreground transition-all hover:bg-accent ${
                isNotificationBellAnimated ? "scale-110 bg-accent/70 animate-pulse" : ""
              }`}
            >
              {isNotificationBellAnimated && (
                <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/15 animate-ping" />
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
                  No updates yet.
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => navigate("/candidate")}
                    className="flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {notification.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatCandidateNotificationTime(notification.createdAt)}
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
          onClick={() => navigate("/candidate/profile")}
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

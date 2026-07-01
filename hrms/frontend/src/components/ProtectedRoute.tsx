// import { Navigate } from "react-router-dom";
// import { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabase";

// type Props = {
//   children: React.ReactNode;
// };

// const ProtectedRoute = ({ children }: Props) => {
//   const [loading, setLoading] = useState(true);
//   const [user, setUser] = useState<any>(null);

//   useEffect(() => {
//     const getUser = async () => {
//       const { data } = await supabase.auth.getUser();
//       setUser(data.user);
//       setLoading(false);
//     };

//     getUser();
//   }, []);

//   if (loading) return <div>Loading...</div>;

//   if (!user) {
//     return <Navigate to="/" replace />;
//   }

//   return <>{children}</>;
// };

// export default ProtectedRoute;

import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  children: React.ReactNode;
  allowedRoles?: Array<"hr" | "candidate">;
};

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<"hr" | "candidate" | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      if (data.session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();

        setRole((profile?.role as "hr" | "candidate" | null) || null);
      } else {
        setRole(null);
      }

      setLoading(false);
    };

    getSession();

    /* ✅ keep session synced */
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);

        if (!session?.user?.id) {
          setRole(null);
          return;
        }

        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            setRole((profile?.role as "hr" | "candidate" | null) || null);
          });
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!session) {
    return <Navigate to="/careers" replace />;
  }

  if (allowedRoles?.length) {
    if (!role) {
      return <Navigate to="/" replace />;
    }

    if (!allowedRoles.includes(role)) {
      return <Navigate to={role === "candidate" ? "/candidate" : "/workspace"} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

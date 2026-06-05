import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import observeNowPeopleLogo from "@/assets/observenow_people.png";
import splineImage from "@/assets/spline.jpeg";

const LoginPage = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  /* 🔥 Auto redirect if already logged in */
  // useEffect(() => {
  //   const checkUser = async () => {
  //     const { data } = await supabase.auth.getUser();
  //     if (data.user) {
  //       navigate("/dashboard");
  //     }
  //   };
  //   checkUser();
  // }, []);

  /* 🔥 Login handler */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error, data: authData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      alert("Unable to determine logged in user.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
      return;
    }

    if (profile?.role === "candidate") {
      navigate("/candidate");
      return;
    }

    if (profile?.role === "hr") {
      navigate("/workspace");
      return;
    }

    alert("No role assigned for this user in profiles table.");
  
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-spline-bg p-6">
        <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-950/5 flex items-center justify-center">
          <img
            src={splineImage}
            alt="Login illustration"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Right - Login */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">

          {/* Logo */}
          <div className="space-y-2 text-left pt-4">
            <div className="flex justify-start">
              <img
                src={observeNowPeopleLogo}
                alt="ObserveNow People"
                className="h-24 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome to ObserveNow People
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="mail@abc.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(v as boolean)}
              />
              <label htmlFor="remember" className="text-sm cursor-pointer">
                Remember Me
              </label>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-semibold"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Having trouble signing in? Contact your admin.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

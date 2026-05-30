"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calculator, User, ShieldCheck } from "lucide-react";
import { colors } from "@/styles/colors";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApiData } from "@/utils/useApiData";

export default function PageHeader() {
  const router = useRouter();
  const {
    data: user,
    loading,
    error,
  } = useApiData(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/me`
  );

  useEffect(() => {
    if (loading) return;
    if (error || !user) {
      // Cookies.remove("auth_token");
      // localStorage.removeItem("userEmail");
      router.push("/login");
    }
    // const email = localStorage.getItem("userEmail");
    // if (!email) {
    //   router.push("/login");
    // }
  }, [loading, error, user, router]);

  // const handleLogout = () => {
  //   // localStorage.removeItem("userEmail");
  //   Cookies.remove("auth_token"); // <-- This is the crucial addition
  //   router.push("/login");
  // };
  const handleLogout = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/logout`,
        {
          method: "POST",
          credentials: "include", // Send cookie to backend
        }
      );
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Redirect to login regardless of success/failure
      router.push("/login");
    }
  };

  if (loading || !user) {
    return (
      <header style={{ backgroundColor: colors.card, color: colors.text }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2">
                <Calculator className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold text-white">
                  TariffCalc Pro
                </h1>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const username = user.email.split("@")[0].replace(/\./g, " ");

  return (
    <header style={{ backgroundColor: colors.card, color: colors.text }}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard">
            <div className="flex items-center gap-2">
              <Calculator className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-white">TariffCalc Pro</h1>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {username}
              {/* Welcome */}
            </span>

            {/* {user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN") && (
              <Link href="/dashboard-admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 flex items-center"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )} */}

            <Link href="/profile">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 flex items-center"
              >
                <User className="h-4 w-4" />
                Profile
              </Button>
            </Link>
            {/* <Button variant="outline" onClick={handleLogout}> */}
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

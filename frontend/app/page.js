"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { colors } from "@/styles/colors";
import Header from "@/components/ui/header";
import { Calculator, Shield, Users } from "lucide-react";
import { apiFetch } from "@/utils/apiClient";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/me`
        );

        if (res.ok) {
          // User is authenticated, redirect to dashboard
          router.push("/dashboard");
        }
        // If not ok, user is not logged in, stay on homepage
      } catch (err) {
        // If there's an error, assume user is not logged in
        console.log("User not authenticated");
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="py-20 px-4" style={{ backgroundColor: colors.card }}>
        <div className="container mx-auto max-w-4xl text-center">
          <h2
            className="text-4xl md:text-6xl font-bold mb-6 text-balance"
            style={{ color: colors.text }}
          >
            Calculate Import Tariffs with Precision
          </h2>
          <p
            className="text-xl mb-8 max-w-2xl mx-auto"
            style={{ color: colors.mutedText }}
          >
            Professional tariff calculation platform for international trade...
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Start Calculating
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        className="py-16 px-4"
        style={{ backgroundColor: colors.background }}
      >
        <div className="container mx-auto max-w-6xl">
          <h3
            className="text-3xl font-bold text-center mb-12"
            style={{ color: colors.text }}
          >
            Why Choose TariffCalc Pro?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Calculator className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Accurate Calculations</CardTitle>
                <CardDescription>
                  Real-time tariff rates with comprehensive product
                  classification database
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Secure & Reliable</CardTitle>
                <CardDescription>
                  Enterprise-grade security with role-based access control and
                  audit trails
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Profile Management</CardTitle>
                <CardDescription>
                  Admin controls for managing tariff data and users
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

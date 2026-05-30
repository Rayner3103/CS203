"use client"; // 1. Needs to be a Client Component to use state

import { useState, useEffect } from "react"; // 2. Import useState
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { UserTable } from "@/components/user-table";
import { colors } from "@/styles/colors";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import { SignupForm } from "@/components/signup-form"; // 3. Import the SignupForm
import { useRouter } from "next/navigation";
import { apiFetch } from "@/utils/apiClient";

export default function UserDashboard() {
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);

  const router = useRouter();

  const handleUserAdded = () => {
    setShowAddUserForm(false); // Close the form
    // Refresh the UserTable. GAHH NO TIME LIAO
    window.location.reload();
  };

  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      try {
        const meRes = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/me`
        );
        if (!meRes.ok) {
          console.log("meRes not ok");
          console.error("Failed to fetch current user. Status:", meRes.status);
          return;
        }
        const meData = await meRes.json();
        if (!mounted) return;
        console.log("my current user is: ", meData.role);
        setCurrentUserRole(meData.role);
      } catch (e) {
        console.error("Error fetching current user:", e);
      }
    };
    fetchMe();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <PageHeader />
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage registered users and their credentials.
                </CardDescription>
              </div>

              {currentUserRole && currentUserRole !== "USER" && (
                <Button onClick={() => setShowAddUserForm(true)}>
                  Add New User
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddUserForm ? (
              <div
                className="mb-6 p-4 border rounded-md"
                style={{ borderColor: colors.text }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Create a New User Account
                  </h3>
                  <Button
                    variant="ghost"
                    onClick={() => setShowAddUserForm(false)} // This is the new "Cancel"
                  >
                    Cancel
                  </Button>
                </div>

                <SignupForm isAdmin={true} onSuccess={handleUserAdded} />
              </div>
            ) : (
              <UserTable />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

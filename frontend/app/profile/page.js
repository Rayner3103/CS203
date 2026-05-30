"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { colors } from "@/styles/colors";
import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { apiFetch } from "@/utils/apiClient";

export default function DashboardPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        "The new password cannot be the same as the current password. Please choose a different password."
      );
      return;
    }

    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/change-password`,
        {
          method: "PUT",
          body: JSON.stringify({
            password: currentPassword,
            newPassword: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to update password.");
        return;
      }

      setSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {/* Header */}
      <PageHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Profile</h2>
          <p>Manage your account details</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 18 }}>
                  <p style={{ padding: "8px 0" }}>
                    Password strength: Password must be at least 8 characters
                    long, contain an uppercase letter and a number.
                  </p>
                  <div style={{ marginBottom: 12 }}>
                    <Input
                      label="Current Password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Input
                      label="New Password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Input
                      label="Confirm Password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {error && (
                    <p style={{ color: "red", marginBottom: 12 }}>{error}</p>
                  )}
                  {success && (
                    <p style={{ color: "green", marginBottom: 12 }}>
                      {success}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword
                  }
                >
                  Confirm Changes
                </Button>
              </form>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}

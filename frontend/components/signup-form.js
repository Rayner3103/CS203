"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { LoginInput } from "@/components/login-form";

export function SignupForm({ isAdmin = false, onSuccess }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Signup failed");
        return;
      }

      setSuccess("Account created successfully!");

      if (isAdmin) {
        if (onSuccess) onSuccess();
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Show success
        setIsLoading(false); // Re-enable form
        return;
      }

      // This creates a 2-second (2000ms) delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const login_response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/users/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        }
      );

      const login_data = await login_response.json();

      if (!login_response.ok) {
        setError(login_data.message || "Login failed");
        return;
      }

      // if (login_data.token) {
      //   Cookies.set("auth_token", login_data.token, {
      //     expires: 7,
      //     secure: false,
      //     // secure: true,
      //     // sameSite: "Strict",
      //     sameSite: "Lax",
      //   });
      // }

      setSuccess(login_data.message || "Login successful!");

      router.push("/dashboard");
    } catch (err) {
      console.error("Signup error:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <LoginInput
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
        />
        <LoginInput
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
        />
        <LoginInput
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
        />
      </div>

      {error && <p className="text-red-500 mt-3">{error}</p>}
      {success && <p className="text-green-500 mt-3">{success}</p>}

      <Button className="mt-6 w-full" type="submit" disabled={isLoading}>
        {isLoading ? "Creating account..." : "Sign Up"}
      </Button>
    </form>
  );
}

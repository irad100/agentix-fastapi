"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import axios from "axios";

// Define the expected response structure based on openapi.json
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_at: string; // ISO 8601 format string
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // The API expects form data, not JSON
    const formData = new URLSearchParams();
    formData.append("username", email); // API uses 'username' for email
    formData.append("password", password);
    formData.append("grant_type", "password"); // As specified in openapi.json

    try {
      const response = await api.post<TokenResponse>(
        "/api/v1/auth/login",
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      // Use the login function from AuthContext
      await login(response.data.access_token, response.data.expires_at);

      // Redirect to the chat page on successful login
      router.push("/");
    } catch (err) {
      console.error("Login failed:", err);

      // Define potential structure for the error response data detail
      type ErrorDetail = string | { msg: string }[];
      interface ErrorResponseData {
        detail: ErrorDetail;
      }

      // Check if it's an AxiosError with a response
      if (axios.isAxiosError<ErrorResponseData>(err) && err.response) {
        if (err.response.status === 401) {
          setError("Invalid email or password.");
        } else if (err.response.data?.detail) {
          const detail = err.response.data.detail;
          // Handle FastAPI validation errors (like invalid email format)
          if (Array.isArray(detail)) {
            // Use unknown for 'd' and assert type for safety
            setError(
              detail.map((d: unknown) => (d as { msg: string }).msg).join(", ")
            );
          } else {
            setError(String(detail));
          }
        } else {
          // Handle other Axios error cases (e.g., network errors without specific data)
          setError("An unexpected error occurred during the request.");
        }
      } else {
        // Handle non-Axios errors or errors without a response property
        setError("An unexpected error occurred. Please try again.");
        // Optional: Log the unknown error structure for debugging
        // console.error('Caught a non-Axios error or error structure:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>
          Enter your email and password to access your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <p>Don&apos;t have an account?&nbsp;</p>
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Register here
        </Link>
      </CardFooter>
    </>
  );
}

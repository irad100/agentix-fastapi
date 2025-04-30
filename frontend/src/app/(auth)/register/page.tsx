'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import axios from 'axios';

// Define the expected response structure based on openapi.json
// UserResponse contains id, email, and token (which has access_token, expires_at)
interface Token {
  access_token: string;
  token_type: string;
  expires_at: string; // ISO 8601 format string
}
interface UserResponse {
  id: number;
  email: string;
  token: Token;
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth(); // Use login from context after registration

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Add more client-side validation if needed (e.g., password strength)

    setIsLoading(true);

    try {
      // Register endpoint expects JSON
      const response = await api.post<UserResponse>('/api/v1/auth/register', {
        email,
        password,
      });

      // Log the user in immediately after successful registration
      await login(response.data.token.access_token, response.data.token.expires_at);

      // Redirect to the chat page
      router.push('/');

    } catch (err) {
      console.error('Registration failed:', err);
      let errorMessage = 'An unexpected error occurred during registration. Please try again.'; // Default message

      // Define potential structures for error response data
      type ErrorDetail = string | null | undefined;
      interface ErrorItem {
        field: string;
        message: string;
      }
      interface ErrorResponseData {
        detail?: ErrorDetail;
        errors?: ErrorItem[];
      }

      // Check if it's an AxiosError with a response
      if (axios.isAxiosError<ErrorResponseData>(err) && err.response?.data) {
        const responseData = err.response.data;

        if (err.response.status === 422) {
          // Check for the custom errors array first
          if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
            errorMessage = responseData.errors
              // Use unknown for 'e' and assert type for safety
              .map((e: unknown) => {
                const item = e as ErrorItem;
                return `${item.field || 'Error'}: ${item.message}`;
              })
              .join('; ');
          } else if (typeof responseData.detail === 'string') {
            // Fallback to using the detail string if errors array is not present or empty
            errorMessage = responseData.detail;
          } else {
            // Fallback if neither errors nor string detail is found
            errorMessage = 'Invalid data submitted. Please check your input.';
          }
        } else if (typeof responseData.detail === 'string') {
          // Handle other errors that might have a string detail (like 400)
          errorMessage = responseData.detail;
        }
        // Add other specific status code checks if needed
      }
      // Non-Axios errors or errors without response.data will use the default message

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>Create your account to get started.</CardDescription>
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
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder='••••••••'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8} // Matches backend validation
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder='••••••••'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Registering...' : 'Register'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <p>Already have an account?&nbsp;</p>
        <Link href="/login" className="font-medium text-primary hover:underline">
          Login here
        </Link>
      </CardFooter>
    </>
  );
} 
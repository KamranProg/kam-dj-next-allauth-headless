"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useAppForm } from "@/components/form";
import { useAuth } from "@/context/auth-context";
import type { ApiResponseStatus } from "@/types/api";
import { errorMessages } from "@/lib/api-errors";
import { loginSchema, type LoginFormValues } from "./schema";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";

async function loginViaProxy(values: LoginFormValues): Promise<ApiResponseStatus> {
  try {
    const res = await fetch("/api/proxy/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        status: "error",
        message: errorMessages(data, "Login failed"),
      };
    }

    return {
      status: "success",
      message: "Logged in successfully!",
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      status: "error",
      message: "Login failed. Please try again.",
    };
  }
}

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { refreshUser } = useAuth();

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
      onChange: loginSchema,
    },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const result = await loginViaProxy(value);

        if (result.status === "error") {
          toast.error(result.message);
          return;
        }

        await refreshUser();
        toast.success(result.message);
        form.reset();
        router.push("/dashboard");
      });
    },
  });

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(e);
          }}
          className="space-y-4"
        >
          <form.AppField name="email">
            {(field) => <field.TextField label="Email" type="email" />}
          </form.AppField>

          <form.AppField name="password">
            {(field) => <field.TextField label="Password" type="password" />}
          </form.AppField>

          <form.AppForm>
            <form.SubmitButton isPending={isPending}>Sign in</form.SubmitButton>
          </form.AppForm>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <div className="w-full border-t pt-4 text-center text-sm text-muted-foreground">OR</div>
        <SocialLoginButtons />
        <p className="text-sm text-center">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

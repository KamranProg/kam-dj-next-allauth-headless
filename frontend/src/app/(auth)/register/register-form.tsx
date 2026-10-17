"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useAppForm } from "@/components/form";
import { useAuth } from "@/context/auth-context";
import type { ApiResponseStatus } from "@/types/api";
import { errorMessages } from "@/lib/api-errors";
import { registerSchema, type RegisterFormBody, type RegisterFormValues } from "./schema";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";

async function registerViaProxy(values: RegisterFormValues): Promise<ApiResponseStatus> {
  const body: RegisterFormBody = {
    email: values.email,
    password: values.password1,
  };

  try {
    const res = await fetch("/api/proxy/auth/register", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        status: "error",
        message: errorMessages(data, "Registration failed"),
      };
    }

    return {
      status: "success",
      message: "Registered successfully!",
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      status: "error",
      message: "Something went wrong.",
    };
  }
}

export function RegisterForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { refreshUser } = useAuth();

  const form = useAppForm({
    defaultValues: {
      email: "",
      password1: "",
      password2: "",
    },
    validators: {
      onSubmit: registerSchema,
      onChange: registerSchema,
    },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const result = await registerViaProxy(value);

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
        <CardTitle className="text-xl">Register</CardTitle>
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

          <form.AppField name="password1">
            {(field) => <field.TextField label="Password" type="password" />}
          </form.AppField>

          <form.AppField name="password2">
            {(field) => <field.TextField label="Confirm Password" type="password" />}
          </form.AppField>

          <form.AppForm>
            <form.SubmitButton isPending={isPending}>Register</form.SubmitButton>
          </form.AppForm>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <div className="w-full border-t pt-4 text-center text-sm text-muted-foreground">OR</div>
        <SocialLoginButtons />
        <p className="text-sm text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppForm } from "@/components/form";
import { useAuth } from "@/context/auth-context";
import { postAuth } from "@/lib/auth-client";
import { z } from "zod";

const codeSchema = z.object({ code: z.string().trim().min(1, "Enter a code") });

export default function TwoFactorPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [isPending, startTransition] = useTransition();

  const form = useAppForm({
    defaultValues: { code: "" },
    validators: { onSubmit: codeSchema, onChange: codeSchema },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const result = await postAuth("two-factor", { code: value.code.trim() });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        await refreshUser();
        toast.success("Logged in successfully!");
        router.push("/dashboard");
      });
    },
  });

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(e);
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app, or one of your recovery codes.
          </p>
          <form.AppField name="code">
            {(field) => (
              <field.TextField label="Code" inputMode="numeric" autoComplete="one-time-code" />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton isPending={isPending}>Verify</form.SubmitButton>
          </form.AppForm>
        </form>
      </CardContent>
      <CardFooter>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppForm } from "@/components/form";
import { postAuth } from "@/lib/auth-client";
import { requestResetSchema } from "./schema";

export default function RequestPasswordResetPage() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onSubmit: requestResetSchema, onChange: requestResetSchema },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const result = await postAuth("password/request", value);
        if (result.ok) setSent(true);
        else toast.error(result.message);
      });
    },
  });

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm">
            If an account exists for that address, we sent an email with a link to choose a new
            password.
          </p>
        ) : (
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
            <form.AppForm>
              <form.SubmitButton isPending={isPending}>Send reset link</form.SubmitButton>
            </form.AppForm>
          </form>
        )}
      </CardContent>
      <CardFooter>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

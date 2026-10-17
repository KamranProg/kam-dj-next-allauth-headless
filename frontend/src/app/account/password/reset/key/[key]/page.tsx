"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppForm } from "@/components/form";
import { postAuth } from "@/lib/auth-client";
import { setPasswordSchema } from "../../schema";

export default function SetNewPasswordPage() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useAppForm({
    defaultValues: { password1: "", password2: "" },
    validators: { onSubmit: setPasswordSchema, onChange: setPasswordSchema },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        // The key in the emailed link is URL-encoded; decode it first.
        const result = await postAuth("password/reset", {
          key: decodeURIComponent(params.key),
          password: value.password1,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success("Password changed. Please sign in.");
        router.push("/login");
      });
    },
  });

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(e);
          }}
          className="space-y-4"
        >
          <form.AppField name="password1">
            {(field) => <field.TextField label="New password" type="password" />}
          </form.AppField>
          <form.AppField name="password2">
            {(field) => <field.TextField label="Confirm new password" type="password" />}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton isPending={isPending}>Change password</form.SubmitButton>
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

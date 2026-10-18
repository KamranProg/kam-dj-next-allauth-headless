"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { callProxy } from "@/lib/auth-client";

export default function CheckEmailPage() {
  const [isPending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const result = await callProxy("auth/verify-email/resend", "POST", {});
      if (result.ok) {
        toast.success("We sent you another email.");
      } else if (result.status === 409) {
        // No confirmation is waiting: the address already has an account, or it was confirmed.
        toast.info(
          "There is no confirmation email to resend. Try signing in, or reset your password."
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">Check your email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          If this address is new, we sent a link to confirm it. Open it to finish creating your
          account, then sign in.
        </p>
        <p className="text-muted-foreground">
          If you already have an account with this address, we sent a different email instead: sign
          in, or use &ldquo;Forgot your password?&rdquo; on the sign-in page.
        </p>
        <Button variant="outline" className="w-full" onClick={resend} disabled={isPending}>
          {isPending ? "Sending..." : "Send the email again"}
        </Button>
      </CardContent>
      <CardFooter>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

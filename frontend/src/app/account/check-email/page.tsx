"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { postAuth } from "@/lib/auth-client";

export default function CheckEmailPage() {
  const [isPending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const result = await postAuth("verify-email/resend");
      if (result.ok) toast.success("We sent you another email.");
      else toast.error(result.message);
    });
  }

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">Check your email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          We sent a link to confirm your email address. Open it to finish creating your account,
          then sign in.
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

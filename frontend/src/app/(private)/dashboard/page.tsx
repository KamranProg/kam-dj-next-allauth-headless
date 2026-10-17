import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        Welcome to your protected dashboard. You can only see this page while signed in.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/account/security" className="text-blue-600 hover:underline">
          Security settings
        </Link>
      </p>
    </div>
  );
}

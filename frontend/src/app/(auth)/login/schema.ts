import { z } from "zod";

// Only require a value here. Password strength rules apply when choosing a
// password (registration), not when signing in to an existing account.
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

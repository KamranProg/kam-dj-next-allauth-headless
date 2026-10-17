import { z } from "zod";

export const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Password must contain at least one number",
  });

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password1: passwordRules,
    password2: passwordRules,
  })
  .refine((data) => data.password1 === data.password2, {
    message: "Passwords do not match",
    path: ["password2"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export type RegisterFormBody = { email: string; password: string };

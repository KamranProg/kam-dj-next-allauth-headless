import { z } from "zod";
import { passwordRules } from "@/app/(auth)/register/schema";

export const requestResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const setPasswordSchema = z
  .object({
    password1: passwordRules,
    password2: passwordRules,
  })
  .refine((data) => data.password1 === data.password2, {
    message: "Passwords do not match",
    path: ["password2"],
  });

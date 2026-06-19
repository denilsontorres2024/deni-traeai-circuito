import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Informe um email valido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(3, "Informe seu nome completo."),
  jobTitle: z.string().min(2, "Informe seu cargo ou rotina principal."),
  goal: z.string().min(10, "Descreva rapidamente seu objetivo."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Informe um email valido."),
});

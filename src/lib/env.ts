import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  COMPOSIO_API_KEY: z.string().optional(),
  COMPOSIO_BASE_URL: z.string().url().default("https://backend.composio.dev"),
  COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR: z.string().optional(),
  COMPOSIO_AUTH_CONFIG_GMAIL: z.string().optional(),
  COMPOSIO_AUTH_CONFIG_SLACK: z.string().optional(),
  COMPOSIO_AUTH_CONFIG_TWILIO: z.string().optional(),
  COMPOSIO_AUTH_CONFIG_NOTION: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
  COMPOSIO_BASE_URL: process.env.COMPOSIO_BASE_URL ?? "https://backend.composio.dev",
  COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR:
    process.env.COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR,
  COMPOSIO_AUTH_CONFIG_GMAIL: process.env.COMPOSIO_AUTH_CONFIG_GMAIL,
  COMPOSIO_AUTH_CONFIG_SLACK: process.env.COMPOSIO_AUTH_CONFIG_SLACK,
  COMPOSIO_AUTH_CONFIG_TWILIO: process.env.COMPOSIO_AUTH_CONFIG_TWILIO,
  COMPOSIO_AUTH_CONFIG_NOTION: process.env.COMPOSIO_AUTH_CONFIG_NOTION,
});

if (!parsed.success) {
  console.error("Variaveis de ambiente invalidas", parsed.error.flatten().fieldErrors);
  throw new Error("Configuracao de ambiente incompleta.");
}

export const env = parsed.data;

export const featureFlags = {
  openAiReady: Boolean(env.OPENAI_API_KEY),
  composioReady: Boolean(env.COMPOSIO_API_KEY),
  prismaReady: Boolean(env.DATABASE_URL),
};

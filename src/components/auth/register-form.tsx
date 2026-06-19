"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/schemas/auth";

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      jobTitle: "",
      goal: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setMessage(null);
    setError(null);

    const registerResponse = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const registerPayload = (await registerResponse.json()) as {
      error?: string;
    };

    if (!registerResponse.ok) {
      setLoading(false);
      setError(registerPayload.error ?? "Nao foi possivel criar sua conta.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("Conta criada com acesso imediato.");
    form.reset();
    router.push("/dashboard");
    router.refresh();
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" placeholder="Seu nome" {...form.register("fullName")} />
          {form.formState.errors.fullName ? (
            <p className="text-xs text-rose-300">{form.formState.errors.fullName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Rotina ou cargo</Label>
          <Input id="jobTitle" placeholder="Ex.: Analista, estudante" {...form.register("jobTitle")} />
          {form.formState.errors.jobTitle ? (
            <p className="text-xs text-rose-300">{form.formState.errors.jobTitle.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="voce@empresa.com" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-xs text-rose-300">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" placeholder="Minimo de 8 caracteres" {...form.register("password")} />
        {form.formState.errors.password ? (
          <p className="text-xs text-rose-300">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal">Objetivo principal</Label>
        <Input id="goal" placeholder="Ex.: reduzir tensao cervical e melhorar setup" {...form.register("goal")} />
        {form.formState.errors.goal ? (
          <p className="text-xs text-rose-300">{form.formState.errors.goal.message}</p>
        ) : null}
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <Button className="w-full" disabled={loading} type="submit">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Criar conta
      </Button>

      <p className="text-sm text-zinc-400">
        Ja possui acesso?{" "}
        <Link className="text-white hover:text-emerald-200" href="/login">
          Fazer login
        </Link>
      </p>
    </form>
  );
}

import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <>
      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Onboarding inteligente</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Comece a construir sua rotina postural com dados reais.
          </h1>
          <p className="max-w-2xl text-base text-zinc-300">
            Crie sua conta, conecte sua agenda e receba planos ergonomicos personalizados conforme suas analises evoluem.
          </p>
        </div>
      </section>

      <Card className="self-center">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Configure seu acesso e seu objetivo inicial de saude postural.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </>
  );
}

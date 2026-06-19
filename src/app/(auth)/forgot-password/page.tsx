import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <>
      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Recuperacao segura</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Redefina sua senha sem perder seu historico postural.
          </h1>
          <p className="max-w-2xl text-base text-zinc-300">
            Enviaremos um link seguro para seu email cadastrado.
          </p>
        </div>
      </section>

      <Card className="self-center">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Informe o email associado a sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </>
  );
}

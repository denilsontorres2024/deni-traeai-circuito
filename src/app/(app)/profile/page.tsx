import { updateProfileAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAuthenticatedContext } from "@/lib/services/data-service";

export default async function ProfilePage() {
  const { supabase, user } = await getAuthenticatedContext();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>
          Dados pessoais, contexto de rotina e objetivos que influenciam o plano postural.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateProfileAction} className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome</Label>
            <Input defaultValue={profile?.full_name ?? ""} id="fullName" name="fullName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Cargo ou rotina</Label>
            <Input defaultValue={profile?.job_title ?? ""} id="jobTitle" name="jobTitle" />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="goal">Objetivo</Label>
            <Input defaultValue={profile?.goal ?? ""} id="goal" name="goal" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input defaultValue={profile?.timezone ?? "UTC"} id="timezone" name="timezone" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discomfortAreas">Areas de desconforto</Label>
            <Input
              defaultValue={(profile?.discomfort_areas ?? []).join(", ")}
              id="discomfortAreas"
              name="discomfortAreas"
              placeholder="Ex.: cervical, ombro direito, lombar"
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="profileSummary">Resumo</Label>
            <Textarea
              defaultValue={`Email: ${user.email ?? ""}`}
              id="profileSummary"
              name="profileSummary"
              readOnly
            />
          </div>
          <div className="lg:col-span-2">
            <Button type="submit">Salvar perfil</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

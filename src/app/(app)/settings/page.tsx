import { updatePreferencesAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthenticatedContext } from "@/lib/services/data-service";

export default async function SettingsPage() {
  const { supabase, user } = await getAuthenticatedContext();
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Preferencias de lembrete, janela de trabalho, pausas e intensidade do acompanhamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updatePreferencesAction} className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="workdayStart">Inicio da jornada</Label>
            <Input defaultValue={preferences?.workday_start ?? "09:00"} id="workdayStart" name="workdayStart" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workdayEnd">Fim da jornada</Label>
            <Input defaultValue={preferences?.workday_end ?? "18:00"} id="workdayEnd" name="workdayEnd" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredBreakMinutes">Duracao da pausa</Label>
            <Input
              defaultValue={preferences?.preferred_break_minutes ?? 5}
              id="preferredBreakMinutes"
              name="preferredBreakMinutes"
              type="number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seatedAlertMinutes">Alerta de sedentarismo</Label>
            <Input
              defaultValue={preferences?.seated_alert_minutes ?? 50}
              id="seatedAlertMinutes"
              name="seatedAlertMinutes"
              type="number"
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="openAiGoal">Prompt interno de foco</Label>
            <Input
              defaultValue={preferences?.openai_goal ?? "Priorize recomendacoes praticas e acionaveis."}
              id="openAiGoal"
              name="openAiGoal"
            />
          </div>
          <label className="flex items-center gap-3 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300 lg:col-span-2">
            <input defaultChecked name="remindersEnabled" type="checkbox" />
            Lembretes inteligentes habilitados
          </label>
          <label className="flex items-center gap-3 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300 lg:col-span-2">
            <input defaultChecked name="weeklySummary" type="checkbox" />
            Resumo semanal automatico
          </label>
          <div className="lg:col-span-2">
            <Button type="submit">Salvar configuracoes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

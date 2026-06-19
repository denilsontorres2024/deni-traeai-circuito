import { IntegrationsPanel } from "@/components/integrations/integrations-panel";
import { listIntegrations } from "@/lib/services/data-service";

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();

  return <IntegrationsPanel initial={integrations} />;
}

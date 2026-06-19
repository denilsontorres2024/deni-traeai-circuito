import { createNotification, listIntegrations } from "@/lib/services/data-service";

const priority: Array<"gmail" | "slack" | "telegram" | "whatsapp"> = [
  "gmail",
  "slack",
  "telegram",
  "whatsapp",
];

function providerForChannel(channel: string) {
  if (channel === "whatsapp") return "twilio";
  return channel;
}

export async function sendSmartReminder(input: {
  subject?: string;
  message: string;
}) {
  const integrations = await listIntegrations();

  const channel = priority.find((option) =>
    integrations.some(
      (integration) =>
        integration.provider === providerForChannel(option) &&
        integration.status === "connected",
    ),
  );

  return createNotification({
    channel: channel ?? "gmail",
    status: channel ? "queued" : "failed",
    subject: input.subject,
    message: input.message,
    metadata: {
      routedBy: "notification-router",
      fallbackUsed: !channel,
    },
  });
}

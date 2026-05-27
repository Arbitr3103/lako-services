import { env } from 'cloudflare:workers';

export interface WorkerBindings {
  LAKO_BOT_API_URL?: string;
  REGISTRATION_SECRET?: string;
  RESEND_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export function getWorkerEnv(): WorkerBindings {
  return env as WorkerBindings;
}

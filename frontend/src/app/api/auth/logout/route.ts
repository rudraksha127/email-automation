import { destroySession, json } from "@/lib/auth";

export async function POST(): Promise<Response> {
  await destroySession();
  return json({ ok: true });
}

import { verifyKey } from 'discord-interactions';
import { Env } from '.';

export async function verify(request: Request, env: Env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.clone().arrayBuffer();
  return verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
}

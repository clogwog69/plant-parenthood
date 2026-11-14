// Plant Parenthood notifications.
// Deploy as a Supabase Edge Function called "push", with "Verify JWT" off.
// It makes its own signing keys the first time it runs and keeps them in
// the locked sprout_secrets table, so there is nothing to configure.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = 'https://clogwog69.github.io/plant-parenthood/';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const text = (v: unknown, max: number) => String(v ?? '').slice(0, max);

interface Keys { publicKey: string; privateKey: string }
let cached: Keys | null = null;
async function keys(): Promise<Keys> {
  if (cached) return cached;
  const read = async () => (await db.from('sprout_secrets').select('value').eq('name', 'vapid').maybeSingle()).data?.value as Keys | undefined;
  let k = await read();
  if (!k) {
    await db.from('sprout_secrets').upsert({ name: 'vapid', value: webpush.generateVAPIDKeys() }, { onConflict: 'name', ignoreDuplicates: true });
    k = await read();
  }
  if (!k) throw new Error('Run supabase/features.sql first');
  cached = k;
  return k;
}

async function houseId(code: unknown): Promise<string | null> {
  const { data } = await db.rpc('sprout_house', { p_code: text(code, 40) });
  return (data as string | null) ?? null;
}

interface Sub { endpoint: string; sub: webpush.PushSubscription }
/** Sends one notification; forgets phones that have switched them off. */
async function send(to: Sub, title: string, body: string): Promise<boolean> {
  const k = await keys();
  try {
    await webpush.sendNotification(to.sub, JSON.stringify({ title, body }), {
      vapidDetails: { subject: SITE, publicKey: k.publicKey, privateKey: k.privateKey },
      TTL: 12 * 60 * 60,
    });
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await db.from('sprout_push_subs').delete().eq('endpoint', to.endpoint);
    return false;
  }
}

/** Today's date and hour on the phone's own clock. */
function localNow(tz: string | null): { date: string; hour: number } {
  const parts = (zone: string) => Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  let p: Record<string, string>;
  try { p = parts(tz || 'UTC'); } catch { p = parts('UTC'); }
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

async function digest(): Promise<number> {
  const { data: subs } = await db.from('sprout_push_subs').select('endpoint, household_id, sub, tz, last_digest');
  const houses = new Map<string, { date: string; items: string[] }[]>();
  let sent = 0;
  for (const s of subs ?? []) {
    const { date, hour } = localNow(s.tz);
    if (hour < 8 || hour > 11 || s.last_digest === date) continue;
    if (!houses.has(s.household_id)) {
      const { data } = await db.from('sprout_households').select('digest').eq('id', s.household_id).maybeSingle();
      houses.set(s.household_id, Array.isArray(data?.digest) ? data.digest : []);
    }
    const items = houses.get(s.household_id)!.find((d) => d.date === date)?.items ?? [];
    await db.from('sprout_push_subs').update({ last_digest: date }).eq('endpoint', s.endpoint);
    if (!items.length) continue;
    const title = items.length === 1 ? '1 plant job today' : `${items.length} plant jobs today`;
    const body = items.slice(0, 4).join(', ') + (items.length > 4 ? ` and ${items.length - 4} more` : '');
    if (await send(s, title, body)) sent++;
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const b = await req.json();
    switch (b.action) {
      case 'key':
        return json({ key: (await keys()).publicKey });

      case 'subscribe': {
        const h = await houseId(b.code);
        const endpoint = b.sub?.endpoint;
        if (!h || typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !b.sub?.keys?.p256dh || !b.sub?.keys?.auth) return json({ error: 'bad request' }, 400);
        const { error } = await db.from('sprout_push_subs').upsert({
          endpoint, household_id: h, name: text(b.name, 40),
          sub: { endpoint, keys: { p256dh: text(b.sub.keys.p256dh, 200), auth: text(b.sub.keys.auth, 100) } },
          tz: text(b.tz, 60),
        });
        if (error) throw error;
        return json({ ok: true });
      }

      case 'unsubscribe':
        await db.from('sprout_push_subs').delete().eq('endpoint', text(b.endpoint, 1000));
        return json({ ok: true });

      case 'notify': {
        const h = await houseId(b.code);
        if (!h) return json({ error: 'bad request' }, 400);
        const { data: subs } = await db.from('sprout_push_subs').select('endpoint, sub').eq('household_id', h);
        const others = (subs ?? []).filter((s) => s.endpoint !== b.from).slice(0, 20);
        const done = await Promise.all(others.map((s) => send(s, text(b.title, 80), text(b.body, 200))));
        return json({ sent: done.filter(Boolean).length });
      }

      case 'digest':
        return json({ sent: await digest() });

      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

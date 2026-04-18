import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeSupabaseUrl(raw: string): string {
  let value = raw.trim();

  if (!/^https?:\/\//i.test(value)) {
    if (!value.includes('.')) {
      value = `https://${value}.supabase.co`;
    } else {
      value = `https://${value}`;
    }
  }

  if (/^https?:\/\/[a-z0-9-]+$/i.test(value)) {
    value = `${value}.supabase.co`;
  }

  return value.replace(/\/$/, '');
}

function getServerUrl(): string {
  return normalizeSupabaseUrl(readEnv('NEXT_PUBLIC_SUPABASE_URL'));
}

export function createServerClient(): SupabaseClient {
  return createClient(getServerUrl(), readEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createBrowserClient(): SupabaseClient {
  return createClient(getServerUrl(), readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
}

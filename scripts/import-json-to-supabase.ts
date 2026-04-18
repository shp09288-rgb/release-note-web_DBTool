import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function main() {
  const supabase = createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const dataDir = path.join(process.cwd(), 'data');
  const files = (await fs.readdir(dataDir)).filter((file) => file.endsWith('.json'));

  for (const file of files) {
    const raw = await fs.readFile(path.join(dataDir, file), 'utf-8');
    const payload = JSON.parse(raw);
    const { error } = await supabase.rpc('save_note', { payload });
    if (error) throw error;
    console.log(`Imported ${file}`);
  }

  console.log(`Imported ${files.length} files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

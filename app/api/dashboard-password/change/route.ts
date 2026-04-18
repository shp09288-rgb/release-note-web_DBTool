import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const newPassword = body.newPassword || body.password

    if (!newPassword) {
      return Response.json({ ok: false, error: 'Password is required' })
    }

    const { error } = await supabase
      .from('dashboard_settings')
      .upsert(
        {
          key: 'dashboard_password',
          value: newPassword,
          updated_by: 'user'
        },
        { onConflict: 'key' }
      )

    if (error) {
      console.error('DB ERROR:', error)
      return Response.json({ ok: false, error: error.message })
    }

    return Response.json({ ok: true })
  } catch (err: any) {
    console.error('SERVER ERROR:', err)
    return Response.json({ ok: false, error: err.message })
  }
}
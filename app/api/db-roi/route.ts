import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)

export async function POST(request: Request) {
  try {
    const requestData = await request.json()

    delete requestData.id;

    const { data, error } = await supabaseAdmin
    .from('rois')
    .insert([
      requestData
    ])
    .select();
          
    

    return NextResponse.json({ data, error })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
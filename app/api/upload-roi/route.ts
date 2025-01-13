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
    const { imageData, category, imageName } = await request.json()
    
    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    const newImageName = imageName.split("/")[1];
    
    const filepath = `${category}/${newImageName}.png`

    // console.log("Uploading image to", {imageName, category, filepath, newImageName});

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('roi-images')
      .upload(filepath, buffer, {
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('roi-images')
      .getPublicUrl(filepath)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
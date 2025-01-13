// app/api/export-roi/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Key');
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { userId, imageName, x, y, width, height, category, dataUrl } = await req.json();

    const { data, error } = await supabase
      .from('rois')
      .insert([
        { user_id: userId, image_name: imageName, x, y, width, height, category, data_url: dataUrl }
      ]);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error saving ROI:', error);
    return NextResponse.json({ success: false, error: (error as Error).message });
  }
}
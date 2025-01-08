import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: Request) {
  try {
    const { imageData, category, filename } = await req.json();
    
    // Base path for Team_jersey_data
    const basePath = join(process.cwd(), 'public', 'Team_jersey_data');
    
    // Full path including category subfolders
    const fullPath = join(basePath, category);
    
    // Create directories if they don't exist
    await mkdir(fullPath, { recursive: true });
    
    // Remove data:image/png;base64, prefix
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Write file
    await writeFile(join(fullPath, filename), buffer);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving file:', error);
    return NextResponse.json({ success: false, error: String(error) });
  }
}

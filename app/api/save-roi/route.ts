// app/api/export-roi/route.ts
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(req: Request) {
  try {
    const { imageData, category } = await req.json();
    
    // Get Desktop path
    const desktopPath = path.join(os.homedir(), 'Desktop');
    
    // Base directory path on Desktop
    const baseDir = path.join(desktopPath, 'Team_jersey_data');
    
    // Create full category path
    const categoryPath = path.join(baseDir, category);
    
    // Ensure directory exists
    await mkdir(categoryPath, { recursive: true });
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}.png`;
    const filepath = path.join(categoryPath, filename);
    
    // Convert base64 to buffer and save
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    await writeFile(filepath, buffer);
    
    return NextResponse.json({ success: true, filepath });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
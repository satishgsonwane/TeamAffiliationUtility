export type Category = 'teamA' | 'teamB' | 'referee' | null

export interface ROI {
  id: number
  x: number
  y: number
  width: number
  height: number
  category: string | null
  dataUrl: string | null
  userId: string
  imageName: string
}

export type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export interface HandleInfo {
  x: number
  y: number
  cursor: string
}


export interface ROI {
  x: number
  y: number
  width: number
  height: number
}

export interface HandleInfo {
  x: number
  y: number
  cursor: string
}

export type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
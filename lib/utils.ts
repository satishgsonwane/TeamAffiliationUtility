import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const generateImageName = (category: string, index: number, timestamp: string) => {
  return `${category}_${timestamp}_${index}`
}

export const formatTimestamp = (date: Date): string => {
  return date.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
}

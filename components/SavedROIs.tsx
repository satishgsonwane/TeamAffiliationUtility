import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from 'react'
import { ROI, Category } from '../types/roi'
import Image from 'next/image'

interface SavedROIsProps {
  rois: ROI[]
  onDiscard: (rois: ROI[]) => void
  onCategoryChange: (roiId: number, category: Category) => void
}

export function SavedROIs({ rois, onDiscard, onCategoryChange }: SavedROIsProps) {
  const [selectedROIs, setSelectedROIs] = useState<Set<number>>(new Set())

  const toggleROI = (id: number) => {
    setSelectedROIs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleDiscard = () => {
    const keptROIs = rois.filter(roi => !selectedROIs.has(roi.id))
    onDiscard(keptROIs)
    setSelectedROIs(new Set())
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2">Saved ROIs</h2>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {rois.map((roi) => (
          <div
            key={roi.id}
            className={`border p-2 ${
              selectedROIs.has(roi.id) ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <div className="relative w-full h-40 mb-2">
              <Image 
                src={roi.dataUrl} 
                alt={`ROI ${roi.id}`} 
                layout="fill"
                objectFit="contain"
                className="cursor-pointer"
                onClick={() => toggleROI(roi.id)}
              />
            </div>
            <Select
              onValueChange={(value: Category) => onCategoryChange(roi.id, value)}
              value={roi.category || undefined}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teamA">Team A</SelectItem>
                <SelectItem value="teamB">Team B</SelectItem>
                <SelectItem value="referee">Referee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {rois.length > 0 && (
        <Button onClick={handleDiscard} variant="destructive">
          Discard Selected ROIs
        </Button>
      )}
    </div>
  )
}


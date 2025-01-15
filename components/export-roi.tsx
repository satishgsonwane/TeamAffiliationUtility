"use client"

import { Check } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { Dispatch, SetStateAction, useState } from "react"
import { formatTimestamp, generateImageName } from "@/lib/utils"
import { ROI } from "@/types/roi"

interface ExportROIProps {
  imageDimensions: { width: number; height: number }
  savedROIs: ROI[]
  setSavedROIs: Dispatch<SetStateAction<ROI[]>>
}

export const ExportROI = ({ imageDimensions, setSavedROIs, savedROIs }: ExportROIProps) => {
  const [exportStatus, setExportStatus] = useState<string>('')

  const handleExport = async (rois: ROI[], setStatus: (status: string) => void) => {
    setStatus('Starting export...')

    const categorizedROIs = rois.filter(roi => roi.category && roi.dataUrl)

    try {
      for (const [index, roi] of categorizedROIs.entries()) {
        const timestamp = formatTimestamp(new Date())
        const imageName = generateImageName(roi.category!, index, timestamp)

        const imageUploadData = {
          imageData: roi.dataUrl,
          category: roi.category,
          imageName
        }

        const normalizedROI = {
          ...roi,
          x: roi.x / imageDimensions.width,
          y: roi.y / imageDimensions.height,
          imageName
        }

        const response = await fetch('/api/upload-roi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(imageUploadData)
        })

        if (!response.ok) throw new Error('Upload failed')

        const { url: imageUrl } = await response.json()

        setSavedROIs(prevROIs =>
          prevROIs.map(prevRoi =>
            prevRoi.id === roi.id
              ? { ...prevRoi, dataUrl: imageUrl }
              : prevRoi
          )
        )

        await fetch('/api/db-roi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedROI)
        })

        setStatus(`Exported ${index + 1}/${categorizedROIs.length}`)
      }

      setStatus('Export complete!')
      setTimeout(() => setStatus(''), 3000)
    } catch (error) {
      console.error('Export error:', error)
      setStatus('Export failed')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Export ROIs</h2>
        <Button
          onClick={() => handleExport(savedROIs, setExportStatus)}
          className="w-full bg-green-500 hover:bg-green-600"
        >
          <Check className="w-4 h-4 mr-2" />
          Export ROIs
        </Button>
        {exportStatus && (
          <p className="text-sm text-gray-600 animate-fade-in">{exportStatus}</p>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { saveAs } from 'file-saver'
import Image from 'next/image'
import { Button } from '../components/ui/button'

export interface ROI {
  id: number
  x: number
  y: number
  width: number
  height: number
  category: string | null
  dataUrl: string | null
}

export default function ROISelector() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [savedROIs, setSavedROIs] = useState<ROI[]>([])
  const [currentROI, setCurrentROI] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {
      setImageUrl(reader.result as string)
    }

    reader.onerror = () => {
      console.error('Error reading file')
    }

    reader.readAsDataURL(file)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setIsDrawing(true)
    setCurrentROI({
      x,
      y,
      width: 0,
      height: 0
    })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentROI) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setCurrentROI(prev => prev ? {
      ...prev,
      width: x - prev.x,
      height: y - prev.y
    } : null)
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentROI || !canvasRef.current) return

    setIsDrawing(false)
    const { x, y, width, height } = currentROI

    const normalizedROI = {
      x: width < 0 ? x + width : x,
      y: height < 0 ? y + height : y,
      width: Math.abs(width),
      height: Math.abs(height)
    }
    const canvas = document.createElement('canvas')
    canvas.width = normalizedROI.width
    canvas.height = normalizedROI.height
    const ctx = canvas.getContext('2d')
    if (ctx && imageUrl) {
      const img = new window.Image()
      img.src = imageUrl
      img.onload = () => {
        ctx.drawImage(img, normalizedROI.x, normalizedROI.y, normalizedROI.width, normalizedROI.height, 0, 0, normalizedROI.width, normalizedROI.height)
        const dataUrl = canvas.toDataURL()
        setSavedROIs(prev => [...prev, { id: Date.now(), ...normalizedROI, category: null, dataUrl }])
      }
    }
    setCurrentROI(null)
  }

  const handleCategoryChange = (roiId: number, category: string) => {
    setSavedROIs(prev => prev.map(roi => roi.id === roiId ? { ...roi, category } : roi))
  }

  const handleDiscard = (roiId: number) => {
    setSavedROIs(prev => prev.filter(roi => roi.id !== roiId))
  }

  const handleExport = () => {
    savedROIs.forEach(roi => {
      const canvas = document.createElement('canvas')
      canvas.width = roi.width
      canvas.height = roi.height
      const ctx = canvas.getContext('2d')
      if (ctx && imageUrl) {
        const img = new window.Image()
        img.src = imageUrl
        img.onload = () => {
          ctx.drawImage(img, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height)
          canvas.toBlob(blob => {
            if (blob) {
              saveAs(blob, `${roi.category}-${roi.id}.png`)
            }
          })
        }
      }
    })
  }

  useEffect(() => {
    if (imageUrl && canvasRef.current) {
      const img = new window.Image()
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height })
      }
      img.src = imageUrl
    }
  }, [imageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (imageUrl) {
      const img = new window.Image()
      img.src = imageUrl
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        savedROIs.forEach(roi => {
          ctx.strokeStyle = 'red'
          ctx.lineWidth = 2
          ctx.strokeRect(roi.x, roi.y, roi.width, roi.height)
        })
        if (currentROI) {
          ctx.strokeStyle = 'blue'
          ctx.lineWidth = 2
          ctx.strokeRect(currentROI.x, currentROI.y, currentROI.width, currentROI.height)
        }
      }
    }
  }, [imageUrl, savedROIs, currentROI])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ROI Selector</h1>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        ref={fileInputRef}
        className="mb-4"
      />
      {imageUrl && (
        <div className="mb-4 relative">
          <Image
            src={imageUrl}
            alt="Uploaded image"
            width={imageDimensions.width}
            height={imageDimensions.height}
            className="max-w-full h-auto"
          />
          <canvas
            ref={canvasRef}
            width={imageDimensions.width}
            height={imageDimensions.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="absolute top-0 left-0 w-full h-full"
          />
        </div>
      )}
      {savedROIs.length > 0 && (
        <div className="flex flex-wrap mb-4">
          {savedROIs.map(roi => (
            <div key={roi.id} className="flex flex-col items-center mr-4 mb-4">
              {roi.dataUrl && (
                <Image 
                  src={roi.dataUrl} 
                  alt={`ROI ${roi.id}`} 
                  width={100}
                  height={100}
                />
              )}
              <select 
                value={roi.category || ''} 
                onChange={(e) => handleCategoryChange(roi.id, e.target.value as string)}
                className="mt-2"
              >
                <option value="">Select category</option>
                <option value="teamA">Team A</option>
                <option value="teamB">Team B</option>
                <option value="referee">Referee</option>
              </select>
              <Button onClick={() => handleDiscard(roi.id)} variant="destructive" className="mt-2">
                Discard
              </Button>
            </div>
          ))}
        </div>
      )}
      {savedROIs.length > 0 && (
        <Button onClick={handleExport} variant="default" className="mt-4">
          Export Selected ROIs
        </Button>
      )}
    </div>
  )
}


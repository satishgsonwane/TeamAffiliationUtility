'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { ROI, Category } from '../types/roi'

export default function ROISelector() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [savedROIs, setSavedROIs] = useState<ROI[]>([])
  const [currentROI, setCurrentROI] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [scale, setScale] = useState({ x: 1, y: 1 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      console.error('No file selected')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        console.error('Failed to read file')
        return
      }

      setImageUrl(reader.result)

      const img = new window.Image()
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height })
      }
      img.onerror = () => {
        console.error('Failed to load image')
      }
      img.src = reader.result
    }

    reader.onerror = () => {
      console.error('Error reading file:', reader.error)
    }

    reader.readAsDataURL(file)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    // Calculate position relative to canvas
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    console.log('Mouse down at:', { x, y, scaleX, scaleY })
    
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
    
    setCurrentROI(prev => {
      if (!prev) return null
      return {
        ...prev,
        width: x - prev.x,
        height: y - prev.y
      }
    })
  }

  const handleMouseUp = () => {
    if (!isDrawing || !currentROI || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(false)
    const { x, y, width, height } = currentROI
    
    // Ensure positive width and height
    const normalizedROI = {
      x: width < 0 ? x + width : x,
      y: height < 0 ? y + height : y,
      width: Math.abs(width),
      height: Math.abs(height)
    }

    const imageData = ctx.getImageData(
      normalizedROI.x,
      normalizedROI.y,
      normalizedROI.width,
      normalizedROI.height
    )

    const offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = normalizedROI.width
    offscreenCanvas.height = normalizedROI.height
    const offscreenCtx = offscreenCanvas.getContext('2d')
    if (!offscreenCtx) return

    offscreenCtx.putImageData(imageData, 0, 0)
    const dataUrl = offscreenCanvas.toDataURL()

    setSavedROIs(prev => [...prev, { id: Date.now(), dataUrl, category: null }])
    setCurrentROI(null)
  }

  const handleCategoryChange = (roiId: number, category: Category) => {
    setSavedROIs(prev => prev.map(roi => 
      roi.id === roiId ? { ...roi, category } : roi
    ))
  }

  const handleDiscard = (roiId: number) => {
    setSavedROIs(prev => prev.filter(roi => roi.id !== roiId))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageUrl) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new window.Image()
    img.onload = () => {
      // Set canvas to original image dimensions
      canvas.width = img.width
      canvas.height = img.height
      
      // Calculate scale factors
      const rect = canvas.getBoundingClientRect()
      setScale({
        x: img.width / rect.width,
        y: img.height / rect.height
      })

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      
      if (currentROI) {
        ctx.strokeStyle = 'red'
        ctx.strokeRect(
          currentROI.x,
          currentROI.y,
          currentROI.width,
          currentROI.height
        )
      }
    }
    img.src = imageUrl
  }, [imageUrl, currentROI])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ROI Selector</h1>
      <Input
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
              <Image 
                src={roi.dataUrl} 
                alt={`ROI ${roi.id}`} 
                width={100}
                height={100}
              />
              <select 
                value={roi.category || ''} 
                onChange={(e) => handleCategoryChange(roi.id, e.target.value as Category)}
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
    </div>
  )
}


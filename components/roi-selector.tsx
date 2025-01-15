'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Upload } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { ExportROI } from './export-roi'
import { RegionsOfInterest } from './regions-of-interest'
import { ROI } from '@/types/roi'
import { useCanvas } from '@/hooks/useCanvas'


const Home = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    handles,
    HANDLE_SIZE,
    savedROIs,
    selectedROI,
    currentROI,
    activeHandle,
    handleMouseUp,
    handleMouseMove,
    handleMouseDown,
    setSavedROIs,
    setSelectedROI
  } = useCanvas({
    imageUrl,
    imageDimensions,
    canvasRef
  })



  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setImageUrl(reader.result as string)
    reader.onerror = () => console.error('Error reading file')
    reader.readAsDataURL(file)
  }

  const drawResizeHandles = (ctx: CanvasRenderingContext2D, roi: ROI) => {
    const handles = {
      topLeft: { x: roi.x, y: roi.y },
      topRight: { x: roi.x + roi.width, y: roi.y },
      bottomLeft: { x: roi.x, y: roi.y + roi.height },
      bottomRight: { x: roi.x + roi.width, y: roi.y + roi.height }
    }

    ctx.shadowColor = 'rgba(33, 150, 243, 0.3)'
    ctx.shadowBlur = 8

    Object.entries(handles).forEach(([, pos]) => {
      ctx.beginPath()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.strokeStyle = '#2196F3'
      ctx.arc(pos.x, pos.y, HANDLE_SIZE/2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      
      ctx.beginPath()
      ctx.fillStyle = '#2196F3'
      ctx.arc(pos.x, pos.y, HANDLE_SIZE/4, 0, Math.PI * 2)
      ctx.fill()
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
          ctx.strokeStyle = roi.id === selectedROI ? '#2196F3' : '#FF4444'
          ctx.lineWidth = 2
          ctx.strokeRect(roi.x, roi.y, roi.width, roi.height)
          
          if (roi.id === selectedROI) {
            drawResizeHandles(ctx, roi)
          }
        })

        if (currentROI) {
          ctx.strokeStyle = '#2196F3'
          ctx.lineWidth = 2
          ctx.strokeRect(
            currentROI.x,
            currentROI.y,
            currentROI.width,
            currentROI.height
          )
        }
      }
    }
  }, [imageUrl, savedROIs, currentROI, selectedROI])

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        {/* File Upload Section */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            {!imageUrl ? (
              <Label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors duration-200">
                <Upload className="w-12 h-12 text-gray-400 mb-4" />
                <span className="text-lg font-medium text-gray-600">Upload Image</span>
                <span className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</span>
              </Label>
            ) : (
              <div className="flex flex-col">
                <div className="relative aspect-video w-full">
                  <Image
                    src={imageUrl}
                    alt="Uploaded image"
                    layout="fill"
                    objectFit="contain"
                    className="rounded-lg"
                  />
                  <canvas
                    ref={canvasRef}
                    width={imageDimensions.width}
                    height={imageDimensions.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`absolute top-0 left-0 w-full h-full ${
                      activeHandle ? handles[activeHandle].cursor : 'cursor-crosshair'
                    }`}
                  />
                </div>
                <Button
                  onClick={() => {
                    setImageUrl(null);
                    setSavedROIs([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  variant="destructive"
                  size="sm"
                  className="mt-4 mx-auto self-start"
                >
                  Remove Image
                </Button>
              </div>
            )}
            <Input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Regions of Interest and Export Sections */}
        {imageUrl && (
          <div className="space-y-6">
            <RegionsOfInterest savedROIs={savedROIs} setSavedROIs={setSavedROIs} selectedROI={selectedROI} setSelectedROI={setSelectedROI} />
            <ExportROI imageDimensions={imageDimensions} setSavedROIs={setSavedROIs} savedROIs={savedROIs} />
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Home


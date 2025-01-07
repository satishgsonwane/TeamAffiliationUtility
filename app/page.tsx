'use client'

import { useState, useRef, useEffect } from 'react'
import { saveAs } from 'file-saver'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export interface ROI {
  id: number
  x: number
  y: number
  width: number
  height: number
  category: string | null
  dataUrl: string | null
}

type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null

export default function ROISelector() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [savedROIs, setSavedROIs] = useState<ROI[]>([])
  const [currentROI, setCurrentROI] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedROI, setSelectedROI] = useState<number | null>(null)
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null)
  const [isResizing, setIsResizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setImageUrl(reader.result as string)
    reader.onerror = () => console.error('Error reading file')
    reader.readAsDataURL(file)
  }

  const getScaledCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const isInsideROI = (x: number, y: number, roi: ROI) => {
    return x >= roi.x && x <= roi.x + roi.width &&
           y >= roi.y && y <= roi.y + roi.height
  }

  const getResizeHandle = (x: number, y: number, roi: ROI): ResizeHandle => {
    const handleSize = 10
    const handles = {
      topLeft: { x: roi.x, y: roi.y },
      topRight: { x: roi.x + roi.width, y: roi.y },
      bottomLeft: { x: roi.x, y: roi.y + roi.height },
      bottomRight: { x: roi.x + roi.width, y: roi.y + roi.height }
    }

    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
        return handle as ResizeHandle
      }
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getScaledCoordinates(e)

    // Check if clicking on existing ROI
    const clickedROIIndex = savedROIs.findIndex(roi => isInsideROI(x, y, roi))
    
    if (clickedROIIndex !== -1) {
      const roi = savedROIs[clickedROIIndex]
      const handle = getResizeHandle(x, y, roi)
      
      if (handle) {
        setIsResizing(true)
        setActiveHandle(handle)
        setSelectedROI(roi.id)
      } else {
        setSelectedROI(roi.id)
      }
      return
    }

    // Start drawing new ROI
    setIsDrawing(true)
    setCurrentROI({ x, y, width: 0, height: 0 })
    setSelectedROI(null)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getScaledCoordinates(e)

    if (isResizing && selectedROI !== null) {
      const roi = savedROIs.find(r => r.id === selectedROI)
      if (!roi || !activeHandle) return

      const newROI = { ...roi }

      switch (activeHandle) {
        case 'topLeft':
          newROI.width += newROI.x - x
          newROI.height += newROI.y - y
          newROI.x = x
          newROI.y = y
          break
        case 'topRight':
          newROI.width = x - newROI.x
          newROI.height += newROI.y - y
          newROI.y = y
          break
        case 'bottomLeft':
          newROI.width += newROI.x - x
          newROI.height = y - newROI.y
          newROI.x = x
          break
        case 'bottomRight':
          newROI.width = x - newROI.x
          newROI.height = y - newROI.y
          break
      }

      // Update ROI with new dimensions
      setSavedROIs(prev => prev.map(r => 
        r.id === selectedROI ? { ...newROI } : r
      ))
      return
    }

    if (isDrawing && currentROI) {
      setCurrentROI(prev => prev ? {
        ...prev,
        width: x - prev.x,
        height: y - prev.y
      } : null)
    }
  }

  const handleMouseUp = () => {
    if (isResizing) {
      setIsResizing(false)
      setActiveHandle(null)
      // Update dataUrl for resized ROI
      if (selectedROI !== null) {
        updateROIDataUrl(selectedROI)
      }
      return
    }

    if (isDrawing && currentROI) {
      const { x, y, width, height } = currentROI

      const normalizedROI = {
        x: width < 0 ? x + width : x,
        y: height < 0 ? y + height : y,
        width: Math.abs(width),
        height: Math.abs(height)
      }

      captureROIImage(normalizedROI).then(dataUrl => {
        setSavedROIs(prev => [...prev, { 
          id: Date.now(), 
          ...normalizedROI, 
          category: null, 
          dataUrl 
        }])
      })
    }

    setIsDrawing(false)
    setCurrentROI(null)
  }

  const updateROIDataUrl = async (roiId: number) => {
    const roi = savedROIs.find(r => r.id === roiId)
    if (!roi) return

    const dataUrl = await captureROIImage(roi)
    setSavedROIs(prev => prev.map(r => 
      r.id === roiId ? { ...r, dataUrl } : r
    ))
  }

  const captureROIImage = async (roi: Omit<ROI, 'id' | 'category' | 'dataUrl'>) => {
    const canvas = document.createElement('canvas')
    canvas.width = roi.width
    canvas.height = roi.height
    const ctx = canvas.getContext('2d')
    
    if (ctx && imageUrl) {
      const img = new window.Image()
      img.src = imageUrl
      await new Promise(resolve => { img.onload = resolve })
      
      ctx.drawImage(
        img,
        roi.x,
        roi.y,
        roi.width,
        roi.height,
        0,
        0,
        roi.width,
        roi.height
      )
      return canvas.toDataURL()
    }
    return null
  }

  const handleCategoryChange = (roiId: number, category: string) => {
    setSavedROIs(prev => prev.map(roi => 
      roi.id === roiId ? { ...roi, category } : roi
    ))
  }

  const handleDiscard = (roiId: number) => {
    setSavedROIs(prev => prev.filter(roi => roi.id !== roiId))
    if (selectedROI === roiId) {
      setSelectedROI(null)
    }
  }

  const handleExport = () => {
    savedROIs.forEach(async (roi) => {
      const canvas = document.createElement('canvas')
      canvas.width = roi.width
      canvas.height = roi.height
      const ctx = canvas.getContext('2d')
      
      if (ctx && imageUrl) {
        const img = new window.Image()
        img.src = imageUrl
        await new Promise(resolve => { img.onload = resolve })
        
        ctx.drawImage(
          img,
          roi.x,
          roi.y,
          roi.width,
          roi.height,
          0,
          0,
          roi.width,
          roi.height
        )
        
        canvas.toBlob(blob => {
          if (blob) {
            saveAs(blob, `${roi.category || 'roi'}-${roi.id}.png`)
          }
        })
      }
    })
  }

  const drawResizeHandles = (ctx: CanvasRenderingContext2D, roi: ROI) => {
    const handleSize = 6
    const handles = [
      { x: roi.x, y: roi.y }, // topLeft
      { x: roi.x + roi.width, y: roi.y }, // topRight
      { x: roi.x, y: roi.y + roi.height }, // bottomLeft
      { x: roi.x + roi.width, y: roi.y + roi.height } // bottomRight
    ]

    ctx.fillStyle = 'white'
    ctx.strokeStyle = 'blue'
    handles.forEach(({ x, y }) => {
      ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize)
      ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize)
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
          ctx.strokeStyle = roi.id === selectedROI ? 'blue' : 'red'
          ctx.lineWidth = 2
          ctx.strokeRect(roi.x, roi.y, roi.width, roi.height)
          
          if (roi.id === selectedROI) {
            drawResizeHandles(ctx, roi)
          }
        })

        if (currentROI) {
          ctx.strokeStyle = 'blue'
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
            className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          />
        </div>
      )}
      {savedROIs.length > 0 && (
        <div className="flex flex-wrap mb-4">
          {savedROIs.map(roi => (
            <div 
              key={roi.id} 
              className={`flex flex-col items-center mr-4 mb-4 p-2 rounded-lg ${
                roi.id === selectedROI ? 'bg-blue-100' : ''
              }`}
            >
              {roi.dataUrl && (
                <Image 
                  src={roi.dataUrl} 
                  alt={`ROI ${roi.id}`} 
                  width={100}
                  height={100}
                  className="border-2 rounded"
                  style={{
                    borderColor: roi.id === selectedROI ? 'blue' : 'transparent'
                  }}
                />
              )}
              <select 
                value={roi.category || ''} 
                onChange={(e) => handleCategoryChange(roi.id, e.target.value)}
                className="mt-2 p-1 rounded border"
              >
                <option value="">Select category</option>
                <option value="TeamA_Player">TeamA Player</option>
                <option value="TeamA_Goalkeeper">TeamA Goalkeeper</option>
                <option value="TeamB_Player">TeamB Player</option>
                <option value="TeamB_Goalkeeper">TeamB Goalkeeper</option>
                <option value="Referee">Referee</option>
              </select>
              <Button 
                onClick={() => handleDiscard(roi.id)} 
                variant="destructive" 
                className="mt-2"
              >
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
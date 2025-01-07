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

type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface HandleInfo {
  x: number
  y: number
  cursor: string
}

const MIN_ROI_SIZE = 20
const HANDLE_SIZE = 16
const HANDLE_INTERACTION_SIZE = 10
const STICKY_FACTOR = 2
const CAPTURE_PADDING = 5 // New constant for ROI capture padding

export default function ROISelector() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [savedROIs, setSavedROIs] = useState<ROI[]>([])
  const [currentROI, setCurrentROI] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedROI, setSelectedROI] = useState<number | null>(null)
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [hoveringHandle, setHoveringHandle] = useState<ResizeHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handles: Record<ResizeHandle, HandleInfo> = {
    topLeft: { x: 0, y: 0, cursor: 'nw-resize' },
    topRight: { x: 0, y: 0, cursor: 'ne-resize' },
    bottomLeft: { x: 0, y: 0, cursor: 'sw-resize' },
    bottomRight: { x: 0, y: 0, cursor: 'se-resize' }
  }
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

  const isInsideROI = (x: number, y: number, roi: ROI | null) => {
    if (!roi) return false
    return x >= roi.x && x <= roi.x + roi.width &&
           y >= roi.y && y <= roi.y + roi.height
  }

  const getResizeHandle = (x: number, y: number, roi: ROI): ResizeHandle | null => {
    const handleSize = HANDLE_INTERACTION_SIZE * 2;
    
    const handles = {
      topLeft: { x: roi.x, y: roi.y },
      topRight: { x: roi.x + roi.width, y: roi.y },
      bottomLeft: { x: roi.x, y: roi.y + roi.height },
      bottomRight: { x: roi.x + roi.width, y: roi.y + roi.height }
    };

    // Increase sticky area when already interacting
    const currentSize = (hoveringHandle || isResizing) ? 
      handleSize * STICKY_FACTOR : 
      handleSize;

    // Check current handle first if we're hovering or resizing
    if (hoveringHandle || activeHandle) {
      const currentHandle = hoveringHandle || activeHandle;
      if (currentHandle) {
        const pos = handles[currentHandle];
        if (Math.abs(x - pos.x) <= currentSize && 
            Math.abs(y - pos.y) <= currentSize) {
          return currentHandle;
        }
      }
    }

    // Check other handles only if we're not already interacting
    if (!isResizing) {
      for (const [handle, pos] of Object.entries(handles)) {
        if (Math.abs(x - pos.x) <= handleSize && 
            Math.abs(y - pos.y) <= handleSize) {
          return handle as ResizeHandle;
        }
      }
    }
    
    return null;
  }

  const constrainROISize = (roi: Pick<ROI, 'x' | 'y' | 'width' | 'height'>): Pick<ROI, 'x' | 'y' | 'width' | 'height'> => {
    return {
      ...roi,
      width: Math.max(MIN_ROI_SIZE, roi.width),
      height: Math.max(MIN_ROI_SIZE, roi.height)
    }
  }

  const constrainToBounds = (
    roi: Pick<ROI, 'x' | 'y' | 'width' | 'height'>, 
    bounds: { width: number; height: number }
  ): Pick<ROI, 'x' | 'y' | 'width' | 'height'> => {
    const pad = CAPTURE_PADDING
    
    // First constrain position
    const x = Math.max(pad, Math.min(roi.x, bounds.width - roi.width - pad))
    const y = Math.max(pad, Math.min(roi.y, bounds.height - roi.height - pad))
  
    // Then constrain size based on new position
    const width = Math.max(
      MIN_ROI_SIZE,
      Math.min(roi.width, bounds.width - x - pad)
    )
    const height = Math.max(
      MIN_ROI_SIZE,
      Math.min(roi.height, bounds.height - y - pad)
    )
  
    return { x, y, width, height }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getScaledCoordinates(e);

    // Check if clicking on existing ROI
    const clickedROIIndex = savedROIs.findIndex(roi => isInsideROI(x, y, roi));
    
    if (clickedROIIndex !== -1) {
      const roi = savedROIs[clickedROIIndex];
      
      // First check for handle interaction
      const handle = getResizeHandle(x, y, roi);
      if (handle) {
        setIsResizing(true);
        setActiveHandle(handle);
        setSelectedROI(roi.id);
        setHoveringHandle(handle);
        return;
      }
      
      // If no handle, select the ROI
      setSelectedROI(roi.id);
      return;
    }

    // Start drawing new ROI
    setIsResizing(false);
    setActiveHandle(null);
    setHoveringHandle(null);
    setIsDrawing(true);
    setCurrentROI({ x, y, width: 0, height: 0 });
    setSelectedROI(null);
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getScaledCoordinates(e);
    const canvas = e.currentTarget;
    
    // Handle cursor and hover states when not actively drawing or resizing
    if (!isResizing && !isDrawing) {
      const roi = selectedROI ? savedROIs.find(r => r.id === selectedROI) : null;
      if (roi) {
        const handle = getResizeHandle(x, y, roi);
        
        // Only update hovering state if cursor shape would change
        const newCursor = handle ? handles[handle].cursor : 
                        isInsideROI(x, y, roi) ? 'move' : 'crosshair';
        
        if (canvas.style.cursor !== newCursor) {
          setHoveringHandle(handle);
          canvas.style.cursor = newCursor;
        }
      } else {
        if (canvas.style.cursor !== 'crosshair') {
          setHoveringHandle(null);
          canvas.style.cursor = 'crosshair';
        }
      }
    }
  
    // Handle resizing
    if (isResizing && selectedROI !== null) {
      const roi = savedROIs.find(r => r.id === selectedROI)
      if (!roi || !activeHandle) return
  
      const newROI = { ...roi }
      const padX = CAPTURE_PADDING
      const padY = CAPTURE_PADDING
  
      switch (activeHandle) {
        case 'topLeft':
          // Account for padding when calculating new dimensions
          newROI.width += newROI.x - x
          newROI.height += newROI.y - y
          newROI.x = Math.max(padX, x) // Ensure x doesn't go below padding
          newROI.y = Math.max(padY, y) // Ensure y doesn't go below padding
          break;
          
        case 'topRight':
          newROI.width = Math.min(x - newROI.x, imageDimensions.width - newROI.x - padX)
          newROI.height += newROI.y - y
          newROI.y = Math.max(padY, y)
          break;
          
        case 'bottomLeft':
          newROI.width += newROI.x - x
          newROI.height = Math.min(y - newROI.y, imageDimensions.height - newROI.y - padY)
          newROI.x = Math.max(padX, x)
          break;
          
        case 'bottomRight':
          newROI.width = Math.min(x - newROI.x, imageDimensions.width - newROI.x - padX)
          newROI.height = Math.min(y - newROI.y, imageDimensions.height - newROI.y - padY)
          break;
      }
  
      // Apply minimum size constraints
      if (newROI.width < MIN_ROI_SIZE) {
        if (['topLeft', 'bottomLeft'].includes(activeHandle)) {
          newROI.x = roi.x + roi.width - MIN_ROI_SIZE
        }
        newROI.width = MIN_ROI_SIZE
      }
  
      if (newROI.height < MIN_ROI_SIZE) {
        if (['topLeft', 'topRight'].includes(activeHandle)) {
          newROI.y = roi.y + roi.height - MIN_ROI_SIZE
        }
        newROI.height = MIN_ROI_SIZE
      }
  
      // Ensure ROI stays within bounds while maintaining minimum size
      const constrainedROI = constrainToBounds(
        constrainROISize(newROI),
        { 
          width: imageDimensions.width,
          height: imageDimensions.height 
        }
      )
      
      setSavedROIs(prev => prev.map(r => 
        r.id === selectedROI ? { ...r, ...constrainedROI } : r
      ))
      return
    }
  
    // Handle drawing new ROI
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
      setIsResizing(false);
      if (selectedROI !== null) {
        updateROIDataUrl(selectedROI);
      }
      return;
    }

    if (isDrawing && currentROI) {
      const { x, y, width, height } = currentROI

      const normalizedROI = {
        x: width < 0 ? x + width : x,
        y: height < 0 ? y + height : y,
        width: Math.abs(width),
        height: Math.abs(height)
      }

      const constrainedROI = constrainToBounds(
        constrainROISize(normalizedROI),
        { width: imageDimensions.width, height: imageDimensions.height }
      )

      captureROIImage(constrainedROI).then(dataUrl => {
        setSavedROIs(prev => [...prev, { 
          id: Date.now(), 
          ...constrainedROI, 
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
    // Create temporary canvas with padding for capture
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = roi.width + (CAPTURE_PADDING * 2);
    tempCanvas.height = roi.height + (CAPTURE_PADDING * 2);
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx && imageUrl) {
      const img = new window.Image();
      img.src = imageUrl;
      await new Promise(resolve => { img.onload = resolve });
      
      // Draw with padding to avoid border
      tempCtx.drawImage(
        img,
        roi.x - CAPTURE_PADDING,
        roi.y - CAPTURE_PADDING,
        roi.width + (CAPTURE_PADDING * 2),
        roi.height + (CAPTURE_PADDING * 2),
        0,
        0,
        roi.width + (CAPTURE_PADDING * 2),
        roi.height + (CAPTURE_PADDING * 2)
      );

      // Create final canvas with exact ROI size
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = roi.width;
      finalCanvas.height = roi.height;
      const finalCtx = finalCanvas.getContext('2d');

      if (finalCtx) {
        // Draw the padded image onto final canvas, cropping out the padding
        finalCtx.drawImage(
          tempCanvas,
          CAPTURE_PADDING,
          CAPTURE_PADDING,
          roi.width,
          roi.height,
          0,
          0,
          roi.width,
          roi.height
        );
        return finalCanvas.toDataURL();
      }
    }
    return null;
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
      if (roi.dataUrl) {
        const response = await fetch(roi.dataUrl)
        const blob = await response.blob()
        saveAs(blob, `${roi.category || 'roi'}-${roi.id}.png`)
      }
    })
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

    Object.entries(handles).forEach(([handle, pos]) => {
      // Draw outer circle (white with blue border)
      ctx.beginPath()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.strokeStyle = '#2196F3'
      ctx.arc(pos.x, pos.y, HANDLE_SIZE/2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      
      // Draw inner dot (blue)
      ctx.beginPath()
      ctx.fillStyle = '#2196F3'
      ctx.arc(pos.x, pos.y, HANDLE_SIZE/4, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  // Effects for image loading and canvas rendering
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
            className={`absolute top-0 left-0 w-full h-full ${
              activeHandle 
                ? handles[activeHandle].cursor 
                : 'cursor-crosshair'
            }`}
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
                    borderColor: roi.id === selectedROI ? '#2196F3' : 'transparent'
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
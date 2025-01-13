'use client'

import { useState, useRef, useEffect } from 'react'
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
  userId: string
  imageName: string
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

const generateImageName = (category: string, index: number, timestamp: string) => {
  return `${category}_${timestamp}_${index}`
}

const formatTimestamp = (date: Date): string => {
  return date.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
}

export default function ROISelector() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [currentROI, setCurrentROI] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedROI, setSelectedROI] = useState<number | null>(null)
  const [savedROIs, setSavedROIs] = useState<ROI[]>([])
  const [exportStatus, setStatus] = useState<string>('')
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

      captureROIImage({
        ...constrainedROI,
        userId: '39874461-8110-47a3-90a1-5250f4a414fc', // Replace with actual userId
        imageName: 'defaultImageName' // Replace with actual imageName
      }).then(dataUrl => {
        setSavedROIs(prev => [...prev, { 
          id: Date.now(), 
          ...constrainedROI, 
          category: null, 
          dataUrl,
          userId: '39874461-8110-47a3-90a1-5250f4a414fc', // Replace with actual userId
          imageName: 'defaultImageName' // Replace with actual imageName
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

  const handleExport = async (rois: ROI[], setStatus: (status: string) => void) => {
    setStatus('Starting export...')
    
    const categorizedROIs = rois.filter(roi => roi.category && roi.dataUrl)
    
    try {
      for (const [index, roi] of categorizedROIs.entries()) {
        const timestamp = formatTimestamp(new Date())
        const imageName = generateImageName(roi.category!, index, timestamp)
        
        console.log(`Exporting ROI `, {imageName, roi})

        // Upload image
        const response = await fetch('/api/upload-roi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: roi.dataUrl,
            category: roi.category,
            imageName
          })
        })
  
        if (!response.ok) throw new Error('Upload failed')
        
        const { url: imageUrl } = await response.json()
        
        // Update ROI with storage URL
        setSavedROIs(prevROIs => 
          prevROIs.map(prevRoi => 
            prevRoi.id === roi.id 
              ? { ...prevRoi, dataUrl: imageUrl } 
              : prevRoi
          )
        )

        const dbResponse = await fetch('/api/db-roi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(roi)
        })

        // console.log('DB response:', await dbResponse.json())

        
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header Section */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">ROI Selector</h1>
          <p className="text-gray-600 text-lg">Select and categorize regions of interest in your image</p>
        </header>

        {/* Upload Section */}
        <div className="flex justify-center">
          <label 
            htmlFor="file-upload" 
            className="cursor-pointer inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 
              text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
            </svg>
            Upload Image
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            ref={fileInputRef}
            className="hidden"
          />
        </div>

        {/* Image Container */}
        <div className="bg-white rounded-xl shadow-lg p-6 min-h-[400px] flex items-center justify-center
          border border-gray-200 transition-all duration-200">
          {imageUrl ? (
            <div className="relative w-full">
              <Image
                src={imageUrl}
                alt="Uploaded image"
                width={imageDimensions.width}
                height={imageDimensions.height}
                className="max-w-full h-auto rounded-md"
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
          ) : (
            <div className="text-gray-400 text-center">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Upload an image to begin</p>
            </div>
          )}
        </div>

        {/* ROI Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {savedROIs.map(roi => (
            <div
              key={roi.id}
              className={`
                p-3 rounded-lg border transition-all duration-200
                hover:shadow-md max-w-[160px]
                ${roi.id === selectedROI 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 bg-white'}
              `}
            >
              {roi.dataUrl && (
                <div className="overflow-hidden rounded-md mb-2">
                  <img
                    src={roi.dataUrl}
                    alt={`ROI ${roi.id}`}
                    className="w-full h-20 object-contain"
                  />
                </div>
              )}
              <select 
                value={roi.category || ''} 
                onChange={(e) => handleCategoryChange(roi.id, e.target.value)}
                className="w-full p-1.5 mb-1.5 border rounded text-xs bg-white hover:border-gray-400 
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="">Select category</option>
                <option value="team_A/player">Team A Player</option>
                <option value="team_A/goalkeeper">Team A Goalkeeper</option>
                <option value="team_B/player">Team B Player</option>
                <option value="team_B/goalkeeper">Team B Goalkeeper</option>
                <option value="referee/referee">Referee</option>
              </select>
              <Button 
                onClick={() => handleDiscard(roi.id)} 
                variant="destructive" 
                className="w-full text-xs py-1 transition-colors duration-200"
              >
                Discard
              </Button>
            </div>
          ))}
        </div>

        {/* Export Section */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button 
            onClick={() => handleExport(savedROIs, setStatus)}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded-lg 
              shadow-md hover:shadow-lg transition-all duration-200"
          >
            Export ROIs
          </Button>
          {exportStatus && (
            <span className="text-sm text-gray-600 animate-fade-in">{exportStatus}</span>
          )}
        </div>
      </div>
    </div>
  )
}


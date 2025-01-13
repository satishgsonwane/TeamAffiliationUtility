'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Upload, ImageIcon, Check, X } from 'lucide-react'
import { Layout } from '@/components/Layout'

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
const CAPTURE_PADDING = 5

const generateImageName = (category: string, index: number, timestamp: string) => {
  return `${category}_${timestamp}_${index}`
}

const formatTimestamp = (date: Date): string => {
  return date.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
}

const Home = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [currentROI, setCurrentROI] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedROI, setSelectedROI] = useState<number | null>(null)
  const [savedROIs, setSavedROIs] = useState<ROI[]>([])
  const [exportStatus, setExportStatus] = useState<string>('')
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [hoveringHandle, setHoveringHandle] = useState<ResizeHandle | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    const currentSize = (hoveringHandle || isResizing) ? 
      handleSize * STICKY_FACTOR : 
      handleSize;

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
    
    const x = Math.max(pad, Math.min(roi.x, bounds.width - roi.width - pad))
    const y = Math.max(pad, Math.min(roi.y, bounds.height - roi.height - pad))
  
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

    const clickedROIIndex = savedROIs.findIndex(roi => isInsideROI(x, y, roi));
    
    if (clickedROIIndex !== -1) {
      const roi = savedROIs[clickedROIIndex];
      
      const handle = getResizeHandle(x, y, roi);
      if (handle) {
        setIsResizing(true);
        setActiveHandle(handle);
        setSelectedROI(roi.id);
        setHoveringHandle(handle);
        return;
      }
      
      setSelectedROI(roi.id);
      return;
    }

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
    
    if (!isResizing && !isDrawing) {
      const roi = selectedROI ? savedROIs.find(r => r.id === selectedROI) : null;
      if (roi) {
        const handle = getResizeHandle(x, y, roi);
        
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
  
    if (isResizing && selectedROI !== null) {
      const roi = savedROIs.find(r => r.id === selectedROI)
      if (!roi || !activeHandle) return
  
      const newROI = { ...roi }
      const padX = CAPTURE_PADDING
      const padY = CAPTURE_PADDING
  
      switch (activeHandle) {
        case 'topLeft':
          newROI.width += newROI.x - x
          newROI.height += newROI.y - y
          newROI.x = Math.max(padX, x)
          newROI.y = Math.max(padY, y)
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
        userId: '39874461-8110-47a3-90a1-5250f4a414fc',
        imageName: 'defaultImageName'
      }).then(dataUrl => {
        setSavedROIs(prev => [...prev, { 
          id: Date.now(), 
          ...constrainedROI, 
          category: null, 
          dataUrl,
          userId: '39874461-8110-47a3-90a1-5250f4a414fc',
          imageName: 'defaultImageName'
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
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = roi.width + (CAPTURE_PADDING * 2);
    tempCanvas.height = roi.height + (CAPTURE_PADDING * 2);
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx && imageUrl) {
      const img = new window.Image();
      img.src = imageUrl;
      await new Promise(resolve => { img.onload = resolve });
      
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

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = roi.width;
      finalCanvas.height = roi.height;
      const finalCtx = finalCanvas.getContext('2d');

      if (finalCtx) {
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
                <span className="text-sm font-medium text-gray-600">Upload Image</span>
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
                  variant="outline"
                  size="sm"
                  className="mt-4 self-start"
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
            {/* Regions of Interest */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Regions of Interest</h2>
                <ScrollArea className="h-[25vh]">
                  <div className="grid grid-cols-2 gap-2">
                    {savedROIs.map(roi => (
                      <Card
                        key={roi.id}
                        className={`overflow-hidden transition-all duration-200 ${
                          roi.id === selectedROI ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <CardContent className="p-2 space-y-1">
                          {typeof roi.dataUrl === 'string' && roi.dataUrl && (
                            <div className="aspect-square relative overflow-hidden rounded-sm h-16">
                              <Image
                                src={roi.dataUrl}
                                alt={`ROI ${roi.id}`}
                                layout="fill"
                                objectFit="cover"
                              />
                            </div>
                          )}
                          <Select
                            value={roi.category || ''}
                            onValueChange={(value) => handleCategoryChange(roi.id, value)}
                            // size="sm"
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="team_A/player">Team A Player</SelectItem>
                              <SelectItem value="team_A/goalkeeper">Team A Goalkeeper</SelectItem>
                              <SelectItem value="team_B/player">Team B Player</SelectItem>
                              <SelectItem value="team_B/goalkeeper">Team B Goalkeeper</SelectItem>
                              <SelectItem value="referee/referee">Referee</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            onClick={() => handleDiscard(roi.id)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Discard
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Export ROIs */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Export ROIs</h2>
                <Button 
                  onClick={() => handleExport(savedROIs, setExportStatus)}
                  className="w-full"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Export ROIs
                </Button>
                {exportStatus && (
                  <p className="text-sm text-gray-600 animate-fade-in">{exportStatus}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Home


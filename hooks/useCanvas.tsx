import { HandleInfo, ResizeHandle, ROI } from "@/types/roi"
import { useState } from "react"

interface UseCanvasProps {
  imageUrl: string | null
  imageDimensions: { width: number, height: number }
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

const MIN_ROI_SIZE = 20
const HANDLE_SIZE = 16
const HANDLE_INTERACTION_SIZE = 10
const STICKY_FACTOR = 2
const CAPTURE_PADDING = 5

export const handles: Record<ResizeHandle, HandleInfo> = {
  topLeft: { x: 0, y: 0, cursor: 'nw-resize' },
  topRight: { x: 0, y: 0, cursor: 'ne-resize' },
  bottomLeft: { x: 0, y: 0, cursor: 'sw-resize' },
  bottomRight: { x: 0, y: 0, cursor: 'se-resize' }
}

export const useCanvas = ({
  imageUrl,
  imageDimensions,
  canvasRef,
}: UseCanvasProps) => {

  const [currentROI, setCurrentROI] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedROI, setSelectedROI] = useState<number | null>(null)
  const [savedROIs, setSavedROIs] = useState<ROI[]>([])
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [hoveringHandle, setHoveringHandle] = useState<ResizeHandle | null>(null)


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

  const getScaledCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef && canvasRef.current
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

  const updateROIDataUrl = async (roiId: number) => {
    const roi = savedROIs.find(r => r.id === roiId)
    if (!roi) return

    const dataUrl = await captureROIImage(roi)
    setSavedROIs(prev => prev.map(r =>
      r.id === roiId ? { ...r, dataUrl } : r
    ))
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

  return {
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
  }
}

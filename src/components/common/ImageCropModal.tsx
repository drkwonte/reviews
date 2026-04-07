import { useState, useRef, useEffect } from 'react'
import ReactCrop, { type Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Check, X, RotateCcw } from 'lucide-react'

interface ImageCropModalProps {
  image: string
  isOpen: boolean
  onClose: () => void
  onCropComplete: (croppedImage: Blob) => void
}

function onImageLoad() {
  const initialCrop: Crop = {
    unit: '%',
    x: 5,
    y: 5,
    width: 90,
    height: 90
  }
  return initialCrop
}

export function ImageCropModal({ image, isOpen, onClose, onCropComplete }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [rotation, setRotation] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (isOpen) {
      setCrop(undefined)
      setCompletedCrop(undefined)
      setRotation(0)
    }
  }, [isOpen])

  const getCroppedImg = async (
    image: HTMLImageElement,
    pixelCrop: PixelCrop
  ): Promise<Blob | null> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    const width = Math.floor(pixelCrop.width * scaleX)
    const height = Math.floor(pixelCrop.height * scaleY)

    canvas.width = width
    canvas.height = height

    ctx.imageSmoothingQuality = 'high'

    ctx.save()
    
    // Draw only the selected portion of the original image
    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      width,
      height
    )

    ctx.restore()

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/webp', 0.95)
    })
  }

  const handleDone = async () => {
    if (!imgRef.current || !completedCrop) return

    try {
      const blob = await getCroppedImg(imgRef.current, completedCrop)
      if (blob) {
        onCropComplete(blob)
        onClose()
      }
    } catch (e) {
      console.error('Error cropping image:', e)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl sm:rounded-[2.5rem] border-border bg-card shadow-2xl">
        <DialogHeader className="p-6 border-b border-border flex-none bg-card/80 backdrop-blur-md z-10">
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <span>영역 선택하기 <span className="text-xs font-normal text-muted-foreground ml-2">(원하는 영역의 모서리를 드래그하세요)</span></span>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 relative bg-slate-900/10 overflow-auto flex items-center justify-center p-4 sm:p-8 custom-scrollbar">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={undefined}
            className="max-w-full"
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={image}
              style={{ transform: `rotate(${rotation}deg)`, maxHeight: '70vh' }}
              onLoad={() => setCrop(onImageLoad())}
              className="block max-w-full rounded-lg shadow-lg"
            />
          </ReactCrop>
        </div>

        <DialogFooter className="flex flex-row gap-3 p-6 bg-card border-t border-border flex-none">
          <Button variant="ghost" onClick={onClose} className="flex-1 h-12 font-bold rounded-2xl text-muted-foreground hover:bg-muted">
            <X className="mr-2 h-4 w-4" /> 취소
          </Button>
          <Button 
            onClick={handleDone} 
            disabled={!completedCrop}
            className="flex-1 h-12 font-bold rounded-2xl bg-foreground text-background hover:opacity-90 disabled:opacity-30"
          >
            <Check className="mr-2 h-4 w-4" /> 선택 영역 확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

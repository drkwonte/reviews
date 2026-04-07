import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Check, X, RotateCcw } from 'lucide-react'

interface ImageCropModalProps {
  image: string
  isOpen: boolean
  onClose: () => void
  onCropComplete: (croppedImage: Blob) => void
}

export function ImageCropModal({ image, isOpen, onClose, onCropComplete }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop)
  }

  const onZoomChange = (zoom: number) => {
    setZoom(zoom)
  }

  const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.setAttribute('crossOrigin', 'anonymous')
      image.src = url
    })

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any,
    rotation = 0
  ): Promise<Blob | null> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    const rotRad = (rotation * Math.PI) / 180
    const { width: bWidth, height: bHeight } = {
      width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
      height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
    }

    canvas.width = bWidth
    canvas.height = bHeight

    ctx.translate(bWidth / 2, bHeight / 2)
    ctx.rotate(rotRad)
    ctx.translate(-image.width / 2, -image.height / 2)
    ctx.drawImage(image, 0, 0)

    const data = ctx.getImageData(
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height
    )

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.putImageData(data, 0, 0)

    return new Promise((resolve) => {
      canvas.toBlob((file) => {
        resolve(file)
      }, 'image/webp')
    })
  }

  const handleDone = async () => {
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation)
      if (croppedImage) {
        onCropComplete(croppedImage)
        onClose()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl sm:rounded-[2rem] border-border bg-card">
        <DialogHeader className="p-6 border-b border-border flex-none">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            이미지 자르기 <span className="text-xs font-normal text-muted-foreground">(필요한 부분만 선택하세요)</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 relative bg-black/5">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={undefined}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            objectFit="contain"
          />
        </div>

        <div className="flex-none p-6 space-y-6 bg-card border-t border-border">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest w-12">확대</span>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(vals: number[]) => setZoom(vals[0])}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest w-12">회전</span>
              <Slider
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={(vals: number[]) => setRotation(vals[0])}
                className="flex-1"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setRotation(0)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1 h-12 font-bold rounded-xl text-muted-foreground">
              <X className="mr-2 h-4 w-4" /> 취소
            </Button>
            <Button onClick={handleDone} className="flex-1 h-12 font-bold rounded-xl bg-foreground text-background hover:opacity-90">
              <Check className="mr-2 h-4 w-4" /> 자르기 완료
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

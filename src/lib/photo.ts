import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

const MAX_WIDTH = 480
const JPEG_QUALITY = 0.7

export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load image'))
      img.onload = () => {
        const scale = Math.min(1, MAX_WIDTH / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not supported'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export interface CapturePhotoOptions {
  // 'camera' locks to the live camera only — used for the tricycle+driver
  // safety photo, where letting someone pick an old gallery photo would
  // defeat the point. 'prompt' lets the user choose Camera or Photo Library
  // — used for documents (NBI clearance, license, prescriptions), which are
  // just as often an existing photo/scan as a fresh one.
  source?: 'camera' | 'prompt'
}

// Native-app photo capture via Capacitor's Camera plugin — gives a real
// native camera/gallery picker and proper OS permission prompts instead of
// the browser's file-picker chrome, when this is actually running inside
// the wrapped native app (see PhotoCaptureButton/DocumentUploadField/
// MultiImageUploadField, which all try this first and fall back to their
// existing <input type="file" capture> on the web). `width`/`quality` here
// match compressImageFile's own resize target, so a native capture and a
// web upload end up the same rough size in localStorage either way.
// Returns null (never throws) when not running natively, or when the user
// cancels the picker/denies permission — both are "nothing captured," not
// error states the caller needs to handle differently.
export async function captureNativePhoto(options: CapturePhotoOptions = {}): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: options.source === 'camera' ? CameraSource.Camera : CameraSource.Prompt,
      quality: Math.round(JPEG_QUALITY * 100),
      width: MAX_WIDTH,
      correctOrientation: true,
    })
    return photo.dataUrl ?? null
  } catch {
    return null
  }
}

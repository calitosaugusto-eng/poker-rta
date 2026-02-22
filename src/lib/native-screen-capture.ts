'use client';

import { useState, useCallback, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';

// Definir interface do plugin
export interface ScreenCapturePlugin {
  startCapture(): Promise<{ success: boolean; message: string }>;
  captureFrame(): Promise<{ success: boolean; imageData?: string; message?: string; width?: number; height?: number }>;
  stopCapture(): Promise<{ success: boolean; message: string }>;
  isCapturing(): Promise<{ isCapturing: boolean }>;
}

// Registrar plugin nativo
const ScreenCapture = registerPlugin<ScreenCapturePlugin>('ScreenCapture');

// Detectar se está rodando como app nativo
function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as any).Capacitor;
  return capacitor?.isNativePlatform?.() ?? false;
}

export interface UseScreenCaptureResult {
  isSupported: boolean;
  isNative: boolean;
  supportReason: string;
  isCapturing: boolean;
  error: string | null;
  startCapture: () => Promise<boolean>;
  captureFrame: () => Promise<string | null>;
  stopCapture: () => Promise<void>;
}

export function useScreenCapture(): UseScreenCaptureResult {
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const native = isNativeApp();
    if (native) return true;
    return !!window.navigator?.mediaDevices?.getDisplayMedia;
  });
  const [isNative, setIsNative] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isNativeApp();
  });
  const [supportReason, setSupportReason] = useState(() => {
    if (typeof window === 'undefined') return 'Renderização no servidor';
    const native = isNativeApp();
    if (native) return 'Plugin nativo Android';
    if (window.navigator?.mediaDevices?.getDisplayMedia) return 'Web Screen Capture API';
    return 'getDisplayMedia não suportado - use Chrome/Edge Desktop ou App Android';
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startCapture = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (isNative) {
      // Usar plugin nativo
      try {
        const result = await ScreenCapture.startCapture();
        if (result.success) {
          setIsCapturing(true);
          return true;
        } else {
          setError(result.message || 'Falha ao iniciar captura');
          return false;
        }
      } catch (e: any) {
        setError(`Erro: ${e.message}`);
        return false;
      }
    } else {
      // Usar API web
      try {
        const getDisplayMedia = window.navigator.mediaDevices.getDisplayMedia.bind(
          window.navigator.mediaDevices
        );

        const stream = await getDisplayMedia({
          video: { displaySurface: 'monitor' } as any,
          audio: false
        });

        streamRef.current = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        videoRef.current = video;
        canvasRef.current = document.createElement('canvas');

        setIsCapturing(true);

        stream.getVideoTracks()[0].onended = () => {
          setIsCapturing(false);
        };

        return true;
      } catch (e: any) {
        setError(`Erro: ${e.message}`);
        return false;
      }
    }
  }, [isNative]);

  const captureFrame = useCallback(async (): Promise<string | null> => {
    setError(null);

    if (isNative) {
      // Usar plugin nativo
      try {
        const result = await ScreenCapture.captureFrame();
        if (result.success && result.imageData) {
          return result.imageData;
        } else {
          setError(result.message || 'Falha ao capturar frame');
          return null;
        }
      } catch (e: any) {
        setError(`Erro: ${e.message}`);
        return null;
      }
    } else {
      // Usar API web
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) {
        setError('Captura não iniciada');
        return null;
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setError('Vídeo não está pronto');
        return null;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Erro ao criar canvas');
        return null;
      }

      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
  }, [isNative]);

  const stopCapture = useCallback(async (): Promise<void> => {
    if (isNative) {
      try {
        await ScreenCapture.stopCapture();
      } catch (e) {
        console.error('Error stopping capture:', e);
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current = null;
      }
      canvasRef.current = null;
    }

    setIsCapturing(false);
  }, [isNative]);

  return {
    isSupported,
    isNative,
    supportReason,
    isCapturing,
    error,
    startCapture,
    captureFrame,
    stopCapture,
  };
}

// Exportar para uso direto se necessário
export { ScreenCapture };

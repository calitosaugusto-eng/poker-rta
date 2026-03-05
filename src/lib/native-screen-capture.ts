'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
function checkIsNative(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as any).Capacitor;
  const result = capacitor?.isNativePlatform?.() ?? false;
  console.log('[ScreenCapture] isNative check:', result, 'Capacitor:', !!capacitor);
  return result;
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
  const [isNative, setIsNative] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [supportReason, setSupportReason] = useState('Verificando...');
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Detectar ambiente nativo após mount
  useEffect(() => {
    // Pequeno delay para garantir que Capacitor está pronto
    const timer = setTimeout(() => {
      const native = checkIsNative();
      setIsNative(native);
      
      if (native) {
        setIsSupported(true);
        setSupportReason('Plugin nativo Android');
        console.log('[ScreenCapture] Ambiente nativo detectado!');
      } else {
        const hasWebSupport = !!window.navigator?.mediaDevices?.getDisplayMedia;
        setIsSupported(hasWebSupport);
        setSupportReason(
          hasWebSupport 
            ? 'Web Screen Capture API' 
            : 'getDisplayMedia não suportado - use Chrome/Edge Desktop ou App Android'
        );
        console.log('[ScreenCapture] Ambiente web. hasWebSupport:', hasWebSupport);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const startCapture = useCallback(async (): Promise<boolean> => {
    setError(null);
    console.log('[ScreenCapture] startCapture called. isNative:', isNative);

    if (isNative) {
      // Usar plugin nativo
      try {
        console.log('[ScreenCapture] Chamando plugin nativo startCapture...');
        const result = await ScreenCapture.startCapture();
        console.log('[ScreenCapture] Resultado startCapture:', result);
        
        if (result.success) {
          setIsCapturing(true);
          return true;
        } else {
          setError(result.message || 'Falha ao iniciar captura');
          return false;
        }
      } catch (e: any) {
        console.error('[ScreenCapture] Erro no plugin nativo:', e);
        setError(`Erro: ${e.message}`);
        return false;
      }
    } else {
      // Usar API web
      try {
        console.log('[ScreenCapture] Usando API web getDisplayMedia...');
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

        if (videoRef.current == null) {
          videoRef.current = video;
        }
        if (canvasRef.current == null) {
          canvasRef.current = document.createElement('canvas');
        }

        setIsCapturing(true);

        stream.getVideoTracks()[0].onended = () => {
          setIsCapturing(false);
        };

        return true;
      } catch (e: any) {
        console.error('[ScreenCapture] Erro na API web:', e);
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
        console.log('[ScreenCapture] Capturando frame nativo...');
        const result = await ScreenCapture.captureFrame();
        
        if (result.success && result.imageData) {
          console.log('[ScreenCapture] Frame capturado, tamanho:', result.imageData.length);
          return result.imageData;
        } else {
          console.log('[ScreenCapture] Falha ao capturar:', result.message);
          setError(result.message || 'Falha ao capturar frame');
          return null;
        }
      } catch (e: any) {
        console.error('[ScreenCapture] Erro ao capturar frame:', e);
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
    console.log('[ScreenCapture] Parando captura...');
    
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

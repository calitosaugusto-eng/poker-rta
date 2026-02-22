'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ScreenCaptureProps {
  onCapture: (imageData: string) => void;
}

export default function ScreenCapture({ onCapture }: ScreenCaptureProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const startCapture = async () => {
    setError(null);
    
    try {
      // @ts-ignore - TypeScript não reconhece getDisplayMedia corretamente
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: false 
      });
      
      // Guardar stream no window para acessar depois
      (window as any).captureStream = stream;
      setIsStreaming(true);
      
      stream.getVideoTracks()[0].onended = () => {
        setIsStreaming(false);
        (window as any).captureStream = null;
      };
      
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  const captureFrame = async () => {
    const stream = (window as any).captureStream as MediaStream;
    if (!stream) {
      setError('Stream não encontrado');
      return;
    }
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    
    await video.play();
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/png');
      onCapture(imageData);
    }
    
    video.pause();
    video.srcObject = null;
  };
  
  const stopCapture = () => {
    const stream = (window as any).captureStream as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      (window as any).captureStream = null;
    }
    setIsStreaming(false);
  };
  
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-4">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}
      
      <div className="flex gap-3">
        {!isStreaming ? (
          <Button 
            onClick={startCapture} 
            className="bg-blue-600 hover:bg-blue-500 text-lg py-6 px-8 font-bold rounded-xl"
          >
            📷 Capturar Tela
          </Button>
        ) : (
          <>
            <Button 
              onClick={captureFrame} 
              className="bg-green-600 hover:bg-green-500 text-lg py-6 px-8 font-bold rounded-xl"
            >
              🎯 Analisar Frame
            </Button>
            <Button 
              onClick={stopCapture} 
              variant="destructive" 
              className="text-lg py-6 px-8 font-bold rounded-xl"
            >
              Parar
            </Button>
          </>
        )}
      </div>
      
      {isStreaming && (
        <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-4">
          <p className="text-green-300">✅ Captura ativa! Clique em "Analisar Frame" para detectar as cartas.</p>
        </div>
      )}
    </div>
  );
}

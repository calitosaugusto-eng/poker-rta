'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface ScreenCaptureProps {
  onCapture: (imageData: string) => void;
}

// Helper para verificar suporte a Screen Capture API
function checkScreenCaptureSupport(): { supported: boolean; reason: string } {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Renderização no servidor' };
  }
  
  if (!window.navigator) {
    return { supported: false, reason: 'Navigator não disponível' };
  }
  
  if (!window.navigator.mediaDevices) {
    return { supported: false, reason: 'mediaDevices não disponível - use HTTPS' };
  }
  
  if (typeof window.navigator.mediaDevices.getDisplayMedia !== 'function') {
    return { supported: false, reason: 'getDisplayMedia não suportado neste navegador' };
  }
  
  return { supported: true, reason: '' };
}

export default function ScreenCapture({ onCapture }: ScreenCaptureProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [supportReason, setSupportReason] = useState('');
  
  // Verificar suporte ao montar o componente
  useEffect(() => {
    const { supported, reason } = checkScreenCaptureSupport();
    setIsSupported(supported);
    setSupportReason(reason);
    
    if (!supported) {
      console.log('Screen Capture API:', reason);
    }
  }, []);
  
  const startCapture = useCallback(async () => {
    setError(null);
    
    // Verificação dupla antes de tentar
    const { supported, reason } = checkScreenCaptureSupport();
    if (!supported) {
      setError(`Não suportado: ${reason}. Use Chrome/Edge em HTTPS.`);
      return;
    }
    
    try {
      // Chamar a API com o contexto correto
      const getDisplayMedia = window.navigator.mediaDevices.getDisplayMedia.bind(
        window.navigator.mediaDevices
      );
      
      const stream = await getDisplayMedia({ 
        video: { displaySurface: 'monitor' } as any, 
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
      console.error('Screen capture error:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Permissão negada. Permita o compartilhamento de tela.');
      } else if (err.name === 'NotSupportedError') {
        setError('Screen capture não suportado neste navegador.');
      } else if (err.name === 'AbortError') {
        setError('Captura cancelada pelo usuário.');
      } else {
        setError(`Erro: ${err.message || 'Desconhecido'}`);
      }
    }
  }, []);
  
  const captureFrame = useCallback(async () => {
    const stream = (window as any).captureStream as MediaStream;
    if (!stream) {
      setError('Stream não encontrado. Inicie a captura primeiro.');
      return;
    }
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    
    try {
      await video.play();
      
      // Aguardar um pouco para o vídeo estar pronto
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setError('Vídeo não está pronto. Tente novamente.');
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(imageData);
      }
    } catch (err: any) {
      setError(`Erro ao capturar frame: ${err.message}`);
    } finally {
      video.pause();
      video.srcObject = null;
    }
  }, [onCapture]);
  
  const stopCapture = useCallback(() => {
    const stream = (window as any).captureStream as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      (window as any).captureStream = null;
    }
    setIsStreaming(false);
  }, []);
  
  return (
    <div className="space-y-4">
      {/* Aviso de suporte */}
      {!isSupported && (
        <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-xl p-4">
          <p className="text-yellow-300">
            ⚠️ Screen Capture não disponível: {supportReason}
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            Use Chrome, Edge ou Firefox com HTTPS.
          </p>
        </div>
      )}
      
      {/* Erros */}
      {error && (
        <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-4">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}
      
      <div className="flex gap-3 flex-wrap">
        {!isStreaming ? (
          <Button 
            onClick={startCapture} 
            disabled={!isSupported}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg py-6 px-8 font-bold rounded-xl"
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

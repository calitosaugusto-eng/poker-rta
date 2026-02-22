'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useScreenCapture } from '@/lib/native-screen-capture';
import { apiFetch } from '@/lib/api-config';

interface UniversalScreenCaptureProps {
  onCapture: (imageData: string) => void;
}

export default function UniversalScreenCapture({ onCapture }: UniversalScreenCaptureProps) {
  const {
    isSupported,
    isNative,
    supportReason,
    isCapturing,
    error: captureError,
    startCapture,
    captureFrame,
    stopCapture,
  } = useScreenCapture();

  const [localError, setLocalError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const error = localError || captureError;

  const handleStartCapture = useCallback(async () => {
    setLocalError(null);
    const success = await startCapture();
    if (!success) {
      // Error já foi definido no hook
    }
  }, [startCapture]);

  const handleCaptureFrame = useCallback(async () => {
    setLocalError(null);
    setIsAnalyzing(true);

    try {
      const imageData = await captureFrame();

      if (imageData) {
        // Enviar para análise usando a API configurada
        const response = await apiFetch<{ success: boolean; gameState?: any; message?: string }>(
          '/api/detect',
          {
            method: 'POST',
            body: JSON.stringify({ imageData }),
          }
        );

        if (response.success && response.gameState?.heroCards?.length >= 2) {
          onCapture(imageData);
        } else {
          setLocalError(response.message || 'Não foi possível detectar as cartas');
        }
      }
    } catch (e: any) {
      setLocalError(`Erro na análise: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [captureFrame, onCapture]);

  const handleStopCapture = useCallback(async () => {
    await stopCapture();
  }, [stopCapture]);

  return (
    <div className="space-y-4">
      {/* Indicador de ambiente */}
      <div className="flex items-center gap-2 text-sm">
        <span className={`w-3 h-3 rounded-full ${isNative ? 'bg-green-500' : 'bg-blue-500'}`} />
        <span className="text-gray-400">
          {isNative ? 'App Nativo Android' : 'Web App'} • {supportReason}
        </span>
      </div>

      {/* Aviso de suporte */}
      {!isSupported && (
        <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-xl p-4">
          <p className="text-yellow-300">
            ⚠️ Screen Capture não disponível: {supportReason}
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            {isNative
              ? 'O plugin nativo não foi carregado corretamente.'
              : 'Use Chrome/Edge Desktop ou instale o app Android.'}
          </p>
        </div>
      )}

      {/* Erros */}
      {error && (
        <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-4">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 flex-wrap">
        {!isCapturing ? (
          <Button
            onClick={handleStartCapture}
            disabled={!isSupported}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg py-6 px-8 font-bold rounded-xl"
          >
            📷 {isNative ? 'Capturar Tela' : 'Capturar Tela'}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleCaptureFrame}
              disabled={isAnalyzing}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-lg py-6 px-8 font-bold rounded-xl"
            >
              {isAnalyzing ? '🔄 Analisando...' : '🎯 Analisar Frame'}
            </Button>
            <Button
              onClick={handleStopCapture}
              variant="destructive"
              className="text-lg py-6 px-8 font-bold rounded-xl"
            >
              Parar
            </Button>
          </>
        )}
      </div>

      {/* Status de captura */}
      {isCapturing && !isAnalyzing && (
        <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-4">
          <p className="text-green-300">
            ✅ Captura ativa! {isNative ? 'Clique em "Analisar Frame"' : 'Selecione uma janela e clique em "Analisar Frame"'}
          </p>
        </div>
      )}

      {/* Analisando */}
      {isAnalyzing && (
        <div className="bg-blue-900/30 border-2 border-blue-600 rounded-xl p-4">
          <p className="text-blue-300">
            🔄 Analisando imagem e detectando cartas...
          </p>
        </div>
      )}
    </div>
  );
}

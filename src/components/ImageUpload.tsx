'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  onCapture: (imageData: string) => void;
}

export default function ImageUpload({ onCapture }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setPreview(imageData);
    };
    reader.readAsDataURL(file);
  }, []);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const analyzeImage = useCallback(() => {
    if (preview) {
      onCapture(preview);
    }
  }, [preview, onCapture]);
  
  const clearImage = useCallback(() => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);
  
  return (
    <div className="space-y-4">
      {/* Área de upload */}
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-4 border-dashed rounded-2xl p-8 text-center cursor-pointer
            transition-all duration-200 min-h-[200px] flex flex-col items-center justify-center
            ${isDragging 
              ? 'border-blue-500 bg-blue-900/30' 
              : 'border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50'
            }
          `}
        >
          <span className="text-6xl mb-4">📸</span>
          <p className="text-xl font-bold text-white mb-2">
            Toque para selecionar imagem
          </p>
          <p className="text-base text-gray-400">
            ou arraste uma imagem aqui
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Tire um print da tela do poker e faça upload
          </p>
        </div>
      ) : (
        /* Preview da imagem */
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border-2 border-gray-600">
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full max-h-[400px] object-contain bg-black"
            />
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={analyzeImage}
              className="flex-1 bg-green-600 hover:bg-green-500 text-lg py-6 font-bold rounded-xl"
            >
              🎯 Analisar Imagem
            </Button>
            <Button 
              onClick={clearImage}
              variant="destructive"
              className="text-lg py-6 px-6 font-bold rounded-xl"
            >
              🗑️
            </Button>
          </div>
        </div>
      )}
      
      {/* Input escondido */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Dicas */}
      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <p className="text-sm text-gray-400">
          <strong className="text-white">💡 Dica:</strong> No Android, tire um print 
          (botão de energia + volume baixo) e depois faça upload da imagem.
        </p>
      </div>
    </div>
  );
}

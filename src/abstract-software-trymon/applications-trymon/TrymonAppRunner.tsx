import React, { useEffect, useState } from 'react';
import { TrymonPackager } from '../../interface/services/trymonEngine/packager';
import { TrymonRuntime, RuntimeContext } from '../../interface/services/trymonEngine/runtime';
import * as kernel from '../../interface/services/kernelService';

interface TrymonAppRunnerProps {
  filePath: string;
  onTitleChange?: (title: string) => void;
  onCloseWindow?: () => void;
}

export const TrymonAppRunner: React.FC<TrymonAppRunnerProps> = ({ 
  filePath, 
  onTitleChange 
}) => {
  // pkg state removed since it's only used inside useEffect
  const [runtimeCtx, setRuntimeCtx] = useState<RuntimeContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const fileBuffer = kernel.readFile(filePath);
      if (!fileBuffer) {
        throw new Error(`File not found: ${filePath}`);
      }

      // 1. Unpack
      const unzippedPkg = TrymonPackager.unpack(fileBuffer.buffer as ArrayBuffer);

      if (onTitleChange) {
        onTitleChange(unzippedPkg.manifest.name || (filePath.split('/').pop() || 'Unknown'));
      }

      // 2. Setup Runtime (JS Sandbox)
      const runtime = new TrymonRuntime(unzippedPkg.mainScript, (ctx) => {
        setRuntimeCtx({ ...ctx });
        if (onTitleChange && ctx.appName) {
          onTitleChange(ctx.appName);
        }
      });

      // Execute Initial State
      runtime.run();

    } catch (err: any) {
      setError(err.message || 'Failed to execute .trymon file');
    }
  }, [filePath, onTitleChange]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center bg-gray-900 text-white">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-400 mb-2">Trymon Engine Error</h2>
        <p className="text-gray-300 font-mono text-sm p-4 bg-black rounded-lg">{error}</p>
      </div>
    );
  }

  if (!runtimeCtx) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="animate-pulse">Loading Trymon App...</div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full overflow-auto text-white flex flex-col p-4"
      style={{ backgroundColor: '#1e1e2e' }}
    >
      <div className="flex flex-col space-y-4">
        {runtimeCtx.elements.map(el => {
          if (el.type === 'TEXT') {
            return (
              <p key={el.id} className="text-lg font-sans">
                {el.content}
              </p>
            );
          }
          if (el.type === 'BUTTON') {
            return (
              <button 
                key={el.id}
                onClick={el.onClick}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white shadow transition-colors w-fit"
              >
                {el.content}
              </button>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { transform } from 'sucrase';
import { zipSync, strToU8 } from 'fflate';
import * as kernel from '../../interface/services/kernelService';
import { Package, FileCode, Code, Settings } from 'lucide-react';

interface IdeAppProps {
  onTitleChange?: (title: string) => void;
  onCloseWindow?: () => void;
}

const DEFAULT_TS_CODE = `// Bem-vindo ao Trymon IDE!
// Use a API nativa Trymon.UI para montar a tela do seu App.

Trymon.UI.setWindowTitle("Meu App TypeScript");

Trymon.UI.addText("title", "Bem-vindo ao Trymon OS 2.0!");

Trymon.UI.addButton("btn1", "Me clique!", () => {
  Trymon.UI.setText("title", "Você clicou no botão com sucesso!");
  Trymon.OS.notify("Sucesso!");
});
`;

export const IdeApp: React.FC<IdeAppProps> = ({ onTitleChange }) => {
  const [code, setCode] = useState(DEFAULT_TS_CODE);
  const [appName, setAppName] = useState('Meu App');
  const [isBuilding, setIsBuilding] = useState(false);

  // Trigger title change on mount
  React.useEffect(() => {
    if (onTitleChange) {
      onTitleChange(`Trymon Studio - ${appName}`);
    }
  }, [appName, onTitleChange]);

  const handleExport = () => {
    setIsBuilding(true);
    setTimeout(() => {
      try {
        // 1. Compile TS to JS using Sucrase
        const compiled = transform(code, { transforms: ['typescript'] }).code;
        
        // 2. Create Manifest
        const manifest = {
          name: appName,
          version: '1.0.0',
          entrypoint: 'main.js'
        };

        // 3. Zip with fflate
        const zipData = {
          'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
          'main.js': strToU8(compiled)
        };

        const zippedBuffer = zipSync(zipData);
        
        // 4. Save to Trymon OS Desktop
        const safeName = appName.trim().replace(/\s+/g, '_') || 'app';
        const desktopPath = `/home/trymon/Desktop/${safeName}.trymon`;
        
        kernel.createFile(desktopPath); // Create node
        kernel.writeBinaryFile(desktopPath, zippedBuffer); // Write data
        kernel.saveVFSState(); // Persist

        window.alert(`App ${appName} exportado para o Desktop!`);
      } catch (err: any) {
        console.error(err);
        window.alert(`Erro ao compilar: ${err.message}`);
      } finally {
        setIsBuilding(false);
      }
    }, 100); // Small timeout to allow UI update for isBuilding state
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e] text-white font-sans">
      {/* Toolbar */}
      <div className="h-12 border-b border-gray-700 bg-[#252526] flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-2">
          <Code size={18} className="text-blue-400" />
          <span className="font-semibold text-sm">Trymon Studio</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Nome do App:</span>
            <input 
              type="text" 
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="bg-[#3c3c3c] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 w-32"
            />
          </div>
          <button 
            onClick={handleExport}
            disabled={isBuilding}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm transition-colors shadow"
          >
            {isBuilding ? (
              <Settings size={16} className="animate-spin" />
            ) : (
              <Package size={16} />
            )}
            {isBuilding ? 'Compilando...' : 'Build (.trymon)'}
          </button>
        </div>
      </div>

      {/* Editor Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 border-r border-gray-700 bg-[#252526] flex flex-col hidden md:flex">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Projeto
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[#37373d] cursor-pointer border-l-2 border-blue-500 text-sm">
            <FileCode size={14} className="text-blue-400" />
            <span>main.ts</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 text-gray-400 hover:text-gray-300 hover:bg-[#2a2d2e] cursor-pointer text-sm">
            <FileCode size={14} className="text-yellow-400" />
            <span>manifest.json</span>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 relative">
          <Editor
            height="100%"
            defaultLanguage="typescript"
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: '"Fira Code", monospace',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              smoothScrolling: true,
            }}
          />
        </div>
      </div>
    </div>
  );
};

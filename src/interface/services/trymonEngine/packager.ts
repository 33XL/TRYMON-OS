import { unzipSync, strFromU8 } from 'fflate';

export interface TrymonManifest {
  name: string;
  version: string;
  entrypoint: string;
  icon?: string;
}

export interface TrymonPackage {
  manifest: TrymonManifest;
  mainScript: string;
  assets: Record<string, Uint8Array>;
}

export class TrymonPackager {
  public static unpack(buffer: ArrayBuffer): TrymonPackage {
    const uint8Array = new Uint8Array(buffer);
    
    // Decompress the ZIP file in memory
    const unzipped = unzipSync(uint8Array);
    
    let manifest: TrymonManifest = { name: 'Unknown', version: '1.0.0', entrypoint: 'main.tys' };
    let mainScript = '';
    const assets: Record<string, Uint8Array> = {};

    for (const [path, data] of Object.entries(unzipped)) {
      // Ignore directories
      if (data.length === 0) continue;

      if (path === 'manifest.json') {
        try {
          manifest = JSON.parse(strFromU8(data));
        } catch (e) {
          console.warn('Failed to parse manifest.json');
        }
      } else if (path === 'main.tys' || path === manifest.entrypoint) {
        mainScript = strFromU8(data);
      } else if (path.startsWith('assets/')) {
        assets[path] = data;
      }
    }

    return { manifest, mainScript, assets };
  }
}

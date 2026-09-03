export interface UIElement {
  id: string;
  type: 'BUTTON' | 'TEXT' | 'INPUT';
  content: string;
  onClick?: () => void;
  onChange?: (val: string) => void;
  value?: string;
}

export interface RuntimeContext {
  appName: string;
  windowSize: { width: number, height: number };
  elements: UIElement[];
}

export class TrymonRuntime {
  private jsCode: string;
  private context: RuntimeContext;
  private onUpdate: (ctx: RuntimeContext) => void;

  constructor(jsCode: string, onUpdate: (ctx: RuntimeContext) => void) {
    this.jsCode = jsCode;
    this.context = { appName: 'Trymon App', windowSize: { width: 400, height: 300 }, elements: [] };
    this.onUpdate = onUpdate;
  }

  public run() {
    try {
      // Setup the API exposed to the sandbox
      const TrymonAPI = {
        UI: {
          setWindowTitle: (title: string) => {
            this.context.appName = title;
            this.onUpdate({ ...this.context });
          },
          addText: (id: string, text: string) => {
            this.context.elements.push({ id, type: 'TEXT', content: text });
            this.onUpdate({ ...this.context });
          },
          addButton: (id: string, text: string, onClick: () => void) => {
            this.context.elements.push({ id, type: 'BUTTON', content: text, onClick });
            this.onUpdate({ ...this.context });
          },
          setText: (id: string, text: string) => {
            const el = this.context.elements.find(e => e.id === id);
            if (el) {
              el.content = text;
              this.onUpdate({ ...this.context });
            }
          },
          clear: () => {
             this.context.elements = [];
             this.onUpdate({ ...this.context });
          }
        },
        OS: {
          notify: (msg: string) => {
            console.log(`[Trymon OS Notification]: ${msg}`);
            // Very simple fallback for OS notification in v1
            window.alert(`Trymon OS: ${msg}`);
          }
        }
      };

      // Create sandboxed function
      const sandboxFn = new Function('Trymon', this.jsCode);
      
      // Execute
      sandboxFn(TrymonAPI);
      
    } catch (e: any) {
      console.error('Trymon Runtime Error:', e);
      this.context.elements.push({ id: 'error', type: 'TEXT', content: `Runtime Error: ${e.message}` });
      this.onUpdate(this.context);
    }
  }
}

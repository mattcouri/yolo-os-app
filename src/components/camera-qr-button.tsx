import { useEffect, useRef, useState } from "react";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export function CameraQrButton({
  onResult,
  disabled,
}: {
  onResult: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const start = async () => {
      setError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const detector = getDetector();
        if (!detector) {
          setError("Este navegador não lê QR pela câmera. Digite o código ou use um leitor USB.");
          return;
        }
        const tick = async () => {
          if (cancelled) return;
          const current = videoRef.current;
          if (current && current.readyState >= 2) {
            try {
              const codes = await detector.detect(current);
              const value = codes[0]?.rawValue?.trim();
              if (value) {
                onResultRef.current(value);
                setOpen(false);
                return;
              }
            } catch {
              /* keep scanning */
            }
          }
          rafRef.current = window.requestAnimationFrame(() => void tick());
        };
        rafRef.current = window.requestAnimationFrame(() => void tick());
      } catch {
        setError("Não foi possível abrir a câmera. Permita o acesso e tente de novo.");
      }
    };
    void start();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-10 shrink-0 px-0"
        disabled={disabled}
        title="Escanear QR com a câmera"
        onClick={() => setOpen(true)}
      >
        <QrCode className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear QR da caixa</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border bg-black">
            <video ref={videoRef} className="h-72 w-full object-cover" playsInline muted />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : <p className="text-xs text-muted-foreground">Aponte a câmera para o QR da caixa.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

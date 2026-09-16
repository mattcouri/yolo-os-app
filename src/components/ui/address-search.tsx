import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: {
              fields?: string[];
              componentRestrictions?: { country: string | string[] };
            }
          ) => {
            addListener: (event: string, fn: () => void) => void;
            getPlace: () => {
              formatted_address?: string;
              name?: string;
              place_id?: string;
              geometry?: { location?: { lat: () => number; lng: () => number } };
            };
          };
        };
      };
    };
    __yoloMapsPromise?: Promise<void>;
  }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

function loadPlaces(): Promise<void> {
  if (!MAPS_KEY) return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__yoloMapsPromise) return window.__yoloMapsPromise;
  window.__yoloMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-yolo-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Maps")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&language=pt-BR`;
    script.async = true;
    script.dataset.yoloMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Maps"));
    document.head.appendChild(script);
  });
  return window.__yoloMapsPromise;
}

function embedSrc(address: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`;
}

export function AddressSearch({
  value,
  onChange,
  required,
  disabled,
  label = "Endereço",
}: {
  value: string;
  onChange: (address: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(() => Boolean(typeof window !== "undefined" && window.google?.maps?.places));

  useEffect(() => {
    let cancelled = false;
    void loadPlaces()
      .then(() => {
        if (!cancelled) setReady(Boolean(window.google?.maps?.places));
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    const google = window.google;
    if (!input || !google?.maps?.places || disabled) return;
    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ["formatted_address", "geometry", "place_id", "name"],
      componentRestrictions: { country: "br" },
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const next = place.formatted_address || place.name || input.value;
      onChangeRef.current(next);
    });
  }, [ready, disabled]);

  return (
    <div className="space-y-2">
      <Label htmlFor="order-address">{label}</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="order-address"
          ref={inputRef}
          value={value}
          disabled={disabled}
          required={required}
          autoComplete="off"
          placeholder="Busque no Maps ou cole o endereço"
          className="pl-8"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {value.trim().length > 8 && (
        <div className="overflow-hidden rounded-lg border bg-muted/30">
          <iframe
            title="Mapa do destino"
            src={embedSrc(value.trim())}
            className="h-36 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.trim())}`}
            target="_blank"
            rel="noreferrer"
            className="block px-3 py-1.5 text-xs text-primary hover:underline"
          >
            Abrir no Google Maps
          </a>
        </div>
      )}
    </div>
  );
}

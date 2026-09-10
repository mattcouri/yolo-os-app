import * as React from "react";
import { Check, Plus, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SelectOption {
  value: string;
  label: string;
}

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  onCreateOption?: (label: string) => void;
  onEditOption?: (value: string, newLabel: string) => void;
  onDeleteOption?: (value: string) => void;
  placeholder?: string;
  createPlaceholder?: string;
  className?: string;
}

export function CreatableSelect({
  value,
  onChange,
  options,
  onCreateOption,
  onEditOption,
  onDeleteOption,
  placeholder = "Selecione...",
  createPlaceholder = "Novo tipo...",
  className,
}: CreatableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [newValue, setNewValue] = React.useState("");
  const [editValue, setEditValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const editInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleCreate = () => {
    if (newValue.trim() && onCreateOption) {
      onCreateOption(newValue.trim());
      const newId = newValue.trim().toLowerCase().replace(/\s+/g, "_");
      onChange(newId);
      setNewValue("");
      setIsCreating(false);
      setOpen(false);
    }
  };

  const handleEdit = (optionValue: string) => {
    if (editValue.trim() && onEditOption) {
      onEditOption(optionValue, editValue.trim());
      setEditingId(null);
      setEditValue("");
    }
  };

  const handleDelete = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteOption) {
      onDeleteOption(optionValue);
      if (value === optionValue) {
        onChange(options[0]?.value || "");
      }
    }
  };

  const startEdit = (option: SelectOption, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(option.value);
    setEditValue(option.label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      setIsCreating(false);
      setNewValue("");
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, optionValue: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEdit(optionValue);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditValue("");
    }
  };

  React.useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  React.useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const canEdit = !!onEditOption;
  const canDelete = !!onDeleteOption;
  const canCreate = !!onCreateOption;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {selectedOption?.label || placeholder}
          <svg
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-60 overflow-auto">
          {options.map((option) => (
            <div
              key={option.value}
              className={cn(
                "flex items-center px-2 py-1.5 text-sm hover:bg-muted transition-colors group",
                value === option.value && "bg-muted"
              )}
            >
              {editingId === option.value ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, option.value)}
                    className="h-7 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleEdit(option.value)}
                    disabled={!editValue.trim()}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      setEditingId(null);
                      setEditValue("");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex items-center flex-1 text-left"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </button>
                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => startEdit(option, e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {canDelete && options.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => handleDelete(option.value, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        
        {canCreate && (
          <div className="border-t p-2">
            {isCreating ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={inputRef}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={createPlaceholder}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCreate}
                  disabled={!newValue.trim()}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setIsCreating(false);
                    setNewValue("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar novo...
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

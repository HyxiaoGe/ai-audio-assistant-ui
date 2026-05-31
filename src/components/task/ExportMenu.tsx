"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface ExportMenuItem {
  key: string;
  label: string;
  onSelect?: () => void;
}

interface ExportMenuProps {
  label: string;
  items: ExportMenuItem[];
}

/**
 * 导出下拉菜单（audit a11y #11/#12）。
 * 触发器暴露 aria-haspopup="menu" + aria-expanded + aria-controls；展开容器为 role="menu"、
 * 子项为 role="menuitem"。支持 Escape 关闭（焦点还原触发器）与外点 mousedown 关闭。
 */
export function ExportMenu({ label, items }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
        style={{ borderColor: 'var(--app-glass-border)', color: 'var(--app-text)' }}
      >
        <span className="text-sm" style={{ fontWeight: 500 }}>{label}</span>
        <ChevronDown className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border overflow-hidden z-10"
          style={{ background: 'var(--app-glass-bg)', borderColor: 'var(--app-glass-border)' }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--app-glass-bg-strong)]"
              style={{ color: 'var(--app-text)' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

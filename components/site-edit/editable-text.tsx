"use client";

import { useRef, useState, type ElementType, type ReactNode } from "react";
import { toast } from "@/components/ui/toast";
import { useSiteContent } from "./site-content-provider";

/**
 * A piece of wording on a public page that a Hub super administrator can change
 * where it sits. `children` is the page's own wording, shown until someone
 * changes it; the element, its classes and so its styling stay exactly the same.
 *
 * In edit mode the text is typed over directly. Enter finishes a heading (or adds
 * a line break with `multiline`), Escape undoes, and clearing it completely puts
 * the page's own wording back.
 */
export function EditableText({
  id,
  as: Tag = "span",
  className,
  multiline = false,
  children,
}: {
  id: string;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  children: ReactNode;
}) {
  const { valueFor, editing, save, isPending } = useSiteContent();
  const override = valueFor(id);
  const content = override ?? children;
  const before = useRef("");
  // Remount after each save: the browser has already changed the text in place,
  // and React must not try to reconcile against what it last rendered.
  const [version, setVersion] = useState(0);
  const lines = typeof override === "string" && override.includes("\n") ? { whiteSpace: "pre-line" as const } : undefined;

  if (!editing) {
    return (
      <Tag className={className} style={lines}>
        {content}
      </Tag>
    );
  }

  const changed = isPending(id);
  const editStyle =
    "rounded-[3px] outline-dashed outline-2 outline-offset-4 cursor-text transition-[outline-color] " +
    (changed ? "outline-magenta/70 hover:outline-magenta focus:outline-magenta" : "outline-purple/35 hover:outline-purple focus:outline-purple");

  return (
    <Tag
      key={version}
      className={`${className ?? ""} ${editStyle}`}
      style={lines}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline={multiline}
      aria-label={`Edit text: ${id}`}
      title={changed ? "Changed, not yet published" : "Click to edit"}
      onClick={(e: React.MouseEvent) => e.preventDefault() /* inside a link, edit rather than navigate */}
      onFocus={(e: React.FocusEvent<HTMLElement>) => {
        before.current = e.currentTarget.innerText;
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") {
          e.currentTarget.innerText = before.current;
          e.currentTarget.blur();
        } else if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        // Browsers without plaintext-only would paste formatting; keep only the words.
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      onBlur={async (e: React.FocusEvent<HTMLElement>) => {
        const el = e.currentTarget; // gone from the event once we await
        const text = el.innerText.replace(/ /g, " ");
        if (text === before.current) return;
        const value = text.trim() ? text : null;
        const res = await save(id, "text", value);
        if (!res.ok) {
          toast.error(res.error);
          el.innerText = before.current;
          return;
        }
        if (value === null) toast.success("Put back the original wording");
        setVersion((v) => v + 1);
      }}
    >
      {content}
    </Tag>
  );
}

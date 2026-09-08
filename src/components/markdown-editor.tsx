// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

import * as React from "react";
import { Bold, Code, ExternalLink, Eye, Italic, List, ListOrdered, RemoveFormatting, TypeOutline } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsHighlight,
  TabsHighlightItem,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/primitives/animate/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  /** Max length of the stored Markdown, inclusive of spaces. */
  maxLength?: number;
};

export const ANNOUNCEMENT_MAX_LENGTH = 1800;

const PROSE =
  "[&_h2]:mt-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:leading-7 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_strong]:font-semibold [&_em]:italic [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-from-font";

function getEditorMarkdown(storage: unknown): string {
  const md = (storage as { markdown?: { getMarkdown?: () => string } } | undefined)?.markdown;
  return md?.getMarkdown ? md.getMarkdown() : "";
}

export function MarkdownEditor({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder,
  className,
  maxLength = ANNOUNCEMENT_MAX_LENGTH,
}: MarkdownEditorProps) {
  const [view, setView] = React.useState<"preview" | "code">("preview");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [selStart, setSelStart] = React.useState(0);
  const lastEmittedRef = React.useRef(value);
  const [, forceTick] = React.useReducer((x: number) => x + 1, 0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Markdown.configure({ html: false, linkify: true, breaks: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn("min-h-[160px] max-w-none px-3 py-2 leading-7 outline-none", PROSE),
        "aria-label": ariaLabel ?? "Announcement message",
      },
    },
    onUpdate: ({ editor }) => {
      const md = getEditorMarkdown(editor.storage);
      if (md === lastEmittedRef.current) return;
      if (md.length > maxLength) {
        // Over the limit — drop the change by restoring the last accepted value.
        editor.commands.setContent(lastEmittedRef.current);
        return;
      }
      lastEmittedRef.current = md;
      onChange(md);
    },
  });

  // Reflect external value changes (e.g. edits made in the Edit Code tab, or a
  // reset) into the WYSIWYG editor. Guarded so editor-originated changes don't loop.
  React.useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(value);
  }, [editor, value]);

  // Re-render the toolbar active states as the selection/content changes.
  React.useEffect(() => {
    if (!editor) return;
    const update = () => forceTick();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  // --- Edit Code (textarea) helpers ---------------------------------------
  const syncSelection = () => {
    const el = textareaRef.current;
    if (el) setSelStart(el.selectionStart);
  };
  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  const lineEndNl = value.indexOf("\n", lineStart);
  const currentLine = value.slice(lineStart, lineEndNl === -1 ? value.length : lineEndNl);
  const codeLineIsHeading = /^#{1,6}\s/.test(currentLine);

  const applyCodeChange = (next: string, selectionStart: number, selectionEnd: number) => {
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selectionStart, selectionEnd);
      setSelStart(selectionStart);
    });
  };
  const wrapSelection = (marker: string, placeholderText: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? selStart;
    const end = el?.selectionEnd ?? start;
    const selected = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    applyCodeChange(next, start + marker.length, start + marker.length + selected.length);
  };
  const prefixLines = (makePrefix: (index: number) => string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? selStart;
    const end = el?.selectionEnd ?? start;
    const blockStart = value.lastIndexOf("\n", start - 1) + 1;
    const blockEndNl = value.indexOf("\n", end);
    const blockEnd = blockEndNl === -1 ? value.length : blockEndNl;
    const block = value.slice(blockStart, blockEnd);
    const newBlock = block
      .split("\n")
      .map((line, index) => makePrefix(index) + line)
      .join("\n");
    applyCodeChange(value.slice(0, blockStart) + newBlock + value.slice(blockEnd), blockStart, blockStart + newBlock.length);
  };
  const toggleCodeHeading = () => {
    const blockStart = value.lastIndexOf("\n", selStart - 1) + 1;
    const blockEndNl = value.indexOf("\n", blockStart);
    const blockEnd = blockEndNl === -1 ? value.length : blockEndNl;
    const line = value.slice(blockStart, blockEnd);
    const newLine = /^#{1,6}\s/.test(line) ? line.replace(/^#{1,6}\s+/, "") : `## ${line}`;
    applyCodeChange(value.slice(0, blockStart) + newLine + value.slice(blockEnd), blockStart, blockStart + newLine.length);
  };

  // --- Toolbar (works in both views) --------------------------------------
  const inPreview = view === "preview";
  const titleActive = inPreview ? !!editor?.isActive("heading", { level: 2 }) : codeLineIsHeading;
  const boldActive = inPreview ? !!editor?.isActive("bold") : false;
  const italicActive = inPreview ? !!editor?.isActive("italic") : false;
  const bulletActive = inPreview ? !!editor?.isActive("bulletList") : false;
  const orderedActive = inPreview ? !!editor?.isActive("orderedList") : false;

  const runTitle = () =>
    inPreview ? editor?.chain().focus().toggleHeading({ level: 2 }).run() : toggleCodeHeading();
  const runBold = () => (inPreview ? editor?.chain().focus().toggleBold().run() : wrapSelection("**", "bold text"));
  const runItalic = () => (inPreview ? editor?.chain().focus().toggleItalic().run() : wrapSelection("_", "italic text"));
  const runBullet = () =>
    inPreview ? editor?.chain().focus().toggleBulletList().run() : prefixLines(() => "- ");
  const runOrdered = () =>
    inPreview ? editor?.chain().focus().toggleOrderedList().run() : prefixLines((index) => `${index + 1}. `);

  const tool = (active: boolean) => cn("h-8 w-8", active && "bg-accent text-accent-foreground");
  const overLimit = value.length > maxLength;

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <Tabs value={view} onValueChange={(v) => setView(v as "preview" | "code")}>
      <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(titleActive)}
          aria-pressed={titleActive}
          aria-label={titleActive ? "Remove title formatting" : "Make title"}
          title={titleActive ? "Remove formatting" : "Title"}
          onClick={runTitle}
        >
          {titleActive ? <RemoveFormatting className="h-4 w-4" /> : <TypeOutline className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool(boldActive)} aria-pressed={boldActive} aria-label="Bold" title="Bold" onClick={runBold}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool(italicActive)} aria-pressed={italicActive} aria-label="Italic" title="Italic" onClick={runItalic}>
          <Italic className="h-4 w-4" />
        </Button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={tool(bulletActive)} aria-pressed={bulletActive} aria-label="Bulleted list" title="Bulleted list" onClick={runBullet}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={tool(orderedActive)} aria-pressed={orderedActive} aria-label="Numbered list" title="Numbered list" onClick={runOrdered}>
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="relative ml-auto">
          <TabsHighlight className="absolute inset-0.5 z-0 rounded-md bg-background shadow-sm">
            <TabsList className="inline-flex gap-1 rounded-md border bg-muted p-1">
              <TabsHighlightItem value="preview">
                <TabsTrigger value="preview" className="relative z-10 inline-flex h-8 w-full items-center justify-center gap-2 whitespace-nowrap px-3.5 text-xs text-muted-foreground">
                  <Eye className="h-4 w-4 shrink-0" />
                  Live preview
                </TabsTrigger>
              </TabsHighlightItem>
              <TabsHighlightItem value="code">
                <TabsTrigger value="code" className="relative z-10 inline-flex h-8 w-full items-center justify-center gap-2 whitespace-nowrap px-3.5 text-xs text-muted-foreground">
                  <Code className="h-4 w-4 shrink-0" />
                  Edit code
                </TabsTrigger>
              </TabsHighlightItem>
            </TabsList>
          </TabsHighlight>
        </div>
      </div>

      <TabsContents>
          <TabsContent value="preview">
            <div className="max-h-[320px] overflow-y-auto">
              {editor ? <EditorContent editor={editor} /> : null}
            </div>
          </TabsContent>
          <TabsContent value="code">
            <textarea
              ref={textareaRef}
              id={id}
              value={value}
              maxLength={maxLength}
              aria-label={ariaLabel}
              placeholder={placeholder ?? "Write your announcement…"}
              onChange={(event) => {
                onChange(event.target.value);
                syncSelection();
              }}
              onSelect={syncSelection}
              onClick={syncSelection}
              onKeyUp={syncSelection}
              className="max-h-[320px] min-h-[160px] w-full resize-y bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
          </TabsContent>
        </TabsContents>
      </Tabs>

      <div className="flex items-center justify-between gap-3 border-t px-3 py-1.5">
        <a
          href="/help/announcements#formatting-announcements"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Markdown formatting help
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
        <span className={cn("text-xs tabular-nums", overLimit ? "text-destructive" : "text-muted-foreground")}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

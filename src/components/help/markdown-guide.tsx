// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

/* eslint-disable @typescript-eslint/no-unused-vars -- each markdown component
   override destructures react-markdown's hast `node` prop only to keep it from
   being spread onto the DOM element; the binding itself is intentionally unused. */

import * as React from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfmSafe from "@/lib/remark-gfm-safe";

import { cn } from "@/lib/utils";
import { HELP_SCREENSHOT_SIZES } from "@/lib/help-screenshot-manifest";
import { getGuideHeadingIdsByLine, rewriteGuideLink } from "@/lib/user-guides";

type MarkdownGuideProps = {
  content: string;
};

function getDarkScreenshotSrc(src?: string) {
  if (!src?.startsWith("/help-screenshots/") || !/\.(?:png|webp)$/.test(src)) {
    return undefined;
  }

  return src.replace(/(\.(?:png|webp))$/, "-dark$1");
}

// Help screenshots render at 1x their captured CSS size, capped by the guide
// column. Without this the browser only knows the file's pixel width, so a
// phone capture — 750px of image describing a 375pt screen — stretched to the
// full ~815px column and read at more than twice life size, while desktop
// captures shrank below theirs. See docs/HELP_SYSTEM.md.
function getScreenshotLayout(src?: string) {
  const name = src?.startsWith("/help-screenshots/")
    ? src.slice("/help-screenshots/".length).replace(/\.(?:png|webp)$/, "")
    : undefined;
  const size = name ? HELP_SCREENSHOT_SIZES[name] : undefined;

  if (!size) return undefined;

  return {
    width: size.pixelWidth,
    height: size.pixelHeight,
    // `w-full` alongside this is load-bearing: a bare max-width does not let an
    // image shrink below its intrinsic size, so a phone capture would overflow
    // the column horizontally on a narrow screen.
    style: { maxWidth: `${Math.round(size.pixelWidth / size.deviceScaleFactor)}px` },
  };
}

export function MarkdownGuideContent({ content }: MarkdownGuideProps) {
  const headingIdsByLine = React.useMemo(() => getGuideHeadingIdsByLine(content), [content]);

  const components: Components = {
    a: ({ href, children, className, node: _node, title: _title, ...props }) => {
      // Links are given the conventional affordance — blue and underlined — so
      // they read as interactive. Markdown (and linkify) turn plain URLs into
      // anchors, and without this they inherited body colour with no underline,
      // leaving no signal that they could be tapped. `title="underline"` used
      // to be the only way to get an underline; it is now redundant but kept so
      // existing guide content keeps behaving the same.
      const linkClassName = cn(
        "text-link underline underline-offset-4 decoration-from-font",
        "hover:text-link-hover focus-visible:text-link-hover",
        "visited:text-link-visited",
        className,
      );

      if (!href) {
        return (
          <a className={linkClassName} {...props}>
            {children}
          </a>
        );
      }

      const rewrittenHref = rewriteGuideLink(href);
      const isExternal = rewrittenHref.startsWith("http://") || rewrittenHref.startsWith("https://");

      if (isExternal) {
        return (
          <a className={linkClassName} href={rewrittenHref} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        );
      }

      if (rewrittenHref.startsWith("mailto:") || rewrittenHref.startsWith("#")) {
        return (
          <a className={linkClassName} href={rewrittenHref} {...props}>
            {children}
          </a>
        );
      }

      return (
        <Link className={linkClassName} href={rewrittenHref} {...props}>
          {children}
        </Link>
      );
    },
    h1: ({ children, node: _node, ...props }) => (
      <h1 className="text-3xl font-semibold tracking-tight text-foreground" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, node, ...props }) => {
      const line = node?.position?.start.line;
      const id = line ? headingIdsByLine.get(line) : undefined;
      return (
        <h2
          id={id}
          className="scroll-mt-24 border-t pt-8 text-2xl font-semibold tracking-tight text-foreground first:border-t-0 first:pt-0"
          {...props}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children, node, ...props }) => {
      const line = node?.position?.start.line;
      const id = line ? headingIdsByLine.get(line) : undefined;
      return (
        <h3 id={id} className="scroll-mt-24 text-lg font-semibold text-foreground" {...props}>
          {children}
        </h3>
      );
    },
    p: ({ className, node: _node, ...props }) => (
      <p className={cn("leading-7 text-foreground/90", className)} {...props} />
    ),
    ul: ({ className, node: _node, ...props }) => (
      <ul className={cn("ml-5 list-disc space-y-2 leading-7", className)} {...props} />
    ),
    ol: ({ className, node: _node, ...props }) => (
      <ol className={cn("ml-5 list-decimal space-y-2 leading-7", className)} {...props} />
    ),
    li: ({ className, node: _node, ...props }) => (
      <li className={cn("pl-1 text-foreground/90", className)} {...props} />
    ),
    blockquote: ({ className, node: _node, ...props }) => (
      <blockquote
        className={cn("border-l-4 border-primary/40 pl-4 text-muted-foreground", className)}
        {...props}
      />
    ),
    img: ({ alt, className, node: _node, src, ...props }) => {
      const normalizedSrc = typeof src === "string" ? src : undefined;
      const darkSrc = getDarkScreenshotSrc(normalizedSrc);
      const layout = getScreenshotLayout(normalizedSrc);
      // The intrinsic width/height also give the browser an aspect ratio to
      // reserve space with, so lazily loaded screenshots stop shifting layout.
      const sizing = layout
        ? { width: layout.width, height: layout.height, style: layout.style }
        : {};
      const imageClassName = cn(
        "rounded-lg border shadow-sm",
        layout && "mx-auto block w-full",
        className,
      );

      if (!darkSrc) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img alt={alt} className={cn("my-4", imageClassName)} loading="lazy" src={normalizedSrc} {...sizing} {...props} />;
      }

      return (
        <span className="my-4 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={alt} className={cn(imageClassName, "dark:hidden")} loading="lazy" src={normalizedSrc} {...sizing} {...props} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={alt} className={cn(imageClassName, "hidden dark:block")} loading="lazy" src={darkSrc} {...sizing} {...props} />
        </span>
      );
    },
    code: ({ className, node: _node, ...props }) => (
      <code
        className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground", className)}
        {...props}
      />
    ),
    pre: ({ className, node: _node, ...props }) => (
      <pre
        className={cn("overflow-x-auto rounded-lg border bg-muted p-4 text-sm text-foreground", className)}
        {...props}
      />
    ),
    table: ({ className, node: _node, ...props }) => (
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    ),
    th: ({ className, node: _node, ...props }) => (
      <th className={cn("border bg-muted px-3 py-2 text-left font-medium", className)} {...props} />
    ),
    td: ({ className, node: _node, ...props }) => (
      <td className={cn("border px-3 py-2 align-top", className)} {...props} />
    ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfmSafe]} components={components}>
      {content}
    </ReactMarkdown>
  );
}

export function MarkdownGuide({ content }: MarkdownGuideProps) {
  return (
    <article
      data-guide-article
      className="max-w-none space-y-5 rounded-lg border bg-card p-5 shadow-sm md:p-7"
    >
      <MarkdownGuideContent content={content} />
    </article>
  );
}

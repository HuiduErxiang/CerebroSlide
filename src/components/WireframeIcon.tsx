/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { cn } from "../utils";

interface WireframeIconProps {
  type: string;
  className?: string;
}

export const WireframeIcon = ({ type, className }: WireframeIconProps) => {
  const baseClass = cn("w-full aspect-video border-2 border-dashed border-black/10 rounded-md bg-black/5 relative overflow-hidden", className);
  
  // Normalize type: lowercase and replace spaces with hyphens
  const normalizedType = type?.toLowerCase().trim().replace(/\s+/g, '-');

  switch (normalizedType) {
    case 'center-hero':
    case 'centerhero':
      return (
        <div className={baseClass}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/4 bg-black/10 rounded" />
          <div className="absolute top-[65%] left-1/2 -translate-x-1/2 w-1/2 h-4 bg-black/5 rounded" />
        </div>
      );
    case 'split-left':
    case 'splitleft':
      return (
        <div className={baseClass}>
          <div className="absolute left-2 top-2 bottom-2 w-[40%] bg-black/10 rounded" />
          <div className="absolute right-2 top-2 bottom-2 w-[45%] border border-black/10 rounded flex items-center justify-center">
            <div className="w-8 h-8 bg-black/5 rounded-full" />
          </div>
        </div>
      );
    case 'split-right':
    case 'splitright':
      return (
        <div className={baseClass}>
          <div className="absolute right-2 top-2 bottom-2 w-[40%] bg-black/10 rounded" />
          <div className="absolute left-2 top-2 bottom-2 w-[45%] border border-black/10 rounded flex items-center justify-center">
            <div className="w-8 h-8 bg-black/5 rounded-full" />
          </div>
        </div>
      );
    case 'grid-3':
    case 'grid3':
      return (
        <div className={baseClass + " flex gap-1 p-1"}>
          <div className="flex-1 bg-black/10 rounded" />
          <div className="flex-1 bg-black/10 rounded" />
          <div className="flex-1 bg-black/10 rounded" />
        </div>
      );
    case 'top-bottom':
    case 'topbottom':
      return (
        <div className={baseClass}>
          <div className="absolute top-2 left-2 right-2 h-[20%] bg-black/10 rounded" />
          <div className="absolute bottom-2 left-2 right-2 h-[60%] border border-black/10 rounded" />
        </div>
      );
    case 'full-image':
    case 'fullimage':
      return (
        <div className={baseClass}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-black/10 rounded-full" />
          </div>
          <div className="absolute bottom-4 left-4 right-4 h-8 bg-white/20 backdrop-blur-sm rounded" />
        </div>
      );
    case 'grid-2':
    case 'grid2':
      return (
        <div className={baseClass + " flex gap-1 p-1"}>
          <div className="flex-1 bg-black/10 rounded" />
          <div className="flex-1 bg-black/10 rounded" />
        </div>
      );
    case 'quote':
      return (
        <div className={baseClass}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-1/3 border-y border-black/10 flex items-center justify-center">
            <div className="w-2/3 h-2 bg-black/10 rounded" />
          </div>
        </div>
      );
    case 'feature-list':
    case 'featurelist':
      return (
        <div className={baseClass + " flex flex-col gap-1 p-2"}>
          <div className="h-2 w-1/3 bg-black/10 rounded" />
          <div className="h-2 w-full bg-black/5 rounded" />
          <div className="h-2 w-full bg-black/5 rounded" />
          <div className="h-2 w-full bg-black/5 rounded" />
        </div>
      );
    case 'bento-grid':
    case 'bentogrid':
      return (
        <div className={baseClass + " grid grid-cols-3 grid-rows-2 gap-1 p-1"}>
          <div className="col-span-2 bg-black/10 rounded" />
          <div className="bg-black/10 rounded" />
          <div className="bg-black/10 rounded" />
          <div className="col-span-2 bg-black/10 rounded" />
        </div>
      );
    case 'data-focus':
    case 'datafocus':
      return (
        <div className={baseClass + " flex flex-col gap-2 p-2"}>
          <div className="flex gap-2 h-1/2">
            <div className="flex-1 bg-black/20 rounded flex items-center justify-center"><div className="w-4 h-4 bg-white/30 rounded-full" /></div>
            <div className="flex-1 bg-black/20 rounded flex items-center justify-center"><div className="w-4 h-4 bg-white/30 rounded-full" /></div>
          </div>
          <div className="flex-1 bg-black/5 rounded" />
        </div>
      );
    case 'expert-quote':
    case 'expertquote':
      return (
        <div className={baseClass + " p-4"}>
          <div className="w-full h-full border-l-4 border-black/20 pl-2 flex flex-col justify-center gap-2">
            <div className="w-full h-2 bg-black/10 rounded" />
            <div className="w-2/3 h-2 bg-black/10 rounded" />
            <div className="w-1/3 h-2 bg-black/5 rounded self-end" />
          </div>
        </div>
      );
    case 'timeline-flow':
    case 'timelineflow':
      return (
        <div className={baseClass + " flex items-center p-2"}>
          <div className="w-full h-0.5 bg-black/10 relative">
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 bg-black/20 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-black/20 rounded-full" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 bg-black/20 rounded-full" />
          </div>
        </div>
      );
    default:
      return (
        <div className={baseClass + " flex items-center justify-center"}>
          <span className="text-[8px] text-black/20 font-mono uppercase">{type || 'Auto'}</span>
        </div>
      );
  }
};

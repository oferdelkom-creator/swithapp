"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

export type ExitDirection = "left" | "right" | "up";

export interface DraggableCardHandle {
  triggerExit: (direction: ExitDirection) => void;
}

interface DraggableCardProps {
  active: boolean;
  onExit: (direction: ExitDirection) => void;
  children: React.ReactNode;
}

const EXIT_DISTANCE = 700;
const SWIPE_THRESHOLD = 110;

const DraggableCard = forwardRef<DraggableCardHandle, DraggableCardProps>(function DraggableCard(
  { active, onExit, children },
  ref
) {
  const { t } = useLocale();
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<ExitDirection | null>(null);
  const startXRef = useRef(0);

  function commitExit(direction: ExitDirection) {
    setDragging(false);
    setExiting(direction);
    setTimeout(() => onExit(direction), 220);
  }

  useImperativeHandle(ref, () => ({ triggerExit: commitExit }));

  function onPointerDown(e: React.PointerEvent) {
    if (!active || exiting) return;
    setDragging(true);
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragX(e.clientX - startXRef.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    if (dragX > SWIPE_THRESHOLD) commitExit("right");
    else if (dragX < -SWIPE_THRESHOLD) commitExit("left");
    else {
      setDragging(false);
      setDragX(0);
    }
  }

  const x = exiting === "left" ? -EXIT_DISTANCE : exiting === "right" ? EXIT_DISTANCE : dragX;
  const y = exiting === "up" ? -EXIT_DISTANCE : 0;
  const rotate = exiting === "left" ? -20 : exiting === "right" ? 20 : dragX / 14;
  const opacity = exiting === "up" ? 0 : 1;
  const likeOpacity = Math.min(Math.max(dragX / SWIPE_THRESHOLD, 0), 1);
  const nopeOpacity = Math.min(Math.max(-dragX / SWIPE_THRESHOLD, 0), 1);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)`,
        opacity,
        transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease",
        touchAction: "pan-y",
      }}
      className={`absolute inset-0 ${active ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
    >
      {children}
      {active && (
        <>
          <div
            style={{ opacity: likeOpacity }}
            className="absolute top-8 start-6 rotate-[-16deg] rounded-lg border-4 border-emerald-400 px-4 py-1 text-2xl font-extrabold text-emerald-400 uppercase tracking-wide"
          >
            {t("swipe.interested")}
          </div>
          <div
            style={{ opacity: nopeOpacity }}
            className="absolute top-8 end-6 rotate-[16deg] rounded-lg border-4 border-red-400 px-4 py-1 text-2xl font-extrabold text-red-400 uppercase tracking-wide"
          >
            {t("swipe.skip")}
          </div>
        </>
      )}
    </div>
  );
});

export default DraggableCard;

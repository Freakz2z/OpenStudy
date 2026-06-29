import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipState {
  target: HTMLElement;
  text: string;
  placement: TooltipPlacement;
  left: number;
  top: number;
  ready: boolean;
  maxWidth: number;
}

const VIEWPORT_MARGIN = 12;
const TOOLTIP_GAP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getTooltipText(target: HTMLElement): string {
  return (
    target.getAttribute('title')?.trim()
    ?? target.dataset.tooltipTitle?.trim()
    ?? ''
  );
}

function findTooltipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  return node.closest<HTMLElement>('[title], [data-tooltip-title]');
}

function getTooltipMaxWidth(text: string): number {
  if (text.length <= 8) return 120;
  if (text.length <= 14) return 160;
  if (text.length <= 22) return 220;
  if (text.length <= 32) return 280;
  return 320;
}

export function GlobalTooltip() {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function restoreTitle(target: HTMLElement | null) {
    if (!target) return;
    const original = target.dataset.tooltipTitle;
    if (original != null) {
      target.setAttribute('title', original);
      delete target.dataset.tooltipTitle;
    }
  }

  function hideTooltip() {
    restoreTitle(activeTargetRef.current);
    activeTargetRef.current = null;
    setTooltip(null);
  }

  function showTooltip(target: HTMLElement) {
    const text = getTooltipText(target);
    if (!text) return;
    if (activeTargetRef.current === target && tooltip?.text === text) return;

    restoreTitle(activeTargetRef.current);

    const originalTitle = target.getAttribute('title');
    if (originalTitle != null) {
      target.dataset.tooltipTitle = originalTitle;
      target.removeAttribute('title');
    }

    activeTargetRef.current = target;
    setTooltip({
      target,
      text,
      placement: 'top',
      left: 0,
      top: 0,
      ready: false,
      maxWidth: getTooltipMaxWidth(text),
    });
  }

  useEffect(() => {
    const onPointerOver = (event: PointerEvent) => {
      const target = findTooltipTarget(event.target);
      if (!target) return;
      showTooltip(target);
    };

    const onPointerOut = (event: PointerEvent) => {
      const activeTarget = activeTargetRef.current;
      if (!activeTarget) return;
      if (!(event.target instanceof Node)) return;
      if (!activeTarget.contains(event.target)) return;
      if (event.relatedTarget instanceof Node && activeTarget.contains(event.relatedTarget)) {
        return;
      }
      hideTooltip();
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = findTooltipTarget(event.target);
      if (!target) return;
      showTooltip(target);
    };

    const onFocusOut = (event: FocusEvent) => {
      const activeTarget = activeTargetRef.current;
      if (!activeTarget) return;
      if (!(event.target instanceof Node)) return;
      if (!activeTarget.contains(event.target)) return;
      if (event.relatedTarget instanceof Node && activeTarget.contains(event.relatedTarget)) {
        return;
      }
      hideTooltip();
    };

    const dismiss = () => hideTooltip();

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    document.addEventListener('pointerdown', dismiss);

    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
      document.removeEventListener('pointerdown', dismiss);
      restoreTitle(activeTargetRef.current);
    };
  }, []);

  const tooltipTarget = tooltip?.target;
  const tooltipText = tooltip?.text;

  useLayoutEffect(() => {
    if (!tooltipTarget || !tooltipRef.current) return;
    if (!tooltipTarget.isConnected) {
      hideTooltip();
      return;
    }

    const rect = tooltipTarget.getBoundingClientRect();
    const { offsetWidth, offsetHeight } = tooltipRef.current;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const topFits = rect.top >= offsetHeight + TOOLTIP_GAP + VIEWPORT_MARGIN;
    const bottomFits = viewportHeight - rect.bottom >= offsetHeight + TOOLTIP_GAP + VIEWPORT_MARGIN;
    const leftFits = rect.left >= offsetWidth + TOOLTIP_GAP + VIEWPORT_MARGIN;
    const rightFits = viewportWidth - rect.right >= offsetWidth + TOOLTIP_GAP + VIEWPORT_MARGIN;

    let placement: TooltipPlacement = 'top';
    if (topFits) placement = 'top';
    else if (bottomFits) placement = 'bottom';
    else if (leftFits) placement = 'left';
    else if (rightFits) placement = 'right';
    else {
      const spaces = [
        { placement: 'top' as const, value: rect.top },
        { placement: 'bottom' as const, value: viewportHeight - rect.bottom },
        { placement: 'left' as const, value: rect.left },
        { placement: 'right' as const, value: viewportWidth - rect.right },
      ].sort((a, b) => b.value - a.value);
      placement = spaces[0]?.placement ?? 'top';
    }

    let left = 0;
    let top = 0;

    if (placement === 'top' || placement === 'bottom') {
      left = clamp(
        rect.left + rect.width / 2 - offsetWidth / 2,
        VIEWPORT_MARGIN,
        viewportWidth - offsetWidth - VIEWPORT_MARGIN,
      );
      top =
        placement === 'top'
          ? rect.top - offsetHeight - TOOLTIP_GAP
          : rect.bottom + TOOLTIP_GAP;
    } else {
      top = clamp(
        rect.top + rect.height / 2 - offsetHeight / 2,
        VIEWPORT_MARGIN,
        viewportHeight - offsetHeight - VIEWPORT_MARGIN,
      );
      left =
        placement === 'left'
          ? rect.left - offsetWidth - TOOLTIP_GAP
          : rect.right + TOOLTIP_GAP;
    }

    setTooltip((current) => {
      if (!current) return current;
      if (
        current.placement === placement &&
        current.left === left &&
        current.top === top &&
        current.ready
      ) {
        return current;
      }
      return {
        ...current,
        placement,
        left,
        top,
        ready: true,
      };
    });
  }, [tooltipTarget, tooltipText]);

  if (!tooltip) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className={`app-tooltip${tooltip.ready ? ' is-ready' : ''}`}
      data-placement={tooltip.placement}
      style={{
        left: tooltip.left,
        top: tooltip.top,
        maxWidth: Math.min(window.innerWidth - VIEWPORT_MARGIN * 2, tooltip.maxWidth),
      }}
      role="tooltip"
    >
      {tooltip.text}
    </div>,
    document.body,
  );
}

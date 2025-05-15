import { useRef } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { useEffect } from "react";

export function useXTerm(
  terminalContainerRef: React.RefObject<HTMLDivElement | null>
) {
  const xtermRef = useRef<XTerminal>(null);

  if (!xtermRef.current) {
    xtermRef.current = new XTerminal();
  }

  useEffect(() => {
    if (!xtermRef.current || !terminalContainerRef.current) {
      return;
    }

    const xterm = xtermRef.current;
    const terminalContainer = terminalContainerRef.current;

    xterm.open(terminalContainer);
    xterm.options.theme = { background: "#0f172b" };

    return () => {
      xterm.dispose();
    };
  }, []);

  return xtermRef.current;
}

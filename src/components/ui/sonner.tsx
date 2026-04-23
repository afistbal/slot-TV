import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useUserStore } from "@/stores/user"

/** 与 sonner 内置默认 `TOAST_LIFETIME`（4000ms）一致 */
const TOAST_DURATION_DEFAULT_MS = 4000

const Toaster = ({ duration: durationProp, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const isAdmin = useUserStore((s) => s.isAdmin())
  const duration =
    durationProp ??
    (isAdmin ? TOAST_DURATION_DEFAULT_MS / 2 : TOAST_DURATION_DEFAULT_MS)

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={duration}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

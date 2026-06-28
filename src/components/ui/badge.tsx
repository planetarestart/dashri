import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-[#4DB848] text-white",
        secondary:   "border-transparent bg-[#0D2114] text-[#7AA880]",
        destructive: "border-transparent bg-[#D45820] text-white",
        outline:     "text-[#E0EEE0] border-[#1B3D20]",
        success:     "bg-[#4DB848]/15 text-[#4DB848] border border-[#4DB848]/30",
        warning:     "bg-[#C8900A]/20 text-[#E8A820] border border-[#C8900A]/30",
        error:       "bg-[#D45820]/20 text-[#E87040] border border-[#D45820]/30",
        info:        "bg-[#7FCC5E]/15 text-[#7FCC5E] border border-[#7FCC5E]/30",
        gray:        "bg-[#1B3D20]/60 text-[#7AA880] border border-[#1B3D20]",
        active:      "bg-[#4DB848]/15 text-[#4DB848] border border-[#4DB848]/30",
        paused:      "bg-[#C8900A]/20 text-[#E8A820] border border-[#C8900A]/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

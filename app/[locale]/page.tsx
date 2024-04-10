"use client"

import { LearnTimeSVG } from "@/components/icons/learntime"
import { IconArrowRight } from "@tabler/icons-react"
import { useTheme } from "next-themes"
import Link from "next/link"

export default function HomePage() {
  const { theme } = useTheme()
  console.log("theme page", theme)
  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div>
        <LearnTimeSVG theme={theme === "dark" ? "dark" : "light"} scale={0.1} />
      </div>

      <div className="mt-2 text-4xl font-bold italic">LearnTime</div>

      <Link
        className="mt-4 flex w-[200px] items-center justify-center rounded-md bg-blue-500 p-2 font-semibold"
        href="/login"
      >
        Start Learning
        <IconArrowRight className="ml-1" size={20} />
      </Link>
    </div>
  )
}

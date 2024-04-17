import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { ChatbotUIContext } from "@/context/context"
import { deleteChat } from "@/db/chats"
import useHotkey from "@/lib/hooks/use-hotkey"
import { Tables } from "@/supabase/types"
import { faTrash } from "@fortawesome/free-solid-svg-icons"
import { faArrowDownToLine } from "@fortawesome/pro-regular-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { FC, useContext, useRef, useState } from "react"
import toast from "react-hot-toast"

const notify = () =>
  toast.success(`The thread messages has been successfully downloaded.`, {
    duration: 2000,
    iconTheme: {
      primary: "#14B8A6",
      secondary: "#191617"
    }
  })

interface DownloadChatProps {
  chat: Tables<"chats">
  setShowChatDialog: (value: boolean) => void
}

export const DownloadChat: FC<DownloadChatProps> = ({
  chat,
  setShowChatDialog: isSetShowDialog
}) => {
  useHotkey("Backspace", () => setShowChatDialog(true))

  const { setChats, chatMessages } = useContext(ChatbotUIContext)
  const { handleNewChat } = useChatHandler()

  const buttonRef = useRef<HTMLButtonElement>(null)

  const [showChatDialog, setShowChatDialog] = useState(false)

  const handleDownload = () => {
    const formattedChat = {
      chatSettings: {
        model: chat.model,
        prompt: chat.prompt,
        temperature: chat.temperature,
        contextLength: chat.context_length,
        includeProfileContext: chat.include_profile_context,
        includeWorkspaceInstructions: chat.include_workspace_instructions,
        embeddingsProvider: chat.embeddings_provider
      },
      messages: chatMessages?.map(message => {
        return {
          role: message.message.role,
          content: message.message.content
        }
      }),
      customModelId: ""
    }

    const jsonStringChat = JSON.stringify(formattedChat)

    console.log("formattedChat", formattedChat)

    const blob = new Blob([jsonStringChat], {
      type: "application/json"
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = chat.name
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    setShowChatDialog(false)
    isSetShowDialog(false)
    notify()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      buttonRef.current?.click()
    }
  }

  return (
    <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
      <DialogTrigger asChild>
        <div
          role="button"
          className="hover:bg-pixelspace-gray-55 dark:hover:bg-pixelspace-gray-70 block w-full cursor-pointer px-4 py-2 text-left text-sm font-medium dark:hover:text-white"
        >
          <FontAwesomeIcon icon={faArrowDownToLine} className="mr-2" />
          <span>Download</span>
        </div>
      </DialogTrigger>

      <DialogContent className="h-[177px] w-[640px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Download {chat.name}</DialogTitle>

          <DialogDescription>
            Are you sure you want to download this chat?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            size="cancelPrompt"
            className="mr-4"
            variant="cancelPrompt"
            onClick={() => setShowChatDialog(false)}
          >
            Cancel
          </Button>

          <Button
            size="savePrompt"
            variant="savePrompt"
            onClick={handleDownload}
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
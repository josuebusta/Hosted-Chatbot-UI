import endent from "endent"
import { BuiltChatMessage } from "@/types"
import { PluginID } from "@/types/plugins"
import llmConfig from "@/lib/models/llm/llm-config"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import {
  buildFinalMessages,
  filterEmptyAssistantMessages
} from "@/lib/build-prompt"
import { checkRateLimitWithoutIncrementing } from "@/lib/server/ratelimiter"
import { handleErrorResponse } from "@/lib/models/llm/api-error"
import {
  getFilteredPlugins
  // allFreePlugins,
  // allProPlugins
} from "@/lib/plugins/available-plugins"
// import { isPremiumUser } from "@/lib/server/subscription-utils"
import { GPT4 } from "@/lib/models/llm/openai-llm-list"
import { MISTRAL_LARGE } from "@/lib/models/llm/mistral-llm-list"
import * as djson from "dirty-json"

export async function POST(request: Request) {
  try {
    const { payload, selectedPlugin, useAllPlugins } = await request.json()
    const chatSettings = payload.chatSettings

    const profile = await getServerProfile()
    // const isPremium = await isPremiumUser(profile.user_id)
    // const availablePlugins = useAllPlugins
    //   ? isPremium
    //     ? [...allFreePlugins, ...allProPlugins]
    //     : allFreePlugins
    //   : getFilteredPlugins(chatSettingsModel)
    const availablePlugins = getFilteredPlugins(chatSettings.model)

    const { openrouter, together, useOpenRouter, models, pinecone } = llmConfig
    const { apiKey: openrouterApiKey, url: openrouterUrl } = openrouter
    const { apiKey: togetherApiKey, url: togetherUrl } = together
    const providerUrl = useOpenRouter ? openrouterUrl : togetherUrl
    const selectedStandaloneQuestionModel = useOpenRouter
      ? "mistralai/mixtral-8x7b-instruct"
      : models.hackerGPT_standalone_question_together
    const providerHeaders = {
      Authorization: `Bearer ${useOpenRouter ? openrouterApiKey : togetherApiKey}`,
      "Content-Type": "application/json"
    }

    let rateLimitIdentifier
    if (chatSettings.model === GPT4.modelId) {
      rateLimitIdentifier = "gpt-4"
    } else if (chatSettings.model === MISTRAL_LARGE.modelId) {
      rateLimitIdentifier = "hackergpt-pro"
    } else {
      rateLimitIdentifier = "hackergpt"
    }

    const modelRateLimitCheck = await checkRateLimitWithoutIncrementing(
      profile.user_id,
      rateLimitIdentifier
    )

    if (!modelRateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          plugin: "None"
        }),
        { status: 429 }
      )
    }

    const cleanedMessages = (await buildFinalMessages(
      payload,
      profile,
      [],
      selectedPlugin
    )) as any[]

    filterEmptyAssistantMessages(cleanedMessages)
    const lastUserMessage = cleanedMessages[cleanedMessages.length - 1].content

    if (
      lastUserMessage.length < pinecone.messageLength.min ||
      lastUserMessage.length > pinecone.messageLength.max
    ) {
      return new Response(JSON.stringify({ plugin: "None" }), { status: 200 })
    }

    const detectedPlugin = await detectPlugin(
      cleanedMessages,
      lastUserMessage,
      providerUrl,
      providerHeaders,
      selectedStandaloneQuestionModel,
      availablePlugins,
      useAllPlugins
    )

    const isValidPlugin = availablePlugins.some(
      plugin => plugin.name.toLowerCase() === detectedPlugin.toLowerCase()
    )

    return new Response(
      JSON.stringify({ plugin: isValidPlugin ? detectedPlugin : "None" }),
      { status: 200 }
    )
  } catch (error: any) {
    return handleErrorResponse(error)
  }
}

async function detectPlugin(
  messages: BuiltChatMessage[],
  lastUserMessage: string,
  openRouterUrl: string | URL | Request,
  openRouterHeaders: any,
  selectedStandaloneQuestionModel: string | undefined,
  availablePlugins: any[],
  useAllPlugins: boolean
) {
  // Move to string type msg.content, if it's an array, concat the text and replace type image with [IMAGE]
  const cleanedMessages = cleanMessagesContent(messages)

  // Exclude the first and last message, and pick the last 3 messages
  const chatHistory = cleanedMessages.slice(1, -1).slice(-4)
  const pluginsInfo = getPluginsInfo(availablePlugins)
  const systemPrompt = llmConfig.systemPrompts.hackerGPT

  const template = generateTemplate(useAllPlugins, lastUserMessage, pluginsInfo)

  try {
    const messagesToSend = buildMessagesToSend(
      chatHistory,
      template,
      systemPrompt
    )

    const data = await callModel(
      selectedStandaloneQuestionModel || "",
      messagesToSend,
      openRouterUrl as string,
      openRouterHeaders
    )

    const aiResponse = data.choices?.[0]?.message?.content?.trim()

    const detectedPlugin = extractXML(aiResponse, "Plugin", "None")
    // const typeOfRequest = safeGetJSONValue(
    //   parsedResponse,
    //   "typeOfRequest",
    //   "other"
    // )
    // const isUserAskingAboutCVEs = safeGetJSONValue(
    //   parsedResponse,
    //   "isUserAskingAboutCVEs",
    //   false
    // )
    const censorshipNeeded = extractXML(aiResponse, "censorshipNeeded", "false")

    // console.log({
    //   aiResponse,
    //   detectedPlugin,
    //   // typeOfRequest,
    //   // isUserAskingAboutCVEs,
    //   censorshipNeeded
    // })

    return determinePlugin(
      detectedPlugin,
      // typeOfRequest,
      // isUserAskingAboutCVEs,
      censorshipNeeded,
      availablePlugins
    )
  } catch (error) {
    return "None"
  }
}

function cleanMessagesContent(messages: BuiltChatMessage[]) {
  return messages.map(msg => {
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content
          .map(content =>
            content.type === "image_url"
              ? "[IMAGE]"
              : content.text.substring(0, 1000) +
                (content.text.length > 1000 ? "..." : "")
          )
          .join("\n\n")
      }
    }
    return msg
  })
}

function generateTemplate(
  useAllPlugins: boolean,
  lastUserMessage: string,
  pluginsInfo: string
) {
  // return useAllPlugins
  //   ? endent`# Function-Calling Interpreter

  //   You are an expert function-calling interpreter. Your task is to analyze user queries and determine the most appropriate plugin to use within a chat environment. Follow these instructions carefully:

  //   # User Query:
  //   """${lastUserMessage}"""

  //   # Available Plugins
  //   ID|Priority|Description|Usage Scenarios
  //   ${pluginsInfo}

  //   ## Process
  //   1. Carefully read and interpret the user's query.
  //   2. Review the list of available plugins and their details.
  //   3. Use your reasoning skills to match the query with the most suitable plugin.
  //   4. Consider the need for censorship based on the query content.
  //   5. Categorize the type of request.
  //   6. Determine if the query is specifically about CVEs.

  //   ## Important Rules:
  //   - Match the user's query to the most appropriate plugin based on intent and context.
  //   - If the query is ambiguous or doesn't clearly align with a specific plugin, default to ID = None.
  //   - For inquiries specifically requesting detailed, actionable information on CVEs from the current year (2024), use cvemap to ensure access to the most updated CVE data, and respond with ID = cvemap.
  //   - For inquiries about CVEs from years other than 2024 or for theoretical or broad discussions on CVEs that do not trigger the cvemap plugin, respond with ID = None.
  //   - Use 'websearch' only in the following circumstances:
  //     - User is asking about current events or something that requires real-time information (weather, sports scores, etc.)
  //     - User is asking about some term you are totally unfamiliar with (it might be new)
  //     - User explicitly asks you to browse or provide links to references
  //   - If the user requests the plugin to run outside our cloud platform, respond with ID = None.
  //   - Opt for ID = None if unsure which plugin to choose.

  //   ## Type of Request
  //   Categorize the user query as:
  //   - Question: Starts with interrogatives (What, Which, How, Why, When, Where, Who) or phrases like "Could you", "Can you", etc.
  //   - Action: Begins with a verb, indicating a command.
  //   - Other: Anything that doesn't fit the categories above.

  //   # Output your response in the following JSON format:
  //   {
  //     "scratchPad": "Your concise, step-by-step reasoning for selecting the plugin and determining the need for censorship",
  //     "typeOfRequest": "Question/Action/Other",
  //     "plugin": "PluginName or None",
  //     "isUserAskingAboutCVEs": true/false,
  //     "censorshipNeeded": true/false
  //   }

  //   Ensure your scratchPad is concise yet comprehensive, explaining your thought process clearly.`
  return endent`# Function-Calling Interpreter
  
    You are an expert function-calling interpreter. Your task is to analyze user queries and determine the most appropriate plugin to use within a chat environment. Follow these instructions carefully:

    # User Query:
    """${lastUserMessage}"""

    # Available Plugins
    ID|Priority|Description|Usage Scenarios
    ${pluginsInfo}

    ## Process
    1. Carefully read and interpret the user's query.
    2. Review the list of available plugins and their details.
    3. Use your reasoning skills to match the query with the most suitable plugin.
    4. Consider the need for censorship based on the query content.

    ## Important Rules:
    - Match the user's query to the most appropriate plugin based on intent and context.
    - If the query is ambiguous or doesn't clearly align with a specific plugin, default to ID = None.
    - Use 'websearch' only in the following circumstances:
      - User is asking about current events or something that requires real-time information (weather, sports scores, etc.)
      - User explicitly asks you to browse or provide links to references
    - For the 'codellm' plugin:
      - Use ONLY for tasks that involve creating or modifying complete code scripts
      - DO NOT use for generating small code snippets, payloads, or security-related techniques
    - For the 'baseLLM' plugin:
      - Use for a wide range of tasks, including generating code snippets, providing explanations, and handling security-related queries
      - This plugin can handle most technical questions, including those about cybersecurity and programming
    - Apply censorship to sensitive topics including, but not limited to, hacking, unauthorized access, and misuse of AI technology. Censorship should also be applied to any content that potentially violates privacy or security regulations.
    
    # ALWAYS USE EXACT OUTPUT STRUCTURE:
    \`\`\`
    <ScratchPad>{Your concise, step-by-step reasoning for selecting the plugin and determining the need for censorship}</ScratchPad>
    <Plugin>{PluginName or none}</Plugin>
    <censorshipNeeded>{true/false}</censorshipNeeded>
    \`\`\`

    Ensure your scratchPad is concise yet comprehensive, explaining your thought process clearly.
  `
}

function getPluginsInfo(availablePlugins: any[]) {
  return availablePlugins
    .map(
      plugin =>
        `${plugin.name}|${plugin.priority}|${plugin.description}|${plugin.usageScenarios.join(
          "; "
        )}`
    )
    .join("\n")
}

function buildMessagesToSend(
  chatHistory: BuiltChatMessage[],
  template: string,
  systemPrompt: string
) {
  return [
    {
      role: "system",
      content: systemPrompt
    },
    ...chatHistory,
    {
      role: "user",
      content: template
    }
  ]
}

function extractXML(aiResponse: string, xmlTag: string, defaultValue: string) {
  const regex = new RegExp(
    `<${xmlTag.toLowerCase()}>(.*?)</${xmlTag.toLowerCase()}>`,
    "i"
  )
  const match = aiResponse.toLowerCase().match(regex)
  return match ? match[1].toLowerCase() : defaultValue
}

function determinePlugin(
  detectedPlugin: string,
  // typeOfRequest: string,
  // isUserAskingAboutCVEs: boolean,
  censorshipNeeded: string,
  availablePlugins: any[]
) {
  if (detectedPlugin === "codellm" && censorshipNeeded === "false") {
    return PluginID.CODE_LLM
  }

  if (detectedPlugin === "websearch") {
    return PluginID.WEB_SEARCH
  }

  // if (isUserAskingAboutCVEs && detectedPlugin === "cvemap") {
  //   return "cvemap"
  // }

  if (
    detectedPlugin === "none" ||
    // typeOfRequest !== "action" ||
    detectedPlugin === "basellm"
  ) {
    return "None"
  }

  return availablePlugins.some(
    plugin => plugin.name.toLowerCase() === detectedPlugin.toLowerCase()
  )
    ? detectedPlugin
    : "None"
}

async function callModel(
  modelStandaloneQuestion: string,
  messages: any,
  openRouterUrl: string,
  openRouterHeaders: any
): Promise<any> {
  const requestBody = {
    model: modelStandaloneQuestion,
    route: "fallback",
    messages,
    temperature: 0.1,
    max_tokens: 256,
    ...(modelStandaloneQuestion === "mistralai/mixtral-8x7b-instruct" && {
      providerRouting: {
        order: ["OctoAI"]
      }
    })
  }

  const res = await fetch(openRouterUrl, {
    method: "POST",
    headers: openRouterHeaders,
    body: JSON.stringify(requestBody)
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(
      `HTTP error! status: ${res.status}. Error Body: ${errorBody}`
    )
  }

  const data = await res.json()
  return data
}
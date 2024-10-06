import { input, confirm  } from '@inquirer/prompts';
import {OpenAI} from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam
} from "openai/resources";
import { World } from 'planck';

const world = new World();
const openai = new OpenAI();

const classifierSystemPrompt =
  `You are a classifier for prompts by user of a 2D Physics Engine. The user creates a configuration of objects with help from another assistant.  Your task is to determine if the user still wants help refining the configuration, or is ready to use the configuration.

Respond with "CONTINUE" in the former case and with "READY" in the latter. Do not use any other word in the output.`;

const physicsExpertSystemPrompt =
  `You are an assistant to a user of a 2D Physics Engine. You must help the user create a configuration of objects. To do that, you must understand 
1) the set of objects the user wants
2) the kind of object that each one is
3) the configuration parameters for each object according to its kind
4) the constraints that each object obeys
5) the constraints that link objects with one another

There can be a static ground. There can be two other kinds of objects: circles and rectangles. They both have a mass. They can be free or static.`;

interface HistoryItem {
  item: ChatCompletionMessageParam,
  tokens: number,
}

const history: HistoryItem[] = [];

const CONTEXT_TOKENS = 200; //a lot less than the allowed total number of tokens

function createContextOfLength(n: number): ChatCompletionMessageParam[] {
  let remainingTokens = CONTEXT_TOKENS;
  const messages: ChatCompletionMessageParam[] = [];
  let i = 0;
  while(n > 0 && i < history.length) {
    const historyItem = history[i];
    if(historyItem.tokens > remainingTokens) break;
    messages.push(historyItem.item);
    remainingTokens -= historyItem.tokens;
    if (historyItem.item.role === "user") {
      n--;
    }
  }

  return messages;
}

async function getOpenAiResponse(system: string, user: string, contextLength = 0) {
  let messages: ChatCompletionMessageParam[] = [{
    role: 'system',
    content: system,
  }];
  let contextOfLength = createContextOfLength(contextLength);
  // console.log(`Context of length ${contextLength}`, contextOfLength);
  if(contextOfLength.length) {
    messages = [...messages, ...contextOfLength];
  }
  let userMessage: ChatCompletionUserMessageParam = {
    role: 'user',
    content: user
  };
  messages.push(userMessage);
  // console.log('Messages', messages);
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  });
  return response.choices[0].message;
}

async function run() {
  console.log('Welcome to the experimental ChatGPT-Powered Knowledge Base');
  let contextLength = 0;
  do {
    try {
      const answer = await input({message: '>'});
      if (answer.toLowerCase() === 'bye' || answer.toLowerCase() === 'exit') break;
      let classifierResponse = await getOpenAiResponse(classifierSystemPrompt, answer, 0);
      console.log('Classifier responded:', classifierResponse.content);
      if(classifierResponse.content === 'READY') {
        console.log('.... use 3rd expert to create objects');
        continue;
      } //else 'CONTINUE'
      let response = await getOpenAiResponse(physicsExpertSystemPrompt, answer, contextLength);
      console.log(response.content);

      contextLength++;
    } catch (e) {
      console.error(e);
    }
  } while (true);
}

await run();






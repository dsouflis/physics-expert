import { input, confirm  } from '@inquirer/prompts';
import {OpenAI} from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionTool,
  ChatCompletionCreateParamsNonStreaming,
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

const toolUserExpertSystemPrompt =
  `You are an assistant to a user of a 2D Physics Engine. You must help the user create an object based on its description.  Use the supplied tools to assist the user.`;


const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_circle',
      description: 'Create a circle in the Physics Engine',
      parameters: {
        type: 'object',
        properties: {
          mass: {
            mass: 'number',
            description: 'The mass of the circle',
          },
          radius: {
            mass: 'number',
            description: 'The radius of the circle',
          },
          initial_position_x: {
            mass: 'number',
            description: 'The initial position of the circle in the X axis',
          },
          initial_position_y: {
            mass: 'number',
            description: 'The initial position of the circle in the Y axis',
          },
          initial_velocity_x: {
            mass: 'number',
            description: 'The initial velocity of the circle in the X axis',
          },
          initial_velocity_y: {
            mass: 'number',
            description: 'The initial velocity of the circle in the Y axis',
          },
          initial_angular_velocity: {
            mass: 'number',
            description: 'The initial angular velocity of the circle',
          },
        },
      },
    },
  }
];

interface HistoryItem {
  item: ChatCompletionMessageParam,
  tokens: number,
}

let history: HistoryItem[] = [];

const CONTEXT_TOKENS = 5000; //a lot less than the allowed total number of tokens

function createContextOfLength(n: number): ChatCompletionMessageParam[] {
  let remainingTokens = CONTEXT_TOKENS;
  let messages: ChatCompletionMessageParam[] = [];
  let i = 0;
  while(n > 0 && i < history.length) {
    const historyItem = history[i];
    if(historyItem.tokens > remainingTokens) break;
    messages = [historyItem.item, ...messages];
    remainingTokens -= historyItem.tokens;
    if (historyItem.item.role === "user") {
      n--;
    }
    i++;
  }

  return messages;
}

async function getOpenAiResponse(system: string, user: string, contextLength: number, tools: ChatCompletionTool[] | null = null) {
  let messages: ChatCompletionMessageParam[] = [{
    role: 'system',
    content: system,
  }];
  let contextOfLength = createContextOfLength(contextLength);
  console.log(`Context of length ${contextLength}`, contextOfLength);
  if(contextOfLength.length) {
    messages = [...messages, ...contextOfLength];
  }
  let userMessage: ChatCompletionUserMessageParam = {
    role: 'user',
    content: user
  };
  messages.push(userMessage);
  console.log('Messages', messages);
  let body:  ChatCompletionCreateParamsNonStreaming = {
    model: 'gpt-4o-mini',
    messages,
  };
  if(tools) {
    body.tools = tools;
  }
  const response = await openai.chat.completions.create(body);
  return response;
}

async function run() {
  console.log('Welcome to the experimental ChatGPT-Powered Physics Engine');
  let contextLength = 0;
  do {
    try {
      const userPrompt = await input({message: '>'});
      if (userPrompt.toLowerCase() === 'bye' || userPrompt.toLowerCase() === 'exit') break;
      let classifierResponse = await getOpenAiResponse(classifierSystemPrompt, userPrompt, 0);
      console.log('Classifier responded:', classifierResponse.choices[0].message.content);
      if(classifierResponse.choices[0].message.content === 'READY') {
        console.log('.... use 3rd expert to create objects');
        continue;
      } //else 'CONTINUE'
      let response = await getOpenAiResponse(physicsExpertSystemPrompt, userPrompt, contextLength);
      console.log(response.choices[0].message.content);
      let userMessage: ChatCompletionUserMessageParam = {
        role: 'user',
        content: userPrompt
      };
      history = [
        {
          item: response.choices[0].message,
          tokens: response.usage?.completion_tokens || 0,
        },
        {
          item: userMessage,
          tokens: response.usage?.prompt_tokens || 0,
        },
        ...history,
      ];
      contextLength++;
    } catch (e) {
      console.error(e);
    }
  } while (true);
}

await run();






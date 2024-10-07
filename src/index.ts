import {input} from '@inquirer/prompts';
import {OpenAI} from 'openai';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionUserMessageParam,
} from "openai/resources";
import {BodyDef, Circle, Polygon, Vec2, World} from 'planck';

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

There can be a static ground. There can be two other kinds of objects: circles and rectangles. They both have a mass. They can be free or immovable.

Respond with a rationale, and then the configuration for the objects in a plaintext block.
`;

const toolUserExpertSystemPrompt =
  `You are an assistant to a user of a 2D Physics Engine. You must help the user create objects based on their description.  Use the supplied tools to assist the user.`;

interface BasicObjectDef {
  name: string,
  immovable: boolean,
  mass: number,
  initial_position_x: number,
  initial_position_y: number,
  initial_velocity_x: number,
  initial_velocity_y: number,
  initial_angular_velocity: number,
}

interface CircleDef extends BasicObjectDef {
  radius: number,
}

interface RectangleDef extends BasicObjectDef {
  width: number,
  height: number,
}

const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_circle',
      description: 'Create a circle in the Physics Engine',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the object',
          },
          immovable: {
            type: 'boolean',
            description: 'If the object is immovable or free',
          },
          mass: {
            type: 'number',
            description: 'The mass of the circle',
          },
          radius: {
            type: 'number',
            description: 'The radius of the circle',
          },
          initial_position_x: {
            type: 'number',
            description: 'The initial position of the circle in the X axis',
          },
          initial_position_y: {
            type: 'number',
            description: 'The initial position of the circle in the Y axis',
          },
          initial_velocity_x: {
            type: 'number',
            description: 'The initial velocity of the circle in the X axis',
          },
          initial_velocity_y: {
            type: 'number',
            description: 'The initial velocity of the circle in the Y axis',
          },
          initial_angular_velocity: {
            type: 'number',
            description: 'The initial angular velocity of the circle',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_rectangle',
      description: 'Create a rectangle in the Physics Engine',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the object',
          },
          immovable: {
            type: 'boolean',
            description: 'If the object is immovable or free',
          },
          mass: {
            type: 'number',
            description: 'The mass of the object',
          },
          radius: {
            type: 'number',
            description: 'The radius of the object',
          },
          initial_position_x: {
            type: 'number',
            description: 'The initial position of the object in the X axis',
          },
          initial_position_y: {
            type: 'number',
            description: 'The initial position of the object in the Y axis',
          },
          width: {
            type: 'number',
            description: 'The width of the object',
          },
          height: {
            type: 'number',
            description: 'The height of the object',
          },
          initial_orientation: {
            type: 'number',
            description: 'The initial orientation of the object with respect to the X axis',
          },
          initial_velocity_x: {
            type: 'number',
            description: 'The initial velocity of the object in the X axis',
          },
          initial_velocity_y: {
            type: 'number',
            description: 'The initial velocity of the object in the Y axis',
          },
          initial_angular_velocity: {
            type: 'number',
            description: 'The initial angular velocity of the object',
          },
        },
      },
    },
  },
];

interface HistoryItem {
  item: ChatCompletionMessageParam & { content: string},
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

function plaintextExtractor(s: string): string | null {
  let lines= s.split('\n');
  let plaintext = null;
  let parsing = false;
  for (const line of lines) {
    const trimmedLine = line.trim();
    if(!parsing && line.startsWith('```')) {
      plaintext = '';
      parsing = true;
    } else if(parsing) {
      if(line.startsWith('```')) {
        parsing = false;
      } else {
        plaintext += line + '\n';
      }
    }
  }
  plaintext = plaintext?.trim();
  return plaintext === ''? null : plaintext ;
}

function parseObjects(lastConfiguration: string) {
  let lines = lastConfiguration.split('\n');
  const objects: { description: string }[] = [{ description: ''}];
  for (const line of lines) {
    if (line.length === 0) {
      objects.push({
        description: '',
      });
    } else {
      objects[objects.length - 1].description += line + '\n';
    }
  }

  return objects;
}

function runTool(toolCall: ChatCompletionMessageToolCall) {
  let functionArgs = JSON.parse(toolCall.function.arguments);
  switch (toolCall.function.name) {
    case 'create_rectangle': {
      const args: RectangleDef = functionArgs;
      const position = Vec2(
        args.initial_position_x,
        args.initial_position_y,
      );
      const center = Vec2(0, 0);
      const rectangle = new Polygon([
        Vec2(-args.width/2, args.height/2),
        Vec2(-args.width/2, -args.height/2),
        Vec2(args.width/2, -args.height/2),
        Vec2(args.width/2, args.height/2),
      ]);

      let bodyDef: BodyDef = {
        type: 'dynamic',
        position,
      };
      let body = world.createBody(bodyDef);
      let fixture = body.createFixture(rectangle);
      let massData = {mass: args.mass, center, I: 0};
      body.setMassData(massData);
      console.log('create_rectangle', args);
      console.log('shape=', rectangle);
      console.log('body=', bodyDef);
      console.log('massData=', massData);
    } break;
    case 'create_circle': {
      const args: CircleDef = functionArgs;
      const position = Vec2(
        args.initial_position_x,
        args.initial_position_y,
      );
      const center = Vec2(0, 0);
      const circle = new Circle(center, args.radius);

      let bodyDef: BodyDef = {
        type: 'dynamic',
        position,
      };
      let body = world.createBody(bodyDef);
      let fixture = body.createFixture(circle);
      let massData = {mass: args.mass, center, I: 0};
      body.setMassData(massData);
      console.log('create_circle', args);
      console.log('shape=', circle);
      console.log('body=', bodyDef);
      console.log('massData=', massData);
    } break;
    default: console.error(`Unknown function ${toolCall.function.name}`);
  }
}

async function runSimulation() {
  let lastConfiguration = history[0].item.content;
  const plaintext = plaintextExtractor(lastConfiguration);
  if (plaintext) {
    let completion = await getOpenAiResponse(toolUserExpertSystemPrompt, plaintext, 0, tools);
    // console.log(completion);
    if(completion.choices[0].finish_reason === 'tool_calls') {
      let toolCalls = completion.choices[0].message.tool_calls;
      for (const toolCall of toolCalls) {
        runTool(toolCall);
      }
    }
    // let objects = parseObjects(plaintext);
    // console.log(objects);
  }
}

async function run() {
  console.log('Welcome to the experimental ChatGPT-Powered Physics Engine');
  let contextLength = 0;
  do {
    try {
      const userPrompt = await input({message: '>'});
      if (userPrompt.toLowerCase() === 'bye' || userPrompt.toLowerCase() === 'exit') break;
      let classifierResponse = await getOpenAiResponse(classifierSystemPrompt, userPrompt, 0);
      // console.log('Classifier responded:', classifierResponse.choices[0].message.content);
      if(classifierResponse.choices[0].message.content === 'READY') {
        console.log('.... use 3rd expert to create objects');
        await runSimulation();
        continue;
      } //else 'CONTINUE'
      let response = await getOpenAiResponse(physicsExpertSystemPrompt, userPrompt, contextLength);
      console.log(response.choices[0].message.content);
      let userMessage: ChatCompletionUserMessageParam = {
        role: 'user',
        content: userPrompt
      };

      let assistantMessage: ChatCompletionMessageParam = {
        role: 'assistant',
        content: response.choices[0].message.content?.toString(),
      };
      history = [
        {
          item: assistantMessage,
          tokens: response.usage?.completion_tokens || 0,
        } as HistoryItem,
        {
          item: userMessage,
          tokens: response.usage?.prompt_tokens || 0,
        } as HistoryItem,
        ...history,
      ];
      contextLength++;
    } catch (e) {
      console.error(e);
    }
  } while (true);
}

await run();






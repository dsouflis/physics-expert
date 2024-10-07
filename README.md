# Physics Expert
Implementation of a Task-Oriented Dialog system with ChatGPT.

It combines three experts: 
1. a Physics expert that can help a user of a 2D Physics Engine to create a configuration
of objects to simulate a Physics problem.
2. a Tools expert that can transform the text description created by the Physics expert into `bodies` in the
Planck.js 2D physics engine, by calling "tools".
3. a Classifier that determines if the user should continue to interact with the Physics expert of if he wants
the Tools expert to be invoked.

## How to run

In order for the OpenAI API to be instantiated, one needs a `.env` file with the OpenAI key, like this:

```
OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Dialog State
In contrast with the kind of dialog implemented in a [previous experiment](https://github.com/dsouflis/cypher-expert),
there are now two user intents. The dialog follows the statemachine in the image.

![Dialog Statemachine](./dialog-statemachine.png)

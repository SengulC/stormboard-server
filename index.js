var express = require("express");
var cors = require("cors");
var OpenAI = require("openai");
var bodyParser = require("body-parser");

let first = true;
let firstCharChange = true;
let prevCharTone = null;

const key = process.env.VITE_OPENAI_KEY;
const openai = new OpenAI({
  apiKey: key
});

function extractNodesData (nodes) {
  let extractedNodes = [];
  for (let node of nodes) {
    extractedNodes.push({id: node.id, text: node.data.label});
  }
  return extractedNodes;
}

async function callCharChange(char) {
  if (char=='off') {
    const completion = await openai.chat.completions.create({
      messages: [{role: "user", content: 'Moving forward, respond in a natural tone. Respond now with just "Okay"'}],
      model: "gpt-4",
    }); // API USAGE
    console.log("CHARCHANGE OFF. Called gpt with : " + 'Moving forward, respond in a natural tone. Respond now with just "Okay"');
    console.log("Got back: " + JSON.stringify(completion.choices[0].message.content));
  } else if (firstCharChange || prevCharTone!=char) {
    firstCharChange = false;
    prevCharTone = char;
    let prePrompt = `You have been asked to change your tone. 
    You will be asked to either take on a Realistic or Abstract approach tone. 
    The Realistic tone's responses should be: straightforward, coherent, precise and realistic. 
    The Abstract tone's responses should be: descriptive, creative, a little random, and abstract in nature.`
    let prompt = `For following responses, change tone to ${char}.  Respond now with just "Okay"` 
    // `For now, respond with a VARIANT of the following JSON object: {preWhat: 'I am creating a', preWho: 'for', preWhere: 'to use in', preWhy: 'to'}, 
    // Make sure your tone matches the desired, ${char}, and is max 4 words for each.
    // `;
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prePrompt},
                 {role: "user", content: prompt}],
      model: "gpt-4",
    }); // API USAGE
    console.log("CHARCHANGE. Called gpt with : " + prompt);
    console.log("Got back: " + JSON.stringify(completion.choices[0].message.content));
    return completion.choices[0].message.content;
  }
}

async function callButtonPrompt(sourceLabels, targetLabels, prompt, input, brief, nodes, charTone) {
  let prePrompt;
  switch(prompt) {
    case 'opposite': 
      prePrompt = "Respond with a single sentence produc, beginning with 'a(n)'t idea (max 10 words). " +  "The brief is: " + brief + ". Make opposite: ";
      break;
    case 'summarize': 
      prePrompt = "Halve the word length of the following product idea, making more coherent. " +  ". Summarize: ";
      break;
    case 'expand': 
      prePrompt = "Respond with a single sentence product idea (max 10 words), beginning with 'a(n)'. " +  "The brief is: " + brief + ". Expand: ";
      break;
    case 'surprise': 
      prePrompt = "Respond with a single sentence product idea (max 10 words), beginning with 'a(n)'. " +  "The brief is: " + brief + ". Surprise me, drawing inspiration from: ";
      break;
    case 'merge': 
      prePrompt = "Respond with a single sentence product idea (max 10 words), beginning with 'a(n)'. " +  "The brief is: " + brief + ". Merge: ";
      break;
    case 'feed': 
      prePrompt = "Respond with a single sentence product idea (max 10 words), beginning with 'a(n)'. " +  "The brief is: " + brief + ". Feed: " + "'" + sourceLabels + "'" + " into " + "'" + targetLabels + "'";
      break;
    case 'regen': 
      prePrompt = "Respond with a single sentence product idea (max 10 words), beginning with 'a(n)'. " +  "The brief is: " + brief + ". Regenerate: ";
      break;
    case 'group': 
      let nodedata = extractNodesData(nodes);
      prePrompt = `GROUP ideas in association with one another. Given a list of the concepts (the idea itself in text and their unique ID), arrange them in groups that are most similar to one another. Respond with a list of lists (using square brackets) identifying the ideas via their unique IDs. 
      E.g. 
        [ 
          [ "c_xM2Z", "IOxNzE" ], 
          [ "R7AN_z" , "koPZrd" ],
          [ "5UZhRp" , "Ved8xX", "Q9tbOx" ] 
        ]` + JSON.stringify(nodedata);
      break;
    default:
      prePrompt = "Respond with a single sentence product idea (max 10 words), beginning with 'a(n)'. " +  "The brief is: " + brief + ". Come up with a random product idea: ";
      break;
  }

  let content;
  if (prompt!= 'feed') {
    content = prePrompt + " " + input;
  } else {
    content=prePrompt;
  }

  let sources = "";
  if (sourceLabels) {
    if (sourceLabels.length > 0) {
      sources = sourceLabels.join(". ");
      content += '. Remember to feed the following concepts into the output: ' + sources;
    }
  }

  if (charTone && charTone!='off') {
    let charDesc = {"realistic": "straightforward, coherent, precise and realistic", "abstract": "descriptive, creative, a little random, and abstract in nature"};
    content += '. Remember to have a ' + charDesc[charTone] + " tone."
  }

  // return content;

  // API usage
  const instruction = `You are a brainstorming assistant. You will be given a design brief and will be asked to assist with ideas in the given context. You will be asked to edit user-created ideas or create new ideas. These are how you will be asked to edit:

  - Expand; elaborate on the given idea, making sure to stay within the overall context.
  - Summarize; draw out core components of the given idea and express concisely.
  - Make Opposite; come up with an object or concept that is the polar opposite of the given idea.
  - Regenerate; rephrase the given idea.
  - Surprise; surprise the user with a random concept, drawing inspiration from the given idea. Make sure to stay within the context of the design brief.
  - Merge; given two ideas, semantically merge them to create a novel concept.
  - Feed; given a core idea, feed components of (a) child idea(s) into it.

  You will also be asked to GROUP ideas in association with one another. Given a list of the concepts (the idea itself in text and their unique ID), arrange them in groups that are most similar to one another. Respond with a list of lists (using square brackets) identifying the ideas via their unique IDs. 
  E.g. 
    [ 
      [ "c_xM2Z", "IOxNzE" ], 
      [ "R7AN_z" , "koPZrd" ],
      [ "5UZhRp" , "Ved8xX", "Q9tbOx" ] 
    ]

  Except for when you're asked to GROUP, respond in ONE sentence (max 20 words) outlining the product or concept ideea, and make sure to always stay within the context.
  Respond CONCISELY beginning with the word "a", e.g. "A wearable AI band that adapts and composes music based on the wearer's heart rate and mood.", "A compact, voice-controlled kitchen robot that cooks, cleans and also orders groceries based on your diet and budget preferences."

  The design brief is: ${brief}`

  if (first) {
    first = false;
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: instruction},
                 {role: "user", content: content}],
      model: "gpt-4",
    });
    console.log("Sent init instructions. Called gpt with brief: " + brief + ", and: " + content);
    console.log("Got back: " + JSON.stringify(completion.choices[0].message.content));
    return completion.choices[0];
  } else {
    const completion = await openai.chat.completions.create({
      messages: [{role: "user", content: content}],
      model: "gpt-4",
    });
    console.log("Called gpt with: " + content);
    console.log("Got back: " + JSON.stringify(completion.choices[0].message.content));
    return completion.choices[0];
  }
}

const app = express();
app.use(bodyParser.json());
const allowedOrigins = 'https://guai-client.vercel.app'
// const allowedOrigins = 'http://localhost:5173'
const corsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

app.post("/buttons", async (req, res) => {
  const sources = req.body.sourceLabels;
  const targets = req.body.targetLabels;
  const input = req.body.nodeLabel;
  const prompt = req.body.prompt;
  const brief = req.body.brief;
  const nodes = req.body.nodes;
  const charTone = req.body.charTone;
  let result;
  if (charTone) {
    /*result =*/ await callCharChange(charTone);
  }
  if (prompt) {
    result = await callButtonPrompt(sources, targets, prompt, input, brief, nodes, charTone);
    result = result.message.content; // UNCOMMENT ME FOR API USAGE
  }
  res.send(result);
});

const port = process.env.PORT || 8000;

// Landing Page
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}.`);
});